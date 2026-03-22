# MigrAgent — Análisis de Nuevas Funciones Diferenciadoras
**Fecha:** 2026-03-21
**Basado en:** Revisión del codebase MigrAgent + mapeo completo de API SM2 + feedback de producto

---

## Contexto

Este documento define las nuevas capacidades a incorporar en MigrAgent para convertirlo en una herramienta de migración de nivel profesional, siguiendo el marco ETL (Extract → Transform → Load) y los principios de un proceso eficiente: **auditable, resiliente, escalable e invisible para el usuario final**.

Cada feature está mapeado contra los endpoints SM2 disponibles para confirmar su viabilidad técnica.

---

## 1. EXTRACCIÓN (Extract) — Nuevos orígenes de datos

### 1.1 Conectores de Origen (ALTA PRIORIDAD)

**Brecha actual:** MigrAgent solo acepta CSV cargado manualmente. No hay conectores para otros tipos de origen.

**Orígenes a implementar:**

| Origen | Descripción | Prioridad |
|--------|-------------|-----------|
| CSV manual (actual) | Upload de archivo CSV | Ya existe |
| XML / RSS feed | Parsear feeds XML estándar de CMS | Alta |
| JSON | Parsear export JSON de cualquier CMS | Alta |
| API Connector | Extracción vía REST API del sistema origen | Alta |
| Upload local | El cliente sube archivos desde su PC directamente a SM2 | Media |

---

#### Origen: XML / RSS Feed

Muchos CMS exportan su contenido como XML o RSS. MigrAgent recibiría el archivo XML y lo parsearía para extraer los items.

**Implementación:**
- Librería: `fast-xml-parser` (ya identificada, sin instalación previa)
- El usuario sube el archivo `.xml` o `.rss` igual que sube el CSV hoy
- MigrAgent detecta el formato por extensión/estructura y elige el parser
- El campo mapping del Wizard Step 3 funciona igual que con CSV: detectar campos del XML → mapear a campos SM2

**Casos de uso reales:** WordPress XML export, RSS feeds de plataformas de video, MRSS (Media RSS).

---

#### Origen: JSON

Exportaciones en JSON desde APIs o CMS modernos (Contentful, Strapi, etc.).

**Implementación:**
- El usuario sube el archivo `.json`
- MigrAgent detecta si es un array de objetos o un objeto con un array interno (configurable: "¿dónde está la lista de items?")
- Mismo flujo de mapeo que CSV/XML

---

#### Origen: API Connector

El cliente tiene un CMS con API REST propia. En lugar de exportar un CSV, MigrAgent consulta la API origen directamente.

**Flujo:**
1. El usuario configura:
   - URL base del API origen (ej: `https://api.cms-antiguo.com/v1`)
   - Patrón de endpoint por ID (ej: `/content/{id}`)
   - Lista de IDs a migrar (pegados en un textarea o subidos en un TXT, uno por línea)
   - Headers de autenticación opcionales (Bearer token, API key)
2. MigrAgent hace `GET {baseUrl}/content/{id}` para cada ID en la lista
3. La respuesta JSON de cada GET se trata como una fila del dataset
4. El Wizard Step 3 muestra los campos encontrados en la respuesta y permite mapearlos igual que con CSV

**Por qué es diferente a pegar una URL de CSV:** Los datos nunca se almacenan fuera del flujo de migración (no hay un archivo "en caliente" que el cliente pueda modificar sin que MigrAgent lo sepa). Cada GET queda registrado en el log de auditoría, preservando exactamente qué datos se extrajeron en el momento de la migración.

**Implementación técnica:**
- Nuevo tipo de origen `api_connector` en la tabla `Migration`
- Campos adicionales: `api_base_url`, `api_endpoint_pattern`, `api_id_list (JSON array)`, `api_headers (JSON)`
- El `CSVValidatorService` se extiende con un `ApiConnectorService` que itera los IDs y construye el dataset en memoria
- Rate limiting configurable (ej: máx 5 requests/segundo al API origen) para no saturar el sistema del cliente

