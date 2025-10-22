// ZeroQ API Types

export interface Office {
  id: number;
  slug: string;
  name: string;
  category_id: number;
  folder: string | null;
  lat: number;
  lng: number;
  location: {
    city: string;
    country: string;
    district: string;
    office: string;
    region: string;
    region_id: number;
  };
  online: boolean;
}

export interface OfficeList {
  id: number;
  slug: string;
  name: string;
}
export interface Line {
  id: number;
  slug: string;
  name: string;
  prefix: string;
  priority: number;
  type: string;
}

export interface OfficeDetails {
  id: number;
  slug: string;
  name: string;
  category: string;
  timezone: string;
  reservable: boolean;
  lines: Record<string, Line>;
}

// DTO limpio para respuestas
export interface OfficeDetailsDTO {
  id: number;
  slug: string;
  name: string;
  timezone: string;
  reservable: boolean;
  lines: Array<{
    id: number;
    slug: string;
    name: string;
    prefix: string;
    type: string;
  }>;
}

export interface TimeBlock {
  from: string;
  to: string;
  slots: number;
}

export interface BlockDay {
  date: string;
  isException: boolean;
  from: string | null;
  to: string | null;
  isRangeConfig: boolean;
  blocks: TimeBlock[];
}

// Respuesta de la API con bloques disponibles
export interface BlockDayResponse {
  date: string;
  isException: boolean;
  from: string | null;
  to: string | null;
  isRangeConfig: boolean;
  blocks?: TimeBlock[];
}

// BlockDay con estadísticas de disponibilidad
export interface AvailableBlockDay extends BlockDay {
  totalAvailableSlots: number;
  availableBlocksCount: number;
}

// Respuesta de validación de bloque
export interface BlockValidationResult {
  available: boolean;
  message: string;
  block?: TimeBlock;
  suggestedBlocks?: TimeBlock[];
}

// Respuesta de bloques próximos con información adicional
export interface UpcomingBlock extends TimeBlock {
  date: string;
  minutesUntil: number;
  timeUntilFormatted: string;
}

export interface UpcomingBlocksResult {
  currentTime: string;
  currentTimezone: string;
  upcomingBlocks: UpcomingBlock[];
  totalBlocks: number;
}

export interface ReservationRequest {
  lineSlug: string;
  officeSlug: string;
  from: string;
  to: string;
  meet?: boolean;
  meta: {
    forms: {
      type: string;
      questions: Array<{
        question: string;
        answer: string;
      }>;
    };
    utm?: any;
    formsError?: any;
  };
}

/**
 * Interface para reagendar una reserva existente
 * Extiende ReservationRequest con el ID de la reserva anterior
 */
export interface RescheduleReservationRequest extends ReservationRequest {
  oldIdReservation: string; // ID de la reserva a reagendar (puede ser _id o reserveNumber)
}

/**
 * Interface de Reserva
 *
 * CLAVES PRINCIPALES:
 * - _id: ID único de la reserva en la base de datos (MongoDB ObjectId)
 * - reserveNumber: Número de reserva legible para el usuario (ej: "RV926")
 *
 * Ambas claves pueden usarse para consultar una reserva:
 * - _id: Identificador interno del sistema
 * - reserveNumber: Identificador amigable para mostrar al usuario
 */
export interface Reservation {
  // CLAVES PRINCIPALES
  _id: string; // ID único interno (MongoDB ObjectId)
  reserveNumber: string; // Número de reserva para el usuario (ej: "RV926")

  // Información de la oficina
  office: {
    id: number;
    name: string;
    slug: string;
    timezone: string;
    lng: number;
    lat: number;
    address: string;
  };

  // Información de la línea
  line: {
    name: string;
    slug: string;
    prefix: string;
    id: number;
    typeid: string;
    folder: string | null;
  };

  // Información del usuario
  user: {
    id: number;
    name: string;
    email: string;
    rut?: string;
    phone: string;
  };

  // Horarios y estado
  from: string; // Fecha/hora inicio (ISO 8601)
  to: string; // Fecha/hora fin (ISO 8601)
  version: number;
  confirmed: boolean;
  inserted_at: string; // Fecha de creación
  updated_at: string; // Fecha de última actualización
  deleted_at: string | null; // Fecha de eliminación (si aplica)

  // Configuración
  origin: string;
  userProvider: string;
  isLocalWeb: boolean;
  meet: boolean; // Si es por videollamada
  extended: boolean;

  // Identificadores adicionales
  operationNumber: number; // Número de operación único

  // Metadata y estado
  meta: any;
  active: boolean;
  available: number;
}
