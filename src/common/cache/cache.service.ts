import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly redis: Redis | null = null;
  private readonly defaultTtl: number;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.defaultTtl = this.configService.redisTtl;
    const redisDsn = this.configService.redisDsn;

    if (!redisDsn) {
      this.logger.warn(
        '⚠️  Redis DSN not configured. Cache will be disabled.',
      );
      this.enabled = false;
      return;
    }

    try {
      this.redis = new Redis(redisDsn, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError: (err: Error) => {
          const targetError = 'READONLY';
          if (err.message.includes(targetError)) {
            // Reconectar en caso de error READONLY
            return true;
          }
          return false;
        },
      });

      this.redis.on('connect', () => {
        this.logger.log('✅ Connected to Redis');
      });

      this.redis.on('error', (error: Error) => {
        this.logger.error('❌ Redis connection error:', error.message);
      });

      this.redis.on('ready', () => {
        this.logger.log('🚀 Redis is ready');
      });

      this.enabled = true;
    } catch (error) {
      this.logger.error('❌ Failed to initialize Redis:', error);
      this.enabled = false;
    }
  }

  /**
   * Obtiene un valor del cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled || !this.redis) {
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (!value) {
        this.logger.debug(`🔍 Cache miss for key: ${key}`);
        return null;
      }

      this.logger.debug(`✅ Cache hit for key: ${key}`);
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error(`❌ Error getting cache for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Guarda un valor en el cache con TTL
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.enabled || !this.redis) {
      return;
    }

    try {
      const ttlToUse = ttl || this.defaultTtl;
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttlToUse, serialized);
      this.logger.debug(`💾 Cached key: ${key} (TTL: ${ttlToUse}s)`);
    } catch (error) {
      this.logger.error(`❌ Error setting cache for key ${key}:`, error);
    }
  }

  /**
   * Elimina un valor del cache
   */
  async delete(key: string): Promise<void> {
    if (!this.enabled || !this.redis) {
      return;
    }

    try {
      await this.redis.del(key);
      this.logger.debug(`🗑️  Deleted cache key: ${key}`);
    } catch (error) {
      this.logger.error(`❌ Error deleting cache for key ${key}:`, error);
    }
  }

  /**
   * Elimina todas las keys que coincidan con un patrón
   */
  async deletePattern(pattern: string): Promise<void> {
    if (!this.enabled || !this.redis) {
      return;
    }

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.debug(
          `🗑️  Deleted ${keys.length} cache keys matching pattern: ${pattern}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `❌ Error deleting cache pattern ${pattern}:`,
        error,
      );
    }
  }

  /**
   * Limpia todo el cache
   */
  async clear(): Promise<void> {
    if (!this.enabled || !this.redis) {
      return;
    }

    try {
      await this.redis.flushdb();
      this.logger.log('🗑️  Cache cleared');
    } catch (error) {
      this.logger.error('❌ Error clearing cache:', error);
    }
  }

  /**
   * Verifica si el cache está habilitado y funcionando
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Obtiene estadísticas del cache
   */
  async getStats(): Promise<{
    enabled: boolean;
    connected: boolean;
    keys: number;
  }> {
    if (!this.enabled || !this.redis) {
      return {
        enabled: false,
        connected: false,
        keys: 0,
      };
    }

    try {
      const keys = await this.redis.dbsize();
      return {
        enabled: true,
        connected: this.redis.status === 'ready',
        keys,
      };
    } catch (error) {
      this.logger.error('❌ Error getting cache stats:', error);
      return {
        enabled: this.enabled,
        connected: false,
        keys: 0,
      };
    }
  }

  /**
   * Cierra la conexión de Redis al destruir el módulo
   */
  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
      this.logger.log('👋 Redis connection closed');
    }
  }
}

