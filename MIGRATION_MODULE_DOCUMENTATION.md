# Documentación del Módulo de Migración

## Tabla de Contenidos

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Modelos de Datos](#modelos-de-datos)
4. [API Reference](#api-reference)
5. [Sistema de Mappers](#sistema-de-mappers)
6. [Flujo de Datos](#flujo-de-datos)
7. [Estados y Transiciones](#estados-y-transiciones)
8. [Propuesta Técnica de Mejoras](#propuesta-técnica-de-mejoras)

---

## Resumen Ejecutivo

El módulo de migración permite importar contenido multimedia a la plataforma Mediastream desde archivos CSV. Soporta dos estrategias principales:

- **Transcodificación**: Descarga archivos desde URLs y los procesa a través de VMS
- **Upload**: Importa rendiciones pre-transcodificadas directamente

### Características Principales

| Característica | Descripción |
|----------------|-------------|
| Procesamiento por lotes | Miles de items en paralelo |
| Mapeo flexible | 19 tipos de mappers configurables |
| Estructura jerárquica | Categorías, Shows, Temporadas, Episodios |
| Recuperación de errores | Reintento de items fallidos |
| Reportes detallados | Export CSV con resultados |
| Tiempo real | Actualizaciones vía WebSocket |

---

## Arquitectura del Sistema

### Estructura de Archivos

```
src/server/
├── model/schemas/migration/
│   ├── migration_config.coffee    # Configuración principal
│   ├── migration_job.coffee       # Jobs de procesamiento CSV
│   ├── migration_item.coffee      # Items individuales
│   ├── _mapper/                   # Sistema de mappers (19 tipos)
│   │   ├── _base.coffee          # Clase base
│   │   ├── index.coffee          # Cargador dinámico
│   │   ├── id.coffee             # Mapper de ID único
│   │   ├── title.coffee          # Mapper de título
│   │   ├── original.coffee       # Mapper de URL origen
│   │   ├── rendition.coffee      # Mapper de rendiciones
│   │   ├── category.coffee       # Mapper de categorías
│   │   ├── tag.coffee            # Mapper de tags
│   │   └── ... (más mappers)
│   └── _runners/
│       ├── index.coffee          # Procesador principal
│       └── report.coffee         # Generador de reportes
├── routes/
│   ├── api/settings/migration/   # APIs públicas (14 endpoints)
│   ├── api/-/migration/          # APIs internas para workers
│   └── settings/migration/       # Rutas de UI
```

### Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENTE (UI)                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │ Crear    │  │ Subir    │  │ Controlar│  │ Ver Progreso     ││
│  │ Config   │  │ CSV      │  │ Start/   │  │ (WebSocket)      ││
│  │          │  │          │  │ Stop     │  │                  ││
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘│
└───────┼─────────────┼─────────────┼─────────────────┼──────────┘
        │             │             │                 │
        ▼             ▼             ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API LAYER (REST)                           │
│  /api/settings/migration/*                                      │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ create │ update │ start │ stop │ upload │ process │ report │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MODELO DE DATOS                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ MigrationConfig │◄─│  MigrationJob   │◄─│ MigrationItem   │ │
│  │                 │  │                 │  │                 │ │
│  │ - name          │  │ - source        │  │ - uniqueKey     │ │
│  │ - strategy      │  │ - fileName      │  │ - status        │ │
│  │ - mappings      │  │ - stats         │  │ - inputData     │ │
│  │ - stats         │  │ - metadata      │  │ - jobConfig     │ │
│  │ - status        │  │ - status        │  │ - vmsJobId      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                     SISTEMA DE MAPPERS                          │
│  ┌──────┐ ┌───────┐ ┌──────────┐ ┌─────────┐ ┌────────────────┐│
│  │  id  │ │ title │ │ original │ │category │ │ show/season/   ││
│  │      │ │       │ │/rendition│ │         │ │ episode        ││
│  └──────┘ └───────┘ └──────────┘ └─────────┘ └────────────────┘│
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                        RUNNERS                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Runner: createMedia → initialize → saveMedia → callVMS      ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Report: createOutput → processItems → generateZIP           ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SERVICIOS EXTERNOS                           │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐│
│  │     AWS S3     │  │      VMS       │  │     MongoDB        ││
│  │ (CSV, Reports) │  │ (Transcoding)  │  │  (Persistencia)    ││
│  └────────────────┘  └────────────────┘  └────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## Modelos de Datos

### MigrationConfig

Configuración principal de una migración.

```javascript
{
  _id: ObjectId,
  name: String,                    // Nombre de la migración
  account: ObjectId,               // Referencia a cuenta
  strategy: 'transcode' | 'upload',
  keys: [String],                  // Headers del CSV
  mappings: [{
    mapper: String,                // Tipo de mapper
    field: String,                 // Columna CSV
    options: Mixed                 // Opciones específicas
  }],
  stats: {
    waiting: Number,
    queued: Number,
    running: Number,
    done: Number,
    error: Number,
    updateTime: Date
  },
  status: 'new' | 'paused' | 'running' | 'done',
  report: String,                  // Nombre archivo reporte
  jobs: {
    pending: [ObjectId]            // Jobs pendientes aprobación
  },
  processTime: Number              // Tiempo total ms
}
```

### MigrationJob

Representa un archivo CSV siendo procesado.

```javascript
{
  _id: ObjectId,
  account: ObjectId,
  config: ObjectId,                // Ref a MigrationConfig
  source: {
    type: 'file' | 'rss',
    fileName: String
  },
  status: 'parseing' | 'pending' | 'waiting' | 'running' | 'paused',
  stats: {
    total: Number                  // Total items en archivo
  },
  metadata: Mixed,                 // Metadatos del parsing
  date_created: Date,
  processTime: Number
}
```

### MigrationItem

Item individual (fila de CSV) en proceso.

```javascript
{
  _id: ObjectId,
  account: ObjectId,
  uniqueKey: String,               // ID único (indexado)
  job: ObjectId,
  config: ObjectId,
  row: Number,                     // Número de fila en CSV
  status: 'waiting' | 'queuing' | 'queued' | 'running' | 'done' | 'error',
  queueLock: String,               // Lock de concurrencia
  error: String,                   // Mensaje de error
  vmsJobId: String,                // ID del job en VMS
  vmsJobResponse: Mixed,           // Respuesta de VMS
  inputData: Mixed,                // Datos originales CSV
  jobConfig: Mixed,                // Config procesada para VMS
  dateRun: Date,
  dateStart: Date,
  dateQueued: Date,
  dateEnded: Date,
  dateConsiderStalled: Date        // Timeout detection
}
```

---

## API Reference

### APIs de Configuración

#### Listar Migraciones
```
GET /api/settings/migration/index
```
**Response:**
```json
[{
  "_id": "...",
  "name": "Mi Migración",
  "status": "running",
  "stats": { "waiting": 100, "done": 50, "error": 2 }
}]
```

#### Crear Migración
```
POST /api/settings/migration/create
```
**Body:**
```json
{
  "name": "Migración de Videos",
  "strategy": "transcode",
  "mappings": [
    { "mapper": "id", "field": "video_id" },
    { "mapper": "title", "field": "titulo" },
    { "mapper": "original", "field": "url_video" }
  ]
}
```

#### Obtener Detalle
```
GET /api/settings/migration/{migration_id}
```

#### Actualizar Configuración
```
PUT /api/settings/migration/{migration_id}
```

#### Eliminar Migración
```
DELETE /api/settings/migration/{migration_id}
```

### APIs de Control

#### Iniciar Migración
```
PUT /api/settings/migration/{migration_id}/start
```
Cambia status: `new`/`paused` → `running`

#### Detener Migración
```
PUT /api/settings/migration/{migration_id}/stop
```
Cambia status: `running` → `paused`

#### Reintentar Errores
```
PUT /api/settings/migration/{migration_id}/retry
```
Items `error` → `waiting`, reinicia procesamiento.

#### Eliminar Items con Error
```
DELETE /api/settings/migration/{migration_id}/deleteErrored
```
Elimina items fallidos y sus medias asociadas.

### APIs de Archivos

#### Obtener URL de Subida
```
POST /api/settings/migration/{migration_id}/upload
```
**Response:**
```json
{
  "url": "https://s3.../presigned-upload-url",
  "fields": { ... }
}
```

#### Procesar Archivo CSV
```
POST /api/settings/migration/{migration_id}/process
```
**Body:**
```json
{
  "name": "contenido.csv"
}
```
Crea MigrationJob e inicia parsing.

### APIs de Reportes

#### Generar Reporte
```
POST /api/settings/migration/{migration_id}/report
```
Solo disponible cuando `status = 'done'`.

#### Descargar Reporte
```
GET /api/settings/migration/{migration_id}/downloadReport
```
Retorna URL presignada del ZIP.

### APIs de Jobs

#### Aprobar Job
```
PUT /api/settings/migration/{migration_id}/job/{job_id}/update
```
Aprueba job en status `pending`.

#### Eliminar Job
```
DELETE /api/settings/migration/{migration_id}/job/{job_id}
```

### APIs Internas (Workers/VMS)

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/-/migration/{item_id}/status` | GET | Estado actual del item |
| `/api/-/migration/{item_id}/start` | PUT | Worker inicia procesamiento |
| `/api/-/migration/{item_id}/done` | POST | Worker finaliza item |
| `/api/-/migration/{item_id}/ping` | PUT | Heartbeat (extiende timeout) |

---

## Sistema de Mappers

### Mappers Disponibles

| Mapper | Obligatorio | Descripción |
|--------|-------------|-------------|
| `id` | Sí | Identificador único del media |
| `title` | Sí | Título del contenido |
| `original` | Sí (transcode) | URL de origen para transcodificar |
| `rendition` | Sí (upload) | URLs de rendiciones pre-procesadas |
| `category` | No | Categorías/carpetas |
| `category_id` | No | ID de categoría existente |
| `tag` | No | Etiquetas del media |
| `description` | No | Descripción |
| `published` | No | Estado de publicación |
| `date_created` | No | Fecha de creación |
| `date_recorded` | No | Fecha de grabación |
| `thumb` | No | URLs de thumbnails |
| `geo` | No | Restricciones geográficas |
| `show` | No | Show (series) |
| `showSeason` | No | Temporada |
| `showSeasonEpisode` | No | Episodio |
| `custom` | No | Atributos personalizados |

### Ejemplo de Configuración de Mappers

```json
{
  "mappings": [
    {
      "mapper": "id",
      "field": "video_id"
    },
    {
      "mapper": "title",
      "field": "titulo"
    },
    {
      "mapper": "original",
      "field": "url_origen",
      "options": {
        "profile": "default",
        "zone": "latam"
      }
    },
    {
      "mapper": "category",
      "field": "categoria",
      "options": {
        "parent": "parent_categoria"
      }
    },
    {
      "mapper": "tag",
      "field": "tags",
      "options": {
        "separator": ","
      }
    }
  ]
}
```

---

## Flujo de Datos

### Diagrama de Flujo Completo

```
┌─────────────────────────────────────────────────────────────────┐
│                    FASE 1: CONFIGURACIÓN                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Usuario                                                       │
│      │                                                          │
│      ▼                                                          │
│   ┌─────────────────┐                                          │
│   │ Crear Config    │ POST /api/settings/migration/create      │
│   │ - name          │                                          │
│   │ - strategy      │                                          │
│   │ - mappings      │                                          │
│   └────────┬────────┘                                          │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐                                          │
│   │ MigrationConfig │ status = 'new'                           │
│   │ created         │                                          │
│   └─────────────────┘                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FASE 2: SUBIDA DE ARCHIVO                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐                                          │
│   │ Obtener URL S3  │ POST .../upload                          │
│   └────────┬────────┘                                          │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐                                          │
│   │ Subir CSV a S3  │ PUT presigned-url                        │
│   └────────┬────────┘                                          │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐                                          │
│   │ Notificar       │ POST .../process                         │
│   │ { name: "x.csv"}│                                          │
│   └────────┬────────┘                                          │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐                                          │
│   │ MigrationJob    │ status = 'parseing'                      │
│   │ created         │                                          │
│   └─────────────────┘                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FASE 3: PARSING CSV                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐                                          │
│   │ fast-csv lee    │ Descarga CSV de S3                       │
│   │ archivo         │                                          │
│   └────────┬────────┘                                          │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐  Para cada fila:                         │
│   │ createJobConfig │  - Valida datos                          │
│   │ por fila        │  - Aplica mappers                        │
│   └────────┬────────┘  - Crea MigrationItem                    │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐                                          │
│   │ MigrationItems  │ status = 'waiting'                       │
│   │ created (N)     │                                          │
│   └────────┬────────┘                                          │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐                                          │
│   │ MigrationJob    │ status = 'pending' (requiere aprobación) │
│   │ updated         │ o 'waiting' (si config running)          │
│   └─────────────────┘                                          │
│                                                                 │
│   WebSocket: PARSE_PROGRESS, PARSED                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FASE 4: EJECUCIÓN                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐                                          │
│   │ PUT .../start   │ Usuario inicia migración                 │
│   └────────┬────────┘                                          │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐                                          │
│   │ preRun()        │ - Ejecuta preRun de mappers              │
│   │                 │ - Pre-crea categorías, shows             │
│   └────────┬────────┘                                          │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐                                          │
│   │ queueItem()     │ Obtiene items 'waiting'                  │
│   └────────┬────────┘                                          │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐                                          │
│   │ item.run()      │ Para cada item:                          │
│   │                 │ - Lock concurrencia                      │
│   │                 │ - status → 'queuing' → 'queued'          │
│   └────────┬────────┘                                          │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐                                          │
│   │ Runner.start()  │ - createMedia()                          │
│   │                 │ - initialize() (runJobConfig)            │
│   │                 │ - saveMedia()                            │
│   │                 │ - callVMS()                              │
│   └────────┬────────┘                                          │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐                                          │
│   │ VMS Job Created │ vmsJobId guardado en item                │
│   └─────────────────┘                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FASE 5: PROCESAMIENTO VMS                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐                                          │
│   │ VMS Worker      │ Procesa media:                           │
│   │                 │ - Descarga/transcoding                   │
│   │                 │ - Genera rendiciones                     │
│   └────────┬────────┘                                          │
│            │                                                    │
│            ├──► GET /api/-/migration/{id}/status               │
│            │                                                    │
│            ├──► PUT /api/-/migration/{id}/start                │
│            │    status → 'running'                             │
│            │                                                    │
│            ├──► PUT /api/-/migration/{id}/ping (heartbeat)     │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐                                          │
│   │ POST .../done   │ Worker finaliza                          │
│   │ { status: ... } │ 'done' o 'error'                         │
│   └────────┬────────┘                                          │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐                                          │
│   │ MigrationItem   │ status = 'done' | 'error'                │
│   │ updated         │ vmsJobResponse guardada                  │
│   └─────────────────┘                                          │
│                                                                 │
│   WebSocket: STATS actualizado                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FASE 6: FINALIZACIÓN                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────┐                                          │
│   │ Todos items     │ MigrationConfig.status = 'done'          │
│   │ procesados      │                                          │
│   └────────┬────────┘                                          │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐                                          │
│   │ POST .../report │ Genera reporte ZIP                       │
│   └────────┬────────┘                                          │
│            │                                                    │
│            ▼                                                    │
│   ┌─────────────────┐                                          │
│   │ GET .../        │ Descarga reporte                         │
│   │ downloadReport  │                                          │
│   └─────────────────┘                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Estados y Transiciones

### MigrationConfig Estados

```
┌───────┐      start()      ┌─────────┐
│  new  │ ─────────────────►│ running │
└───────┘                   └────┬────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
              ▼                  ▼                  ▼
         stop()            items done       new items
              │                  │                  │
              ▼                  ▼                  ▼
        ┌─────────┐        ┌─────────┐        ┌─────────┐
        │ paused  │◄───────│  done   │───────►│ paused  │
        └────┬────┘        └─────────┘        └────┬────┘
             │                                     │
             └──────────── start() ────────────────┘
```

### MigrationItem Estados

```
┌─────────┐
│ waiting │  Item creado, esperando procesamiento
└────┬────┘
     │ item.run() con lock
     ▼
┌─────────┐
│ queuing │  Bloqueado temporalmente (concurrencia)
└────┬────┘
     │ lock adquirido
     ▼
┌─────────┐
│ queued  │  Enviado a VMS, esperando worker
└────┬────┘
     │ worker: PUT .../start
     ▼
┌─────────┐
│ running │  Worker procesando
└────┬────┘
     │ worker: POST .../done
     ▼
┌─────────┐        ┌─────────┐
│  done   │   o    │  error  │
└─────────┘        └────┬────┘
                        │ retry()
                        ▼
                   ┌─────────┐
                   │ waiting │
                   └─────────┘
```

---

## Propuesta Técnica de Mejoras

### Problemas Identificados

| # | Problema | Impacto | Prioridad |
|---|----------|---------|-----------|
| 1 | Sin validación previa del CSV | Errores descubiertos tarde | Alta |
| 2 | Falta de progreso granular | Usuario no sabe qué está pasando | Alta |
| 3 | Reintentos manuales | Requiere intervención constante | Media |
| 4 | Sin cancelación individual | Todo o nada | Media |
| 5 | Reportes solo al final | No hay visibilidad parcial | Media |
| 6 | Items estancados silenciosos | 2 horas sin notificación | Alta |
| 7 | Sin rate limiting | Puede sobrecargar VMS | Media |
| 8 | Logs dispersos | Difícil debugging | Baja |

---

### Mejora 1: Validación Previa del CSV

**Problema Actual:**
Los errores de formato, URLs inválidas o datos faltantes solo se descubren durante el parsing o ejecución.

**Propuesta:**

```javascript
// Nuevo endpoint
POST /api/settings/migration/{id}/validate-file

// Request
{
  "fileName": "contenido.csv",
  "sampleSize": 100  // Opcional, default 100
}

// Response
{
  "valid": false,
  "totalRows": 5000,
  "sampledRows": 100,
  "errors": [
    {
      "row": 15,
      "field": "url_video",
      "mapper": "original",
      "error": "URL inválida o inaccesible",
      "value": "htp://invalid"
    },
    {
      "row": 23,
      "field": "video_id",
      "mapper": "id",
      "error": "Valor duplicado",
      "value": "VID001"
    }
  ],
  "warnings": [
    {
      "type": "missing_optional",
      "field": "description",
      "count": 45,
      "message": "45 filas sin descripción"
    }
  ],
  "preview": [
    {
      "row": 1,
      "input": { "video_id": "V001", "titulo": "Video 1" },
      "output": { "uniqueKey": "V001", "title": "Video 1" }
    }
  ]
}
```

**Beneficios:**
- Detecta errores antes de iniciar
- Muestra preview de cómo se procesarán los datos
- Reduce items con error

---

### Mejora 2: Progreso Granular y Dashboard

**Problema Actual:**
Solo se muestran contadores globales (waiting, done, error). El usuario no sabe qué items específicos están procesándose.

**Propuesta:**

```javascript
// Eventos WebSocket mejorados
{
  "type": "ITEM_STATUS",
  "data": {
    "itemId": "...",
    "uniqueKey": "VID001",
    "title": "Mi Video",
    "status": "running",
    "progress": 45,  // Porcentaje de transcoding
    "step": "transcoding",  // parsing, queued, downloading, transcoding, uploading
    "startTime": "2024-01-15T10:30:00Z",
    "estimatedEnd": "2024-01-15T10:35:00Z"
  }
}

// Nuevo endpoint para items activos
GET /api/settings/migration/{id}/active-items

// Response
{
  "items": [
    {
      "_id": "...",
      "uniqueKey": "VID001",
      "title": "Video 1",
      "status": "running",
      "progress": 45,
      "step": "transcoding",
      "duration": 300000  // ms desde inicio
    }
  ],
  "queue": {
    "waiting": 450,
    "nextBatch": ["VID002", "VID003", "VID004"]
  }
}
```

**UI Mejorada:**
```
┌────────────────────────────────────────────────────────────────┐
│ Migración: Contenido Q1 2024                         [Pausar]  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  Progreso General: ████████████░░░░░░░░ 60% (3000/5000)       │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ En Proceso (5)                                           │ │
│  ├──────────────────────────────────────────────────────────┤ │
│  │ VID001 - Video Tutorial 1    [████████░░] 80% transcod.  │ │
│  │ VID002 - Video Tutorial 2    [██████░░░░] 60% transcod.  │ │
│  │ VID003 - Video Demo          [████░░░░░░] 40% download   │ │
│  │ VID004 - Webinar Intro       [██░░░░░░░░] 20% download   │ │
│  │ VID005 - Presentación        [░░░░░░░░░░] queued         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  Estadísticas:                                                 │
│  ✓ Completados: 2997    ⚠ Errores: 3    ⏳ Pendientes: 2000   │
│                                                                │
│  Velocidad: 15 items/min    ETA: 2h 13min                     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

### Mejora 3: Sistema de Reintentos Automáticos

**Problema Actual:**
Los items fallidos requieren intervención manual para reintentarlos.

**Propuesta:**

```javascript
// Configuración en MigrationConfig
{
  "retryPolicy": {
    "enabled": true,
    "maxRetries": 3,
    "backoffType": "exponential",  // linear, exponential, fixed
    "initialDelay": 60000,         // 1 minuto
    "maxDelay": 3600000,           // 1 hora
    "retryableErrors": [
      "TIMEOUT",
      "NETWORK_ERROR",
      "VMS_BUSY",
      "RATE_LIMITED"
    ]
  }
}

// Nuevo campo en MigrationItem
{
  "retryCount": 2,
  "retryHistory": [
    {
      "attempt": 1,
      "date": "2024-01-15T10:30:00Z",
      "error": "TIMEOUT",
      "nextRetry": "2024-01-15T10:31:00Z"
    },
    {
      "attempt": 2,
      "date": "2024-01-15T10:31:00Z",
      "error": "VMS_BUSY",
      "nextRetry": "2024-01-15T10:33:00Z"
    }
  ],
  "nextRetryDate": Date  // Para scheduler
}
```

**Lógica de Reintentos:**
```javascript
// En post-save de MigrationItem cuando status = 'error'
if (retryPolicy.enabled && item.retryCount < retryPolicy.maxRetries) {
  const delay = calculateBackoff(item.retryCount, retryPolicy);
  const retryableError = isRetryableError(item.error, retryPolicy);

  if (retryableError) {
    item.status = 'waiting';
    item.nextRetryDate = new Date(Date.now() + delay);
    item.retryCount++;
    item.retryHistory.push({ ... });
    // Scheduler recogerá items con nextRetryDate <= now
  }
}
```

---

### Mejora 4: Cancelación y Control Individual

**Problema Actual:**
No se pueden cancelar items individuales, solo pausar toda la migración.

**Propuesta:**

```javascript
// Nuevo endpoint
DELETE /api/settings/migration/{id}/items/{item_id}
PUT /api/settings/migration/{id}/items/{item_id}/cancel

// Cancelación masiva por filtro
POST /api/settings/migration/{id}/items/cancel
{
  "filter": {
    "status": "waiting",
    "category": "Series/Drama"
  }
}

// Priorización de items
PUT /api/settings/migration/{id}/items/{item_id}/priority
{
  "priority": "high"  // high, normal, low
}

// Nuevo campo en MigrationItem
{
  "priority": "normal",
  "cancelled": false,
  "cancelledBy": ObjectId,
  "cancelledAt": Date
}
```

**UI:**
```
┌─────────────────────────────────────────────────────────────┐
│ Items en Cola (500)                    [Filtrar] [Cancelar] │
├─────────────────────────────────────────────────────────────┤
│ □ VID100 - Video A     waiting     normal    [⬆][✕]        │
│ □ VID101 - Video B     waiting     normal    [⬆][✕]        │
│ ☑ VID102 - Video C     waiting     high      [⬇][✕]        │
│ □ VID103 - Video D     error       normal    [🔄][✕]       │
├─────────────────────────────────────────────────────────────┤
│ Seleccionados: 1       [Priorizar] [Cancelar] [Reintentar] │
└─────────────────────────────────────────────────────────────┘
```

---

### Mejora 5: Reportes en Tiempo Real

**Problema Actual:**
Los reportes solo se generan cuando la migración está completa.

**Propuesta:**

```javascript
// Reporte parcial en cualquier momento
GET /api/settings/migration/{id}/report/preview
{
  "status": ["done", "error"],  // Filtro opcional
  "limit": 1000
}

// Response streamed
{
  "headers": ["video_id", "titulo", "status", "platformMediaId", "error"],
  "rows": [
    ["VID001", "Video 1", "done", "MEDIA123", null],
    ["VID002", "Video 2", "error", null, "URL inaccesible"]
  ],
  "hasMore": true,
  "cursor": "abc123"
}

// Exportación incremental
POST /api/settings/migration/{id}/report/stream
{
  "format": "csv",
  "filter": { "status": "error" },
  "includeInProgress": false
}

// WebSocket para notificaciones de error en tiempo real
{
  "type": "ITEM_ERROR",
  "data": {
    "itemId": "...",
    "uniqueKey": "VID002",
    "title": "Video 2",
    "error": "URL inaccesible",
    "row": 15,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

---

### Mejora 6: Detección y Alerta de Items Estancados

**Problema Actual:**
Items estancados (2 horas sin respuesta) no generan alertas activas.

**Propuesta:**

```javascript
// Configuración en MigrationConfig
{
  "stalledPolicy": {
    "detectionThreshold": 900000,  // 15 minutos (reducido de 2 horas)
    "action": "retry",  // retry, cancel, alert
    "alertChannels": ["websocket", "email", "webhook"]
  }
}

// Nuevo endpoint para items estancados
GET /api/settings/migration/{id}/stalled-items

// Response
{
  "items": [
    {
      "_id": "...",
      "uniqueKey": "VID050",
      "status": "running",
      "lastPing": "2024-01-15T10:00:00Z",
      "stalledDuration": 1800000,  // 30 min
      "vmsJobId": "...",
      "action": "pending_retry"
    }
  ]
}

// WebSocket alert
{
  "type": "ITEM_STALLED",
  "data": {
    "itemId": "...",
    "uniqueKey": "VID050",
    "stalledDuration": 1800000,
    "suggestedAction": "retry"
  }
}

// Job automático cada 5 minutos
// Busca items con dateConsiderStalled < now
// Ejecuta acción según stalledPolicy
```

---

### Mejora 7: Rate Limiting y Control de Carga

**Problema Actual:**
Sin límites, puede sobrecargar VMS o servicios externos.

**Propuesta:**

```javascript
// Configuración en MigrationConfig
{
  "rateLimiting": {
    "maxConcurrent": 10,           // Items simultáneos
    "maxPerMinute": 60,            // Items por minuto
    "pauseOnVmsLoad": true,        // Pausa si VMS sobrecargado
    "vmsLoadThreshold": 80,        // % de carga VMS
    "downloadBandwidth": 100       // MB/s máximo
  }
}

// Estado de rate limiting
{
  "type": "RATE_LIMIT_STATUS",
  "data": {
    "currentConcurrent": 8,
    "maxConcurrent": 10,
    "itemsThisMinute": 45,
    "maxPerMinute": 60,
    "vmsLoad": 65,
    "throttled": false
  }
}

// Endpoint para ajuste dinámico
PUT /api/settings/migration/{id}/rate-limit
{
  "maxConcurrent": 5  // Reducir temporalmente
}
```

---

### Mejora 8: Sistema de Logs Centralizado

**Problema Actual:**
Logs dispersos dificultan el debugging.

**Propuesta:**

```javascript
// Nuevo modelo MigrationLog
{
  "_id": ObjectId,
  "config": ObjectId,
  "job": ObjectId,
  "item": ObjectId,
  "level": "info" | "warn" | "error" | "debug",
  "category": "parsing" | "validation" | "processing" | "vms" | "system",
  "message": String,
  "data": Mixed,
  "timestamp": Date,
  "stack": String  // Para errores
}

// Endpoint para logs
GET /api/settings/migration/{id}/logs
{
  "level": ["error", "warn"],
  "category": "vms",
  "from": "2024-01-15T00:00:00Z",
  "to": "2024-01-16T00:00:00Z",
  "limit": 100
}

// WebSocket para logs en tiempo real
{
  "type": "LOG",
  "data": {
    "level": "error",
    "category": "vms",
    "message": "VMS returned 503",
    "itemId": "...",
    "timestamp": "..."
  }
}
```

**UI de Logs:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Logs de Migración                [Info][Warn][Error] [Filtrar] │
├─────────────────────────────────────────────────────────────────┤
│ 10:30:15 [ERROR] [vms] VMS returned 503 - Item: VID050         │
│ 10:30:10 [WARN]  [validation] URL lenta (5s) - Item: VID049    │
│ 10:30:05 [INFO]  [processing] Item completado - Item: VID048   │
│ 10:30:00 [INFO]  [processing] Iniciando item - Item: VID050    │
│ 10:29:55 [ERROR] [parsing] Fila 150: campo vacío               │
└─────────────────────────────────────────────────────────────────┘
```

---

### Mejora 9: Templates de Migración

**Problema Actual:**
Cada migración requiere configurar mappings desde cero.

**Propuesta:**

```javascript
// Nuevo modelo MigrationTemplate
{
  "_id": ObjectId,
  "account": ObjectId,
  "name": "Template para YouTube",
  "description": "Importación desde export de YouTube",
  "strategy": "transcode",
  "mappings": [...],
  "expectedHeaders": ["video_id", "title", "url"],
  "isPublic": false,
  "usageCount": 15
}

// Endpoints
GET /api/settings/migration/templates
POST /api/settings/migration/templates
POST /api/settings/migration/from-template/{template_id}

// UI: Selector de template al crear migración
┌─────────────────────────────────────────────────────────────────┐
│ Nueva Migración                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ○ Empezar desde cero                                          │
│                                                                 │
│  ● Usar template existente:                                    │
│    ┌─────────────────────────────────────────────────────────┐ │
│    │ ★ Template YouTube (usado 15 veces)                     │ │
│    │   Template Vimeo                                        │ │
│    │   Template Custom CSV                                   │ │
│    └─────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [Siguiente]                                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Mejora 10: Dry Run / Modo Simulación

**Problema Actual:**
No hay forma de probar una migración sin ejecutarla realmente.

**Propuesta:**

```javascript
// Nuevo modo en MigrationConfig
{
  "mode": "live" | "dry_run",
  "dryRunOptions": {
    "simulateVms": true,
    "simulateDelay": 5000,  // ms por item
    "simulateErrorRate": 0.05  // 5% de errores
  }
}

// En dry_run:
// - No crea Media real
// - No llama a VMS
// - Simula tiempos y resultados
// - Genera reporte de "qué hubiera pasado"

// Response de dry run
{
  "summary": {
    "wouldCreate": 500,
    "wouldUpdate": 50,
    "wouldFail": 25,
    "estimatedTime": 7200000
  },
  "issues": [
    {
      "type": "duplicate_id",
      "count": 10,
      "samples": ["VID001", "VID002"]
    },
    {
      "type": "invalid_url",
      "count": 15,
      "samples": ["row 45", "row 89"]
    }
  ],
  "preview": {
    "categories": ["Series/Drama", "Series/Comedy"],
    "shows": ["Show A", "Show B"],
    "mediaTypes": { "video": 450, "audio": 50 }
  }
}
```

---

## Resumen de Mejoras

| # | Mejora | Esfuerzo | Impacto | Prioridad |
|---|--------|----------|---------|-----------|
| 1 | Validación previa CSV | Medio | Alto | P1 |
| 2 | Progreso granular | Medio | Alto | P1 |
| 3 | Reintentos automáticos | Medio | Alto | P1 |
| 4 | Cancelación individual | Bajo | Medio | P2 |
| 5 | Reportes tiempo real | Medio | Medio | P2 |
| 6 | Alertas items estancados | Bajo | Alto | P1 |
| 7 | Rate limiting | Medio | Medio | P2 |
| 8 | Logs centralizados | Medio | Medio | P3 |
| 9 | Templates | Bajo | Medio | P3 |
| 10 | Dry run / Simulación | Alto | Alto | P2 |

### Orden de Implementación Sugerido

**Fase 1 - Fundamentos (Crítico):**
1. Validación previa CSV
2. Alertas items estancados
3. Reintentos automáticos

**Fase 2 - Experiencia de Usuario:**
4. Progreso granular y dashboard
5. Cancelación individual
6. Reportes en tiempo real

**Fase 3 - Optimización:**
7. Rate limiting
8. Dry run / Simulación

**Fase 4 - Calidad de Vida:**
9. Logs centralizados
10. Templates de migración

---

## Apéndice: Ejemplos de Uso

### Ejemplo 1: Migración Simple de Videos

```bash
# 1. Crear configuración
curl -X POST /api/settings/migration/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Videos Q1 2024",
    "strategy": "transcode",
    "mappings": [
      { "mapper": "id", "field": "video_id" },
      { "mapper": "title", "field": "titulo" },
      { "mapper": "original", "field": "url" }
    ]
  }'

# 2. Obtener URL de subida
curl -X POST /api/settings/migration/{id}/upload

# 3. Subir archivo a S3
curl -X PUT "{presigned_url}" -d @videos.csv

# 4. Iniciar procesamiento
curl -X POST /api/settings/migration/{id}/process \
  -d '{ "name": "videos.csv" }'

# 5. Iniciar migración
curl -X PUT /api/settings/migration/{id}/start
```

### Ejemplo 2: CSV con Estructura Jerárquica

```csv
video_id,titulo,url,categoria,subcategoria,show,temporada,episodio
V001,Piloto,http://...,Series,Drama,Breaking Bad,1,1
V002,El Gato,http://...,Series,Drama,Breaking Bad,1,2
V003,Piloto,http://...,Series,Comedia,The Office,1,1
```

```json
{
  "mappings": [
    { "mapper": "id", "field": "video_id" },
    { "mapper": "title", "field": "titulo" },
    { "mapper": "original", "field": "url" },
    {
      "mapper": "category",
      "field": "subcategoria",
      "options": { "parent": "categoria" }
    },
    { "mapper": "show", "field": "show" },
    { "mapper": "showSeason", "field": "temporada" },
    { "mapper": "showSeasonEpisode", "field": "episodio" }
  ]
}
```

---

*Documento generado el 2024 - Módulo de Migración v1.0*
