# MCP Inteligente (NestJS) con **Agente IA** — Selección automática de fila y reserva (OpenAI Mini)

> Este MCP expone **solo** un endpoint conversacional para clientes (p. ej., n8n / chatbot).
> Internamente integra **proveedores de reservas** y un **Agente IA** (OpenAI *mini*) que entiende la intención del usuario, **selecciona la mejor fila**, valida **disponibilidad** y **genera la reserva**.
> **No se exponen** APIs del proveedor; todo el flujo vive dentro del MCP.

---

## 🧠 Qué resuelve el Agente

- Entiende frases como: *“Reserva mañana a las 11 en la oficina Demo, la fila para trámites rápidos, a nombre de Ana”*.
- Si el usuario **no especifica** la fila, **la elige automáticamente** en base a heurísticas y contexto.
- Verifica **disponibilidad** (bloques con `slots > 0`) y propone alternativa si no hay cupos.
- **Confirma** antes de reservar (modo confirmación) o **reserva directo** (modo directo).

---

## Arquitectura (resumen)

```
mcp-agente/
├─ src/
│  ├─ main.ts
│  ├─ app.module.ts
│  ├─ config/
│  │   └─ config.service.ts
│  ├─ common/
│  │   ├─ http/http.module.ts
│  │   ├─ guards/api-key.guard.ts
│  │   └─ utils/
│  ├─ tools/
│  │   └─ reservations/
│  │      ├─ reservations.service.ts          # dominio (validar office/line; disponibilidad; normalizar)
│  │      └─ providers/zeroq.provider.ts      # proveedor interno (no expuesto)
│  ├─ agent/
│  │   ├─ agent.module.ts
│  │   ├─ agent.service.ts                    # loop ReAct + tool-calling
│  │   ├─ prompts/
│  │   │  └─ system.md                        # instrucciones del agente
│  │   └─ tools.schemas.ts                    # JSON Schemas de tools
│  └─ flow/
│     ├─ flow.module.ts
│     ├─ flow.controller.ts   # /api/flow/agent  (único endpoint público)
│     └─ flow.service.ts      # orquesta respuesta final al cliente
├─ .env.example
├─ package.json
└─ README.md
```

**Superficie pública (para n8n/cliente):**
- `POST /api/flow/agent` → diálogo en **lenguaje natural**. El agente decide y ejecuta tools internas.
- (Opcional) `GET /api/flow/reservations/:id` → consultar detalle/estado de reserva creada por el agente.

---

## Variables de entorno (`.env.example`)

```env
MCP_PORT=3000
MCP_PUBLIC_API_KEY=change-me-strong-key
MCP_TZ=America/Santiago

# OpenAI Mini (modelos ligeros y económicos)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini    # recomendado
OPENAI_JSON_MODE=true       # usa respuestas tool-calling

# Proveedor interno (NO expuesto a clientes)
PROVIDER_DEFAULT=zeroq
PROVIDER_ZEROQ_BASE=https://zeroq.cl
PROVIDER_ZEROQ_RES_BASE=https://zeroq.cl/services/reservations/api/v3
PROVIDER_ZEROQ_RES_BLOCKS_BASE=https://services.zeroq.cl/reservations/api/v3
PROVIDER_ZEROQ_AUTH_TOKEN=Bearer <token>

LOG_LEVEL=info
```

---

## Instalación y arranque

```bash
git clone <repo> mcp-agente && cd mcp-agente
cp .env.example .env
npm i
npm run start:dev
```

El MCP corre en `http://localhost:${MCP_PORT}`.

---

## Endpoint **único** (cliente) — Agente conversacional

### `POST /api/flow/agent`
**Headers:** `x-api-key: ${MCP_PUBLIC_API_KEY}`

**Body (ejemplo 1, solicitud directa):**
```json
{
  "message": "Reservame mañana a las 11 en la oficina demo, fila rápida, a nombre de Ana Pérez, tel +505..., mail ana@demo.com",
  "mode": "direct"     // "direct" = reserva sin pedir confirmación; "confirm" = solicita confirmación
}
```

**Body (ejemplo 2, sin fila específica):**
```json
{
  "message": "Quiero una reserva en la oficina demo para mañana a la tarde a nombre de Juan"
}
```

**Respuesta (posibles):**
- **Confirmación previa** (modo `confirm` o ambigüedad): el agente pregunta por dato faltante o confirma opción propuesta.
- **Resultado** (modo `direct` o confirmado): JSON con `id`, `reserveNumber`, horario, fila elegida y resumen para mostrar al usuario.

**Ejemplo de respuesta exitosa:**
```json
{
  "ok": true,
  "result": {
    "id": "R89104178963",
    "reserveNumber": "R-12345",
    "office": "demo-web-oscar",
    "line": "demo-web-oscar-fila-01",
    "from": "2025-10-15T16:00:00.000Z",
    "to": "2025-10-15T16:30:00.000Z",
    "status": "CREATED"
  },
  "message": "He reservado tu cupo para mañana a las 10:00am (TZ local). Fila: Trámites rápidos. ¿Necesitas el QR por correo?"
}
```

---

## Diseño del Agente (OpenAI Mini)

### Prompt del sistema (`agent/prompts/system.md`)
- Rol: **Agente de reservas** de MCP.
- Objetivo: resolver la intención de **reservar**.
- Políticas:
  - No expongas implementaciones internas ni rutas del proveedor.
  - Si falta información (oficina, fecha/hora, datos de contacto), **pregunta**.
  - Si no hay cupos, **propón la mejor alternativa** (siguiente bloque libre).
  - Mantén respuestas **claras y cortas**, con un resumen ejecutable para UI.

