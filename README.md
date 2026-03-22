# Helpper Migrator

Herramienta de escritorio para gestionar migraciones masivas de contenido multimedia hacia la plataforma **Mediastream (SM2)**. Permite importar, validar, transformar y monitorear la migración de videos y audios desde un CSV hasta su ingesta completa en SM2.

---

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 18 + TypeScript + Vite + MUI v6 |
| Backend | Node.js + Express + TypeScript |
| Base de datos | SQLite via Prisma ORM |
| Tiempo real | Socket.IO |
| Gráficas | Recharts |
| Autenticación | JWT + cookie de sesión SM2 |

---

## Funciones

### Autenticación y sesión

- **Importación de credenciales SM2** — El usuario pega su JWT y cookie `connect.sid` desde el navegador. No se almacena la contraseña en ningún momento.
- **Gestión de sesiones** — Listado, revocación y validación de sesiones activas almacenadas cifradas en SQLite.
- **Fallback a variables de entorno** — Si no hay sesión activa, usa `MEDIASTREAM_API_TOKEN` y `MEDIASTREAM_SESSION_COOKIE` como credenciales legacy.

---

### Asistente de migración (Wizard 6 pasos)

Flujo guiado completo para crear una migración desde cero:

#### Paso 1 — Autenticación
Inicia o valida la sesión con SM2. Muestra el estado actual de conexión y los módulos del JWT.

#### Paso 2 — Configuración de la cuenta
- Verifica módulos habilitados en la cuenta SM2 (media, migración, VOD, AOD, publicidad, DRM).
- Muestra los perfiles de calidad de video activos y faltantes.
- Selección de tipo de contenido a migrar (VOD / AOD / Ambos) y estrategia (transcodificar / upload).
- Nombre de la migración con sugerencia automática basada en cuenta + fecha.
- **Panel de IA de SM2** — Muestra qué features de generación automática están activas en la cuenta (transcripción, metadata, capítulos, highlights, artículo, i18n, thumbnails) junto con el modelo usado y si tiene el flag `automatic` activado.

#### Paso 3 — CSV y mapeo de campos
- Carga de archivo CSV por drag & drop (hasta 100 MB).
- **Detección automática de mapeo** — El sistema detecta y sugiere qué columna del CSV corresponde a cada campo de SM2 con un porcentaje de confianza.
- **Detección de template** — Si el CSV tiene headers que coinciden con un template guardado (umbral 70%), propone aplicar su configuración en un solo clic.
- Tabla de mapeo editable con 17 campos disponibles: `id`, `title`, `original`, `rendition`, `description`, `category`, `category_id`, `tag`, `thumb`, `published`, `date_created`, `date_recorded`, `geo`, `show`, `showSeason`, `showSeasonEpisode`, `custom`.
- **Columnas adicionales** — Agrega columnas con valor por defecto al CSV normalizado (ej. `category` para publicidad masiva).
- **Motor de reglas de transformación** — Editor visual para aplicar transformaciones a columnas antes de enviar a SM2:
  - `trim`, `uppercase`, `lowercase`
  - `replace` (texto literal), `regex` (expresión regular)
  - `prefix` / `suffix`
  - `default` (valor cuando el campo está vacío)
  - `truncate` (recortar a N caracteres)
  - `map_value` (tabla de mapeo de valores)
- **Detección de duplicados por historial** — Al asignar la columna `id`, automáticamente cruza los IDs del CSV contra la tabla de ítems ya migrados. Muestra un banner con el conteo y un toggle para omitirlos en la normalización.
- **Comparación con reporte SM2** — Sube el ZIP de reporte de SM2 (o CSV directamente) para importar IDs con `migrationStatus = done` al historial y detectar duplicados.
- **Alerta de migraciones activas** — Si ya hay migraciones corriendo en SM2, advierte antes de continuar.

#### Paso 4 — Validación de URLs
- Verificación de accesibilidad de las URLs del CSV con control de concurrencia y porcentaje de muestra configurable (5%, 20%, 50%, 100%).
- Detección de rate limiting por dominio.
- Resumen por dominio con conteos de accesibles / fallidas / con rate limit.

#### Paso 5 — Reporte de validación
- Panel go/no-go con checklist de preparación (auth, cuenta, CSV, URLs).
- Resumen de configuración, estadísticas del CSV y detalle de URLs.
- Vista previa de campos mapeados.

#### Paso 6 — Confirmar y crear
- Resumen completo de la migración antes de confirmar.
- **Migración por lotes** — Divide el CSV en N lotes del tamaño configurado. Cada lote se crea como una migración independiente en SM2 con naming automático `{prefijo} - Lote X/N`. Soporta modo automático (todos los lotes de una vez) o piloto (lote a lote).
- **Guardar como template** — Opción para guardar la configuración de mapeo como template reutilizable con el nombre que elija el usuario.
- Creación de la migración en SM2 y registro en la base de datos local.