---

#### Origen: Upload Local de Archivos

El cliente tiene los archivos multimedia (MP4, MP3, etc.) en su computadora local y quiere migrarlos directamente a SM2 sin que estén alojados en ningún servidor.

**Flujo propuesto:**
1. El usuario sube un CSV/JSON de metadatos (título, descripción, tags, etc.) — **sin columna de URL**
2. En el Wizard, después del mapeo, aparece un paso de "Upload de archivos":
   - Se muestra la lista de items del CSV
   - Por cada item, el usuario arrastra/selecciona el archivo local correspondiente
   - MigrAgent valida que el nombre de archivo coincida con el campo `filename` del CSV (opcional: auto-match por nombre)
3. Durante la ejecución, por cada item:
   a. `POST /api/media` → crear el media en SM2 con sus metadatos
   b. `GET /api/media/upload` → obtener la URL de upload (presigned S3 URL)
   c. Upload directo del archivo al S3 de SM2 desde el browser (no pasa por el servidor de MigrAgent)
   d. SM2 recibe el archivo y lo procesa

**Endpoints SM2 relevantes:**
```
POST /api/media              → crear media con metadatos
GET  /api/media/upload       → obtener config de upload (presigned URL a S3)
POST /api/media/upload       → confirmar upload completado
DELETE /api/media/upload     → cancelar upload
```

**Por qué diferencia:** Convierte MigrAgent en la herramienta para clientes que tienen contenido exclusivamente local y no tienen CDN ni servidor propio. El upload es ordenado, trazable y con control de errores, algo que hacerlo manualmente por la UI de SM2 item por item es inviable para cientos de archivos.

**Consideración técnica importante:** El upload desde el browser va directo a S3 (no pasa por MigrAgent), por lo que no hay límite de tamaño en el servidor de MigrAgent. Sí hay que manejar el progreso de cada upload vía `XMLHttpRequest.upload.onprogress` y reportarlo al backend por Socket.IO.

---

## 2. TRANSFORMACIÓN (Transform) — Enriquecimiento y limpieza

### 2.1 Motor de Reglas de Transformación (ALTA PRIORIDAD)

**Brecha actual:** Los mappers solo hacen mapeo 1:1 de columnas. No hay lógica de transformación sobre los datos.

**Propuesta:** Agregar un sistema de reglas en el Wizard Step 3 (mapeo) que permita definir transformaciones sobre los datos antes de enviarlos a SM2:

```
Regla 1: Si [category_id] está vacío → asignar valor por defecto: 42
Regla 2: Si [title] contiene "[BORRADOR]" → marcar como privado (published=false)
Regla 3: Reemplazar en [tags]: "futbol" → "fútbol"
Regla 4: Si [duration] > 7200 → añadir tag "long-form"
Regla 5: Concatenar [show_name] + " - " + [episode_number] → [title]
```

**Tipos de reglas a implementar:**

| Tipo | Ejemplo |
|------|---------|
| Valor por defecto | Si `[campo]` está vacío → usar `[valor]` |
| Reemplazo | Reemplazar `[texto]` por `[nuevo texto]` en `[campo]` |
| Condicional | Si `[campo]` `[operador]` `[valor]` → `[acción]` |
| Concatenación | `[campo_a]` + `" - "` + `[campo_b]` → `[campo_destino]` |
| Normalización | Aplicar trim / lowercase / remove accents a `[campo]` |
| Derivado | Calcular `[campo_destino]` desde una expresión sobre otros campos |

**Implementación técnica:**
- Las reglas se guardan en el campo `mappers (JSON)` de la tabla `Migration` como una sección `transformation_rules`
- Se ejecutan en el `CSVValidatorService` después del mapeo y antes de la validación
- La UI en Step 3 es un editor visual tipo "si → entonces" con dropdowns para campos y operadores, sin código
- Las reglas forman parte del Template para reutilizarlas en migraciones futuras

