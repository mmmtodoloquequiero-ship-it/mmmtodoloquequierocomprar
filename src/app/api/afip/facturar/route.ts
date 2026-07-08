import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Afip from '@afipsdk/afip.js';
import fs from 'fs';
import path from 'path';

// Cliente de Supabase con Service Role Key para operaciones administrativas y saltarse el RLS
// Si no está definida la Service Role Key, usamos la Anon Key como fallback para testing local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, tenantId, tipoComprobante, docTipo, docNro } = body;

    if (!orderId || !tenantId) {
      return NextResponse.json({ error: 'Faltan campos obligatorios: orderId y tenantId' }, { status: 400 });
    }

    console.log(`[AFIP] Iniciando facturación para Pedido: ${orderId}, Local: ${tenantId}`);

    // 1. Obtener la configuración fiscal del tenant
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (tenantError || !tenant) {
      console.error('[AFIP] Error al obtener el local:', tenantError);
      return NextResponse.json({ error: 'No se encontró la configuración del local (Tenant)' }, { status: 404 });
    }

    // El CUIT del local. Para homologación usamos el CUIT de pruebas.
    // Si no está configurado, usamos un CUIT genérico de pruebas de AFIP
    const cuit = tenant.afip_cuit ? tenant.afip_cuit.replace(/-/g, '') : '20346582201';
    const ptoVta = tenant.afip_punto_venta || 1;
    const isSandbox = tenant.afip_is_sandbox !== false; // Por defecto true (homologación)

    // 2. Obtener los certificados (CRT y KEY)
    let certContent = '';
    let keyContent = '';

    // ESTRATEGIA DE LECTURA DE CERTIFICADOS:
    // A. Buscar localmente en la raíz del proyecto si estamos en desarrollo (para pruebas fáciles)
    const localCertPath = path.join(process.cwd(), 'afip_certificado.crt');
    const localKeyPath = path.join(process.cwd(), 'afip_privada.key');

    if (fs.existsSync(localCertPath) && fs.existsSync(localKeyPath)) {
      console.log('[AFIP] Cargando certificados de desarrollo locales desde la raíz del proyecto');
      certContent = fs.readFileSync(localCertPath, 'utf8');
      keyContent = fs.readFileSync(localKeyPath, 'utf8');
    } else {
      // B. En producción, los descargamos desde el storage privado de Supabase
      console.log('[AFIP] Intentando descargar certificados desde Supabase Storage');
      
      if (!tenant.afip_cert_path || !tenant.afip_key_path) {
        return NextResponse.json({ 
          error: 'No se han configurado los certificados de AFIP. Súbelos en el Panel de Administrador.' 
        }, { status: 400 });
      }

      // Descargar CRT
      const { data: certData, error: certDownloadError } = await supabaseAdmin.storage
        .from('afip-certificates')
        .download(tenant.afip_cert_path);

      if (certDownloadError || !certData) {
        console.error('[AFIP] Error al descargar .crt del storage:', certDownloadError);
        return NextResponse.json({ error: 'Error al obtener el certificado .crt del almacenamiento seguro.' }, { status: 500 });
      }
      certContent = await certData.text();

      // Descargar KEY
      const { data: keyData, error: keyDownloadError } = await supabaseAdmin.storage
        .from('afip-certificates')
        .download(tenant.afip_key_path);

      if (keyDownloadError || !keyData) {
        console.error('[AFIP] Error al descargar .key del storage:', keyDownloadError);
        return NextResponse.json({ error: 'Error al obtener la clave privada .key del almacenamiento seguro.' }, { status: 500 });
      }
      keyContent = await keyData.text();
    }

    // 3. Obtener los datos del Pedido
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('[AFIP] Error al obtener el pedido:', orderError);
      return NextResponse.json({ error: 'No se encontró el pedido a facturar' }, { status: 404 });
    }

    if (order.afip_cae) {
      return NextResponse.json({ 
        success: true, 
        message: 'Este pedido ya está facturado ante AFIP', 
        cae: order.afip_cae, 
        voucherNumber: order.afip_numero_comprobante 
      });
    }

    // Total a facturar
    const totalAmount = Math.round(order.total_price || 0);
    if (totalAmount <= 0) {
      return NextResponse.json({ error: 'El monto total del pedido debe ser mayor a $0 para facturar.' }, { status: 400 });
    }

    // 4. Escribir certificados en /tmp (requerido por afip.js 0.7.11 en Serverless/Vercel)
    const os = require('os');
    const tmpDir = os.tmpdir();
    const certPath = path.join(tmpDir, `afip_cert_${tenantId}.crt`);
    const keyPath = path.join(tmpDir, `afip_key_${tenantId}.key`);

    fs.writeFileSync(certPath, certContent, 'utf8');
    fs.writeFileSync(keyPath, keyContent, 'utf8');

    console.log('[AFIP] Inicializando SDK local (v0.7.11) sin API Gateway...');
    const afip = new Afip({
      CUIT: parseInt(cuit),
      res_folder: tmpDir,
      ta_folder: tmpDir,
      cert: `afip_cert_${tenantId}.crt`,
      key: `afip_key_${tenantId}.key`,
      production: !isSandbox
    });

    // 5. Determinar el Tipo de Comprobante (por defecto 11 = Factura C para monotributistas, o 6 = Factura B para Consumidor Final)
    // 11 = Factura C (Común para Monotributistas)
    // 6  = Factura B (Común para Responsables Inscriptos a Consumidor Final)
    // 1  = Factura A (Responsable Inscripto a Responsable Inscripto)
    let selectedCbteTipo = tipoComprobante;
    if (!selectedCbteTipo) {
      selectedCbteTipo = tenant.afip_condicion_iva && tenant.afip_condicion_iva.toLowerCase().includes('monotribut') ? 11 : 6;
    }

    // 6. Obtener el próximo número de factura disponible en AFIP
    console.log(`[AFIP] Obteniendo el último comprobante para Tipo: ${selectedCbteTipo}, PtoVta: ${ptoVta}...`);
    let lastVoucher = 0;
    try {
      lastVoucher = await afip.ElectronicBilling.getLastVoucher(ptoVta, selectedCbteTipo);
    } catch (err: any) {
      console.warn('[AFIP] No se pudo obtener el último comprobante, asumiendo 0:', err.message);
      lastVoucher = 0;
    }
    const nextVoucher = lastVoucher + 1;

    // 7. Preparar la fecha del comprobante en formato AAAAMMDD (Ej: 20260530)
    const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '');

    // 8. Armar los importes (Para Factura B o C simplificada)
    // Concepto: 1 = Productos, 2 = Servicios, 3 = Productos y Servicios. Usamos 1 (Productos).
    let impNeto = totalAmount;
    let impIva = 0;
    let ivaData: any[] = [];

    // Si es Factura A o B de Responsable Inscripto, el IVA DEBE venir discriminado en el WS.
    // Para simplificar, si es Factura C (Monotributo) no lleva IVA desglosado (IVA 0% / Exento).
    if (selectedCbteTipo === 1 || selectedCbteTipo === 6) {
      // Separamos el IVA del 21% incluido en el total
      const neto = totalAmount / 1.21;
      impIva = Math.round((totalAmount - neto) * 100) / 100;
      impNeto = Math.round(neto * 100) / 100;
      
      // Ajustar posibles diferencias de redondeo asegurando que neto + iva = total
      impNeto = Math.round((totalAmount - impIva) * 100) / 100;

      ivaData = [
        {
          Id: 5, // 5 = Alícuota de IVA del 21%
          BaseImp: impNeto,
          Importe: impIva
        }
      ];
    }

    // 9. Configurar tipo y número de documento del comprador, y su condición frente al IVA
    // Si no se especifica, por defecto es Consumidor Final (DocTipo: 99, DocNro: 0, CondicionIVAReceptorId: 5)
    const compradorDocTipo = docTipo || 99;
    const compradorDocNro = docNro || 0;
    
    // Determinamos la CondicionIVAReceptorId obligatoria (RG 5616):
    // 5 = Consumidor Final (por defecto para Factura B o C a público general)
    // 1 = Responsable Inscripto (si es Factura A y tiene CUIT)
    // 6 = Responsable Monotributo (si tiene CUIT pero no se hace Factura A)
    let condicionIvaReceptorId = 5; // Consumidor Final
    if (compradorDocTipo === 80) { // Si se identificó con CUIT
      if (selectedCbteTipo === 1) {
        condicionIvaReceptorId = 1; // IVA Responsable Inscripto (Factura A)
      } else {
        condicionIvaReceptorId = 6; // Responsable Monotributo (Factura B o C con CUIT)
      }
    }

    const invoiceData: any = {
      CantReg: 1, // Registrar 1 factura
      PtoVta: ptoVta,
      CbteTipo: selectedCbteTipo,
      Concepto: 1, // 1: Productos
      DocTipo: compradorDocTipo,
      DocNro: compradorDocNro,
      CondicionIVAReceptorId: condicionIvaReceptorId, // RG 5616 obligatoria
      CbteDesde: nextVoucher,
      CbteHasta: nextVoucher,
      CbteFch: parseInt(todayStr),
      ImpTotal: totalAmount,
      ImpTotConc: 0,
      ImpNeto: impNeto,
      ImpOpEx: 0,
      ImpIVA: impIva,
      ImpTrib: 0,
      MonId: 'PES',
      MonCotiz: 1
    };

    if (ivaData.length > 0) {
      invoiceData.Iva = ivaData;
    }

    console.log('[AFIP] Enviando datos de facturación a AFIP/ARCA:', invoiceData);

    // 10. Crear la factura ante AFIP
    const result = await afip.ElectronicBilling.createVoucher(invoiceData);

    console.log('[AFIP] Factura autorizada exitosamente!', result);

    const cae = result.CAE;
    const caeFchVto = result.CAEFchVto; // Fecha de vencimiento en formato AAAAMMDD

    // Convertir la fecha de vencimiento a formato ISO
    let formattedVencimiento = null;
    if (caeFchVto) {
      try {
        if (caeFchVto.includes('-')) {
          // Si ya viene con guiones (YYYY-MM-DD)
          formattedVencimiento = new Date(`${caeFchVto}T23:59:59Z`).toISOString();
        } else if (caeFchVto.length === 8) {
          // Si viene pegado (YYYYMMDD)
          const year = caeFchVto.substring(0, 4);
          const month = caeFchVto.substring(4, 6);
          const day = caeFchVto.substring(6, 8);
          formattedVencimiento = new Date(`${year}-${month}-${day}T23:59:59Z`).toISOString();
        } else {
          // Fallback genérico
          formattedVencimiento = new Date(caeFchVto).toISOString();
        }
      } catch (e) {
        console.warn('[AFIP] No se pudo parsear CAEFchVto:', caeFchVto);
        formattedVencimiento = new Date().toISOString(); // Fallback preventivo
      }
    }

    // 11. Guardar los datos de AFIP en la orden en Supabase
    // Como usamos la clave anon localmente, debemos inyectar el tenant_id en los headers para pasar el RLS
    const localSupabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          'x-tenant-id': tenantId
        }
      }
    });

    const { error: updateError } = await localSupabase
      .from('orders')
      .update({
        afip_cae: cae,
        afip_cae_vencimiento: formattedVencimiento,
        afip_tipo_comprobante: selectedCbteTipo,
        afip_punto_venta: ptoVta,
        afip_numero_comprobante: nextVoucher,
        afip_facturado_at: new Date().toISOString(),
        afip_doc_tipo: docTipo,
        afip_doc_nro: String(docNro),
        afip_error: null
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('[AFIP] Error al actualizar la orden con los datos de AFIP:', updateError);
      return NextResponse.json({ 
        success: false, 
        error: `Factura creada en AFIP (CAE: ${cae}), pero error en BD local: ${updateError.message}`
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Factura electrónica autorizada con éxito',
      cae,
      caeVencimiento: formattedVencimiento,
      voucherNumber: nextVoucher,
      ptoVta,
      tipoComprobante: selectedCbteTipo
    });

  } catch (error: any) {
    console.error('[AFIP] Error catastrófico en la facturación:', error);
    
    // Si conocemos el orderId, guardamos el error en la orden para que el cajero sepa qué falló
    try {
      const body = await req.clone().json();
      if (body.orderId) {
        await supabaseAdmin
          .from('orders')
          .update({ afip_error: error.message || 'Error desconocido al facturar' })
          .eq('id', body.orderId);
      }
    } catch (dbErr) {
      console.error('[AFIP] No se pudo guardar el mensaje de error en la base de datos:', dbErr);
    }

    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Error interno del servidor en el módulo AFIP' 
    }, { status: 500 });
  }
}
