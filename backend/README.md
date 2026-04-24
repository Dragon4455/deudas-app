# Backend para Gestión de Deudas

Este es el backend Node.js con MySQL para la aplicación de gestión de deudas, desplegado en Vercel con TiDB.

## Instalación Local

1. Instala dependencias: `npm install`
2. Configura variables de entorno en `.env` (DB_HOST, DB_USER, etc.)
3. Ejecuta: `npm run dev`

## Despliegue en Vercel

1. Crea una cuenta en [TiDB](https://tidbcloud.com/) y configura una base de datos MySQL.
2. Ejecuta `init.sql` en TiDB para crear tablas.
3. Instala Vercel CLI: `npm i -g vercel`
4. En la carpeta backend: `vercel`
5. Configura variables de entorno en Vercel Dashboard:
   - DB_HOST
   - DB_USER
   - DB_PASSWORD
   - DB_NAME
   - DB_PORT (opcional, default 4000)
6. Despliega: `vercel --prod`

## Endpoints

- `POST /api/sync`: Sincronizar deudas.
- `GET /api/deudas`: Obtener deudas.
- `GET /api/tasa`: Obtener tasa actual.
- `POST /api/tasa`: Actualizar tasa.
- `GET /api/tasas`: Historial de tasas.
- `PUT /api/tasa/:id`: Editar tasa específica.

## Frontend

Sube el frontend (index.html, app.js, sw.js) a Netlify. Actualiza las URLs de fetch a la URL de Vercel.