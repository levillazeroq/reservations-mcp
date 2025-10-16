import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../config/config.service';
import { HttpService } from '../http/http.service';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    [key: string]: {
      status: 'up' | 'down';
      latency?: number;
      error?: string;
    };
  };
  config: {
    environment: string;
    port: number;
    hasOpenAIKey: boolean;
    hasZeroQToken: boolean;
  };
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();
  private readonly version = process.env.npm_package_version || '1.0.0';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Realiza un health check completo del sistema
   */
  async checkHealth(detailed: boolean = false): Promise<HealthStatus> {
    const services: HealthStatus['services'] = {};

    // Verificar servicio de ZeroQ (solo si detailed=true)
    if (detailed) {
      services.zeroq = await this.checkZeroQService();
    }

    // Determinar estado general
    const allServicesUp = Object.values(services).every(
      (service) => service.status === 'up',
    );
    const someServicesDown = Object.values(services).some(
      (service) => service.status === 'down',
    );

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (someServicesDown && !allServicesUp) {
      status = 'degraded';
    } else if (!allServicesUp && Object.keys(services).length > 0) {
      status = 'unhealthy';
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: this.version,
      services: Object.keys(services).length > 0 ? services : {},
      config: {
        environment: process.env.NODE_ENV || 'development',
        port: this.configService.port,
        hasOpenAIKey: !!this.configService.openaiApiKey,
        hasZeroQToken: !!this.configService.zeroqAuthToken,
      },
    };
  }

  /**
   * Health check básico (solo estado del servicio)
   */
  async checkBasicHealth(): Promise<{
    status: string;
    service: string;
    version: string;
    timestamp: string;
    uptime: number;
  }> {
    return {
      status: 'ok',
      service: 'zeroq-mcp-tools',
      version: this.version,
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  /**
   * Verifica la conectividad con el servicio de ZeroQ
   */
  private async checkZeroQService(): Promise<{
    status: 'up' | 'down';
    latency?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();

      // Intentar listar oficinas (endpoint más ligero)
      const url = `${this.configService.zeroqBaseUrl}/web-offices`;
      await this.httpService.get(url);

      const latency = Date.now() - startTime;

      return {
        status: 'up',
        latency,
      };
    } catch (error) {
      this.logger.warn(
        `ZeroQ health check failed: ${error.message}`,
      );
      return {
        status: 'down',
        error: error.message || 'Connection failed',
      };
    }
  }

  /**
   * Verifica que la configuración sea válida
   */
  validateConfiguration(): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!this.configService.zeroqAuthToken) {
      errors.push('ZEROQ_AUTH_TOKEN is not configured');
    }

    if (!this.configService.zeroqBaseUrl) {
      errors.push('ZEROQ_BASE_URL is not configured');
    }

    if (!this.configService.zeroqBlocksBaseUrl) {
      errors.push('ZEROQ_BLOCKS_BASE_URL is not configured');
    }

    if (!this.configService.zeroqReservationsBaseUrl) {
      errors.push('ZEROQ_RESERVATIONS_BASE_URL is not configured');
    }

    if (!this.configService.openaiApiKey) {
      errors.push(
        'OPENAI_API_KEY is not configured (required for AI Agent)',
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Obtiene métricas del sistema
   */
  getSystemMetrics() {
    const memoryUsage = process.memoryUsage();

    return {
      memory: {
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
      },
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
      },
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}

