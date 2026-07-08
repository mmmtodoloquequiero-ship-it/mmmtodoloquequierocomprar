# 📖 Manual Comercial y Operativo del Sistema Smart Splitter & Gestión Gastronómica Premium

Este manual detalla el funcionamiento comercial, operativo y técnico de la plataforma gastronómica multi-tenant, enfocándose en la automatización de procesos, el control de inventarios físicos en tiempo real y el análisis financiero de rentabilidad por producto.

---

## 🚀 1. Arquitectura y Smart Splitter (División Inteligente)

El **Smart Splitter** es el núcleo operativo que distribuye automáticamente los elementos de un pedido a sus respectivas pantallas de preparación en tiempo real, garantizando la máxima eficiencia y evitando cuellos de botella en el local.

### Lógica de Distribución por Departamento
* **🍳 Cocina (kitchen):** Platos calientes, hamburguesas, entradas y postres de elaboración.
* **🍹 Barra (bartender):** Bebidas, cócteles, milkshakes y cafetería.

### Flujo Técnico del Pedido
1. El cliente realiza un pedido desde el menú público (`PublicMenu.tsx`).
2. El sistema analiza cada ítem y su relación con la categoría asignada.
3. Se realiza una división inteligente en la comandera administrativa:
   * La pantalla de **Cocina** muestra y procesa únicamente los ítems asignados a `kitchen`.
   * La pantalla de **Barra** muestra y procesa únicamente los ítems asignados a `bartender`.
4. Ambos departamentos trabajan en paralelo de manera fluida y sincronizada.

---

## 🔒 2. Blindaje de Stock y Control de Inventarios Negativos

Para evitar la venta de productos sin insumos disponibles y erradicar los saldos negativos en el almacén, el sistema implementa un **Blindaje Físico de Stock Real**.

### Reglas Operativas de Almacén
* **Cálculo de Disponibilidad Real:**
  $$\text{Stock Disponible} = \text{Stock Físico en BD} - \text{Stock Reservado en Pedidos Pendientes}$$
* **Bloqueo en Menú Público:** Si los ingredientes de un producto o combo caen por debajo del nivel mínimo requerido por su receta (considerando los pedidos en preparación en la cocina), el producto se deshabilita automáticamente y muestra un mensaje de *"Sin Stock Real"*.
* **Control de Insumos Críticos:** El sistema notifica al administrador en la pestaña de Stock mediante colores de alerta (Rojo si el insumo está por debajo del stock de alerta mínimo configurado).

---

## 💰 3. Análisis Financiero de Recetas y Margen de Ganancia

La plataforma cuenta con un módulo de inteligencia de costos que calcula la rentabilidad real de cada elemento del menú antes de ofrecerlo al público.

### Fórmulas del Negocio
* **Costo de Receta ($):**
  $$\text{Costo Total} = \sum (\text{Cantidad Insumo} \times \text{Precio de Costo del Insumo})$$
* **Ganancia Neta ($):**
  $$\text{Ganancia} = \text{Precio de Venta} - \text{Costo de Receta}$$
* **Margen de Ganancia (%):**
  $$\text{Margen (\%)} = \left( \frac{\text{Ganancia}}{\text{Precio de Venta}} \right) \times 100$$

### 🧮 Calculadora en Tiempo Real (Modal de Producto)
Integrada en el modal de creación y edición de productos, permite al administrador simular combinaciones de insumos y precios de venta obteniendo un diagnóstico visual instantáneo de rentabilidad:
* 🔴 **Rojo (Margen $\le 20\%$):** Rentabilidad baja o de alto riesgo.
* 🟠 **Naranja (Margen entre $21\%$ y $50\%$):** Rentabilidad media y equilibrada.
* 🟢 **Verde (Margen $> 50\%$):** Rentabilidad alta y altamente recomendada.

### 📊 Desglose en Lista de Menú
Cada producto del menú administrativo cuenta con un mini-desglose premium de sus costos:
`Costo: $X.XX • Ganancia: $Y.YY (Z%)` para una visualización rápida y toma de decisiones comerciales eficientes en un solo vistazo.

---

## 📉 4. Registro Automático de Gastos por Compra de Insumos

Cada vez que el administrador añade stock físico al almacén, la plataforma calcula e ingresa de forma automática un registro contable de egreso en el balance mensual.

