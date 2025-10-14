# MCP Inteligente para ZeroQ Reservations (NestJS + OpenAI)

> Servicio MCP (Model Context Protocol) con **agente inteligente OpenAI** que entiende lenguaje natural y ejecuta automáticamente operaciones en el sistema de reservas de ZeroQ.

[![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white)](https://nestjs.com/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=flat&logo=openai&logoColor=white)](https://openai.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

---

## 📑 Tabla de Contenidos

- [Características](#-características)
- [Quick Start](#-quick-start)
- [Arquitectura](#-arquitectura)
- [Configuración](#-configuración)
- [Tools Disponibles](#-tools-disponibles)
- [Endpoints](#-endpoints)
- [Ejemplos de Uso](#-ejemplos-de-uso)
- [Integración con n8n](#-integración-con-n8n)
- [Troubleshooting](#-troubleshooting)
- [Seguridad](#-seguridad)
- [Roadmap](#-roadmap)

---

## 🎯 Características

### Agente Inteligente (OpenAI)
- ✅ Entiende **lenguaje natural**: *"Busca oficinas en Santiago, quiero reservar mañana a las 11am"*
- ✅ Ejecuta automáticamente las tools necesarias
- ✅ Confirma información antes de crear reservas
- ✅ Sugiere alternativas si no hay disponibilidad
- ✅ Mantiene contexto conversacional

### 7 Tools MCP Disponibles

1. **`chatAgent`** ⭐ - Agente conversacional inteligente (lenguaje natural)
2. **`listWebOffices`** - Listar todas las oficinas web disponibles
3. **`getOfficeDetails`** - Obtener detalles completos de una oficina
4. **`getOfficeLines`** - Obtener líneas de atención de una oficina
5. **`getAvailableBlocks`** - Consultar bloques de tiempo disponibles
6. **`createReservation`** - Crear una nueva reserva
7. **`getReservation`** - Consultar detalles de una reserva existente

### Dos Modos de Uso

**1. Modo Conversacional (Recomendado para chatbots)**
```bash
POST /agent/chat
{
  "message": "Quiero reservar mañana a las 11am en la oficina Demo"
}
```

**2. Modo Tools MCP (Para n8n AI Agent)**
```bash
POST /mcp/execute
{
  "tool": "chatAgent",
  "arguments": { "message": "..." }
}
```

---

## 🚀 Quick Start

### 1. Instalar Dependencias

```bash
cd mcp-tools-reserve
yarn install
# o npm install
```

### 2. Configurar Variables de Entorno

```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:

```env
# Server
MCP_PORT=3000
MCP_PUBLIC_API_KEY=tu-clave-secreta-segura
MCP_TZ=America/Santiago

# OpenAI (para el agente inteligente)
OPENAI_API_KEY=sk-tu-api-key-de-openai
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.7

# ZeroQ Provider (NO expuesto a clientes)
ZEROQ_BASE_URL=https://zeroq.cl
ZEROQ_API_BASE_URL=https://zeroq.cl/api
ZEROQ_RESERVATIONS_BASE_URL=https://zeroq.cl/services/reservations/api/v3
ZEROQ_BLOCKS_BASE_URL=https://services.zeroq.cl/reservations/api/v3
ZEROQ_AUTH_TOKEN=

# Logging
LOG_LEVEL=info
NODE_ENV=development
```

### 3. Iniciar el Servidor

```bash
# Modo desarrollo (con hot-reload)
yarn start:dev

# Modo producción
yarn build
yarn start:prod
```

El servidor estará corriendo en `http://localhost:3000`

### 4. Probar el Agente

```bash
curl -X POST http://localhost:3000/agent/chat \
  -H "x-api-key: tu-clave-secreta-segura" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hola, ¿qué oficinas tienes disponibles?"}'
```

---

## 🏗️ Arquitectura

```
mcp-tools-reserve/
├─ src/
│  ├─ main.ts                            # Entry point
│  ├─ app.module.ts                      # Módulo principal
│  ├─ config/
│  │  ├─ config.module.ts
│  │  └─ config.service.ts               # Variables de entorno
│  ├─ common/
│  │  ├─ http/
│  │  │  ├─ http.module.ts
│  │  │  └─ http.service.ts              # Cliente HTTP (fetch wrapper)
│  │  └─ guards/
│  │     └─ api-key.guard.ts             # Autenticación API Key
│  ├─ tools/zeroq/
│  │  ├─ zeroq.module.ts
│  │  ├─ zeroq.service.ts                # Integración con ZeroQ APIs
│  │  └─ types.ts                        # TypeScript types
│  ├─ agent/
│  │  ├─ agent.module.ts
│  │  ├─ agent.service.ts                # Agente IA (OpenAI + tool-calling)
│  │  ├─ agent.controller.ts             # Endpoint /agent/chat
│  │  └─ dto/chat.dto.ts                 # DTOs
│  └─ mcp/
│     ├─ mcp.module.ts
│     ├─ mcp.controller.ts               # Endpoints /mcp/*
│     ├─ mcp.service.ts                  # Orquestador de tools
│     └─ mcp-tools.schemas.ts            # JSON Schemas (MCP protocol)
├─ .env.example
├─ package.json
└─ README.md
```

**Endpoints Públicos:**

| Tipo | Endpoint | Descripción |
|------|----------|-------------|
| 🤖 Agente | `POST /agent/chat` | Conversación en lenguaje natural |
| 🤖 Agente | `POST /agent/ping` | Health check del agente |
| 📋 MCP | `GET /mcp/tools` | Lista de tools disponibles |
| ⚡ MCP | `POST /mcp/execute` | Ejecutar una tool específica |
| ❤️ MCP | `GET /mcp/health` | Health check del servicio |

---

## ⚙️ Configuración

### Variables de Entorno Requeridas

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `MCP_PORT` | Puerto del servidor | `3000` |
| `MCP_PUBLIC_API_KEY` | API Key para autenticación | `your-secret-key-123` |
| `OPENAI_API_KEY` | API Key de OpenAI | `sk-...` |
| `OPENAI_MODEL` | Modelo de OpenAI | `gpt-4o-mini` |

### Variables Opcionales

| Variable | Descripción | Default |
|----------|-------------|---------|
| `OPENAI_MAX_TOKENS` | Máximo tokens por respuesta | `2000` |
| `OPENAI_TEMPERATURE` | Temperatura del modelo | `0.7` |
| `MCP_TZ` | Zona horaria | `America/Santiago` |
| `LOG_LEVEL` | Nivel de logs | `info` |

---

## 🛠️ Tools Disponibles

### 1. chatAgent ⭐ (RECOMENDADA)

**Agente inteligente que entiende lenguaje natural y ejecuta operaciones automáticamente.**

**Argumentos:**
```typescript
{
  message: string;              // Requerido: Mensaje en lenguaje natural
  conversationHistory?: Array<{  // Opcional: Historial de conversación
    role: 'user' | 'assistant';
    content: string;
  }>;
}
```

**Ejemplo:**
```json
{
  "tool": "chatAgent",
  "arguments": {
    "message": "Busca oficinas en Santiago y muéstrame disponibilidad para mañana"
  }
}
```

**Casos de uso:**
- Cuando el usuario escribe en lenguaje natural
- Para flujos conversacionales complejos
- Cuando no sabes exactamente qué tool específica necesitas
- Para crear reservas con confirmación automática

**Ejemplos de mensajes que entiende:**
- "Lista las oficinas disponibles en Santiago"
- "Quiero reservar mañana a las 11am en la oficina Demo"
- "Consulta el estado de la reserva R89104178963"
- "¿Hay disponibilidad esta semana en la oficina demo-web-oscar?"

**Retorna:**
```json
{
  "message": "Respuesta del agente en lenguaje natural",
  "conversationHistory": [...],
  "toolCallsMade": 2
}
```

---

### 2. listWebOffices

Lista todas las oficinas web disponibles en ZeroQ.

**Argumentos:** Ninguno

**Ejemplo:**
```json
{
  "tool": "listWebOffices",
  "arguments": {}
}
```

**Retorna:** Array de oficinas con `id`, `slug`, `name`, `location`, etc.

---

### 3. getOfficeDetails

Obtiene detalles completos de una oficina incluyendo todas sus líneas de atención.

**Argumentos:**
```typescript
{
  officeSlug: string;  // Requerido: Slug de la oficina
}
```

**Ejemplo:**
```json
{
  "tool": "getOfficeDetails",
  "arguments": {
    "officeSlug": "demo-web-oscar"
  }
}
```

**Retorna:** Objeto con detalles completos (id, name, timezone, lines, options, etc.)

---

### 4. getOfficeLines

Obtiene solo las líneas de atención disponibles (filtradas: solo las que permiten reservas).

**Argumentos:**
```typescript
{
  officeSlug: string;  // Requerido: Slug de la oficina
}
```

**Retorna:** Array de líneas con `id`, `slug`, `name`, `prefix`, `meta`, etc.

---

### 5. getAvailableBlocks

Consulta bloques de tiempo disponibles para una línea en un rango de fechas.

**Argumentos:**
```typescript
{
  lineSlug: string;     // Requerido: Slug de la línea
  from: string;         // Requerido: Fecha/hora inicio (ISO 8601)
  to: string;           // Requerido: Fecha/hora fin (ISO 8601)
  tz?: string;          // Opcional: Zona horaria (default: America/Santiago)
}
```

**Ejemplo:**
```json
{
  "tool": "getAvailableBlocks",
  "arguments": {
    "lineSlug": "demo-web-oscar-fila-01",
    "from": "2025-10-14T16:00:00.000Z",
    "to": "2025-10-20",
    "tz": "America/Santiago"
  }
}
```

**Retorna:** Array de días con bloques disponibles (cada bloque: `from`, `to`, `slots`)

---

### 6. createReservation

Crea una nueva reserva para un bloque específico.

**Argumentos:**
```typescript
{
  officeSlug: string;      // Requerido: Slug de la oficina
  lineSlug: string;        // Requerido: Slug de la línea
  from: string;            // Requerido: Inicio del bloque (ISO 8601)
  to: string;              // Requerido: Fin del bloque (ISO 8601)
  personName: string;      // Requerido: Nombre completo
  personPhone: string;     // Requerido: Teléfono con código país
  personEmail: string;     // Requerido: Email
  personRut?: string;      // Opcional: RUT/DNI
  meet?: boolean;          // Opcional: Si es videollamada (default: false)
}
```

> **Nota**: La autenticación con ZeroQ se maneja automáticamente usando `ZEROQ_AUTH_TOKEN` de las variables de entorno.

**Ejemplo:**
```json
{
  "tool": "createReservation",
  "arguments": {
    "officeSlug": "demo-web-oscar",
    "lineSlug": "demo-web-oscar-fila-01",
    "from": "2025-10-15T11:00:00.000Z",
    "to": "2025-10-15T11:30:00.000Z",
    "personName": "Ana Pérez",
    "personPhone": "+56912345678",
    "personEmail": "ana@example.com",
    "meet": false
  }
}
```

**Retorna:** Objeto de reserva completo con `_id`, `reserveNumber`, `office`, `line`, `user`, etc.

---

### 7. getReservation

Consulta detalles de una reserva existente.

**Argumentos:**
```typescript
{
  reservationId: string;   // Requerido: ID de la reserva (ej: "R89104178963")
}
```

> **Nota**: La autenticación con ZeroQ se maneja automáticamente usando `ZEROQ_AUTH_TOKEN` de las variables de entorno.

**Retorna:** Objeto de reserva completo con todos sus detalles

---

## 📡 Endpoints

Todos los endpoints requieren el header `x-api-key`.

### Agente Conversacional

#### POST /agent/chat

Endpoint principal para conversaciones en lenguaje natural.

**Headers:**
```
x-api-key: your-secret-api-key
Content-Type: application/json
```

**Body:**
```json
{
  "message": "Quiero reservar mañana a las 11am",
  "conversationHistory": []  // Opcional
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "He encontrado disponibilidad. ¿Confirmas la reserva?",
  "conversationHistory": [...],
  "toolCallsMade": 2
}
```

---

#### POST /agent/ping

Health check del agente.

**Respuesta:**
```json
{
  "status": "ok",
  "agent": "active",
  "model": "gpt-4o-mini",
  "timestamp": "2025-10-14T16:00:00.000Z"
}
```

---

### Tools MCP

#### GET /mcp/tools

Lista todas las tools disponibles con sus schemas.

**Respuesta:**
```json
{
  "tools": [
    {
      "name": "chatAgent",
      "description": "Agente conversacional inteligente...",
      "inputSchema": {...}
    },
    ...
  ],
  "version": "1.0.0",
  "provider": "zeroq-mcp"
}
```

---

#### POST /mcp/execute

Ejecuta una tool específica.

**Body:**
```json
{
  "tool": "chatAgent",
  "arguments": {
    "message": "Lista las oficinas"
  }
}
```

**Respuesta:**
```json
{
  "success": true,
  "tool": "chatAgent",
  "result": {
    "message": "Aquí están las oficinas disponibles...",
    "conversationHistory": [...],
    "toolCallsMade": 1
  }
}
```

---

#### GET /mcp/health

Health check del servicio.

**Respuesta:**
```json
{
  "status": "ok",
  "service": "zeroq-mcp",
  "version": "1.0.0",
  "timestamp": "2025-10-14T16:00:00.000Z"
}
```

---

## 💻 Ejemplos de Uso

### Modo Conversacional (Agente Inteligente)

#### Ejemplo 1: Conversación Simple

```bash
curl -X POST http://localhost:3000/agent/chat \
  -H "x-api-key: your-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hola, quiero ver las oficinas disponibles"
  }' | jq .
```

#### Ejemplo 2: Buscar Disponibilidad

```bash
curl -X POST http://localhost:3000/agent/chat \
  -H "x-api-key: your-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Busca disponibilidad mañana a las 11am en la oficina demo-web-oscar"
  }' | jq .
```

#### Ejemplo 3: Crear Reserva Completa

```bash
curl -X POST http://localhost:3000/agent/chat \
  -H "x-api-key: your-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Crea una reserva para mañana a las 11:00 en demo-web-oscar, línea demo-web-oscar-fila-01, a nombre de Juan Pérez, tel +56912345678, email juan@test.com"
  }' | jq .
```

#### Ejemplo 4: Consultar Reserva

```bash
curl -X POST http://localhost:3000/agent/chat \
  -H "x-api-key: your-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "¿Cuál es el estado de mi reserva R89104178963?"
  }' | jq .
```

---

### Modo Tools MCP

#### Usar el agente como tool

```bash
curl -X POST http://localhost:3000/mcp/execute \
  -H "x-api-key: your-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "chatAgent",
    "arguments": {
      "message": "Busca oficinas en Santiago"
    }
  }' | jq .
```

#### Listar tools disponibles

```bash
curl -X GET http://localhost:3000/mcp/tools \
  -H "x-api-key: your-secret-api-key" | jq .
```

#### Listar oficinas directamente

```bash
curl -X POST http://localhost:3000/mcp/execute \
  -H "x-api-key: your-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "listWebOffices",
    "arguments": {}
  }' | jq .
```

#### Crear reserva con tool directa

```bash
curl -X POST http://localhost:3000/mcp/execute \
  -H "x-api-key: your-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "createReservation",
    "arguments": {
      "officeSlug": "demo-web-oscar",
      "lineSlug": "demo-web-oscar-fila-01",
      "from": "2025-10-15T11:00:00.000Z",
      "to": "2025-10-15T11:30:00.000Z",
      "personName": "Ana Pérez",
      "personPhone": "+56912345678",
      "personEmail": "ana@example.com"
    }
  }' | jq .
```

---

## 🔗 Integración con n8n

### 📋 Pre-requisitos

- ✅ Servidor MCP corriendo en `http://localhost:3030`
- ✅ n8n instalado y corriendo
- ✅ API Key configurada en tu `.env` (por defecto: `change-me-strong-key`)

### 🎯 Configuración Paso a Paso

#### Paso 1: Crear Credencial MCP en n8n

1. Abre n8n
2. Ve a **Settings** → **Credentials**
3. Click en **"Create New Credential"**
4. Busca y selecciona **"MCP Server"**
5. Llena los campos:
   ```
   Credential Name:    ZeroQ MCP Server
   Server Transport:   HTTP Streamable  ⚠️ MUY IMPORTANTE
   URL:                http://localhost:3030/mcp/sse
   Authentication:     Header Auth
     ├─ Header Name:   x-api-key
     └─ Header Value:  change-me-strong-key
   ```
6. Click **"Save"**

#### Paso 2: Crear Workflow con AI Agent

1. Crea un nuevo workflow
2. Agrega los siguientes nodos:

```
[Chat Trigger]
    ↓
[AI Agent]
    ↓
[Respond to Chat]
```

#### Paso 3: Configurar el AI Agent

1. **Doble click en el nodo "AI Agent"**

2. **Configurar el Model:**
   - Click en "Model" → "Add AI Model"
   - Selecciona "OpenAI Chat Model"
   - Conecta tu credencial de OpenAI
   - Modelo recomendado: `gpt-4o-mini`

3. **Agregar MCP Client Tool:**
   - En la sección **"Tools"**
   - Click **"Add Tool"**
   - Busca y selecciona **"MCP Client Tool"**
   - En "Credential to connect with":
     - Selecciona la credencial **"ZeroQ MCP Server"** que creaste
   - En "Tool Selection":
     - Selecciona **"All"** para usar todas las tools

4. **System Prompt (Opcional pero recomendado):**
   ```
   Eres un asistente de reservas de ZeroQ.
   Ayudas a los usuarios a:
   - Buscar oficinas disponibles
   - Consultar horarios disponibles
   - Crear reservas
   - Consultar reservas existentes
   
   Siempre confirma los datos antes de crear una reserva.
   ```

#### Paso 4: Probar el Workflow

1. **Activa el workflow** (toggle en la esquina superior derecha)

2. **Abre el Chat** (botón de chat en la parte inferior)

3. **Prueba con estos mensajes:**

   ```
   👤 Usuario: "Hola, lista las oficinas disponibles"
   
   🤖 Asistente: [Ejecuta listWebOffices automáticamente]
   ```

   ```
   👤 Usuario: "Quiero hacer una reserva para mañana a las 10am en demo-web-oscar"
   
   🤖 Asistente: [Ejecuta getOfficeDetails, getOfficeLines, getAvailableBlocks]
                 "Necesito algunos datos para completar la reserva..."
   ```

   ```
   👤 Usuario: "Mi nombre es Juan Pérez, email juan@example.com, teléfono +56912345678"
   
   🤖 Asistente: [Ejecuta createReservation]
                 "Reserva creada con éxito. Tu código es: R123456789"
   ```

### 🔍 Verificación de Conexión

#### Test 1: Verificar que el servidor está corriendo

```bash
curl http://localhost:3030/mcp/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "service": "zeroq-mcp",
  "version": "1.0.0",
  "timestamp": "2025-10-14T19:00:00.000Z"
}
```

#### Test 2: Verificar endpoint MCP

```bash
curl -X POST http://localhost:3030/mcp/sse \
  -H "Content-Type: application/json" \
  -H "x-api-key: change-me-strong-key" \
  -d '{"method":"tools/list","id":1}'
```

**Debe retornar la lista de tools disponibles en formato SSE.**

### ❓ Troubleshooting

#### Error: "Could not connect to MCP Server"

**Posibles causas:**

1. **API Key incorrecta**
   - Verifica que el valor en n8n coincida EXACTAMENTE con tu `.env`
   - Por defecto es: `change-me-strong-key`

2. **Server Transport incorrecto**
   - ⚠️ DEBE ser **"HTTP Streamable"**, NO "stdio"
   - Si seleccionaste "stdio", cambia a "HTTP Streamable"

3. **URL incorrecta**
   - Debe ser: `http://localhost:3030/mcp/sse`
   - **NO** `http://localhost:3030/sse`
   - **NO** `http://localhost:3030/mcp`

4. **Servidor no está corriendo**
   ```bash
   # Verifica que el servidor esté corriendo
   ps aux | grep "nest start"
   
   # Si no está corriendo, inícialo
   cd /path/to/mcp-tools-reserve
   yarn start:dev
   ```

5. **n8n en Docker**
   - Si n8n corre en Docker, usa: `http://host.docker.internal:3030/mcp/sse`
   - No uses `localhost` desde dentro de Docker

#### Error: "Tools not found" o "Empty tools list"

1. Verifica que el endpoint SSE responda:
   ```bash
   curl -H "x-api-key: change-me-strong-key" \
     http://localhost:3030/mcp/sse
   ```

2. Recarga la credencial en n8n:
   - Edita la credencial MCP
   - Click "Test" para verificar conexión
   - Guarda de nuevo

3. Recarga el nodo MCP Client Tool:
   - Elimina el tool del AI Agent
   - Agrega de nuevo el MCP Client Tool
   - Selecciona la credencial

#### Error: "Authentication failed"

- Verifica que el header se llame **EXACTAMENTE** `x-api-key` (minúsculas, guiones)
- Verifica que el valor coincida con `MCP_PUBLIC_API_KEY` en tu `.env`
- No agregues espacios antes o después del valor

#### Las tools no se ejecutan

1. Verifica que el AI Agent tenga:
   - ✅ Un modelo de OpenAI configurado
   - ✅ El MCP Client Tool agregado
   - ✅ Tool Selection en "All"

2. Prueba con un prompt explícito:
   ```
   "Por favor usa la tool listWebOffices para mostrarme las oficinas"
   ```

### 📊 Tools Disponibles

| Tool | Descripción | Uso en n8n |
|------|-------------|------------|
| `chatAgent` | Agente conversacional inteligente | Ideal para consultas en lenguaje natural |
| `listWebOffices` | Lista oficinas disponibles | El agent lo usa automáticamente |
| `getOfficeDetails` | Detalles de oficina específica | Requiere `officeSlug` |
| `getOfficeLines` | Líneas de atención de oficina | Requiere `officeSlug` |
| `getAvailableBlocks` | Bloques de tiempo disponibles | Requiere `lineSlug`, `from`, `to` |
| `createReservation` | Crear nueva reserva | Requiere datos completos |
| `getReservation` | Consultar reserva existente | Requiere `reservationId` |

### 🎓 Ejemplos de Uso

#### Ejemplo 1: Búsqueda Simple

```
Usuario: "¿Qué oficinas hay disponibles?"

AI Agent:
1. Detecta la intención
2. Ejecuta: listWebOffices()
3. Responde con la lista formateada
```

#### Ejemplo 2: Reserva Completa

```
Usuario: "Quiero reservar en demo-web-oscar para mañana 10am"

AI Agent:
1. Ejecuta: getOfficeDetails(officeSlug: "demo-web-oscar")
2. Ejecuta: getOfficeLines(officeSlug: "demo-web-oscar")
3. Ejecuta: getAvailableBlocks(lineSlug: "...", from: "...", to: "...")
4. Pide datos de la persona
5. Cuando el usuario los da:
   Ejecuta: createReservation(...)
6. Confirma la reserva con el código
```

#### Ejemplo 3: Consultar Reserva

```
Usuario: "Consulta mi reserva R123456789"

AI Agent:
1. Ejecuta: getReservation(reservationId: "R123456789")
2. Responde con los detalles
```

---

### Opción Alternativa: Modo HTTP Request (Simple)

**Configuración rápida usando solo el endpoint conversacional.**

#### Paso 1: Configurar Credencial en n8n

1. Ir a **Credentials** → **Create New**
2. Buscar **Header Auth**
3. Configurar:
   - **Name**: `ZeroQ MCP API Key`
   - **Header Name**: `x-api-key`
   - **Value**: Tu `MCP_PUBLIC_API_KEY`

#### Paso 2: Crear Workflow Simple

```
[Webhook/Chat Trigger]
    → [HTTP Request a /agent/chat]
    → [Responder al usuario]
```

#### Paso 3: Configurar HTTP Request Node

- **Method**: POST
- **URL**: `http://your-mcp-server:3000/agent/chat`
- **Authentication**: Header Auth → `ZeroQ MCP API Key`
- **Body**:
  ```json
  {
    "message": "={{ $json.userMessage }}"
  }
  ```
- **Response Format**: JSON
- **Extract**: `={{ $json.message }}`

---

### Opción B: Modo AI Agent con Tools (Avanzado)

**Usa n8n AI Agent con la tool `chatAgent` del MCP.**

#### Paso 1: Configurar Credencial

Igual que Opción A.

#### Paso 2: Crear Workflow con AI Agent

```
[Chat Trigger]
    → [AI Agent]
        → [Tool: ZeroQ Reservations]
    → [Respuesta al usuario]
```

#### Paso 3: Configurar Tool en AI Agent

**Tool Type**: HTTP Request

**Tool Name**: `ZeroQ Reservations`

**Tool Description**:
```
Agente inteligente para el sistema de reservas ZeroQ.
Entiende lenguaje natural y puede:
- Buscar oficinas disponibles
- Consultar disponibilidad de horarios
- Crear reservas
- Consultar estado de reservas

Envíale cualquier pregunta o solicitud en lenguaje natural.
```

**Method**: POST

**URL**: `http://your-mcp-server:3000/mcp/execute`

**Authentication**: Header Auth → `ZeroQ MCP API Key`

**Body**:
```json
{
  "tool": "chatAgent",
  "arguments": {
    "message": "={{ $json.query }}"
  }
}
```

**Response**: `={{ $json.result.message }}`

#### Paso 4: Configurar Prompt del AI Agent

```
Eres un asistente virtual para el sistema de reservas ZeroQ.

Usa la herramienta "ZeroQ Reservations" para:
- Buscar oficinas
- Consultar disponibilidad
- Crear reservas
- Consultar estado de reservas

Cuando el usuario pregunte sobre oficinas, horarios o reservas,
siempre usa esta herramienta para obtener información actualizada.

Sé amable y profesional. Confirma información importante antes
de crear reservas (nombre, teléfono, email, fecha/hora).
```

---

### Opción C: Múltiples Tools (Máximo Control)

Para casos avanzados donde necesitas control granular de cada operación.

#### Configurar cada tool individualmente:

1. **Tool: chatAgent** (para lenguaje natural)
2. **Tool: listWebOffices** (para listar oficinas)
3. **Tool: getOfficeDetails** (para detalles)
4. **Tool: createReservation** (para crear reservas)
5. etc.

**Ejemplo de configuración multi-tool:**

```json
{
  "tool": "={{ $json.toolName }}",
  "arguments": {{ $json.arguments }}
}
```

**Prompt para AI Agent (Multi-Tool):**

```
Eres un asistente de reservas para el sistema ZeroQ.

Tienes acceso a las siguientes herramientas:

1. "ZeroQ Chat Agent" - Para consultas en lenguaje natural
2. "List ZeroQ Offices" - Para listar oficinas disponibles
3. "Get Office Details" - Para detalles de una oficina
4. "Check Availability" - Para consultar horarios
5. "Create Reservation" - Para crear reservas

Usa la herramienta apropiada según la solicitud del usuario.
Para consultas complejas o ambiguas, usa "ZeroQ Chat Agent".

IMPORTANTE: Confirma datos críticos antes de crear reservas.
```

---

### Ejemplos de Flujos n8n

#### Flujo 1: Chatbot Simple
```
[Webhook] → [AI Agent con chatAgent] → [Responder]
```
✅ Muy simple, el agente maneja todo

#### Flujo 2: Formulario + Reserva Directa
```
[Webhook con form] → [Validar] → [createReservation] → [Confirmar]
```
✅ Control total, sin IA intermedia

#### Flujo 3: Híbrido (IA + Tools)
```
[Chat] → [AI Agent con todas las tools] → [Formatear] → [Enviar]
```
✅ Flexibilidad máxima

---

## 🐛 Troubleshooting

### Error: "Invalid or missing API key"

**Causa**: API key incorrecta o no enviada.

**Solución**:
1. Verifica que envías el header `x-api-key`
2. Confirma que el valor coincide con `MCP_PUBLIC_API_KEY` en `.env`
3. En n8n, verifica la credencial Header Auth

---

### Error de OpenAI / "401 Unauthorized"

**Causa**: API key de OpenAI inválida o sin saldo.

**Solución**:
1. Verifica `OPENAI_API_KEY` en `.env`
2. Confirma que la key es válida en https://platform.openai.com/api-keys
3. Verifica que tienes saldo en tu cuenta OpenAI

---

### El agente no entiende el mensaje

**Causa**: Mensaje muy ambiguo o falta contexto.

**Solución**:
1. Sé más específico en los mensajes
2. Incluye información clave:
   - Fecha y hora deseada
   - Nombre de oficina o slug
   - Datos de contacto para reservas
3. Revisa los logs del servidor para ver qué está procesando

**Ejemplo de mensaje claro:**
```
"Crea una reserva para el 15 de octubre a las 11:00 AM
en la oficina demo-web-oscar, línea demo-web-oscar-fila-01,
a nombre de Juan Pérez, teléfono +56912345678,
email juan@test.com"
```

---

### Error: "Tool not found"

**Causa**: Nombre de tool incorrecto.

**Solución**:
Verifica que usas exactamente estos nombres:
- `chatAgent`
- `listWebOffices`
- `getOfficeDetails`
- `getOfficeLines`
- `getAvailableBlocks`
- `createReservation`
- `getReservation`

---

### Respuestas vacías o errores de formato

**Causa**: Extracción incorrecta de la respuesta.

**Solución** (en n8n):

Para tool `chatAgent`:
```javascript
={{ $json.result.message }}
```

Para otras tools:
```javascript
={{ $json.result }}
```

---

### Timeout en consultas complejas

**Causa**: Operaciones que requieren múltiples tool calls.

**Solución**:
1. Aumenta el timeout del HTTP Request a 60s
2. Divide consultas muy complejas en pasos más simples
3. Revisa logs del MCP para ver cuántas tool calls está haciendo

---

### El agente no ejecuta tools en n8n

**Causa**: Configuración incorrecta del AI Agent.

**Solución**:
1. Verifica que el prompt menciona las tools disponibles
2. Asegúrate que las tools tienen descripciones claras
3. Confirma que la autenticación funciona (prueba con cURL primero)
4. Revisa los logs del MCP para ver qué recibe

---

## 🔒 Seguridad

### Autenticación

- ✅ **API Key obligatoria** en header `x-api-key`
- ✅ Todas las peticiones requieren autenticación
- ✅ Guard de NestJS valida el API key en cada request

### No Exposición de APIs

- ✅ Las APIs de ZeroQ **no son accesibles directamente**
- ✅ Todo pasa por el MCP con validación
- ✅ No se exponen tokens ni credenciales en respuestas

### CORS y Validación

- ✅ CORS habilitado para integraciones
- ✅ Validación automática de entrada con NestJS pipes
- ✅ Manejo consistente de errores

### Logging y Auditoría

- ✅ Todas las operaciones se registran con timestamp
- ✅ Logs estructurados por módulo
- ✅ Sin logging de datos sensibles (PII)

### Recomendaciones de Seguridad

#### 🔴 Obligatorio en Producción

1. **Cambiar API Key**
   ```env
   MCP_PUBLIC_API_KEY=usa-un-valor-seguro-aleatorio-largo
   ```

2. **Usar HTTPS**
   - Configura un reverse proxy (nginx, Caddy)
   - O usa un servicio como Cloudflare Tunnel

3. **Proteger OpenAI API Key**
   - Nunca la expongas en el frontend
   - Guárdala solo en el servidor

#### 🟡 Recomendado

4. **Rate Limiting**
   - Implementa límites en nginx/Cloudflare
   - O usa `@nestjs/throttler`

5. **Monitoreo**
   - Configura alertas para errores
   - Monitorea uso anómalo

6. **Logging**
   - Usa servicio de logs centralizado (ELK, Datadog)
   - Configura retención apropiada

#### 🟢 Opcional

7. **Tokens de Usuario**
   - Para operaciones que requieren auth de ZeroQ
   - Pasa el token del usuario en `authToken`

8. **Firewall**
   - Limita acceso por IP si es posible
   - Usa VPC o security groups en cloud

---

## 📊 Roadmap

### v1.1 (Próximo)
- [ ] Cache de oficinas y líneas con Redis
- [ ] Rate limiting integrado
- [ ] Métricas con Prometheus
- [ ] Logs estructurados con correlationId

### v1.2 (Futuro)
- [ ] Webhooks para notificar cambios en reservas
- [ ] Soporte para cancelar/modificar reservas
- [ ] Tests E2E con Jest
- [ ] Documentación OpenAPI/Swagger

### v2.0 (Visión)
- [ ] Multi-tenant support
- [ ] Dashboard de administración
- [ ] Analytics y reportes
- [ ] Soporte para múltiples proveedores

---

## 📝 Licencia

UNLICENSED - Uso interno

---

## 👥 Soporte

Para preguntas o issues:
- Revisa la sección [Troubleshooting](#-troubleshooting)
- Consulta los logs del servidor
- Contacta al equipo de desarrollo

---

## 🙏 Agradecimientos

- [NestJS](https://nestjs.com/) - Framework backend
- [OpenAI](https://openai.com/) - Agente inteligente
- [ZeroQ](https://zeroq.cl/) - Sistema de reservas
- [n8n](https://n8n.io/) - Automatización

---

**Hecho con ❤️ para ZeroQ**