**Por qué diferencia:** El cliente no puede controlar el CSV del sistema origen, pero sí puede definir reglas de limpieza. Convierte MigrAgent de una herramienta de transporte en una herramienta de **gobernanza y limpieza de datos**.

---

### 2.2 Deduplicación por Historial de Migraciones (MEDIA PRIORIDAD)

**Brecha actual:** Solo se detectan IDs duplicados dentro del CSV actual. No hay detección cruzada con migraciones previas.

**Problema con búsqueda por título:** Buscar en SM2 por título para detectar duplicados es poco confiable — dos items distintos pueden tener el mismo título, y el contenido encontrado puede no ser el que se migró.

**Propuesta revisada:** Comparar los IDs origen del CSV actual contra los IDs que ya figuran como exitosos en reportes de migraciones anteriores dentro de MigrAgent.

**Flujo:**
1. Al validar el CSV (Step 3/5), MigrAgent consulta su propia base de datos: ¿alguno de los IDs de este CSV ya aparece como migrado exitosamente en otra migración?
2. Si hay coincidencias, se muestran en el Step 5 (Validation Report) como "Items posiblemente ya migrados"
3. El usuario elige qué hacer con cada uno: **Omitir** / **Actualizar en SM2** / **Migrar de todas formas**

**Tablas involucradas:** `MigrationLog` + `ValidationResult` — ya existen, solo hay que agregar una consulta de cruce.

**Limitación conocida:** Si los items fueron eliminados de SM2 después de ser migrados, el historial de MigrAgent dirá "ya migrado" pero en realidad no existe en destino. La UI debe dejar claro que es una advertencia basada en el historial local, no una verificación en tiempo real.

---

### 2.3 Activación del Pipeline de IA de SM2 (DIFERENCIADOR CLAVE)

**Brecha actual:** Los metadatos migran exactamente como están en el CSV, sin enriquecimiento posterior.

**Hallazgo en SM2:** SM2 tiene su propio pipeline de IA completo, configurable por cuenta:

| Capacidad SM2 | Descripción | Cómo se activa |
|---------------|-------------|----------------|
| **AI Metadata Generation** | Genera título, descripción, tags automáticamente (vía Lambda + OpenAI) | `POST /api/settings/ai` con `ai.metadata.automatic=true` |
| **AI Transcription** | Genera subtítulos automáticos (Deepgram) | `POST /api/media/:id/transcription` |
| **AI Highlights** | Genera clips destacados del video (Lambda) | Trigger via `/api/-/media/:id/notify-media-transcription/highlights` |
| **AI Chapters** | Genera capítulos automáticos (Lambda) | Trigger via `/api/-/media/:id/notify-media-transcription/chapters` |
| **Custom Prompts** | El cliente personaliza qué genera la IA | `POST /api/settings/ai/prompts` |

**Propuesta:** En el Step 6 (Confirmación), agregar una sección "Enriquecimiento con IA post-migración":

```
[ ] Activar AI Metadata Generation para items sin descripción
[ ] Activar AI Transcription (subtítulos automáticos)
[ ] Activar AI Highlights
[ ] Activar AI Chapters
```

MigrAgent, después de crear cada item en SM2, dispara los módulos de IA seleccionados sobre ese media_id. El procesamiento de IA corre de forma asíncrona en la infraestructura de SM2.

**Por qué es mejor que integrar Claude directamente:**
- Usa los modelos que el cliente ya tiene configurados y pagados en su cuenta SM2
- El output (subtítulos, highlights, capítulos) queda almacenado directamente en SM2, no hay que volver a enviarlo
- SM2 ya tiene la lógica de reintentos, tracking y notificaciones para estos jobs

