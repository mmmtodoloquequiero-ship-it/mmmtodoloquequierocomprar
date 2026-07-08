import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 p-6 sm:p-12 selection:bg-amber-500/30">
      <div className="max-w-4xl mx-auto bg-slate-900/50 p-8 sm:p-12 rounded-[2.5rem] border border-white/5 shadow-2xl relative">
        <Link href="/" className="absolute top-8 left-8 text-slate-500 hover:text-white transition-colors">
          <ArrowLeft size={24} />
        </Link>
        
        <div className="flex flex-col items-center mb-10 mt-8">
          <div className="w-16 h-16 bg-amber-500/10 flex items-center justify-center rounded-2xl mb-4 border border-amber-500/20">
            <ShieldCheck size={32} className="text-amber-500" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black italic text-white text-center">Condiciones del Servicio</h1>
          <p className="text-amber-500 font-bold tracking-widest uppercase text-xs mt-2">mmmTodoLoQueQuiero SaaS</p>
          <p className="text-slate-500 text-xs mt-2">Última actualización: {new Date().toLocaleDateString('es-AR')}</p>
        </div>

        <div className="space-y-8 text-sm sm:text-base leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><span className="text-amber-500">1.</span> Aceptación de los Términos</h2>
            <p>Al acceder, registrarse y utilizar la plataforma de software como servicio (SaaS) "mmmTodoLoQueQuiero" (en adelante, "el Servicio", "la Plataforma" o "la Aplicación"), el usuario ("Cliente", "Restaurante", o "Titular del Local") acepta someterse a estos Términos y Condiciones de Servicio. Si no está de acuerdo con estos términos, no debe utilizar la Plataforma.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><span className="text-amber-500">2.</span> Descripción del Servicio</h2>
            <p>mmmTodoLoQueQuiero proporciona un sistema de gestión integral para locales gastronómicos, que incluye, entre otros, módulos para el control de caja, toma de pedidos, gestión de cocina (KDS), despachos/delivery, menú digital público (QR), reservas y administración multi-usuario (roles). El Servicio se provee "tal cual" y según disponibilidad, pudiendo sufrir actualizaciones continuas.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><span className="text-amber-500">3.</span> Cuentas y Responsabilidades del Local</h2>
            <ul className="list-disc pl-5 space-y-2 text-slate-400">
              <li>El usuario registrado como Administrador asume la responsabilidad total de todas las actividades que ocurran bajo su cuenta y subcuentas (roles de personal).</li>
              <li>El Cliente es responsable de mantener la confidencialidad de sus contraseñas por rol (Administrador, Caja, Cocina, Despacho).</li>
              <li>La información del local proporcionada debe ser veraz, exacta y mantenerse actualizada.</li>
              <li>El Cliente garantiza que cuenta con todos los permisos, habilitaciones bromatológicas y fiscales necesarios para operar su negocio comercialmente.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><span className="text-amber-500">4.</span> Integraciones y Pasarelas de Pago</h2>
            <p>La plataforma puede ofrecer integraciones de terceros (ej: Mercado Pago para cobros, APIs de facturación electrónica o plataformas de delivery). Al utilizar estas herramientas, el Cliente acepta también los Términos y Condiciones de dichos proveedores. mmmTodoLoQueQuiero no se responsabiliza por fallas, retenciones de fondos, o interrupciones propias de los servicios de terceros.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><span className="text-amber-500">5.</span> Planes, Suscripciones y Pagos</h2>
            <p>El uso del Servicio puede estar sujeto al pago de una suscripción mensual, anual o comisiones por transacción, según el plan seleccionado al momento del registro o posterior actualización. La falta de pago en tiempo y forma habilitará a mmmTodoLoQueQuiero a suspender temporalmente o cancelar de manera definitiva el acceso al sistema, previo aviso al correo registrado.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><span className="text-amber-500">6.</span> Propiedad Intelectual</h2>
            <p>Todo el código, diseño, bases de datos, algoritmos, y componentes de la Plataforma son propiedad exclusiva de mmmTodoLoQueQuiero y sus creadores. Se le otorga al Cliente una licencia de uso revocable, no exclusiva e intransferible. Está prohibida la copia, ingeniería inversa o reventa del software.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><span className="text-amber-500">7.</span> Limitación de Responsabilidad</h2>
            <p>mmmTodoLoQueQuiero no será responsable de ningún lucro cesante, pérdida de ingresos, pérdida de datos, daño incidental, indirecto o punitivo derivado del uso o de la imposibilidad de uso del software. Es obligación del Cliente realizar verificaciones periódicas de sus reportes de ventas diarios y respaldos de su información.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2"><span className="text-amber-500">8.</span> Modificaciones a los Términos</h2>
            <p>Nos reservamos el derecho de modificar estos Términos y Condiciones en cualquier momento. Los cambios significativos serán notificados a los administradores a través del panel principal del SaaS o vía correo electrónico.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-white/10 text-center">
          <p className="text-slate-500 text-sm">Si tienes alguna consulta sobre estas Condiciones, contáctanos a soporte@mmmtodoloquequiero.com.ar</p>
          <Link href="/">
            <button className="mt-6 px-8 py-3 bg-slate-800 hover:bg-amber-500 text-white font-bold rounded-xl transition-colors">
              Volver al inicio
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
