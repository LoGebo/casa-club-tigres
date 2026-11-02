# Casa Club Tigres — control de acceso

App para la Casa Club Femenil: permisos de salida y regreso con QR, autorización de mamá/papá por WhatsApp (enlace + código),
viajes y convocatorias, comedor, avisos y horarios por categoría. Roles: **jugadora · Seguridad · Coordinación** (y tutores por enlace).

- **Frontend** (`app/`): Expo (React Native) + Expo Router. Una sola base de código para iPhone, Android y web. La web se exporta a `public/` y la sirve el mismo servidor.
- **Backend** (`server.js`, `features.js`, `db.js`): Node 22 + Express 5 + Postgres (Neon en producción, PGlite embebido en local).

## Desarrollo local
    npm install
    SEG_PIN=1234 COORD_PIN=1234 node seed.js && node seed.js demo   # usuarios y datos de ejemplo (solo local)
    PORT=3000 node server.js                                        # API
    cd app && npm install && EXPO_PUBLIC_API_URL=http://localhost:3000 npx expo start --web
    npm test                                                        # pruebas de la API (flujo completo)

## Publicar la versión web (gratis)
1. `scripts/build-web.sh` exporta la app a `public/` (se versiona, así el hosting no necesita compilar nada).
2. **Neon** (neon.tech, plan gratis): crea un proyecto y copia la cadena de conexión (`postgresql://…?sslmode=require`).
3. **Render** (render.com, plan gratis): New → Blueprint → este repo (`render.yaml`). Variables: `DATABASE_URL`, `PUBLIC_URL` (la URL que te asigne Render), `COORD_PIN` y `SEG_PIN` (temporales; se pide cambiarlos al primer ingreso).
4. **Monitor gratis** (cron-job.org o UptimeRobot): llama a `https://TU-APP.onrender.com/api/health` cada 5 minutos. Mantiene despierto el servicio y ejecuta el vigilante de retrasos / toque de queda.
5. Coordinación entra, abre Jugadoras → Registrar jugadoras → Enlace, y manda el enlace por WhatsApp.

Límites del plan gratis (verifícalos antes de contratar, cambian): Render duerme tras 15 min sin tráfico (el monitor lo evita); Neon 0.5 GB (las fotos de comidas se borran a los 30 días y las de servicios a los 90).

## Notificaciones
- Dentro de la app siempre hay bandeja (campana). Push en web: instalar la app en la pantalla de inicio (iPhone: Compartir → Agregar a pantalla de inicio) y activar avisos en Notificaciones.
- Push nativo (App Store / Google Play) requiere cuenta de desarrollador (Apple $99/año, Google $25 único) y compilar con EAS; el código ya registra el token de Expo.

## Variables de entorno
`DATABASE_URL`, `SECRET`, `PUBLIC_URL`, `COORD_PIN`/`SEG_PIN` (solo primera vez), `TZ_CLUB` (zona horaria), `PORT`, `DATA_DIR` (local).
