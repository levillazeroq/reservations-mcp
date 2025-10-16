import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '../../common/http/http.service';
import { ConfigService } from '../../config/config.service';
import {
  Office,
  OfficeDetails,
  BlockDay,
  Reservation,
  ReservationRequest,
  Line,
} from './types';

@Injectable()
export class ZeroQService {
  private readonly logger = new Logger(ZeroQService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Lista todas las oficinas web disponibles
   */
  async listWebOffices(): Promise<Office[]> {
    try {
      const url = `${this.configService.zeroqApiBaseUrl}/v3/offices/web`;
      const response = await this.httpService.get<{ data: Office[] }>(url);
      return response.data;
    } catch (error) {
      this.logger.error('Error listing web offices:', error);
      throw new Error('Failed to list web offices');
    }
  }

  /**
   * Obtiene detalles de una oficina y sus líneas
   */
  async getOfficeDetails(officeSlug: string): Promise<OfficeDetails> {
    try {
      const url = `${this.configService.zeroqApiBaseUrl}/v1/state/${officeSlug}`;
      const response = await this.httpService.get<OfficeDetails>(url);
      return response;
    } catch (error) {
      this.logger.error(`Error getting office details for ${officeSlug}:`, error);
      throw new Error(`Failed to get office details for ${officeSlug}`);
    }
  }

  /**
   * Obtiene líneas disponibles de una oficina (normalizado)
   */
  async getOfficeLines(officeSlug: string): Promise<Line[]> {
    try {
      const officeDetails = await this.getOfficeDetails(officeSlug);

      // Convertir el objeto lines a un array
      const linesArray = Object.values(officeDetails.lines || {});

      // Filtrar líneas que no tienen reservas deshabilitadas
      const availableLines = linesArray.filter(
        (line: any) => !line.meta?.disabled_reserves
      ) as any[];

      this.logger.log(`📋 Found ${availableLines.length} available lines for office "${officeSlug}":`);
      availableLines.forEach((line: any, index: number) => {
        this.logger.log(`   ${index + 1}. "${line.name}" (slug: "${line.slug}")`);
      });

      return availableLines;
    } catch (error) {
      this.logger.error(`Error getting lines for office ${officeSlug}:`, error);
      throw new Error(`Failed to get lines for office ${officeSlug}`);
    }
  }

  /**
   * Obtiene bloques de tiempo disponibles para una línea en una fecha específica
   * Siempre consulta el día completo y filtra solo bloques con slots disponibles
   */
  async getAvailableBlocks(
    lineSlug: string,
    date?: string,
    tz: string = 'America/Santiago',
  ): Promise<BlockDay[]> {
    try {
      this.logger.log(`📋 getAvailableBlocks called with lineSlug: "${lineSlug}"`);
      this.logger.log(`📋 Received date: ${date || 'undefined (using today)'}`);

      // Advertencia: detectar si se está usando officeSlug en lugar de lineSlug
      // Los lineSlugs suelen tener el formato: "office-slug-line-name" (con más de 2 partes)
      const slugParts = lineSlug.split('-');
      if (slugParts.length < 3) {
        this.logger.warn(`⚠️  WARNING: lineSlug "${lineSlug}" parece ser corto. ¿Es un officeSlug en lugar de lineSlug?`);
        this.logger.warn(`   Los lineSlugs correctos suelen ser: "demo-web-oscar-fila-01" (no solo "demo-web-oscar")`);
      }

      // Helper para convertir cualquier fecha a formato YYYY-MM-DD
      const toSimpleDate = (dateInput: string | Date): string => {
        this.logger.debug(`🔍 toSimpleDate input: ${JSON.stringify(dateInput)}, type: ${typeof dateInput}`);

        let month: number;
        let day: number;
        const currentYear = new Date().getFullYear();

        if (typeof dateInput === 'string') {
          // Si es string, verificar formato
          if (dateInput.match(/^\d{4}-\d{2}-\d{2}$/)) {
            // Formato YYYY-MM-DD completo (ej: "2025-10-17" o "2023-10-17")
            this.logger.debug(`✅ Format detected: YYYY-MM-DD`);
            const parts = dateInput.split('-');
            const inputYear = parseInt(parts[0], 10);
            month = parseInt(parts[1], 10);
            day = parseInt(parts[2], 10);

            // ⚠️ FORZAR AÑO ACTUAL si el año recibido no es el actual
            if (inputYear !== currentYear) {
              this.logger.warn(`⚠️  Year ${inputYear} detected, forcing current year: ${currentYear}`);
            }
          } else if (dateInput.match(/^\d{2}-\d{2}$/)) {
            // Formato MM-DD sin año (ej: "10-17"), usar año actual
            this.logger.log(`📅 Date without year detected. Using current year: ${currentYear}`);
            const parts = dateInput.split('-');
            month = parseInt(parts[0], 10);
            day = parseInt(parts[1], 10);
          } else if (dateInput.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
            // Formato MM/DD/YYYY o M/D/YYYY
            this.logger.debug(`✅ Format detected: MM/DD/YYYY`);
            const parts = dateInput.split('/');
            const inputYear = parseInt(parts[2], 10);
            month = parseInt(parts[0], 10);
            day = parseInt(parts[1], 10);

            // ⚠️ FORZAR AÑO ACTUAL si el año recibido no es el actual
            if (inputYear !== currentYear) {
              this.logger.warn(`⚠️  Year ${inputYear} detected, forcing current year: ${currentYear}`);
            }
          } else {
            // Intentar parsear como ISO o timestamp
            this.logger.debug(`⚠️  Unknown format, attempting to parse: "${dateInput}"`);
            const d = new Date(dateInput);

            if (isNaN(d.getTime())) {
              throw new Error(`Invalid date format: "${dateInput}"`);
            }

            month = d.getMonth() + 1;
            day = d.getDate();

            // ⚠️ FORZAR AÑO ACTUAL
            const inputYear = d.getFullYear();
            if (inputYear !== currentYear) {
              this.logger.warn(`⚠️  Year ${inputYear} detected, forcing current year: ${currentYear}`);
            }
          }
        } else {
          // Es un objeto Date
          const d = dateInput;
          month = d.getMonth() + 1;
          day = d.getDate();

          // ⚠️ FORZAR AÑO ACTUAL
          const inputYear = d.getFullYear();
          if (inputYear !== currentYear) {
            this.logger.warn(`⚠️  Year ${inputYear} detected, forcing current year: ${currentYear}`);
          }
        }

        // ⭐ SIEMPRE USAR AÑO ACTUAL
        const result = `${currentYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        this.logger.debug(`✅ toSimpleDate result: ${result}`);
        return result;
      };

      // Determinar la fecha a consultar
      let targetDate: string;
      if (date) {
        // Si se proporciona fecha, normalizarla a YYYY-MM-DD
        this.logger.log(`📅 Processing provided date: "${date}"`);
        targetDate = toSimpleDate(date);
        this.logger.log(`📅 Using provided date: ${targetDate}`);
      } else {
        // Si no se proporciona, usar el día actual
        const now = new Date();
        targetDate = toSimpleDate(now);
        this.logger.log(`📅 Using current day: ${targetDate} (${now.toISOString()})`);
      }

      // ⚠️ VALIDAR: La fecha NO debe ser anterior al día de hoy
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Resetear a medianoche para comparar solo fechas

      const targetDateObj = new Date(targetDate + 'T00:00:00');

      if (targetDateObj < today) {
        const todayStr = today.toISOString().split('T')[0];
        this.logger.error(`❌ Date validation failed: ${targetDate} is before today (${todayStr})`);
        throw new Error(`Cannot query blocks for past dates. Date ${targetDate} is before today (${todayStr}). Please provide a current or future date.`);
      }

      this.logger.log(`✅ Date validation passed: ${targetDate} is valid (>= today)`);

      // La API de ZeroQ requiere from=YYYY-MM-DD&to=YYYY-MM-DD para consultar un día completo
      const fromDate = targetDate;
      const toDate = targetDate;

      const url = `${this.configService.zeroqBlocksBaseUrl}/blocks/${lineSlug}?from=${fromDate}&to=${toDate}&tz=${tz}`;

      this.logger.log(`🔍 Querying blocks from ${fromDate} to ${toDate}`);
      this.logger.log(`🌐 Full URL: ${url}`);

      const response = await this.httpService.get<any>(url);

      this.logger.debug(`📦 Response type: ${typeof response}`);
      this.logger.debug(`📦 Response is array: ${Array.isArray(response)}`);
      this.logger.debug(`📦 Response keys: ${response ? Object.keys(response).join(', ') : 'null'}`);
      this.logger.debug(`📦 Response sample: ${JSON.stringify(response).substring(0, 200)}`);

      // La API puede devolver un array directamente o un objeto con un campo 'data'
      const blocksData = Array.isArray(response) ? response : (response?.data || []);

      if (!Array.isArray(blocksData)) {
        this.logger.error('❌ Response is not an array and has no data field');
        throw new Error('Invalid response format from blocks API');
      }

      // Filtrar y analizar bloques disponibles
      const availableDays = blocksData
        .map((day: any) => {
          // Filtrar solo bloques con slots disponibles (slots > 0)
          const availableBlocks = (day.blocks || []).filter(
            (block: any) => block.slots > 0
          );

          if (availableBlocks.length === 0) {
            return null; // No hay bloques disponibles este día
          }

          return {
            ...day,
            blocks: availableBlocks,
            totalAvailableSlots: availableBlocks.reduce(
              (sum: number, block: any) => sum + block.slots,
              0
            ),
            availableBlocksCount: availableBlocks.length,
          };
        })
        .filter((day: any) => day !== null); // Remover días sin bloques disponibles

      this.logger.log(
        `✅ Found ${availableDays.length} days with available blocks (${availableDays.reduce((sum: number, day: any) => sum + day.availableBlocksCount, 0)} total blocks)`
      );

      return availableDays;
    } catch (error) {
      this.logger.error(`Error getting blocks for line ${lineSlug}:`, error);
      throw new Error(`Failed to get available blocks for line ${lineSlug}`);
    }
  }

  /**
   * Crea una nueva reserva
   */
  async createReservation(
    data: ReservationRequest,
  ): Promise<Reservation> {
    try {
      this.logger.log('🔍 ============ CREATE RESERVATION START ============');
      this.logger.log('📥 Received data:', JSON.stringify(data, null, 2));
      this.logger.log(`📅 Original from: "${data.from}" (type: ${typeof data.from})`);
      this.logger.log(`📅 Original to: "${data.to}" (type: ${typeof data.to})`);

      const url = this.configService.zeroqReservationsBaseUrl;
      const headers: Record<string, string> = {};

      // Usar el token de autenticación de las variables de entorno
      const authToken = this.configService.zeroqAuthToken;
      if (authToken) {
        headers['authorization'] = authToken;
      }

      // Helper para validar y normalizar fechas con año actual forzado
      const validateAndNormalizeDate = (dateInput: string | Date, fieldName: string): string => {
        this.logger.debug(`🔍 Validating ${fieldName}: ${JSON.stringify(dateInput)}`);

        const currentYear = new Date().getFullYear();
        let parsedDate = new Date(dateInput);

        if (isNaN(parsedDate.getTime())) {
          this.logger.error(`❌ Invalid date format for ${fieldName}: "${dateInput}"`);
          throw new Error(`Invalid date format for ${fieldName}: "${dateInput}"`);
        }

        // Log del año original
        const originalYear = parsedDate.getFullYear();
        this.logger.debug(`📅 Original year for ${fieldName}: ${originalYear}`);

        // ⚠️ FORZAR AÑO ACTUAL si es diferente
        if (originalYear !== currentYear) {
          this.logger.warn(`⚠️  ${fieldName}: Year ${originalYear} detected, forcing current year: ${currentYear}`);

          // Mantener mes, día, hora, minuto, segundo pero cambiar año
          parsedDate.setFullYear(currentYear);
          this.logger.debug(`✅ ${fieldName} adjusted to current year: ${parsedDate.toISOString()}`);
        }

        // ⚠️ VALIDAR: La fecha NO debe ser anterior al día de hoy
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Resetear a medianoche

        const dateOnly = new Date(parsedDate);
        dateOnly.setHours(0, 0, 0, 0); // Comparar solo fechas

        if (dateOnly < today) {
          const todayStr = today.toISOString().split('T')[0];
          const dateStr = parsedDate.toISOString().split('T')[0];
          this.logger.error(`❌ ${fieldName} validation failed: ${dateStr} is before today (${todayStr})`);
          throw new Error(`Cannot create reservation for past dates. ${fieldName} (${dateStr}) is before today (${todayStr}).`);
        }

        this.logger.debug(`✅ ${fieldName} validation passed`);

        // Retornar en formato ISO 8601 UTC
        return parsedDate.toISOString();
      };

      // Validar y normalizar fechas
      const normalizedFrom = validateAndNormalizeDate(data.from, 'from');
      const normalizedTo = validateAndNormalizeDate(data.to, 'to');

      this.logger.log(`✅ Normalized from: ${normalizedFrom}`);
      this.logger.log(`✅ Normalized to: ${normalizedTo}`);

      // Validar que 'to' sea después de 'from'
      if (new Date(normalizedTo) <= new Date(normalizedFrom)) {
        this.logger.error(`❌ Date range validation failed: 'to' must be after 'from'`);
        throw new Error(`Invalid date range: 'to' (${normalizedTo}) must be after 'from' (${normalizedFrom})`);
      }

      const normalizedData = {
        ...data,
        from: normalizedFrom,
        to: normalizedTo,
      };

      // Log del payload completo que se enviará
      this.logger.log('📤 Sending reservation request to:', url);
      this.logger.log('📦 Final payload:', JSON.stringify(normalizedData, null, 2));
      this.logger.log('🔑 Headers:', JSON.stringify(headers, null, 2));

      const response = await this.httpService.post<Reservation>(url, normalizedData, {
        headers,
      });

      this.logger.log('✅ Reservation created successfully:', response._id);
      this.logger.log('🔍 ============ CREATE RESERVATION END ============');
      return response;
    } catch (error) {
      this.logger.error('❌ Error creating reservation:', error);
      this.logger.error('🔍 ============ CREATE RESERVATION FAILED ============');
      throw error;
    }
  }

  /**
   * Obtiene detalles de una reserva existente
   */
  async getReservation(
    reservationId: string,
  ): Promise<Reservation> {
    try {
      const url = `${this.configService.zeroqReservationsBaseUrl}/${reservationId}`;
      const headers: Record<string, string> = {};

      // Usar el token de autenticación de las variables de entorno
      const authToken = this.configService.zeroqAuthToken;
      if (authToken) {
        headers['authorization'] = authToken;
      }

      const response = await this.httpService.get<Reservation>(url, {
        headers,
      });

      return response;
    } catch (error) {
      this.logger.error(`Error getting reservation ${reservationId}:`, error);
      throw new Error(`Failed to get reservation ${reservationId}`);
    }
  }
}