**Endpoints SM2 relevantes:**
```
POST /api/media/:id/transcription                             → activar transcripción
GET  /api/lookup/ai_models                                    → qué modelos tiene disponibles la cuenta
POST /api/settings/ai                                         → verificar/activar configuración de IA
GET  /api/settings/ai/models/:name                           → detalles del modelo configurado
POST /api/-/media/:id/notify-media-transcription/metadata    → trigger metadata generation
POST /api/-/media/:id/notify-media-transcription/highlights  → trigger highlights
POST /api/-/media/:id/notify-media-transcription/chapters    → trigger chapters
```

---

## 3. CARGA (Load) — Control y resiliencia

### 3.1 Migración por Lotes con Migraciones SM2 Nombradas (ALTA PRIORIDAD)

**Brecha actual:** La migración procesa todo el CSV de una vez. No hay forma de hacer una migración piloto ni dividir en fases rastreables.

**Propuesta:** El usuario divide el CSV en lotes configurables. **Cada lote se convierte en una migración independiente y nombrada en SM2**, lo que permite trazabilidad completa desde SM2 además de desde MigrAgent.

**UI en Step 6:**
```
Modo de migración:
( ) Migración completa — 8,432 items en una sola migración SM2
(x) Por lotes         — Dividir en lotes de [___500___] items

  Estrategia de selección del primer lote:
  [x] Primeros N del CSV      [ ] Últimos N      [ ] Aleatorio      [ ] Por categoría

  Nomenclatura automática en SM2:
  Prefijo: [_________Proyecto Noticias__________]
  → Se crearán: "Proyecto Noticias - Lote 1/17", "Proyecto Noticias - Lote 2/17", etc.

  Modo de ejecución:
  ( ) Crear todos los lotes de una vez (automático)
  (x) Crear lote a lote con confirmación manual entre cada uno (piloto)
```

**Implementación técnica:**
- Nuevos campos en la tabla `Migration`: `batch_size`, `batch_strategy`, `batch_name_prefix`, `batch_total`, `batch_current`, `batch_mode (auto|manual)`
- En modo piloto: al completar el Lote 1, el estado pasa a `batch_waiting_confirmation` y se notifica al usuario
- El usuario revisa el reporte del lote y aprueba o detiene la continuación
- Cada lote crea su propia migración en SM2 con el nombre generado automáticamente
- MigrAgent trackea todos los lotes como hijos de una migración "padre"

**Por qué diferencia:** El cliente valida que todo funciona con los primeros 500 items antes de comprometer el presupuesto de transcodificación de 8,000 videos restantes. Y en SM2 quedan migraciones bien nombradas para auditoría interna.

---

### 3.2 Cola Inteligente con Prioridad (MEDIA PRIORIDAD)

**Brecha actual:** Los items se procesan en el orden del CSV. No hay priorización.

**Propuesta:** Definir reglas de prioridad para el orden de procesamiento:

```
Prioridad ALTA:   items donde [featured] = "true"
Prioridad MEDIA:  items donde [category] = "noticias"
Prioridad BAJA:   resto
```

**Resultado:** Los items marcados como destacados llegan primero a SM2 aunque la migración tarde horas. El sitio puede "abrir" con el contenido más importante mientras el resto sigue procesando.

**Implementación:** Ordenamiento del array de items antes de la carga, usando las mismas reglas de transformación (sección 2.1). Las reglas de prioridad son un tipo especial de regla de transformación que agrega un campo `_priority` al dataset y luego ordena por él.

**Consideración de implementación:** El orden se aplica antes de dividir en lotes (sección 3.1) para garantizar que el Lote 1 siempre contenga los items de mayor prioridad.

---

### 3.3 Campos Extendidos en la Migración SM2 (MEDIA PRIORIDAD)

**Brecha actual:** MigrAgent solo mapea los campos básicos. La migración nativa de SM2 soporta más campos que no estamos aprovechando.

**Propuesta:** Revisar todos los campos que acepta `POST /api/settings/migration` y `POST /api/settings/migration/:id/upload` en SM2, e incorporar los que aún no estén en el mapper de MigrAgent:

