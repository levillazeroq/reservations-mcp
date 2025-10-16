import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { HealthService } from './health.service';

/**
 * Controlador de Health Check
 *
 * Endpoints públicos (sin autenticación) para monitoreo:
 * - GET /health - Health check básico
 * - GET /health/detailed - Health check detallado con validación de servicios
 * - GET /health/config - Validación de configuración
 * - GET /health/metrics - Métricas del sistema
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /**
   * Health check básico y rápido
   * Usado por Docker, Kubernetes, load balancers, etc.
   *
   * Response: { status: 'ok', service: '...', version: '...', timestamp: '...', uptime: 123 }
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async health() {
    return this.healthService.checkBasicHealth();
  }

  /**
   * Health check detallado con validación de servicios externos
   * Query param: ?detailed=true para incluir validación de servicios
   *
   * Response: {
   *   status: 'healthy' | 'degraded' | 'unhealthy',
   *   timestamp: '...',
   *   uptime: 123,
   *   version: '...',
   *   services: { zeroq: { status: 'up', latency: 123 } },
   *   config: { environment: '...', port: 3030, hasOpenAIKey: true, ... }
   * }
   */
  @Get('detailed')
  @HttpCode(HttpStatus.OK)
  async detailedHealth(@Query('detailed') detailed?: string) {
    const isDetailed = detailed === 'true' || detailed === '1';
    return this.healthService.checkHealth(isDetailed);
  }

  /**
   * Validación de configuración
   * Verifica que todas las variables de entorno requeridas estén configuradas
   *
   * Response: { valid: true/false, errors: [...] }
   */
  @Get('config')
  @HttpCode(HttpStatus.OK)
  async configValidation() {
    const validation = this.healthService.validateConfiguration();

    return {
      ...validation,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Métricas del sistema
   * Información sobre memoria, proceso y uptime
   *
   * Response: {
   *   memory: { rss: 123, heapTotal: 123, heapUsed: 123, external: 123 },
   *   process: { pid: 123, version: '...', platform: '...' },
   *   uptime: 123
   * }
   */
  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  async metrics() {
    return this.healthService.getSystemMetrics();
  }

  /**
   * Liveness probe para Kubernetes
   * Responde si el proceso está vivo (no colgado)
   */
  @Get('live')
  @HttpCode(HttpStatus.OK)
  async liveness() {
    return { status: 'alive' };
  }

  /**
   * Readiness probe para Kubernetes
   * Responde si el servicio está listo para recibir tráfico
   */
  @Get('ready')
  @HttpCode(HttpStatus.OK)
  async readiness() {
    const health = await this.healthService.checkHealth(false);

    if (health.status === 'unhealthy') {
      return {
        status: 'not_ready',
        reason: 'Service is unhealthy',
      };
    }

    return {
      status: 'ready',
      uptime: health.uptime,
    };
  }
}

