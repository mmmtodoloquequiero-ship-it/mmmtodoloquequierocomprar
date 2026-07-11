# Estado del Proyecto: Todo Lo Que Quiero Comprar (SaaS para Negocios de Barrio)

## ¿Qué hacemos?
Estamos adaptando el sistema desarrollado originalmente para restaurantes ("juOliMyMapps") a un nuevo enfoque de SaaS multi-tenant dirigido a negocios de barrio (kioscos, despensas, panaderías, etc.).
Se han eliminado funcionalidades complejas que no aplican a este rubro (mozos, mesas, reservas, sistema de fidelidad) y se ha unificado la interfaz operativa para que haya una sola pantalla de caja y una de preparación/despacho.
Además, se está introduciendo el concepto de **Fiado (Cuentas Corrientes)** con una validación estricta mensual (del 1 al 1 de cada mes) para bloquear nuevos fiados a clientes deudores.

## ¿Por qué lo hacemos?
El usuario, enfocándose en la eficiencia y la hiper-automatización, busca ofrecer un producto más sencillo ("Pro" por defecto) para negocios de barrio, reduciendo la curva de aprendizaje y facilitando la adopción masiva.

## Hitos Completados
- [x] **Clonación del Proyecto:** Se copiaron los archivos de la aplicación original.
- [x] **Limpieza de Código:** Se eliminaron los componentes `WaiterTab`, `KitchenTab`, `BartenderTab`, `AnimadorTab` y se integraron las vistas necesarias en `PreparationTab` y `DeliveryTab`.
- [x] **Nuevo Esquema de Base de Datos:** Se generó el archivo `database_schema.sql` (simplificado y unificado).
- [x] **Simplificación de la Interfaz Administrativa:** Se eliminaron las secciones de Integración con Delivery Apps, Módulo de Reservas, Mesas/QR y Muro VIP del `AdminTab.tsx`.
- [x] **Módulo Fiado Avanzado (Admin):** Se agregó `AdminFiadosTab.tsx` para alta de clientes con límites de crédito configurables, gestión de cobros parciales/totales en efectivo, y un sistema global (Veraz de Barrio) usando `global_customers`.
- [x] **Escáner y Pedidos por Voz en Caja:** Se integró la cámara y micrófono. Se optimizó el NLP en `ScannerVoiceInput.tsx` para comprender frases coloquiales ("medio kilo", "un cuarto") y procesarlas matemáticamente.
- [x] **Venta por Peso (Fraccionables):** Se añadieron columnas (`sale_by_weight`, `base_weight`, `base_weight_unit`) a la tabla `products` y se actualizó la interfaz de `OrderTab.tsx` para permitir al cajero ingresar los gramos/kilos, calculando automáticamente el stock y precio correspondiente.
- [x] **Resolución de Errores de Build:** Se arreglaron múltiples errores de TypeScript originados por desajustes entre la UI de Next.js (por ej. vistas deprecadas como "Mozo" o "Barra") y las definiciones de base de datos de Supabase, logrando un build exitoso.
- [x] **Correcciones de Base de Datos y Flujo de Despacho (POS):** Se ajustó el esquema de Supabase (`orders`, `order_items`, `active_devices`, `app_notifications`) para alinearlo con el código frontend. Se modificó el tipo de dato de `quantity` a `NUMERIC` en `order_items` para permitir ventas de productos fraccionados (por peso decimal, ej. 0.5 kg). Se eliminaron las restricciones de bloqueo por Cocina/Barra y Mesa en la vista de caja de `OrderTab.tsx`, permitiendo al cajero despachar y archivar comandas directamente y sin demoras.
- [x] **Soporte de Venta por Peso en Menú Digital (Clientes):** Se adaptó `PublicMenu.tsx` para que los clientes puedan ingresar el peso exacto en gramos (o elegir atajos rápidos de 100g, 250g, 500g, etc.) al ordenar productos fraccionables. Se agregaron indicadores de precio por kilogramo (`/ kg`), subtotales dinámicos estimados y se adaptó el carrito público para mostrar el desglose en gramos o kilogramos y ajustar la cantidad de a 100g por paso.
- [x] **Página de Términos de Fiado (Cuenta Corriente):** Se creó la ruta `/terminos-fiado` (`terminos-fiado/page.tsx`) con un diseño y tipografía de alta fidelidad, detallando las reglas de recolección de datos, límites, moralidad (Veraz de Barrio), vencimientos y firma digital. Se enlazó el texto de aceptación en `FiadoOnboarding.tsx` como un link en negrita subrayado que abre los términos en una pestaña nueva.
- [x] **Eliminación del Bloqueo por Heartbeat en Checkout:** Se removió la verificación estricta de latido de conexión en `PublicMenu.tsx` que arrojaba el error *"El local se encuentra temporalmente sin conexión al sistema..."*. Esto permite que se puedan realizar pedidos de prueba local y que los pedidos ingresen sin bloqueos arbitrarios si la PC de la administración se encuentra apagada o suspendida.
- [x] **Pizarra Pública de Deudores del Mes en Landing Page:** Se agregó un componente interactivo en `src/app/page.tsx` para mostrar públicamente las cuentas impagas y activas del mes corriente (DNI, Nombre, Local e importe adeudado) con un buscador rápido por DNI/Nombre y estética premium en modo oscuro.
- [x] **Sistema Global de Reputación Automatizado ("Veraz de Barrio"):** Se diseñó el disparador (trigger) en la base de datos para recalcular la reputación global y el conteo de moras en `global_customers` cada vez que se cree o altere una cuenta corriente en `customer_tabs`. Además, se modificó `FiadoOnboarding.tsx` para consultar `global_customers` en tiempo real y bloquear el alta de fiados si el cliente registra moras activas en la red.
- [x] **Alineación de Contraseñas del SaaS:** Se preparó la migración SQL para agregar las columnas faltantes de contraseñas de personal (`bartender_password` y `kitchen_password`) en la tabla `tenants`, solucionando el error `PGRST204` al guardar la configuración en la pestaña de administración.
- [x] **Panel de Control Maestro (SaaS CEO):** Se migró y adaptó la vista de SuperAdmin de la app original. Ahora disponible en la ruta `/mmmcomprar-co` con acceso asegurado (credenciales master) para gestionar los locales, cupones, bandeja de soporte y suscripciones al SaaS.
- [x] **Auditoría de Seguridad (Sesiones y Secretos):** Se creó e implementó el script `security_patch.sql` para migrar desde cabeceras falsificables (`x-tenant-id`) a tokens de sesión (`tenant_sessions`) validados por servidor. Se ocultaron los tokens de cobro de Mercado Pago en una tabla privada `tenant_secrets` y se actualizó la API en Next.js para usarlos de forma segura.
- [x] **Branding Global:** Se agregó un componente global (`GlobalWatermark.tsx`) en el pie de página de clientes y cajeros (Landing y Admin Dashboard) que muestra el logo y vincula al dominio corporativo principal (`www.mmmtodoloquequiero.com.ar`).

