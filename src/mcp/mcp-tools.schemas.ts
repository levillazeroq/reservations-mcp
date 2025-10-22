/**
 * MCP Tools Schemas for n8n AI Agent
 *
 * Estos schemas definen las herramientas (tools) disponibles para el agente de n8n
 * siguiendo el protocolo MCP (Model Context Protocol)
 */

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export const MCP_TOOLS: MCPTool[] = [
  {
    name: 'chatAgent',
    description:
      'Agente conversacional inteligente que entiende lenguaje natural y ejecuta automáticamente las operaciones necesarias en el sistema de reservas. Puede buscar oficinas, consultar disponibilidad, crear reservas y más. Ideal para interacciones en lenguaje natural donde el usuario no especifica exactamente qué tool usar.',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description:
            'Mensaje del usuario en lenguaje natural. Ejemplos: "Busca oficinas en Santiago", "Quiero reservar mañana a las 11am", "Consulta mi reserva R123"',
        },
        conversationHistory: {
          type: 'array',
          description:
            'Historial de conversación previa (opcional). Array de objetos con role ("user" o "assistant") y content.',
          items: {
            type: 'object',
            properties: {
              role: {
                type: 'string',
                enum: ['user', 'assistant'],
              },
              content: {
                type: 'string',
              },
            },
          },
        },
      },
      required: ['message'],
    },
  },
  {
    name: 'listWebOffices',
    description:
      'Lista todas las oficinas web disponibles en ZeroQ. Retorna información básica de cada oficina incluyendo slug, nombre, ubicación y estado.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'searchWebOffices',
    description:
      'Busca oficinas específicas por slug o nombre usando coincidencia parcial. Ideal para encontrar rápidamente una oficina cuando el usuario menciona un nombre o ubicación. Usa el cache de Redis para búsquedas instantáneas. Retorna las oficinas que coincidan con la búsqueda.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Término de búsqueda para filtrar oficinas por slug o nombre. Ejemplos: "demo", "oscar", "caja los andes", "calama". La búsqueda es case-insensitive y permite coincidencias parciales.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'getOfficeDetails',
    description:
      'Obtiene detalles completos de una oficina específica por su slug, incluyendo todas sus líneas de atención, configuraciones y estado actual.',
    inputSchema: {
      type: 'object',
      properties: {
        officeSlug: {
          type: 'string',
          description:
            'Slug único de la oficina (ej: "demo-web-oscar", "caja-los-andes-calama")',
        },
      },
      required: ['officeSlug'],
    },
  },
  {
    name: 'getOfficeLines',
    description:
      'Obtiene la lista de líneas de atención disponibles para una oficina específica. Retorna solo las líneas que permiten reservas.',
    inputSchema: {
      type: 'object',
      properties: {
        officeSlug: {
          type: 'string',
          description: 'Slug único de la oficina',
        },
      },
      required: ['officeSlug'],
    },
  },
  {
    name: 'getAvailableBlocks',
    description:
      'Obtiene los bloques de tiempo disponibles para una línea específica en una fecha determinada. El sistema siempre consulta el día completo y retorna solo bloques con slots disponibles (slots > 0). Si no se especifica fecha, usa el día actual. ⚠️ IMPORTANTE: Solo acepta fechas del día actual o futuras, NUNCA fechas pasadas.',
    inputSchema: {
      type: 'object',
      properties: {
        lineSlug: {
          type: 'string',
          description:
            'Slug único de la línea (ej: "demo-web-oscar-fila-01"). IMPORTANTE: Debe ser el slug completo de la línea, no el slug de la oficina.',
        },
        date: {
          type: 'string',
          description:
            'Fecha a consultar en formato YYYY-MM-DD (ej: "2025-10-15"). Opcional: si no se proporciona, se usa el día actual. ⚠️ CRÍTICO: La fecha debe ser HOY o FUTURA, nunca fechas pasadas. Validar antes de llamar.',
        },
        tz: {
          type: 'string',
          description:
            'Zona horaria (ej: "America/Santiago"). Por defecto: America/Santiago',
          default: 'America/Santiago',
        },
      },
      required: ['lineSlug'],
    },
  },
  {
    name: 'validateBlockAvailability',
    description:
      'Valida si un bloque de tiempo específico está disponible para una línea y fecha determinada. Ideal para verificar si una hora específica está disponible antes de crear una reserva. Soporta múltiples formatos de hora: "14:00", "2pm", "2:30 PM", "14:30:00". Si el bloque no está disponible, sugiere alternativas cercanas.',
    inputSchema: {
      type: 'object',
      properties: {
        lineSlug: {
          type: 'string',
          description:
            'Slug único de la línea (ej: "demo-web-oscar-fila-01"). IMPORTANTE: Debe ser el slug completo de la línea, no el slug de la oficina.',
        },
        fromTime: {
          type: 'string',
          description:
            'Hora a validar. Soporta múltiples formatos: "14:00" (24hrs), "2pm" o "2:00 PM" (12hrs), "14:30:00". Ejemplos: "10:00", "10am", "2:30pm", "14:30".',
        },
        date: {
          type: 'string',
          description:
            'Fecha a consultar en formato YYYY-MM-DD (ej: "2025-10-21"). Opcional: si no se proporciona, se usa el día actual. ⚠️ CRÍTICO: La fecha debe ser HOY o FUTURA.',
        },
        tz: {
          type: 'string',
          description:
            'Zona horaria (ej: "America/Santiago"). Por defecto: America/Santiago',
          default: 'America/Santiago',
        },
      },
      required: ['lineSlug', 'fromTime'],
    },
  },
  {
    name: 'getUpcomingBlocks',
    description:
      '🆕 Obtiene automáticamente los 5 bloques de tiempo más próximos disponibles para una línea específica. Consulta inteligentemente el día actual y el siguiente, filtra bloques que ya pasaron basándose en la hora actual del timezone, y los ordena por proximidad. Ideal para mostrar las opciones más inmediatas al usuario sin necesidad de especificar hora. ⚠️ IMPORTANTE: La fecha opcional debe ser HOY o FUTURA, nunca fechas pasadas.',
    inputSchema: {
      type: 'object',
      properties: {
        lineSlug: {
          type: 'string',
          description:
            'Slug único de la línea (ej: "demo-web-oscar-fila-01"). IMPORTANTE: Debe ser el slug completo de la línea, no el slug de la oficina.',
        },
        date: {
          type: 'string',
          description:
            'Fecha de inicio para buscar bloques próximos en formato YYYY-MM-DD (ej: "2025-10-22"). Opcional: si no se proporciona, se usa el día de HOY por defecto. ⚠️ CRÍTICO: La fecha debe ser HOY o FUTURA. El sistema consultará este día y el siguiente para encontrar los 5 bloques más cercanos.',
        },
        tz: {
          type: 'string',
          description:
            'Zona horaria (ej: "America/Santiago"). Por defecto: America/Santiago. Se usa para calcular la hora actual y filtrar bloques expirados.',
          default: 'America/Santiago',
        },
      },
      required: ['lineSlug'],
    },
  },
  {
    name: 'createReservation',
    description:
      'Crea una nueva reserva para un bloque de tiempo específico. Requiere información de la persona que reserva y el bloque seleccionado. IMPORTANTE: Solo acepta reservas para HOY o fechas FUTURAS, nunca fechas pasadas. RETORNA: Objeto Reservation completo con CLAVES PRINCIPALES: 1) "_id" (ID interno MongoDB usado por la API internamente), 2) "reserveNumber" (número legible ej: "RV926" - ESTE ES EL QUE SE MUESTRA AL USUARIO), 3) "operationNumber" (número de operación único). CRÍTICO: Siempre mostrar "reserveNumber" al usuario para futuras consultas. El usuario usará "reserveNumber" para consultar su reserva, aunque internamente la API usa "_id".',
    inputSchema: {
      type: 'object',
      properties: {
        officeSlug: {
          type: 'string',
          description: 'Slug de la oficina (obtenido con listWebOffices o getOfficeDetails)',
        },
        lineSlug: {
          type: 'string',
          description: 'Slug completo de la línea (OBLIGATORIO obtenerlo con getOfficeLines, NO inventar)',
        },
        from: {
          type: 'string',
          description:
            'Fecha/hora de inicio del bloque en formato ISO 8601 con .000Z (ej: "2025-10-17T14:00:00.000Z"). Debe coincidir EXACTAMENTE con un bloque obtenido de getAvailableBlocks. ⚠️ CRÍTICO: Validar que la fecha/hora NO sea pasada.',
        },
        to: {
          type: 'string',
          description:
            'Fecha/hora de fin del bloque en formato ISO 8601 con .000Z (ej: "2025-10-17T14:30:00.000Z"). Debe coincidir EXACTAMENTE con un bloque obtenido de getAvailableBlocks.',
        },
        personName: {
          type: 'string',
          description: 'Nombre completo de la persona',
        },
        personPhone: {
          type: 'string',
          description: 'Teléfono de contacto (incluir código de país, ej: +56912345678)',
        },
        personEmail: {
          type: 'string',
          description: 'Email de contacto',
        },
        personRut: {
          type: 'string',
          description: 'RUT/DNI de la persona (opcional)',
        },
        meet: {
          type: 'boolean',
          description: 'Si la reserva es por videollamada. Por defecto: false',
          default: false,
        },
      },
      required: [
        'officeSlug',
        'lineSlug',
        'from',
        'to',
        'personName',
        'personPhone',
        'personEmail',
      ],
    },
  },
  {
    name: 'getReservation',
    description:
      'Obtiene los detalles completos de una reserva existente. IMPORTANTE CONTEXTO: La API consulta internamente usando el campo "_id" (ID MongoDB), pero al usuario siempre se le muestra el "reserveNumber" (número legible como "RV926"). ACEPTA: Tanto _id como reserveNumber como parámetro. RETORNA: Objeto Reservation completo donde: 1) "_id" es el identificador interno del sistema (usar para consultas API), 2) "reserveNumber" es el número que ve y usa el usuario (SIEMPRE mostrar este al usuario). Cuando el usuario diga "mi reserva RV926", usar ese valor para consultar.',
    inputSchema: {
      type: 'object',
      properties: {
        reservationId: {
          type: 'string',
          description:
            'Identificador de la reserva. La API consulta con el "_id" interno, pero acepta también "reserveNumber". Puede ser: 1) _id (MongoDB ObjectId ej: "507f1f77bcf86cd799439011") - usado internamente por la API, 2) reserveNumber (ej: "RV926") - el que ve el usuario. Si el usuario proporciona "RV926", el sistema lo acepta y hace la consulta correctamente.',
        },
      },
      required: ['reservationId'],
    },
  },
];

/**
 * Schemas en formato JSON Schema para validación
 */
export const MCP_TOOLS_JSON_SCHEMA = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'ZeroQ MCP Tools',
  description: 'Herramientas MCP para interactuar con el sistema de reservas ZeroQ',
  tools: MCP_TOOLS,
};