- Thumbnails (URL de imagen de portada)
- Subtítulos (URL de archivo VTT/SRT)
- Restricciones geográficas (geo)
- Campos de shows/episodios
- Metadata custom (campos personalizados de la cuenta)
- Tags de acceso/DRM

**Acción requerida:** Auditar el schema del CSV que acepta SM2 en `POST /api/settings/migration/:id/upload` y cruzarlo contra los 19 mapper types actuales de MigrAgent. Los campos faltantes se agregan como nuevos tipos de mapper.

---

### 3.4 Callbacks de Estado SM2 → MigrAgent (ALTA PRIORIDAD)

**Brecha actual:** MigrAgent usa polling para consultar el estado de la migración en SM2. Es ineficiente y tiene latencia.

**Propuesta:** Registrar un webhook en SM2 al inicio de cada migración para recibir notificaciones push cuando cada item cambia de estado.

**Flujo:**
1. Al crear la migración en SM2, MigrAgent registra un webhook:
   - `POST /api/settings/webhooks` con la URL de MigrAgent como receptor
2. SM2 llama al webhook de MigrAgent cuando un item termina (done/error)
3. MigrAgent actualiza el estado en su BD y emite el evento via Socket.IO al frontend
4. Al finalizar la migración, MigrAgent elimina el webhook registrado:
   - `DELETE /api/settings/webhooks/:id`

**Endpoints SM2 relevantes:**
```
POST   /api/settings/webhooks              → registrar webhook receptor
GET    /api/settings/webhooks/:id/history  → auditar entregas (para debug)
DELETE /api/settings/webhooks/:id          → limpiar al finalizar

Callbacks internos SM2 (referencia):
POST /api/-/migration/:item_id/ping        → heartbeat
POST /api/-/migration/:item_id/done        → item completado
POST /api/-/migration/:item_id/error       → item falló
```

**Ventaja:** Elimina el polling, el progreso se actualiza instantáneamente, y se reduce la carga en ambos servidores.

---

## 4. AUDITORÍA Y REPORTES — Visibilidad total

### 4.1 Reporte de Conformidad Descargable (ALTA PRIORIDAD)

**Brecha actual:** SM2 genera un reporte básico de migración pero sin el detalle y formato que un cliente enterprise necesita para auditoría interna.

**Propuesta:** Generar reportes descargables desde MigrAgent con mayor detalle:

**Reporte ejecutivo (PDF):**
- Nombre del proyecto, fecha y hora de inicio/fin
- Total procesado, exitosos, fallidos, omitidos
- Tasa de éxito (%)
- Desglose por lote (si se usó migración por lotes)
- Lista de items fallidos con motivo del error
- Comparativa con migración anterior (si existe)
- Hash SHA256 del resultado para verificación de integridad

**Reporte técnico (CSV):**
- Una fila por item: ID origen, ID destino en SM2, estado, timestamp, duración, errores, lote

**Endpoints SM2 a complementar:**
```
GET  /api/settings/migration/:id/report   → reporte nativo SM2 (como fuente adicional de datos)
POST /api/settings/migration/:id/report   → trigger generación del reporte en SM2
```

**Implementación:** `pdfkit` o `puppeteer` en el backend para el PDF. Los datos vienen de las tablas `MigrationLog` + `ValidationResult` + datos obtenidos de SM2. El frontend agrega botón "Descargar Reporte" (PDF / CSV) en la vista de detalle de migración y en el Step 5.

---

### 4.2 Comparativa de Migraciones — Pulir lo existente (ALTA PRIORIDAD)

**Estado actual:** El commit `da6630b` ya inició la comparación de reportes. **Hay que terminarlo y pulirlo.**

**Lo que falta completar:**
- Gráfica de barras (Recharts ya instalado): items por estado vs. tiempo
- Vista side-by-side: "Esta migración vs. la anterior" con delta de tasa de éxito
- Alerta automática si la tasa de error de la migración actual supera el promedio histórico en más de un umbral configurable
- Exportar la comparativa como parte del reporte PDF (sección 4.1)

