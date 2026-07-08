import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Lock } from 'lucide-react';

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 p-6 sm:p-12 selection:bg-amber-500/30">
      <div className="max-w-4xl mx-auto bg-slate-900/50 p-8 sm:p-12 rounded-[2.5rem] border border-white/5 shadow-2xl relative">
        <Link href="/" className="absolute top-8 left-8 text-slate-500 hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </Link>
        
        <div className="flex flex-col items-center mb-10 mt-8">
          <div className="w-16 h-16 bg-blue-500/10 flex items-center justify-center rounded-2xl mb-4 border border-blue-500/20">
            <Lock size={32} className="text-blue-500" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black italic text-white text-center">Políticas de Privacidad</h1>
          <p className="text-blue-500 font-bold tracking-widest uppercase text-xs mt-2">mmmTodoLoQueQuiero SaaS</p>
          <p className="text-slate-500 text-xs mt-2">Última actualización: {new Date().toLocaleDateString('es-AR')}</p>
        </div>

        <div className="space-y-8 text-sm sm:text-base leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><span className="text-blue-500">1.</span> Introducción</h2>
            <p>En "mmmTodoLoQueQuiero", valoramos y respetamos tu privacidad. Esta Política de Privacidad describe cómo recopilamos, utilizamos, almacenamos y compartimos la información personal cuando te registras como local gastronómico (Cliente) y cuando tus consumidores interactúan con el menú público.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><span className="text-blue-500">2.</span> Información que Recopilamos</h2>
            <p>Recopilamos los siguientes tipos de información:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2 text-slate-400">
              <li><strong>Datos de la Cuenta del Restaurante:</strong> Nombre comercial, correo electrónico de registro, datos de facturación e identificadores fiscales.</li>
              <li><strong>Datos Operativos:</strong> El catálogo de productos, precios, stock, ventas, tickets y contraseñas de los diferentes roles (almacenadas de forma cifrada).</li>
              <li><strong>Datos de Clientes Finales (Comensales):</strong> Al realizar pedidos vía menú QR, el restaurante podría recopilar el nombre, teléfono o dirección (para delivery) de sus clientes. mmmTodoLoQueQuiero actúa únicamente como <em>procesador</em> de estos datos por encargo del Restaurante, quien es el <em>responsable principal</em>.</li>
              <li><strong>Datos Técnicos:</strong> Información del dispositivo, direcciones IP, y datos de uso de la plataforma mediante cookies o analíticas locales para mejorar la seguridad y la experiencia del sistema.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><span className="text-blue-500">3.</span> Uso de la Información</h2>
            <p>La información recopilada se utiliza exclusivamente para:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2 text-slate-400">
              <li>Proveer, mantener y mejorar las funcionalidades del SaaS gastronómico.</li>
              <li>Procesar autenticaciones y gestionar la seguridad de las cuentas por rol.</li>
              <li>Enviar comunicaciones administrativas (facturas, notificaciones de mantenimiento, alertas del sistema).</li>
              <li>Generar reportes estadísticos anónimos sobre el rendimiento comercial de la plataforma general.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><span className="text-blue-500">4.</span> Compartición de la Información</h2>
            <p>No vendemos ni comercializamos tus datos personales. Sin embargo, podríamos compartir datos técnicos de manera estricta y bajo confidencialidad con:</p>
            <ul className="list-disc pl-5 mt-2 space-y-2 text-slate-400">
              <li><strong>Proveedores de Servicios e Infraestructura:</strong> Empresas de alojamiento web (AWS, Vercel), bases de datos (Supabase) y pasarelas de pago (Mercado Pago).</li>
              <li><strong>Autoridades Legales:</strong> Únicamente en caso de ser requerido por una orden judicial o requisito fiscal legalmente vinculante.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><span className="text-blue-500">5.</span> Protección y Retención de Datos</h2>
            <p>Implementamos medidas de seguridad estándar de la industria (como encriptación SSL/TLS, bases de datos aseguradas, RLS) para proteger la información contra accesos no autorizados. Los datos de transacciones se conservan durante el tiempo que la cuenta del Restaurante esté activa o según lo requiera la normativa fiscal local. Tras la cancelación de la suscripción, los datos pueden ser eliminados en un plazo de 60 días tras solicitud expresa.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><span className="text-blue-500">6.</span> Derechos del Usuario</h2>
            <p>Como usuario titular de la cuenta del restaurante, tienes derecho a acceder, rectificar, exportar y solicitar la eliminación de tus datos en cualquier momento a través del panel de administración o contactando a nuestro equipo de soporte, en cumplimiento con la normativa de protección de datos aplicable.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <p className="text-slate-500 text-sm">Para reclamos de privacidad o consultas, escríbenos a privacidad@mmmtodoloquequiero.com.ar</p>
          <Link href="/">
            <button className="mt-6 px-8 py-3 bg-slate-800 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors">
              Volver al inicio
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
