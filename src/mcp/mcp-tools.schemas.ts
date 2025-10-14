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
      'Obtiene los bloques de tiempo disponibles para una línea específica en un rango de fechas. Cada bloque indica cantidad de slots disponibles.',
    inputSchema: {
      type: 'object',
      properties: {
        lineSlug: {
          type: 'string',
          description:
            'Slug único de la línea (ej: "demo-web-oscar-fila-01")',
        },
        from: {
          type: 'string',
          description:
            'Fecha/hora de inicio en formato ISO 8601 (ej: "2025-10-14T16:00:00.000Z")',
        },
        to: {
          type: 'string',
          description:
            'Fecha/hora de fin en formato ISO 8601 o fecha simple (ej: "2026-04-30")',
        },
        tz: {
          type: 'string',
          description:
            'Zona horaria (ej: "America/Santiago"). Por defecto: America/Santiago',
          default: 'America/Santiago',
        },
      },
      required: ['lineSlug', 'from', 'to'],
    },
  },
  {
    name: 'createReservation',
    description:
      'Crea una nueva reserva para un bloque de tiempo específico. Requiere información de la persona que reserva y el bloque seleccionado.',
    inputSchema: {
      type: 'object',
      properties: {
        officeSlug: {
          type: 'string',
          description: 'Slug de la oficina',
        },
        lineSlug: {
          type: 'string',
          description: 'Slug de la línea',
        },
        from: {
          type: 'string',
          description:
            'Fecha/hora de inicio del bloque en formato ISO 8601 (debe coincidir con un bloque disponible)',
        },
        to: {
          type: 'string',
          description:
            'Fecha/hora de fin del bloque en formato ISO 8601',
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
        authToken: {
          type: 'string',
          description:
            'Token de autenticación JWT de ZeroQ (opcional, si no se provee se usará el del sistema)',
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
      'Obtiene los detalles completos de una reserva existente por su ID.',
    inputSchema: {
      type: 'object',
      properties: {
        reservationId: {
          type: 'string',
          description: 'ID único de la reserva (ej: "R89104178963")',
        },
        authToken: {
          type: 'string',
          description:
            'Token de autenticación JWT de ZeroQ (opcional)',
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