---

### Gestión de migraciones

- **Listado** con estado, progreso, items procesados/errores y fecha.
- **Detalle** con monitoreo en tiempo real via Socket.IO:
  - Estadísticas en vivo: waiting, queued, running, done, error.
  - Barras de progreso animadas.
  - Historial de estadísticas con gráfico de líneas (Recharts).
  - Logs de actividad con niveles y categorías.
- **Acciones**: iniciar, pausar, detener, reintentar migración.
- **Reanudación desde checkpoint** — Si una migración queda en estado `paused` o `error` con checkpoint guardado, aparece un botón "Reanudar (fila N)" que reinicia SM2 desde donde se detuvo.
- **Descarga de reporte CSV** — Genera un reporte con resumen y logs descargable directamente desde el detalle.
- **Detección de conflictos** — Alerta si hay otra migración activa en la misma cuenta SM2.

---

### Templates

- CRUD completo de templates de mapeo reutilizables.
- Cada template guarda: nombre, descripción, estrategia, mappings y headers esperados.
- **Detección automática** al cargar un CSV en el wizard (umbral de similitud de headers del 70%).
- Contador de usos que se incrementa cada vez que se aplica o se asocia a una migración.
- Duplicar templates existentes.

---

### Dashboard y métricas

- **Stat cards**: Total de migraciones, activas ahora, completadas, con errores, tasa de éxito global (%).
- **Gráfico de actividad** (AreaChart) — Migraciones creadas vs. completadas en los últimos 7 días.
- **Migraciones recientes** — Lista de las 8 más recientes con estado, progreso e ítems, clicable hacia el detalle.
- **Templates más usados** — Ranking de los 5 templates con más usos.
- Refresco automático cada 30 segundos.

---

### Alertas

- Sistema de alertas internas con severidades: `info`, `warning`, `critical`.
- Contador de alertas no leídas en tiempo real (Socket.IO).
- Marcar como leída individualmente o todas a la vez.
- Filtrado por migración.

---

### Configuración

- URL de la API de SM2 (por defecto `https://platform.mediastre.am`).
- **Notificaciones salientes**:
  - Email via SMTP (nodemailer) — al completar o al producirse errores.
  - Webhook HTTP — envía un POST con el payload de la migración a una URL configurable.
  - Toggles individuales para notificar en completado y en error.
- Test de conexión con SM2 desde la pantalla de configuración.
- Listado de migraciones activas en SM2 directamente desde la plataforma.

---

### Deduplicación por historial

- Tabla `MigratedItem` que almacena los IDs de todo el contenido que se ha migrado exitosamente.
- **Auto-ingesta**: cuando una migración termina sin errores, sus IDs se guardan automáticamente.
- **Manual via reporte**: sube el ZIP de reporte de SM2 para importar los IDs con `migrationStatus = done`.
- En el wizard, si hay duplicados detectados, se puede activar un toggle para omitirlos en la normalización del CSV antes de enviarlo a SM2.

---

## Arquitectura

```
MigrAgent/
├── backend/
│   ├── prisma/          # Schema SQLite + migraciones
│   ├── src/
│   │   ├── controllers/ # Handlers de cada ruta
│   │   ├── services/    # Lógica de negocio (migration, csv-validator, template, auth, mediastream...)
│   │   ├── routes/      # Definición de endpoints REST
│   │   ├── socket.ts    # Singleton Socket.IO
│   │   └── types/       # Tipos compartidos
│   └── uploads/         # CSVs y archivos temporales
└── frontend/
    ├── src/
    │   ├── components/  # Wizard steps, gráficos, UI compartida
    │   ├── context/     # WizardContext, AppContext
    │   ├── hooks/       # useApi (react-query), useSocket
    │   ├── pages/       # Dashboard, Migrations, Templates, Settings...
    │   ├── services/    # api.ts (axios client)
    │   └── types/       # Tipos TypeScript
    └── public/
```

---

## Variables de entorno (backend)

```env
# Opcional — credenciales legacy (reemplazadas por sesiones dinámicas)
MEDIASTREAM_API_URL=https://platform.mediastre.am
MEDIASTREAM_API_TOKEN=<jwt>
MEDIASTREAM_SESSION_COOKIE=<connect.sid>
MEDIASTREAM_ACCOUNT_ID=<account_id>

# Notificaciones por email (opcional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=secret
```

---

## Desarrollo

```bash
# Backend
cd backend
npm install
npm run db:migrate
npm run dev          # Puerto 3000

# Frontend
cd frontend
npm install
npm run dev          # Puerto 5173 (proxy → :3000)
```
