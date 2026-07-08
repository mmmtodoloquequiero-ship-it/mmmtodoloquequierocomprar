# Checklist Interactiva de Trabajo: Menús del Cliente, Envíos, Cobros y Balance Diario

El Constructor debe marcar cada tarea con una `[x]` cuando esté completamente programada, verificada y sin errores. El Supervisor revisará el código y auditará los cambios para asegurar el cumplimiento exacto del plan y la ausencia de regresiones.

---

## 🗄️ Fase 1: Configuración del Local en Ajustes (`AdminTab.tsx`) y Seguridad
- [x] **Habilitar el almacenamiento robusto en Supabase:**
  - [x] Ejecutar en Supabase el script SQL de migración.
- [x] **Sincronización Automática de Envíos y Rol de Despacho:**
  - [x] Al activar/desactivar envíos en ajustes, habilitar/deshabilitar el rol `'delivery'` automáticamente.
- [x] **Implementar políticas de seguridad para las credenciales:**
  - [x] Omitir `mercadopago_access_token` en consultas públicas del cliente.
- [x] **Actualizar la persistencia en base de datos (`handleSaveConfig`):**
  - [x] Persistir las nuevas columnas con éxito.

---

## 📱 Fase 2: Checkout del Cliente, Envíos, Identificación y Google Maps (`PublicMenu.tsx`)
- [x] **Selector de Tipo de Entrega en el checkout del carrito:**
  - [x] Selección fluida entre Retiro y Envío (con mapa interactivo y coordenadas).
- [x] **Método de Pago e Integración de Pasarela:**
  - [x] Modal interactivo premium de simulación de Mercado Pago y guardado de `payment_status` e `is_approved_for_production`.
- [x] **Pantalla de Confirmación de Pedido (Número de Orden):**
  - [x] Número de orden gigante animado en checkout exitoso.

---

## 💰 Fase 3: Aprobación, Cobro Cruzado, Doble Pestaña y Flujos Operativos Estrictos (`OrderTab.tsx` / `WaiterTab.tsx`)
- [x] **Implementar la Doble Pestaña de Control en Caja (`deliveries`):**
  - [x] Pestañas "Pendientes" y "Completados" operativas con animaciones y contador.
- [x] **Trazabilidad 360 y Control de Entrega Física por Roles:**
  - [x] Servido/Entregado limitado por roles (Caja para llevar, Mozos salón, Repartidores delivery).
- [x] **Búsqueda Reactiva en Tiempo Real en ambas pestañas:**
  - [x] Búsqueda por número, nombre o celular instantánea.
- [x] **Resaltado y Aprobación de pedidos en Efectivo Pendiente:**
  - [x] Comandas en rojo brillante con botón para enviar a producción.
- [x] **Notificación de Pago Pendiente en Cocina y Barra:**
  - [x] Alertas llamativas `"PAGO PENDIENTE"` en los paneles de cocina y barra.
- [x] **Añadir la opción de Cobro Cruzado para el Cajero:**
  - [x] Selector dinámico en Caja para consolidar pago en Efectivo, Débito o Crédito.
- [x] **Implementar Módulo de Notificaciones SMS / WhatsApp Automatizadas:**
  - [x] Emisión de alertas automáticas al cambiar el estado del pedido a `'delivered'` (Listo).
- [x] **Restricción de Flujo de Despacho en Caja:**
  - [x] Botón deshabilitado hasta preparación completa, entrega del mozo o del cajero.
- [x] **Auto-cierre Inteligente de Pedidos Pagados:**
  - [x] Cierre automático al marcar el último plato servido para salón (mozo con liberación de mesa) y para llevar (caja).
- [x] **Corrección Crítica del Smart Splitter en Caja (`OrderTab.tsx`):**
  - [x] Implementar la división atómica de combos (Hamburguesa + Bebida) en Caja en múltiples ítems de orden independientes.
  - [x] Asignar precio unitario `$0` a los ítems secundarios para no alterar la facturación global de la orden.
  - [x] Mapear de forma precisa el desglose de insumos en `notes` para Cocina y Barra.

---

## 🚚 Fase 4: Pantalla Operativa de Reparto y Despacho (`DeliveryTab.tsx`)
- [x] **Habilitación Automática de la Pestaña de Envíos:**
  - [x] Activación inteligente según configuración del local.
- [x] **Rediseñar la Interfaz para los Repartidores:**
  - [x] Datos de envío en grande y en cabecera (Maps, teléfono, WhatsApp) y productos abajo de forma secundaria.

---

## 📊 Fase 5: Corrección de Ventas de Hoy y Balance en Administrador (`AdminTab.tsx`)
- [x] **Modificar el filtro `filteredOrders` en `AdminTab.tsx`:**
  - [x] Remover la exclusión de comandas archivadas (`if (o.is_archived) return false;`).
  - [x] Implementar el filtro exacto basado en el día calendario de hoy local (de `00:00:00` a `23:59:59`), asegurando que todos los pedidos creados hoy aparezcan en la pestaña diaria.
  - [x] Ajustar el período de semana (`salesPeriod === 'weekly'`) para que use los últimos 7 días calendario local completos.
- [x] **Validación de Cierre de Caja:**
  - [x] Verificar que el cierre de caja (`handleCloseBox`) siga operando con total éxito y no interfiera con el reporte de la jornada.

---

## 🧪 Fase 6: Pruebas, Compilación y Verificación Final
- [x] **Validar la compilación del proyecto:**
  - [x] Ejecutar `npm run build` en el workspace local para confirmar que compile con éxito al 100% libre de fallas de TypeScript o dependencias.
  - [x] Actualizar el archivo `walkthrough.md` documentando la solución del bug del balance diario y el control de flujos operativos.
