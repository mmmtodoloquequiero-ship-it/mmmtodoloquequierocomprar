# MyMapps - Lion Management System

Sistema de gestión digital para negocios de comida rápida, construido con Next.js y Supabase.

## Características
- **Pedidos en Tiempo Real**: Toma pedidos desde cualquier dispositivo.
- **Panel de Cocina**: Cola de pedidos automática con actualizaciones instantáneas.
- **Administración de Inventario**: Descuento automático de stock basado en insumos.
- **Métricas de Negocio**: Visualización de ingresos y gastos.
- **Diseño Premium**: Interfaz moderna con Glassmorphism y modo oscuro.

## Instalación y Configuración

1. **Clonar el repositorio**.
2. **Configurar Supabase**:
   - Crea un proyecto en [Supabase](https://supabase.com).
   - Ve a la sección **SQL Editor** y ejecuta el contenido del archivo `schema.sql` (disponible en los archivos del proyecto).
3. **Variables de Entorno**:
   - Crea un archivo `.env.local` en la raíz con:
     ```env
     NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
     NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anon_key
     ```
4. **Instalar dependencias**:
   ```bash
   npm install
   ```
5. **Ejecutar en desarrollo**:
   ```bash
   npm run dev
   ```

## Roles
- **Staff (Caja)**: Toma de pedidos y gestión de clientes.
- **Kitchen (Cocina)**: Visualización y despacho de órdenes.
- **Admin (Dueño)**: Control de stock, precios, categorías y métricas de ventas.

## Deployment
Para subirlo a GitHub y Vercel:
1. Crea un nuevo repositorio en GitHub.
2. Sube el código:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <tu_url_github>
   git push -u origin main
   ```
3. Conecta el repositorio en Vercel y añade las variables de entorno en la configuración del proyecto.
"# mmmtodoloquequierocomprar" 
"# mmmtodoloquequierocomprar" 
"# mmmtodoloquequierocomprar" 
