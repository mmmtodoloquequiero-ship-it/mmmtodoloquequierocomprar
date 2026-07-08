import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck, FileText, Check } from 'lucide-react';

export default function TerminosFiadoPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 p-6 sm:p-12 selection:bg-indigo-500/30">
      <div className="max-w-3xl mx-auto bg-slate-900/50 p-8 sm:p-12 rounded-[2.5rem] border border-white/5 shadow-2xl relative">
        <Link href="/" className="absolute top-8 left-8 text-slate-500 hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </Link>
        
        <div className="flex flex-col items-center mb-10 mt-8">
          <div className="w-16 h-16 bg-indigo-500/10 flex items-center justify-center rounded-2xl mb-4 border border-indigo-500/20">
            <ShieldCheck size={32} className="text-indigo-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black uppercase text-center text-white">Términos del Servicio de Fiado</h1>
          <p className="text-indigo-400 font-bold tracking-widest uppercase text-xs mt-2">Cuenta Corriente y Crédito Local</p>
          <p className="text-slate-500 text-xs mt-2">Última actualización: {new Date().toLocaleDateString('es-AR')}</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-slate-400">
          <p className="text-slate-300">
            El presente documento establece las condiciones que rigen el alta, uso y administración del servicio de Cuenta Corriente ("Fiado") ofrecido de forma autónoma por los comercios adheridos que operan bajo la plataforma tecnológica <strong>mmmTodoLoQueQuiero SaaS</strong>.
          </p>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-indigo-400">1.</span> Autorización y Consentimiento de Datos
            </h2>
            <p>
              Al enviar tu solicitud de alta en el sistema de fiados, autorizas de manera expresa e irrevocable al comercio y a la plataforma a:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Recopilar y almacenar de manera segura tus datos personales básicos: Nombre, Apellido, DNI (Documento Nacional de Identidad) y número telefónico de contacto (WhatsApp).</li>
              <li>Registrar y procesar tu historial de transacciones, compras acumuladas, montos adeudados y fechas de pago en la plataforma.</li>
              <li>Registrar tu dirección IP de conexión y huella digital del navegador (fingerprint) al momento de aceptar estos términos como firma digital equivalente.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-indigo-400">2.</span> Límite de Crédito y Evaluación ("Veraz de Barrio")
            </h2>
            <p>
              El límite máximo de crédito asignado para compras fiadas es determinado y ajustado discrecionalmente por la administración del local comercial. Aceptas que:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Tu historial de comportamiento de pago (puntualidad, saldos pendientes y cancelaciones) se utilizará para calcular automáticamente tu reputación de pago.</li>
              <li>Tu comportamiento de pago consolidado podrá ser compartido con la base de datos global de clientes de la plataforma. Si presentas deudas incobrables o moras severas en este u otros comercios de la red, tu perfil podrá ser marcado como "Deudor de Riesgo", lo que inhabilitará tu derecho a solicitar crédito en otros locales adheridos.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-indigo-400">3.</span> Regla de Vencimiento Mensual y Bloqueo de Cuenta
            </h2>
            <p>
              El sistema de Cuenta Corriente opera bajo un esquema mensual cerrado:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Todos los consumos y compras fiados realizados durante el mes calendario en curso deberán ser saldados por el cliente antes del <strong>día 1 del mes siguiente</strong>.</li>
              <li>De no regularizarse la totalidad de la deuda acumulada del periodo vencido para el día 1, el sistema procederá a un <strong>bloqueo informático automático</strong> de tu cuenta.</li>
              <li>Mientras persista el bloqueo, no podrás realizar nuevas compras bajo la modalidad de fiado en el local bajo ninguna circunstancia, debiendo cancelar tus compras al contado (Efectivo/Mercado Pago) hasta regularizar el saldo pendiente.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-indigo-400">4.</span> Declaración Jurada de Veracidad
            </h2>
            <p>
              Declaras bajo juramento que los datos identificatorios (DNI, Teléfono, Nombre) que has suministrado en la solicitud son verdaderos, vigentes y te pertenecen. El uso de identidades falsas, DNI de terceros sin autorización o información fraudulenta con la finalidad de obtener crédito local constituye una infracción y el local podrá iniciar las acciones legales y denuncias pertinentes, además del bloqueo inmediato de tu acceso.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="text-indigo-400">5.</span> Firma Electrónica
            </h2>
            <p>
              Aceptas que la validación electrónica realizada al marcar la casilla de aceptación de términos y presionar "Enviar Solicitud" (asociando tu número de DNI verificado, WhatsApp, dirección IP y fingerprint de dispositivo) constituye una manifestación de voluntad equivalente y equiparable a una firma holográfica (manuscrita) de conformidad con las normativas locales de firma digital y comercio electrónico.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <p className="text-slate-500 text-xs">Si tienes dudas sobre las condiciones de tu cuenta corriente, consúltalo con el encargado del local.</p>
          <div className="flex justify-center mt-6">
            <Link href="/">
              <span className="cursor-pointer px-8 py-3 bg-indigo-650 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center gap-2 shadow-lg shadow-indigo-650/20">
                <Check size={16} /> Entendido, Volver
              </span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
