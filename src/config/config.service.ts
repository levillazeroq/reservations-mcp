import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  get port(): number {
    return parseInt(process.env.MCP_PORT || '3000', 10);
  }

  get apiKey(): string {
    return process.env.MCP_PUBLIC_API_KEY || 'change-me-strong-key';
  }

  get timezone(): string {
    return process.env.MCP_TZ || 'America/Santiago';
  }

  get zeroqBaseUrl(): string {
    return process.env.ZEROQ_BASE_URL || 'https://zeroq.cl';
  }

  get zeroqApiBaseUrl(): string {
    return process.env.ZEROQ_API_BASE_URL || 'https://zeroq.cl/api';
  }

  get zeroqReservationsBaseUrl(): string {
    return (
      process.env.ZEROQ_RESERVATIONS_BASE_URL ||
      'https://zeroq.cl/services/reservations/api/v3'
    );
  }

  get zeroqBlocksBaseUrl(): string {
    return (
      process.env.ZEROQ_BLOCKS_BASE_URL ||
      'https://services.zeroq.cl/reservations/api/v3'
    );
  }

  get zeroqAuthToken(): string {
    return process.env.ZEROQ_AUTH_TOKEN || '';
  }

  get logLevel(): string {
    return process.env.LOG_LEVEL || 'info';
  }

  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  }

  get openaiApiKey(): string {
    return process.env.OPENAI_API_KEY || '';
  }

  get openaiModel(): string {
    return process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  get openaiMaxTokens(): number {
    return parseInt(process.env.OPENAI_MAX_TOKENS || '2000', 10);
  }

  get openaiTemperature(): number {
    return parseFloat(process.env.OPENAI_TEMPERATURE || '0.7');
  }

  get redisDsn(): string {
    return process.env.REDIS_DSN || '';
  }

  get redisTtl(): number {
    // TTL por defecto: 8 horas en segundos
    return parseInt(process.env.REDIS_TTL || '28800', 10);
  }
}

