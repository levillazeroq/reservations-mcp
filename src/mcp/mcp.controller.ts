import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { MCPService } from './mcp.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';

/**
 * Controlador MCP - Expone endpoints para n8n y otros clientes
 * 
 * Endpoints:
 * - GET /mcp/tools - Lista de tools disponibles
 * - POST /mcp/execute - Ejecutar una tool específica
 */
@Controller('mcp')
@UseGuards(ApiKeyGuard)
export class MCPController {
  constructor(private readonly mcpService: MCPService) {}

  /**
   * Lista todas las tools disponibles con sus schemas
   * Endpoint para que n8n descubra las tools disponibles
   */
  @Get('tools')
  @HttpCode(HttpStatus.OK)
  listTools() {
    return this.mcpService.listTools();
  }

  /**
   * Ejecuta una tool específica
   * Body: { tool: string, arguments: object }
   */
  @Post('execute')
  @HttpCode(HttpStatus.OK)
  async executeTool(@Body() body: { tool: string; arguments: any }) {
    const result = await this.mcpService.executeTool(
      body.tool,
      body.arguments || {},
    );
    
    return {
      success: true,
      tool: body.tool,
      result,
    };
  }

  /**
   * Health check endpoint
   */
  @Get('health')
  @HttpCode(HttpStatus.OK)
  health() {
    return {
      status: 'ok',
      service: 'zeroq-mcp',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}