### Lógica de Registro Contable
* Si se crea un insumo nuevo, se registra un gasto inicial por el total del stock ingresado.
* Si se edita un insumo existente y se incrementa el stock, se calcula la diferencia física adicionada y se genera un gasto bajo el concepto de `"Compra de Insumo"` en la tabla `expenses`.
* El balance consolidado y las gráficas mensuales de rentabilidad descuentan automáticamente estos montos, garantizando que el saldo de caja y los egresos reales coincidan a la perfección al cierre de mes.

---

## 📋 5. Ventas de Hoy, Cierre de Caja y Desglose de Métodos de Pago

Para agilizar el arqueo diario y la conciliación bancaria, el sistema segmenta de manera precisa cada transacción del día.

### Métodos de Pago Soportados
* **💵 Efectivo (Cash):** Dinero físico de caja.
* **💳 Débito (Debit Card):** Transacciones por tarjeta de débito.
* **💳 Crédito (Credit Card):** Transacciones por tarjeta de crédito.

### Flujo de Cierre de Caja
1. El sistema acumula y presenta en tarjetas diferenciadas las ventas de hoy por cada método de pago.
2. El administrador cuenta con la herramienta de **"Compartir Cierre de Caja"**, la cual genera un reporte detallado con formato elegante para enviar por WhatsApp o guardar en el portapapeles.
3. El botón **"Cerrar Caja"** archiva de forma masiva los pedidos de hoy, limpiando la comandera diaria y preparándola para la jornada del día siguiente sin alterar las métricas semanales o mensuales.

---

## ⏰ 6. Control de Lotes y Fechas de Vencimiento de Insumos (PEPS/FIFO)

Para garantizar la inocuidad alimentaria, reducir la merma y optimizar la rotación de los inventarios perecederos en el almacén, el sistema cuenta con un módulo de **Control de Lotes por Fecha de Vencimiento**.

### Carga de Vencimiento por Lote
* Al crear o ingresar stock a un insumo en el modal administrativo (`AdminTab.tsx`), el administrador puede especificar una **Fecha de Vencimiento** asociada al lote ingresado.
* Si el stock ingresado (`diff > 0`) tiene una fecha asignada, se almacena de forma independiente en la tabla `ingredient_batches` vinculando la cantidad exacta y su fecha correspondiente.

### Desglose y Control de Lotes en Almacén (Pestaña Stock)
* Debajo de cada ingrediente en la pestaña **Stock**, se visualiza un desglose interactivo y premium titulado **"Lotes Activos por Vencimiento"** (siempre que existan lotes cargados para dicho insumo).
* Cada lote muestra su cantidad física exacta, la fecha de vencimiento formateada, y un indicador visual de color:
  * 🔴 **Rojo:** Lote vencido.
  * 🟠 **Naranja:** Lote a 7 días o menos de vencer.
  * 🟢 **Verde:** Lote óptimo con vencimiento lejano.
* **Eliminación Manual e Inmediata:** Si un lote específico ha sido vendido o gastado por completo, el administrador puede hacer clic sobre el icono de la papelera del lote para eliminarlo del sistema directamente desde la pestaña de Stock en tiempo real, garantizando una administración ágil de la mercadería.

### Alertas de Vencimiento Cercano (Dashboard)
* La plataforma calcula en tiempo real los lotes activos próximos a expirar.
* Si un lote está a **7 días o menos** de vencer, se dispara una alerta roja o naranja brillante con diseño *Glassmorphism* en la pestaña principal del Dashboard.
* **Resolución Inteligente de Lotes (PEPS/FIFO):**
  * La alerta cuenta con la acción directa: **"¿Ya liquidaste este stock?"**.
  * Al hacer clic, el sistema pregunta al administrador si el lote antiguo ya fue retirado o consumido en su totalidad.
  * Si responde **"Sí"**, el sistema elimina de forma definitiva ese lote de `ingredient_batches`, dejando activo el lote con la fecha de vencimiento más lejana. Esto asegura que la cocina opere siempre bajo el principio de **Primeras Entradas, Primeras Salidas (PEPS)**.

---

## 🏷️ 7. Ofertas y Descuentos Programados (Marketing Gastronómico)

Para impulsar las ventas de platos específicos, liquidar mercadería excedente y programar promociones comerciales ágiles, el sistema cuenta con un módulo de **Ofertas y Descuentos Programados** en tiempo real.

### Creación y Programación de Ofertas (Pestaña Menú)
* **Botón e Invocación:** Ubicado de forma destacada junto a la creación de categorías. Al hacer clic, abre un modal administrativo premium de configuración de campañas.
* **Configuración Dinámica:** Permite establecer el porcentaje de descuento (desde `1%` hasta `100%` gratis), fechas de inicio y fin de vigencia de la oferta, y una cantidad límite opcional para limitar la disponibilidad (ej. "primeros 50 pedidos").
* **Selección Múltiple de Productos:** Cuenta con un listado interactivo con checkboxes que permite asociar múltiples productos del menú a la misma campaña en un solo paso.

