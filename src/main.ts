import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import { Logger, ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Enable validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.port;

  await app.listen(port);
  logger.log(`🚀 MCP Server running on: http://localhost:${port}`);
  logger.log(`📋 Tools endpoint: http://localhost:${port}/mcp/tools`);
  logger.log(`⚡ Execute endpoint: http://localhost:${port}/mcp/execute`);
  logger.log(`🤖 Agent chat endpoint: http://localhost:${port}/agent/chat`);
}
bootstrap();
