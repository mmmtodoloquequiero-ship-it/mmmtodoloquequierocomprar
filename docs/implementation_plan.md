# Plan de Implementación: Reestructuración de Menús, Envíos, Cobros Dinámicos, Control de Flujo de Despacho y Smart Splitter en Caja

Este plan detalla la reestructuración completa del flujo operativo, la solución al bug de balance de administrador, el estricto control de flujo de despacho en Caja, y la **corrección crítica del Smart Splitter en Caja** para asegurar que los combos (Hamburguesa + Bebida) se dividan correctamente y sus componentes se envíen de inmediato a los departamentos de Cocina y Barra de forma atómica.

> [!IMPORTANT]
> **GARANTÍA DE PRESERVACIÓN Y CERO REGRESIONES (NO ROMPER LO QUE FUNCIONA):**
> Este plan ha sido diseñado con un enfoque quirúrgico y no invasivo. **No se modificará ningún componente visual, botón, desglose de comanda, modal ni estructura de Balance existente.** 
> Se garantiza al 100% la preservación de las siguientes funcionalidades operativas:
> 1. **Pestaña de Balance:** Los gráficos e ingresos mensuales del balance de administrador se mantendrán intactos.
> 2. **Pestaña de Ventas Anual/Semanal:** Se mantendrá sin cambios la UI y la capacidad de hacer clic en un día del año, ver el desglose completo de comandas de ese día, y entrar en cada comanda para auditar los productos específicos.
> 3. **Botones de Control:** Los botones de "Cierre de Caja" y "Compartir" de la cabecera diaria seguirán operando tal cual lo hacen actualmente.

---

## 🔍 1. Diagnóstico de la Causa Raíz (Bug del Balance)

*(Implementado con éxito)*
El filtro `filteredOrders` en `AdminTab.tsx` excluía las órdenes archivadas. Al archivar de inmediato en Caja las órdenes cobradas, desaparecían de las ventas de hoy del Administrador.
* **Solución Aplicada:** Se removió la exclusión por `is_archived` y se implementó un filtrado de fecha de alta fidelidad basado en el día calendario de hoy local.

---

## 🚦 2. Control de Flujo de Despacho y Entrega Obligatoria

*(Implementado con éxito)*
Para evitar que se cierren comandas antes de que Cocina/Barra preparen los productos, o antes de que el Mozo entregue en mesa en el salón, se deshabilitó el botón de despacho en Caja aplicando avisos adaptativos:
* **Cocina/Barra Preparando:** `"⏳ Esperando Cocina/Barra"` (deshabilitado).
* **Mozo sin Entregar en Mesa:** `"⏳ Esperando Mozo"` (deshabilitado).
* **Cajero sin Entregar (Take Away):** `"⏳ Debes entregar todos los ítems en Caja"` (deshabilitado).
* **Delivery en Reparto:** `"🛵 En reparto - Cierre a cargo del Repartidor"` (etiqueta fija).

---

## ⚡ 3. Automatización Inteligente: Auto-Cierre de Pedidos Pagados

*(Implementado con éxito)*
* **En Mozo (`WaiterTab.tsx`):** Al servir el último plato de una mesa pagada previamente, el pedido se completa, se archiva de inmediato en Supabase y la mesa se libera y limpia automáticamente en el salón del local.
* **En Caja (`OrderTab.tsx`):** Al marcar como entregado el último producto de una comanda para llevar pagada, la orden se archiva de forma 100% automática.

---

## 🍕 4. Corrección Crítica del Smart Splitter en Caja (`OrderTab.tsx`)

### A. Diagnóstico del Bug del Combo
Al realizar un pedido de Caja de un combo (por ejemplo, que incluye Hamburguesa para Cocina y Cerveza para Barra):
1. **Lógica Errónea del Constructor:** En la lógica de inserción de productos en `OrderTab.tsx` (líneas 375 a 411), el constructor forzó a que si un producto contenía ingredientes asignados a múltiples departamentos (`deptsFound.length > 1`), todo el producto se asignaba a **un solo departamento** (Cocina) en lugar de dividirse:
   ```typescript
   targetDepts = deptsFound.includes('kitchen') ? ['kitchen'] : ['bartender'];
   ```
2. **Consecuencia:** Al no dividirse el combo, la Cerveza (bebida) del combo **NUNCA** se insertaba como un ítem de barra (`target_departments: ['bartender']`). Como resultado, la bebida del combo se perdía y nunca llegaba a Barra, impidiendo que el bartender la viera en su pantalla operativa.

### B. Solución de Alta Fidelidad
Modificaremos la inserción de ítems de comanda en Caja (`OrderTab.tsx`) para que funcione con la misma lógica del Smart Splitter del Menú del Cliente (`PublicMenu.tsx`):
* Si el producto (Combo) posee ingredientes destinados a cocina Y barra (`deptsFound.length > 1`), **se dividirá de forma inteligente en múltiples registros de `order_items` independientes** (uno para cada departamento).
* El primer registro mantendrá el precio unitario real del combo, mientras que los registros secundarios de los otros departamentos (ej. Barra) se insertarán con **precio `0`** para no alterar ni duplicar el total cobrado de la comanda.
* Se registrarán en el campo `notes` los insumos de cada departamento (ej. `"Pan + Medallón + Queso"` para Cocina y `"Cerveza"` para Barra), garantizando que Barra reciba exactamente su bebida de forma instantánea en tiempo real.

---

## 💻 5. Cambios en Código

### Modificación: `src/components/OrderTab.tsx`
*(A ser implementado por el Constructor)*
Reemplazar la sección de inserción de `orderItems` dentro de `handleFinish` (líneas 363 a 417 aprox.) para implementar la división de combos con precio `0` en ítems secundarios y el mapeo de `notes` de insumos por departamento.

---

## 🧪 6. Plan de Verificación

1. **Prueba de Combo de Caja:** Registrar en Caja un combo que incluya hamburguesa (Cocina) y bebida (Barra).
   - Validar que en el desglose de ítems de la comanda en Caja aparezcan **dos líneas separadas**: una de Cocina con el precio del combo, y otra de Barra con precio `$0`.
   - Validar en la terminal de Barra (`BartenderTab.tsx`) que la bebida aparezca al instante para preparar.
2. **Compilación y Cero Advertencias:** Correr `npm run build` en la consola local para asegurar un éxito absoluto de TypeScript.
