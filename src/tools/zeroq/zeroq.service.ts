import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '../../common/http/http.service';
import { ConfigService } from '../../config/config.service';
import {
  Office,
  OfficeDetails,
  BlockDay,
  Reservation,
  ReservationRequest,
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
      return linesArray.filter(
        (line: any) => !line.meta?.disabled_reserves
      ) as any[];
    } catch (error) {
      this.logger.error(`Error getting lines for office ${officeSlug}:`, error);
      throw new Error(`Failed to get lines for office ${officeSlug}`);
    }
  }

  /**
   * Obtiene bloques de tiempo disponibles para una línea
   */
  async getAvailableBlocks(
    lineSlug: string,
    from: string,
    to: string,
    tz: string = 'America/Santiago',
  ): Promise<BlockDay[]> {
    try {
      const url = `${this.configService.zeroqBlocksBaseUrl}/blocks/${lineSlug}?from=${from}&to=${to}&tz=${tz}`;
      const response = await this.httpService.get<BlockDay[]>(url);
      return response;
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
    authToken?: string,
  ): Promise<Reservation> {
    try {
      const url = this.configService.zeroqReservationsBaseUrl;
      const headers: Record<string, string> = {};
      
      if (authToken) {
        headers['authorization'] = authToken;
      }

      const response = await this.httpService.post<Reservation>(url, data, {
        headers,
      });
      
      return response;
    } catch (error) {
      this.logger.error('Error creating reservation:', error);
      throw new Error('Failed to create reservation');
    }
  }

  /**
   * Obtiene detalles de una reserva existente
   */
  async getReservation(
    reservationId: string,
    authToken?: string,
  ): Promise<Reservation> {
    try {
      const url = `${this.configService.zeroqReservationsBaseUrl}/${reservationId}`;
      const headers: Record<string, string> = {};
      
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

