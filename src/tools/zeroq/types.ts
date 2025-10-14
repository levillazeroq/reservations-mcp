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

export interface Line {
  id: number;
  slug: string;
  name: string;
  prefix: string;
  priority: number;
  type: string;
  queue: number;
  waiting: number;
  attending: number;
  tickets: number;
  calls: number;
  weight: number;
  frozen: boolean;
  office_slug: string;
  meta?: {
    disabled_reserves?: boolean;
    disabled_virtual_tickets?: boolean;
    ask_for?: any;
    keypad?: any;
  };
}

export interface OfficeDetails {
  id: number;
  slug: string;
  name: string;
  category: string;
  category_id: number;
  code: string;
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
  timezone: string;
  online: boolean;
  reservable: boolean;
  lines: Record<string, Line>;
  options?: any;
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

export interface Reservation {
  _id: string;
  office: {
    id: number;
    name: string;
    slug: string;
    timezone: string;
    lng: number;
    lat: number;
    address: string;
  };
  line: {
    name: string;
    slug: string;
    prefix: string;
    id: number;
    typeid: string;
    folder: string | null;
  };
  user: {
    id: number;
    name: string;
    email: string;
    rut?: string;
    phone: string;
  };
  from: string;
  to: string;
  version: number;
  confirmed: boolean;
  inserted_at: string;
  updated_at: string;
  origin: string;
  userProvider: string;
  isLocalWeb: boolean;
  meet: boolean;
  meta: any;
  deleted_at: string | null;
  extended: boolean;
  operationNumber: number;
  reserveNumber: string;
  active: boolean;
  available: number;
}