### Simulador de Margen en Tiempo Real (Calculadora Gastronómica)
* A medida que el administrador selecciona productos y altera el descuento, el simulador analiza reactivamente el impacto financiero para cada plato:
  * **Costo de Receta:** Calcula la suma de todos los insumos necesarios para preparar el plato.
  * **Precio Rebajado:** Muestra el precio de venta final que verá el cliente.
  * **Ganancia y Margen Neto Resultante (%):** Indica la rentabilidad que le queda al negocio.
  * **Semáforo de Rentabilidad Visual:**
    * 🔴 **Rojo ($\le 20\%$):** Margen de ganancia crítico o pérdidas potenciales.
    * 🟠 **Naranja ($21\% - 50\%$):** Rentabilidad moderada.
    * 🟢 **Verde ($> 50\%$):** Alta rentabilidad comercial.
  * *Esto previene que el local realice ofertas destructivas que comprometan la sustentabilidad económica del negocio.*

### Visualización de Ofertas Activas y Baja Instantánea
* **Panel Superior Global:** Debajo del encabezado del menú, el administrador dispone de un panel premium que lista todas las **Ofertas Programadas Activas** en tiempo real. Cada tarjeta detalla los productos participantes, la vigencia temporal y el porcentaje de descuento, con opción de eliminarlas por completo.
* **Destacado Visual en Lista de Productos:** 
  * Los productos con una oferta activa hoy se resaltan de forma espectacular en la lista de categorías administrativa (`AdminTab.tsx`) con un degradado de fondo morado neón premium (`bg-gradient-to-r from-purple-950/20 to-slate-950/40 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.08)]`).
  * Al lado de su nombre, se renderiza una insignia vibrante indicando el porcentaje de la oferta (ej. `20% OFF`).
  * En el precio, se destaca el precio neto de oferta en morado y se tacha el precio normal en gris.
  * **Cálculo de Margen de Oferta Proyectado:** El sistema actualiza en tiempo real los campos de **"Ganancia Oferta"** y el **"Margen con Oferta"** (%) en la tarjeta del producto, para que el administrador controle constantemente la rentabilidad real bajo descuento.
* **Baja Directa con Un Solo Toque:** 
  * Al lado de los botones tradicionales de editar y borrar de cada producto en oferta, aparece un botón morado directo con el icono de estrella desactivada (`StarOff`).
  * Al hacer clic, el sistema gestiona inteligentemente la baja: si el producto es el único en la oferta, elimina el registro completo; si forma parte de una oferta multi-producto, remueve únicamente a este producto de la campaña de descuento sin alterar los otros platos. Esto brinda una ergonomía operativa de nivel profesional.

### Sincronización en Tiempo Real con Latencia Cero y Robustez Multiproducto (Prioridad 5)
* **Latencia Cero en Cambios de Carta:** El motor RLS del sistema de base de datos se encuentra optimizado con políticas `SELECT USING (true)` en tablas públicas. Esto permite que Supabase Realtime propague instantáneamente (en menos de 100ms) cualquier edición de catálogo, stock o promociones a las cartas digitales activas de todos los clientes sin necesidad de recargar la página.
* **Sanitización Robusta de Arrays:** El sistema incorpora normalización defensiva en front-end (`getProductIdsArray`) que interpreta indistintamente formatos de arrays de JS, JSON serializados o cadenas nativas de Postgres (`"{uuid-1,uuid-2}"`). Esto garantiza total estabilidad y tolerancia a fallos ante actualizaciones masivas por sockets en campañas multiproducto.

### Aplicación Automática en la Carta del Cliente
* **Sincronización en Tiempo Real:** El menú del cliente (`PublicMenu.tsx`) evalúa automáticamente si la fecha actual se encuentra en el rango de validez de la oferta programada.
* **Experiencia de Usuario Premium:** En la carta digital, el precio original aparece tachado en gris y el precio promocional se resalta con colores vibrantes acompañados de una insignia destacada (ej. `20% OFF`).
* **Integración con Carrito y Smart Splitter:** Al añadir un plato de oferta al carrito, se calcula con el valor rebajado. La confirmación del pedido y el desglose de insumos en cocina/barra respetan de forma transparente este valor final.
