import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '../../common/http/http.service';
import { ConfigService } from '../../config/config.service';
import { DateUtilsService } from '../../utils/date-utils.service';
import {
  Office,
  OfficeDetails,
  OfficeDetailsDTO,
  BlockDay,
  BlockDayResponse,
  AvailableBlockDay,
  Reservation,
  ReservationRequest,
  Line,
  OfficeList,
  TimeBlock,
} from './types';

@Injectable()
export class ZeroQService {
  private readonly logger = new Logger(ZeroQService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly dateUtils: DateUtilsService,
  ) {}

  /**
   * Lista todas las oficinas web disponibles
   */
  async listWebOffices(): Promise<OfficeList[]> {
    try {
      const url = `${this.configService.zeroqApiBaseUrl}/v3/offices/web`;
      const response = await this.httpService.get<{ data: Office[] }>(url);
      return response.data.map((office) => ({
        id: office.id,
        slug: office.slug,
        name: office.name,
      }));
    } catch (error) {
      this.logger.error('Error listing web offices:', error);
      throw new Error('Failed to list web offices');
    }
  }

  /**
   * Obtiene detalles de una oficina y sus líneas
   */
  async getOfficeDetails(officeSlug: string): Promise<OfficeDetailsDTO> {
    try {
      const url = `${this.configService.zeroqApiBaseUrl}/v1/state/${officeSlug}`;
      const response = await this.httpService.get<OfficeDetails>(url);

      // Filtrar solo los atributos necesarios
      const filteredResponse: OfficeDetailsDTO = {
        id: response.id,
        slug: response.slug,
        name: response.name,
        timezone: response.timezone,
        reservable: response.reservable,
        lines: Object.values(response.lines || {}).map((line) => ({
          id: line.id,
          slug: line.slug,
          name: line.name,
          prefix: line.prefix,
          type: line.type,
        })),
      };

      return filteredResponse;
    } catch (error) {
      this.logger.error(
        `Error getting office details for ${officeSlug}:`,
        error,
      );
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
        (line: any) => !line.meta?.disabled_reserves,
      ) as any[];

      this.logger.log(
        `📋 Found ${availableLines.length} available lines for office "${officeSlug}":`,
      );
      availableLines.forEach((line: any, index: number) => {
        this.logger.log(
          `   ${index + 1}. "${line.name}" (slug: "${line.slug}")`,
        );
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
  ): Promise<AvailableBlockDay[]> {
    try {
      this.logger.log(`📋 Getting available blocks for: "${lineSlug}"`);

      // Advertencia: detectar si se está usando officeSlug en lugar de lineSlug
      const slugParts = lineSlug.split('-');
      if (slugParts.length < 3) {
        this.logger.warn(
          `⚠️  lineSlug "${lineSlug}" seems too short. Make sure it's a line slug, not an office slug.`,
        );
      }

      // Determinar la fecha a consultar
      let targetDate: string;
      if (date) {
        targetDate = this.dateUtils.toSimpleDate(date);
      } else {
        targetDate = this.dateUtils.toSimpleDate(new Date());
      }

      // ⚠️ VALIDAR: La fecha NO debe ser anterior al día de hoy
      this.dateUtils.validateDateNotPast(targetDate, 'date');

      // La API de ZeroQ requiere from=YYYY-MM-DD&to=YYYY-MM-DD para consultar un día completo
      const fromDate = targetDate;
      const toDate = targetDate;
      const url = `${this.configService.zeroqBlocksBaseUrl}/blocks/${lineSlug}?from=${fromDate}&to=${toDate}&tz=${tz}`;

      const response = await this.httpService.get<
        BlockDayResponse[] | { data: BlockDayResponse[] }
      >(url);

      // La API puede devolver un array directamente o un objeto con un campo 'data'
      const blocksData = Array.isArray(response)
        ? response
        : response?.data || [];

      if (!Array.isArray(blocksData)) {
        this.logger.error('❌ Invalid response format from blocks API');
        throw new Error('Invalid response format from blocks API');
      }

      // Filtrar y analizar bloques disponibles
      const availableDays: AvailableBlockDay[] = blocksData
        .map((day: BlockDayResponse): AvailableBlockDay | null => {
          // Filtrar solo bloques con slots disponibles (slots > 0)
          const availableBlocks: TimeBlock[] = (day.blocks || []).filter(
            (block: TimeBlock) => block.slots > 0,
          );

          if (availableBlocks.length === 0) {
            return null; // No hay bloques disponibles este día
          }

          return {
            date: day.date,
            isException: day.isException,
            from: day.from,
            to: day.to,
            isRangeConfig: day.isRangeConfig,
            blocks: availableBlocks,
            totalAvailableSlots: availableBlocks.reduce(
              (sum: number, block: TimeBlock) => sum + block.slots,
              0,
            ),
            availableBlocksCount: availableBlocks.length,
          };
        })
        .filter((day): day is AvailableBlockDay => day !== null); // Remover días sin bloques disponibles

      const totalBlocks = availableDays.reduce(
        (sum: number, day: AvailableBlockDay) => sum + day.availableBlocksCount,
        0,
      );
      this.logger.log(
        `✅ Found ${availableDays.length} day(s) with ${totalBlocks} available block(s)`,
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
  async createReservation(data: ReservationRequest): Promise<Reservation> {
    try {
      this.logger.log('🔍 Creating reservation...');

      const url = this.configService.zeroqReservationsBaseUrl;
      const headers: Record<string, string> = {};

      // Usar el token de autenticación de las variables de entorno
      const authToken = this.configService.zeroqAuthToken;
      if (authToken) {
        headers['authorization'] = authToken;
      }

      // Validar y normalizar fechas
      const normalizedFrom = this.dateUtils.validateAndNormalizeDate(
        data.from,
        'from',
      );
      const normalizedTo = this.dateUtils.validateAndNormalizeDate(
        data.to,
        'to',
      );

      // Validar que 'to' sea después de 'from'
      this.dateUtils.validateDateRange(normalizedFrom, normalizedTo);

      const normalizedData = {
        ...data,
        from: normalizedFrom,
        to: normalizedTo,
      };

      const response = await this.httpService.post<Reservation>(
        url,
        normalizedData,
        {
          headers,
        },
      );

      this.logger.log(`✅ Reservation created: ${response._id}`);
      return response;
    } catch (error) {
      this.logger.error('❌ Failed to create reservation');
      throw error;
    }
  }

  /**
   * Obtiene detalles de una reserva existente
   */
  async getReservation(reservationId: string): Promise<Reservation> {
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