## Siguientes Pasos (A cargo del usuario o Futuros)
1. **Ejecutar `admin_saas_setup.sql` y `security_patch.sql`:** El usuario debe correr estos scripts en el editor SQL de Supabase para crear las tablas de planes, suscripciones, cupones, y el nuevo sistema de roles de seguridad seguro.
2. **Verificar Interfaz:** Probar que la caja reconoce correctamente los dictados de voz y los escaneos de código de barras.
3. **Aplicación B2C para Clientes:** (Fase Futura) Crear el portal para que los clientes busquen productos, comparen precios en comercios cercanos (500m) y acepten los T&C para pedir fiado.

## Impacto Arquitectónico
- **Arquitectura de Base de Datos Expandida:** Se añadió `global_customers` para compartir reputación crediticia entre tenants. Se expandió `products` con campos matemáticos (`base_weight`) para aislar la lógica de fraccionamiento sin afectar las tablas secundarias, y se restauró `ingredients` para manejar stock físico (combos). Se adaptaron `order_items` para permitir cantidades decimales (peso) y `active_devices` para canalizar notificaciones web push. Se implementaron tablas de seguridad (`tenant_secrets` y `tenant_sessions`).
- **Páginas Afectadas:** `AdminTab.tsx` fue actualizado para soportar insumos, fiados y configuración de ventas por peso. `OrderTab.tsx` absorbió la lógica del cajero para procesar voz con IA coloquial, escaneo, y pop-ups inteligentes de pesaje, removiendo además los bloqueos de preparación de Cocina y entrega de Mozos en Caja. `PublicMenu.tsx` ahora renderiza el modal interactivo de peso para los clientes y calcula las cantidades decimales correspondientes en el carrito público, eliminando además la restricción del latido (heartbeat) al confirmar. La nueva página `src/app/terminos-fiado/page.tsx` define los términos comerciales y legales para los clientes de crédito. `src/app/page.tsx` ahora incluye la pizarra pública de deudores y consulta dinámicamente las cuentas corrientes impagas cruzando RLS con políticas públicas de solo-lectura sobre datos morosos.

