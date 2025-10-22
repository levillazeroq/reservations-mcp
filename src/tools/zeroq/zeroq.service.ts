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
  BlockDayResponse,
  AvailableBlockDay,
  Reservation,
  ReservationRequest,
  RescheduleReservationRequest,
  Line,
  OfficeList,
  TimeBlock,
  BlockValidationResult,
  UpcomingBlock,
  UpcomingBlocksResult,
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
   * Valida si un bloque de tiempo específico está disponible
   * Permite especificar hora en diferentes formatos: "14:00", "2pm", "14:00:00"
   */
  async validateBlockAvailability(
    lineSlug: string,
    fromTime: string,
    date?: string,
    tz: string = 'America/Santiago',
  ): Promise<BlockValidationResult> {
    try {
      this.logger.log(
        `🔍 Validating block availability for: "${lineSlug}" at ${fromTime} (timezone: ${tz})`,
      );

      // Obtener bloques disponibles para la fecha
      const availableDays = await this.getAvailableBlocks(lineSlug, date, tz);

      if (availableDays.length === 0) {
        return {
          available: false,
          message: 'No available blocks found for this date',
          suggestedBlocks: [],
        };
      }

      // Trabajar con el primer día (ya que consultamos un día específico)
      const day = availableDays[0];
      const blocks = day.blocks;

      // Normalizar la hora solicitada a formato ISO
      const normalizedFromTime = this.dateUtils.normalizeTimeInput(
        fromTime,
        date || moment().tz(tz).format('YYYY-MM-DD'),
        tz,
      );

      this.logger.log(`🕒 Normalized time: ${normalizedFromTime}`);

      // Buscar el bloque exacto
      const exactBlock = blocks.find((block) => {
        const blockFrom = moment.tz(block.from, tz);
        const requestedTime = moment.tz(normalizedFromTime, tz);
        return blockFrom.isSame(requestedTime, 'minute');
      });

      if (exactBlock && exactBlock.slots > 0) {
        this.logger.log(
          `✅ Block available: ${exactBlock.from} - ${exactBlock.to} (${exactBlock.slots} slot${exactBlock.slots > 1 ? 's' : ''})`,
        );
        return {
          available: true,
          message: `Block is available with ${exactBlock.slots} slot${exactBlock.slots > 1 ? 's' : ''}`,
          block: exactBlock,
          suggestedBlocks: [],
        };
      }

      // Si no se encuentra el bloque exacto, sugerir bloques cercanos
      const suggestedBlocks = blocks.slice(0, 5); // Primeros 5 bloques disponibles

      this.logger.warn(
        `⚠️  Requested block not available. Suggesting ${suggestedBlocks.length} alternative(s)`,
      );

      return {
        available: false,
        message: `Requested block at ${fromTime} is not available`,
        suggestedBlocks: suggestedBlocks,
      };
    } catch (error) {
      this.logger.error(
        `Error validating block availability for line ${lineSlug}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Obtiene los 5 bloques de tiempo más próximos a la hora actual
   * Consulta el día actual y el siguiente automáticamente
   * Los bloques se ordenan por proximidad a la hora actual
   */
  async getUpcomingBlocks(
    lineSlug: string,
    date?: string,
    tz: string = 'America/Santiago',
  ): Promise<UpcomingBlocksResult> {
    try {
      this.logger.log(
        `🔜 Getting upcoming blocks for: "${lineSlug}" (timezone: ${tz})`,
      );

      // Obtener la hora actual en la zona horaria especificada
      const nowInTz = moment().tz(tz);
      const currentDayStr = nowInTz.format('YYYY-MM-DD');
      this.logger.log(
        `⏰ Current time in ${tz}: ${nowInTz.format('YYYY-MM-DD HH:mm:ss')}`,
      );

      // Determinar la fecha de inicio
      let startDate: string;
      let startDateMoment: moment.Moment;

      if (date) {
        // Normalizar fecha
        startDate = this.dateUtils.toSimpleDate(date);
        startDateMoment = moment.tz(startDate, tz);

        // Verificar que el año sea el actual
        const currentYear = new Date().getFullYear();
        if (startDateMoment.year() !== currentYear) {
          this.logger.warn(
            `⚠️  Year ${startDateMoment.year()} adjusted to ${currentYear}`,
          );
          startDateMoment.year(currentYear);
          startDate = startDateMoment.format('YYYY-MM-DD');
        }

        // Validar que la fecha no sea anterior a hoy
        if (startDateMoment.isBefore(moment(currentDayStr), 'day')) {
          this.logger.error(
            `❌ Requested date (${startDate}) is before current day (${currentDayStr})`,
          );
          throw new Error(
            `Cannot query blocks for past dates. Requested date (${startDate}) is before today (${currentDayStr}). Please provide a current or future date.`,
          );
        }
      } else {
        // Por defecto usar el día de hoy
        startDate = currentDayStr;
        startDateMoment = nowInTz.clone();
      }

      this.logger.log(`📅 Start date: ${startDate}`);

      // Calcular el día siguiente
      const nextDay = moment.tz(startDate, tz).add(1, 'day');
      const nextDayStr = nextDay.format('YYYY-MM-DD');

      // Consultar bloques del día de inicio y del día siguiente
      const fromDate = startDate;
      const toDate = nextDayStr;
      const url = `${this.configService.zeroqBlocksBaseUrl}/blocks/${lineSlug}?from=${fromDate}&to=${toDate}&tz=${tz}&notCache=true`;

      this.logger.log(`🌐 Querying blocks API for 2 days: ${url}`);

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

      if (blocksData.length === 0) {
        this.logger.warn(
          `⚠️  No blocks found for ${lineSlug} in the next 2 days`,
        );
        return {
          currentTime: nowInTz.format('YYYY-MM-DD HH:mm:ss'),
          currentTimezone: tz,
          upcomingBlocks: [],
          totalBlocks: 0,
        };
      }

      // Recolectar todos los bloques disponibles de ambos días
      const allBlocks: UpcomingBlock[] = [];

      for (const day of blocksData) {
        if (!day.blocks || day.blocks.length === 0) {
          continue;
        }

        for (const block of day.blocks) {
          // Debe tener slots disponibles
          if (block.slots <= 0) {
            continue;
          }

          const blockTime = moment.tz(block.from, tz);

          // Solo incluir bloques que no hayan pasado
          if (blockTime.isAfter(nowInTz)) {
            const minutesUntil = blockTime.diff(nowInTz, 'minutes');
            const hours = Math.floor(minutesUntil / 60);
            const minutes = minutesUntil % 60;

            let timeUntilFormatted: string;
            if (hours > 24) {
              const days = Math.floor(hours / 24);
              const remainingHours = hours % 24;
              timeUntilFormatted = `${days}d ${remainingHours}h`;
            } else if (hours > 0) {
              timeUntilFormatted = `${hours}h ${minutes}m`;
            } else {
              timeUntilFormatted = `${minutes}m`;
            }

            allBlocks.push({
              from: block.from,
              to: block.to,
              slots: block.slots,
              date: day.date,
              minutesUntil,
              timeUntilFormatted,
            });
          }
        }
      }

      // Ordenar por proximidad (minutesUntil ascendente)
      allBlocks.sort((a, b) => a.minutesUntil - b.minutesUntil);

      // Tomar los primeros 5 bloques
      const upcomingBlocks = allBlocks.slice(0, 5);

      this.logger.log(
        `✅ Found ${upcomingBlocks.length} upcoming block(s) (from ${allBlocks.length} total available):`,
      );
      upcomingBlocks.forEach((block, index) => {
        const blockTime = moment.tz(block.from, tz);
        this.logger.log(
          `   ${index + 1}. ${blockTime.format('YYYY-MM-DD HH:mm')} - ${moment.tz(block.to, tz).format('HH:mm')} (${block.slots} slot${block.slots > 1 ? 's' : ''}, in ${block.timeUntilFormatted})`,
        );
      });

      return {
        currentTime: nowInTz.format('YYYY-MM-DD HH:mm:ss'),
        currentTimezone: tz,
        upcomingBlocks,
        totalBlocks: allBlocks.length,
      };
    } catch (error) {
      this.logger.error(
        `Error getting upcoming blocks for line ${lineSlug}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Crea una nueva reserva
   *
   * @param data - Datos de la reserva a crear
   * @returns Reservation - Objeto completo de la reserva creada
   *
   * CLAVES PRINCIPALES en la respuesta:
   * - _id: ID único interno de MongoDB (usar para operaciones del sistema)
   * - reserveNumber: Número de reserva legible (ej: "RV926") - mostrar al usuario
   * - operationNumber: Número de operación único para tracking
   *
   * El usuario debe guardar reserveNumber para futuras consultas
   */
  async createReservation(data: ReservationRequest): Promise<Reservation> {
    try {
      this.logger.log('Creating reservation...');

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


      return response;
    } catch (error) {
      this.logger.error('Failed to create reservation');
      throw error;
    }
  }

  /**
   * Reagenda una reserva existente a un nuevo horario
   *
   * @param data - Datos de la nueva reserva incluyendo oldIdReservation
   * @returns Reservation - Objeto completo de la nueva reserva creada
   *
   * IMPORTANTE:
   * - oldIdReservation: ID de la reserva a reagendar (acepta _id o reserveNumber)
   * - Valida que el nuevo horario sea válido (fecha >= HOY)
   * - Crea una nueva reserva y marca la anterior como reagendada
   * - La respuesta incluye un nuevo _id y reserveNumber (mostrar al usuario)
   *
   * FLUJO:
   * 1. Usuario tiene reserva RV123
   * 2. Quiere cambiarla a otro horario
   * 3. Se envía oldIdReservation: "RV123" + nuevo horario
   * 4. Sistema crea nueva reserva RV456 y marca RV123 como reagendada
   * 5. Mostrar al usuario el nuevo reserveNumber (RV456)
   */
  async rescheduleReservation(
    data: RescheduleReservationRequest,
  ): Promise<Reservation> {
    try {
      this.logger.log(
        `Rescheduling reservation: ${data.oldIdReservation} to new time`,
      );

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
        oldIdReservation: data.oldIdReservation, // Campo específico para reagendar
      };

      const response = await this.httpService.post<Reservation>(
        url,
        normalizedData,
        {
          headers,
        },
      );

      this.logger.log(`Reservation rescheduled successfully`);
      this.logger.log(`  - Old reservation: ${data.oldIdReservation}`);
      this.logger.log(`  - New ID: ${response._id}`);
      this.logger.log(`  - New Reserve Number: ${response.reserveNumber}`);

      return response;
    } catch (error) {
      this.logger.error(
        `Failed to reschedule reservation ${data.oldIdReservation}`,
      );
      throw error;
    }
  }

  /**
   * Cancela una reserva existente
   *
   * @param reservationId - Puede ser _id (MongoDB ObjectId) o reserveNumber (ej: "RV926")
   * @returns Reservation - Objeto de la reserva cancelada (con deleted_at actualizado)
   *
   * IMPORTANTE:
   * - Acepta tanto _id como reserveNumber
   * - Marca la reserva como eliminada (soft delete)
   * - La reserva queda con deleted_at != null
   * - No se puede cancelar una reserva ya pasada
   * - La respuesta incluye la reserva con su nuevo estado
   *
   * FLUJO:
   * 1. Usuario tiene reserva RV123 y quiere cancelarla
   * 2. Llamar cancelReservation("RV123")
   * 3. Sistema marca la reserva como cancelada
   * 4. Informar al usuario: "Tu reserva RV123 ha sido cancelada exitosamente"
   */
  async cancelReservation(reservationId: string): Promise<Reservation> {
    try {
      this.logger.log(`Canceling reservation: ${reservationId}`);

      const url = `${this.configService.zeroqReservationsBaseUrl}/${reservationId}`;
      const headers: Record<string, string> = {};

      // Usar el token de autenticación de las variables de entorno
      const authToken = this.configService.zeroqAuthToken;
      if (authToken) {
        headers['authorization'] = authToken;
      }

      const response = await this.httpService.delete<Reservation>(url, {
        headers,
      });

      this.logger.log(`Reservation canceled successfully: ${reservationId}`);

      return response;
    } catch (error) {
      this.logger.error(`Error canceling reservation ${reservationId}:`, error);
      throw new Error(`Failed to cancel reservation ${reservationId}`);
    }
  }

  /**
   * Obtiene detalles de una reserva existente
   *
   * @param reservationId - Puede ser _id (MongoDB ObjectId) o reserveNumber (ej: "RV926")
   * @returns Reservation - Objeto completo de la reserva
   *
   * CLAVES PRINCIPALES que se pueden usar para consultar:
   * 1. _id: ID interno de MongoDB (ej: "507f1f77bcf86cd799439011")
   * 2. reserveNumber: Número de reserva legible (ej: "RV926") - RECOMENDADO para usuarios
   *
   * La respuesta incluye:
   * - Información completa de la oficina (ubicación, timezone, etc)
   * - Información de la línea de atención
   * - Datos del usuario que reservó
   * - Horarios (from/to) en formato ISO 8601
   * - Estado de la reserva (active, confirmed, deleted_at)
   */
  async getReservation(reservationId: string): Promise<Reservation> {
    try {
      this.logger.log(`Getting reservation: ${reservationId}`);

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
