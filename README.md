# Gestión de Deudas PWA

Aplicación web progresiva para gestionar deudas en economía bimonetaria.

## Despliegue

### Frontend (Netlify)
1. Sube los archivos `index.html`, `app.js`, `sw.js`, `netlify.toml`, `_redirects` a Netlify.
2. En Netlify Dashboard, configura la variable de entorno `API_URL` con la URL de Vercel (ej. `https://tu-app.vercel.app`).
3. Despliega.

### Backend (Vercel + TiDB)
1. Ve a la carpeta `backend`.
2. Instala Vercel CLI: `npm i -g vercel`
3. `vercel login`
4. `vercel`
5. Configura variables de entorno en Vercel:
   - DB_HOST: Host de TiDB
   - DB_USER: Usuario
   - DB_PASSWORD: Contraseña
   - DB_NAME: Nombre de DB
   - DB_PORT: 4000
6. Despliega: `vercel --prod`

### Base de Datos (TiDB)
1. Crea una cuenta en [TiDB Cloud](https://tidbcloud.com/).
2. Crea un cluster MySQL.
3. Ejecuta el SQL de `backend/init.sql` en la DB.
4. Obtén las credenciales para conectar.

## Desarrollo Local
- Frontend: Abre `index.html` en navegador.
- Backend: `cd backend && npm run dev`

## Notas
- Cambia `API_BASE` en `app.js` para producción.