---

## 5. RESILIENCIA — Que nada se pierda

### 5.1 Reanudación desde Checkpoint (ALTA PRIORIDAD)

**Brecha actual:** Si la migración falla a mitad, hay que reiniciar desde cero.

**Propuesta:** Sistema de checkpoint implementado 100% del lado de MigrAgent. SM2 no necesita ningún cambio: simplemente recibe los items pendientes como si fuera una continuación normal.

**Mecanismo:**
- Nuevo campo `checkpoint_data (JSON)` en la tabla `Migration`
- Después de cada item procesado exitosamente, MigrAgent actualiza el checkpoint con el índice de la última fila procesada
- Si la migración se interrumpe y el usuario la reanuda, MigrAgent lee el checkpoint y salta directamente a la fila siguiente

```json
{
  "last_successful_row": 4521,
  "last_item_id": "news-abc-123",
  "sm2_migration_id": "mig-xyz-789",
  "timestamp": "2026-03-21T14:32:00Z"
}
```

**UI:** En la vista de detalle de una migración interrumpida, botón "Reanudar desde fila 4522" en lugar de solo "Reintentar".

**Consideración con lotes:** En migración por lotes (sección 3.1), el checkpoint aplica dentro del lote activo. Si el Lote 2 de 17 falla en la fila 230, se reanuda desde esa fila del Lote 2, no desde el inicio del Lote 1.

---

## 6. EXPERIENCIA DE USUARIO

### 6.1 Estimación de Costo de Transcodificación (BAJA PRIORIDAD)

**Propuesta:** En el Step 6, mostrar estimación antes de ejecutar:
- N items × duración promedio detectada × tarifa de transcodificación configurada = **costo estimado**
- La tarifa se configura en Settings (campo configurable, no calculado automáticamente)
- Mostrar también el costo desglosado si se usa migración por lotes

---

### 6.2 Notificaciones al Finalizar (ALTA PRIORIDAD)

**Brecha actual:** No hay forma de saber que la migración terminó si no se está mirando el dashboard.

**Propuesta:**
- **Email** al finalizar cada migración o lote: usando Resend (API simple, sin SMTP propio) o Nodemailer con SMTP configurable en Settings
- **Webhook saliente**: MigrAgent llama a una URL configurada por el cliente cuando el job termina — útil para activar deploys, invalidar cachés, notificar a Slack, etc.
- Configuración en Settings: email(s) de destino, URL del webhook, eventos que disparan la notificación (done, error, batch_complete)

---

## 7. PRIORIZACIÓN RECOMENDADA (REVISADA)

### Fase 1 — Quick Wins y fundamentos (1-2 semanas)
| # | Feature | Impacto | Esfuerzo |
|---|---------|---------|---------|
| 1 | Pulir comparativa de migraciones (ya iniciado) | Alto | Bajo |
| 2 | Reporte descargable PDF + CSV | Alto | Bajo |
| 3 | Callbacks SM2 → MigrAgent (reemplazar polling) | Alto | Medio |
| 4 | Notificaciones email/webhook saliente | Medio | Bajo |

### Fase 2 — Diferenciadoras de proceso (2-4 semanas)
| # | Feature | Impacto | Esfuerzo |
|---|---------|---------|---------|
| 5 | Migración por lotes con migraciones SM2 nombradas | Muy Alto | Alto |
| 6 | Motor de reglas de transformación | Muy Alto | Alto |
| 7 | Reanudación desde checkpoint | Alto | Medio |
| 8 | Campos extendidos en migración SM2 | Medio | Medio |
| 9 | Deduplicación por historial | Medio | Bajo |

