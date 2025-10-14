import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class HttpService {
  private readonly logger = new Logger(HttpService.name);

  constructor(private readonly configService: ConfigService) {}

  async get<T>(url: string, options?: RequestInit): Promise<T> {
    try {
      this.logger.log(`GET ${url}`);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json, text/plain, */*',
          'cache-control': 'no-cache',
          ...options?.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${error}`,
        );
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`GET ${url} failed:`, error);
      throw error;
    }
  }

  async post<T>(url: string, data: any, options?: RequestInit): Promise<T> {
    try {
      this.logger.log(`POST ${url}`);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json, text/plain, */*',
          ...options?.headers,
        },
        body: JSON.stringify(data),
        ...options,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${error}`,
        );
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`POST ${url} failed:`, error);
      throw error;
    }
  }
}

