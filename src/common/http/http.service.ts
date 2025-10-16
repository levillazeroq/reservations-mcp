import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import axios, { AxiosRequestConfig, AxiosError } from 'axios';

@Injectable()
export class HttpService {
  private readonly logger = new Logger(HttpService.name);

  constructor(private readonly configService: ConfigService) {}

  async get<T>(url: string, options?: AxiosRequestConfig): Promise<T> {
    try {
      this.logger.log(`GET ${url}`);

      const response = await axios.get<T>(url, {
        headers: {
          'Content-Type': 'application/json',
          accept: 'application/json, text/plain, */*',
          'cache-control': 'no-cache',
          ...options?.headers,
        },
        ...options,
      });

      return response.data;
    } catch (error) {
      this.logger.error(`GET ${url} failed:`, error);
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        throw new Error(
          `HTTP ${axiosError.response?.status}: ${axiosError.response?.statusText} - ${JSON.stringify(axiosError.response?.data)}`,
        );
      }
      throw error;
    }
  }

  async post<T>(url: string, data: any, options?: AxiosRequestConfig): Promise<T> {
    try {
      this.logger.log(`📤 POST ${url}`);

      const headers = {
        'Content-Type': 'application/json;charset=UTF-8',
        accept: 'application/json, text/plain, */*',
        ...options?.headers,
      };

      const response = await axios.post<T>(url, data, {
        headers,
        ...options,
      });

      this.logger.log(`✅ POST ${url} - Status: ${response.status}`);

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error(`❌ POST ${url} failed - Status: ${axiosError.response?.status}`);
        this.logger.error(`📩 Error: ${JSON.stringify(axiosError.response?.data)}`);

        throw new Error(
          `HTTP ${axiosError.response?.status}: ${axiosError.response?.statusText} - ${JSON.stringify(axiosError.response?.data)}`,
        );
      }

      this.logger.error(`❌ POST ${url} failed:`, error);
      throw error;
    }
  }
}