### Tool-calling (funciones disponibles para el modelo)
Declaradas en `agent/tools.schemas.ts` como **JSON Schemas**:

- `listLinesForOffice(officeSlug)` → devuelve líneas y metadatos útiles (p. ej., *“rápida”, “documentos”, “atención general”*).
- `getAvailableBlocks(lineSlug, fromISO, toISO, tz)` → lista bloques con `slots`.
- `createReservation(officeSlug, lineSlug, from, to, person)` → crea la reserva.
- `getReservation(id)` → detalle de la reserva.

> El agente decide en qué orden llamar a las tools. Si el usuario no especifica la fila, primero **obtiene líneas**, filtra por etiquetas/keywords (rápida/general/etc.), luego **consulta disponibilidad**, y por último **crea** la reserva.

### Heurística para **seleccionar fila** (cuando el usuario no especifica)
1. Si hay línea etiquetada como *rápida/express* y la intención es *trámite simple*, priorizar esa.
2. Si menciona *documentos/licencias*, buscar línea asociada.
3. Si no hay match semántico, seleccionar la línea con **mayor disponibilidad** en el rango solicitado.
4. Si el rango exacto no tiene cupos, buscar el **próximo bloque** disponible más cercano.

---

## Ejemplo (TypeScript): agent.service.ts (loop ReAct + tools)

```ts
@Injectable()
export class AgentService {
  constructor(
    private readonly openai: OpenAIClient,           // wrapper SDK
    private readonly reservations: ReservationsService
  ) {}

  tools = {
    listLinesForOffice: async (officeSlug: string) => {
      return this.reservations.listLinesNormalized(officeSlug);
    },
    getAvailableBlocks: async (lineSlug: string, fromISO: string, toISO: string, tz: string) => {
      return this.reservations.listBlocksNormalized(lineSlug, fromISO, toISO, tz);
    },
    createReservation: async (args: any) => {
      return this.reservations.createReservationNormalized(args);
    },
    getReservation: async (id: string) => {
      return this.reservations.getReservationNormalized(id);
    },
  };

  async chat(message: string, opts?: { mode?: 'confirm'|'direct', tz?: string }) {
    const system = await this.buildSystemPrompt();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    // 1) Iniciar conversación con función de tools (JSON mode)
    const res = await this.openai.chat({
      model,
      system,
      messages: [{ role: 'user', content: message }],
      tools: this.makeJsonSchemas(),  // <- schemas de tools
    });

    // 2) Resolver recursivamente las llamadas a tools
    let state = res;
    while (this.hasToolCall(state)) {
      const call = this.extractToolCall(state);
      const result = await this.invokeTool(call);
      state = await this.openai.chat({
        model,
        system,
        messages: [
          { role: 'user', content: message },
          ...this.accumulateToolMessages(state),
          { role: 'tool', name: call.name, content: JSON.stringify(result) }
        ],
        tools: this.makeJsonSchemas(),
      });
      if (this.isFinal(state)) break;
    }

    // 3) Formatear salida para el cliente
    return this.summarizeForClient(state, opts?.mode ?? 'confirm');
  }
}
```

> **Nota**: `OpenAIClient` es un wrapper simple sobre la API REST/SDK de OpenAI con soporte **tool-calling** (function calling) y validación JSON. Usa `OPENAI_JSON_MODE=true` para forzar respuestas estructuradas.

---

## Flow Controller (único endpoint público)

```ts
@Controller('api/flow')
@UseGuards(ApiKeyGuard)
export class FlowController {
  constructor(private readonly agent: AgentService) {}

  @Post('agent')
  async agentChat(@Body() body: { message: string; mode?: 'confirm'|'direct' }) {
    const result = await this.agent.chat(body.message, { mode: body.mode || 'confirm' });
    return result;
  }

  @Get('reservations/:id')
  get(@Param('id') id: string) {
    // acceso de sólo lectura al estado de una reserva creada por el agente
    return this.agent.tools.getReservation(id);
  }
}
```

---

## cURL de ejemplo (cliente)

```bash
API=http://localhost:3000/api/flow
KEY="x-api-key: change-me-strong-key"

# Conversación / intención directa
curl -s -H "$KEY" -H "Content-Type: application/json" \
  -X POST $API/agent -d '{
    "message": "Reservame mañana a las 11 en la oficina demo para trámite rápido a nombre de Ana, tel +505..., mail ana@demo.com",
    "mode": "direct"
  }' | jq .

# Consultar estado de reserva
curl -s -H "$KEY" $API/reservations/R89104178963 | jq .
```

---

## Seguridad y políticas

- **No** se devuelven ni exponen rutas del proveedor ni tokens.
- **Rate-limit** y **API Key** obligatorios.
- **Registro de auditoría** de llamadas del agente y herramientas ejecutadas.
- **Idempotencia**: `clientRef` (si disponible) y hash por clave compuesta; TTL en Redis.
- **Privacidad**: anonimizar PII en logs (nombre/email/teléfono).

---

## Roadmap

- [ ] Re-ranking de filas por **aprendizaje** (p. ej., éxito histórico por intención/tiempo).
- [ ] Confirmaciones multimodales (voz/TTS) y canal WebRTC opcional.
- [ ] Gestión de cancelación/reagendamiento vía agente.
- [ ] Evaluaciones automáticas de prompts (línea base y tests de regresión).