## Actualizaci�n de Seguridad (Julio 2026)
**Impacto:** Se reescribi� security_patch.sql para soportar cajas fuertes para contrase�as (update_tenant_secrets). Se modific� AdminTab.tsx para no sobreescribir contrase�as. Se elimin� la vulnerabilidad de 'pedidos fantasmas' creando la ruta /api/mercadopago/verify que comprueba en el backend el pago antes de marcarlo como pagado. Se aplic� RLS estricto a orders para que an�nimos solo puedan INSERTAR.

- [x] **Configuraci�n SaaS y Mercado Pago:** Se verific� la integraci�n de Suscripciones (Preapproval) de Mercado Pago en la API, el Webhook y la tabla saas_plans (Plan �nico a 35000 ARS). El panel /mmmcomprar-co permite generar c�digos promocionales reales que los locales pueden canjear en la app.

- [x] **PWA (Progressive Web App):** Se configuraron los iconos con el logotipo provisto por el usuario, se activ� la instalaci�n nativa como app (Service Worker + Manifest), y se a�adi� un bot�n inteligente en la UI para instalar la app desde navegadores compatibles.

- [x] **Eliminaci�n del M�dulo de Reservas en Caja:** Se retir� por completo la pesta�a y la secci�n de visualizaci�n de Reservas dentro del componente de toma de pedidos e hist�rico (OrderTab.tsx), limpiando la interfaz para el personal sin comprometer el comportamiento de otras pesta�as de caja.

- [x] **Fidelizaci�n Inmediata y Configuraci�n:** Se agreg� l�gica para calcular localmente el cashback generado en una compra y mostrar de inmediato un cartel o banner con el beneficio (tanto en la app del cliente como en la caja). Adem�s, se cambi� el valor por defecto del sistema de fidelizaci�n a desactivado para nuevas cuentas.

- [x] **Rebranding Global Premium (UI/UX):** Se implement� una paleta de colores global estricta enfocada en Negro Profundo y Dorado Met�lico. Se sobrescribieron los valores nativos de Tailwind en globals.css para impactar toda la app instant�neamente sin generar riesgo arquitect�nico. Se ajust� el letter-spacing, las sombras (golden glows) y el hover en botones primarios.

- [x] **Correcci�n de Modo Claro:** Se removi� la clase bg-black est�tica del contenedor principal del men� p�blico para permitir que el Modo Claro rellene toda la pantalla. Se optimizaron los colores grises intermedios en Tailwind (slate-100 a slate-700) para asegurar un contraste agudo y perfectamente legible en Modo Claro.

- [x] **Visibilidad de Buscador en Modo Claro:** Se actualiz� el componente ScannerVoiceInput para soportar din�micamente el tema Claro (isLight). Esto resuelve el problema de la caja de b�squeda negra y texto invisible en la vista de Caja (OrderTab).

- [x] **Correcci�n de Visibilidad en Buscador del Men� P�blico:** Se actualiz� la barra de b�squeda en PublicMenu.tsx para que respete din�micamente el Modo Claro, cambiando el fondo a claro y el texto a oscuro, evitando as� que el texto sea invisible al buscar productos.
