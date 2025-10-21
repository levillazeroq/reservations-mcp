import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '../../common/http/http.service';
import { ConfigService } from '../../config/config.service';
import { DateUtilsService } from '../../utils/date-utils.service';
import { CacheService } from '../../common/cache/cache.service';
import moment from 'moment-timezone';
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
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Lista todas las oficinas web disponibles
   */
  async listWebOffices(): Promise<OfficeList[]> {
    const cacheKey = 'zeroq:offices:web';

    try {
      // Intentar obtener del cache
      const cached = await this.cacheService.get<OfficeList[]>(cacheKey);
      if (cached) {
        this.logger.log('✅ Returning cached web offices list');
        return cached;
      }

      // Si no está en cache, hacer la petición
      const url = `${this.configService.zeroqApiBaseUrl}/v3/offices/web`;
      const response = await this.httpService.get<{ data: Office[] }>(url);
      const offices = response.data.map((office) => ({
        id: office.id,
        slug: office.slug,
        name: office.name,
      }));

      // Guardar en cache
      await this.cacheService.set(cacheKey, offices);
      this.logger.log('💾 Cached web offices list');

      return offices;
    } catch (error) {
      this.logger.error('Error listing web offices:', error);
      throw new Error('Failed to list web offices');
    }
  }

  /**
   * Busca oficinas por slug o nombre
   * Utiliza el cache de Redis para búsquedas rápidas
   */
  async searchWebOffices(query: string): Promise<OfficeList[]> {
    try {
      this.logger.log(`🔍 Searching offices with query: "${query}"`);

      // Obtener todas las oficinas (usa cache automáticamente)
      const allOffices = await this.listWebOffices();

      // Normalizar query para búsqueda case-insensitive
      const normalizedQuery = query.toLowerCase().trim();

      // Buscar por slug o nombre (coincidencia parcial)
      const results = allOffices.filter((office) => {
        const slugMatch = office.slug.toLowerCase().includes(normalizedQuery);
        const nameMatch = office.name.toLowerCase().includes(normalizedQuery);
        return slugMatch || nameMatch;
      });

      this.logger.log(
        `✅ Found ${results.length} office(s) matching "${query}"`,
      );

      if (results.length === 0) {
        this.logger.warn(`⚠️  No offices found matching "${query}"`);
      } else {
        results.forEach((office, index) => {
          this.logger.log(
            `   ${index + 1}. "${office.name}" (slug: "${office.slug}")`,
          );
        });
      }

      return results;
    } catch (error) {
      this.logger.error(`Error searching offices with query "${query}":`, error);
      throw new Error(`Failed to search offices with query "${query}"`);
    }
  }

  /**
   * Obtiene detalles de una oficina y sus líneas
   */
  async getOfficeDetails(officeSlug: string): Promise<OfficeDetailsDTO> {
    const cacheKey = `zeroq:office:details:${officeSlug}`;

    try {
      // Intentar obtener del cache
      const cached = await this.cacheService.get<OfficeDetailsDTO>(cacheKey);
      if (cached) {
        this.logger.log(
          `✅ Returning cached office details for ${officeSlug}`,
        );
        return cached;
      }

      // Si no está en cache, hacer la petición
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

      // Guardar en cache
      await this.cacheService.set(cacheKey, filteredResponse);
      this.logger.log(`💾 Cached office details for ${officeSlug}`);

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
    const cacheKey = `zeroq:office:lines:${officeSlug}`;

    try {
      // Intentar obtener del cache
      const cached = await this.cacheService.get<Line[]>(cacheKey);
      if (cached) {
        this.logger.log(`✅ Returning cached office lines for ${officeSlug}`);
        return cached;
      }

      // Si no está en cache, obtener los detalles
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

      // Guardar en cache
      await this.cacheService.set(cacheKey, availableLines);
      this.logger.log(`💾 Cached office lines for ${officeSlug}`);

      return availableLines;
    } catch (error) {
      this.logger.error(`Error getting lines for office ${officeSlug}:`, error);
      throw new Error(`Failed to get lines for office ${officeSlug}`);
    }
  }

  /**
   * Obtiene bloques de tiempo disponibles para una línea en una fecha específica
   * Siempre consulta el día completo y filtra solo bloques con slots disponibles
   * Valida que los bloques no hayan expirado considerando la zona horaria
   */
  async getAvailableBlocks(
    lineSlug: string,
    date?: string,
    tz: string = 'America/Santiago',
  ): Promise<AvailableBlockDay[]> {
    try {
      this.logger.log(
        `📋 Getting available blocks for: "${lineSlug}" (timezone: ${tz})`,
      );

      // Advertencia: detectar si se está usando officeSlug en lugar de lineSlug
      const slugParts = lineSlug.split('-');
      if (slugParts.length < 3) {
        this.logger.warn(
          `⚠️  lineSlug "${lineSlug}" seems too short. Make sure it's a line slug, not an office slug.`,
        );
      }

      // Obtener la hora actual en la zona horaria especificada
      const nowInTz = moment().tz(tz);
      const currentDayStr = nowInTz.format('YYYY-MM-DD');
      this.logger.log(
        `⏰ Current time in ${tz}: ${nowInTz.format('YYYY-MM-DD HH:mm:ss')}`,
      );

      // Determinar la fecha a consultar
      let targetDate: string;
      let requestedDateMoment: moment.Moment;

      if (date) {
        // Normalizar fecha: toSimpleDate siempre fuerza el año actual
        targetDate = this.dateUtils.toSimpleDate(date);

        // Crear moment con la fecha normalizada (ya tiene el año actual)
        requestedDateMoment = moment.tz(targetDate, tz);

        // Verificar que el año sea el actual, si no, forzarlo
        const currentYear = new Date().getFullYear();
        if (requestedDateMoment.year() !== currentYear) {
          this.logger.warn(
            `⚠️  Year ${requestedDateMoment.year()} adjusted to ${currentYear}`,
          );
          requestedDateMoment.year(currentYear);
          targetDate = requestedDateMoment.format('YYYY-MM-DD');
        }
      } else {
        targetDate = this.dateUtils.toSimpleDate(new Date());
        requestedDateMoment = nowInTz.clone();
      }

      const requestedDayStr = requestedDateMoment.format('YYYY-MM-DD');
      this.logger.log(`📅 Requested date: ${requestedDayStr}`);

      // ⚠️ VALIDAR: El día solicitado no debe ser anterior al día actual
      if (moment(requestedDayStr).isBefore(moment(currentDayStr), 'day')) {
        this.logger.error(
          `❌ Requested day (${requestedDayStr}) is before current day (${currentDayStr})`,
        );
        throw new Error(
          `Cannot query blocks for past dates. Requested date (${requestedDayStr}) is before today (${currentDayStr}). Please provide a current or future date.`,
        );
      }

      // Consultar bloques a la API
      const fromDate = targetDate;
      const toDate = targetDate;
      const url = `${this.configService.zeroqBlocksBaseUrl}/blocks/${lineSlug}?from=${fromDate}&to=${toDate}&tz=${tz}&notCache=true`;

      this.logger.log(`🌐 Querying blocks API: ${url}`);

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

      if (blocksData.length === 0 || !blocksData[0]?.blocks?.length) {
        this.logger.warn(
          `⚠️  No blocks found for ${lineSlug} on ${requestedDayStr}`,
        );
        return [];
      }

      // Filtrar y analizar bloques disponibles
      const isToday = requestedDayStr === currentDayStr;

      const availableDays: AvailableBlockDay[] = blocksData
        .map((day: BlockDayResponse): AvailableBlockDay | null => {
          if (!day.blocks || day.blocks.length === 0) {
            return null;
          }

          // Filtrar bloques válidos
          const availableBlocks: TimeBlock[] = day.blocks.filter(
            (block: TimeBlock) => {
              // Debe tener slots disponibles
              if (block.slots <= 0) {
                return false;
              }

              // Si es hoy, verificar que la hora del bloque no haya pasado
              if (isToday) {
                const blockTime = moment.tz(block.from, tz);
                const blockDayStr = blockTime.format('YYYY-MM-DD');

                // Asegurar que el bloque es del día actual
                if (blockDayStr !== currentDayStr) {
                  return true; // Es de otro día, incluirlo
                }

                // Verificar si la hora ya pasó
                if (blockTime.isSameOrBefore(nowInTz)) {
                  this.logger.debug(
                    `⏭️  Skipping expired block: ${block.from} (current time: ${nowInTz.format('HH:mm:ss')})`,
                  );
                  return false;
                }
              }

              return true;
            },
          );

          if (availableBlocks.length === 0) {
            return null; // No hay bloques disponibles este día
          }

          this.logger.log(
            `✅ Day ${day.date}: ${availableBlocks.length} available block(s)`,
          );
          availableBlocks.forEach((block, index) => {
            const blockTime = moment.tz(block.from, tz);
            this.logger.debug(
              `   ${index + 1}. ${blockTime.format('HH:mm')} - ${moment.tz(block.to, tz).format('HH:mm')} (${block.slots} slot${block.slots > 1 ? 's' : ''})`,
            );
          });

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
        .filter((day): day is AvailableBlockDay => day !== null);

      const totalBlocks = availableDays.reduce(
        (sum: number, day: AvailableBlockDay) => sum + day.availableBlocksCount,
        0,
      );
      const totalSlots = availableDays.reduce(
        (sum: number, day: AvailableBlockDay) => sum + day.totalAvailableSlots,
        0,
      );

      this.logger.log(
        `✅ Found ${availableDays.length} day(s) with ${totalBlocks} available block(s) and ${totalSlots} total slot(s)`,
      );

      if (availableDays.length === 0) {
        this.logger.warn(
          `⚠️  No available blocks found for ${lineSlug} on ${requestedDayStr}. All blocks may have expired or have no slots.`,
        );
      }

      return availableDays;
    } catch (error) {
      this.logger.error(`Error getting blocks for line ${lineSlug}:`, error);
      throw error;
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
