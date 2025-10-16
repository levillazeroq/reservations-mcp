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
      const body = JSON.stringify(data);
      const headers = {
        'Content-Type': 'application/json;charset=UTF-8',
        accept: 'application/json, text/plain, */*',
        ...options?.headers,
      };


      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        ...options,
      });

      this.logger.debug(`📩 Response status: ${response.status} ${response.statusText}`);
      this.logger.debug(`📩 Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2)}`);

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`📩 Response body: ${error}`);
        throw new Error(
          `HTTP ${response.status}: ${response.statusText} - ${error}`,
        );
      }

      const result = await response.json();
      this.logger.log(`✅ POST ${url} successful`);
      return result;
    } catch (error) {
      this.logger.error(`POST ${url} failed:`, error);
      throw error;
    }
  }
}