### Fase 3 — Nuevos orígenes e innovación (4-8 semanas)
| # | Feature | Impacto | Esfuerzo |
|---|---------|---------|---------|
| 10 | Soporte XML/RSS + JSON | Alto | Medio |
| 11 | API Connector (extracción vía REST) | Muy Alto | Alto |
| 12 | Upload local (archivos desde PC → SM2 S3) | Alto | Alto |
| 13 | Activación pipeline IA de SM2 post-migración | Muy Alto | Medio |
| 14 | Cola inteligente con prioridad | Medio | Bajo |
| 15 | Estimación de costo | Bajo | Bajo |

---

## 8. PREGUNTAS A VALIDAR CON EQUIPO SM2

Antes de implementar algunas features, confirmar con el equipo SM2:

1. **Campos del CSV de migración** — ¿Cuál es el schema completo del CSV que acepta `POST /api/settings/migration/:id/upload`? Necesitamos auditarlo para la sección de campos extendidos (3.3).
2. **Paginación de `/api/media`** — ¿Cuál es el `limit` máximo? ¿Soporta cursor-based pagination para bibliotecas de +10k items?
3. **Rate limits** — ¿Cuántas llamadas/segundo permite SM2 en endpoints de creación para no ser bloqueados durante migraciones masivas?
4. **Webhooks** — ¿Los webhooks de `/api/settings/webhooks` se disparan durante el procesamiento de una migración (por item) o solo por eventos de media en general?
5. **Pipeline IA** — ¿Los endpoints de trigger de IA (`/api/-/media/:id/notify-media-transcription/:type`) son accesibles externamente o son internos de SM2?
6. **`POST /api/bulk/media`** — ¿Permite crear múltiples medias en una sola llamada? ¿Cuántos items acepta por request?

---

## 9. ARQUITECTURA PROPUESTA

```
┌─────────────────────────────────────────────────────────────────┐
│              WIZARD STEP 0 — Seleccionar Origen                 │
│    [CSV]  [XML/RSS]  [JSON]  [API Connector]  [Upload Local]    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│            TRANSFORMATION ENGINE (Wizard Step 3)                │
│   ┌──────────────────┐  ┌──────────────────┐                   │
│   │ Motor de Reglas  │  │ Cola con         │                   │
│   │ (condición →     │  │ Prioridad        │                   │
│   │  acción)         │  │ (orden de carga) │                   │
│   └──────────────────┘  └──────────────────┘                   │
│   ┌──────────────────┐  ┌──────────────────┐                   │
│   │ Deduplicación    │  │ Normalización    │                   │
│   │ por historial    │  │ de campos        │                   │
│   └──────────────────┘  └──────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│          BATCH PROCESSOR CON CHECKPOINT (Step 6)                │
│  - Lotes configurables → cada lote = 1 migración SM2 nombrada  │
│  - Checkpoint por fila → resume sin perder trabajo             │
│  - Modo piloto → confirmación manual entre lotes               │
│  - Webhooks SM2 → updates en tiempo real via Socket.IO         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              POST-MIGRACIÓN — Enriquecimiento                   │
│  - Trigger AI pipeline SM2 (metadata, transcription,           │
│    highlights, chapters) por media_id creado                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              REPORTING & NOTIFICACIONES                         │
│  - PDF/CSV descargable con comparativa histórica               │
│  - Email + webhook saliente al finalizar                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. CONCLUSIÓN

Los diferenciadores más impactantes, en orden de prioridad de implementación:

1. **Migración por lotes con naming en SM2** — trazabilidad end-to-end, control de riesgo financiero
2. **Motor de reglas de transformación** — convierte MigrAgent de transporte a gobernanza de datos
3. **Callbacks SM2 + reanudación desde checkpoint** — resiliencia real para migraciones masivas
4. **Pipeline IA de SM2 post-migración** — enriquecimiento automático usando la IA que el cliente ya tiene contratada
5. **API Connector + Upload local** — elimina la dependencia del CSV manual para clientes que no pueden exportar
6. **Reporte de conformidad descargable** — el entregable formal que cierra un proyecto de migración

La base técnica actual (Prisma + Socket.IO + SM2 API integration) soporta todas estas features sin necesidad de cambios arquitecturales mayores.
