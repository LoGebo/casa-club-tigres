# Casa Club Acceso
PWA de control de entradas/salidas (jugadoras · Seguridad · Coordinación · tutores por enlace).

    npm install
    node seed.js            # crea usuarios seguridad/coordinacion (imprime PINs; o SEG_PIN= COORD_PIN=)
    node seed.js demo       # opcional: jugadoras de prueba (ana/bea/caro, PIN 1234)
    npm start               # http://localhost:3000
    npm test                # flujo completo

Variables: PORT, DATA_DIR (carpeta de la BD, montar volumen persistente), PUBLIC_URL (https://tu-dominio, para los enlaces de WhatsApp), TZ_CLUB.
Despliegue: cualquier host Node ≥22.13 con HTTPS (la cámara lo exige): Railway/Render/Fly. Los usuarios abren el link y "Agregar a pantalla de inicio".

## Base de datos y hosting gratis
- Local: Postgres embebido (PGlite) en `data/pg`, sin instalar nada.
- Producción: define `DATABASE_URL` (Neon o Supabase, plan gratis) y `SECRET` (cadena larga aleatoria). El mismo código usa Postgres real.
- App Node: Render/Koyeb gratis (se duerme sin tráfico). Un monitor gratis (UptimeRobot) que haga ping a `/api/health` cada 5 min la mantiene despierta; ese endpoint no toca la base, así que Neon puede dormir.
- Logo oficial: coloca `public/brand/logo.png` y el encabezado lo usa solo.
- Verifica los límites vigentes de cada plan antes de contratar: cambian seguido.
