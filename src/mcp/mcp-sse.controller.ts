import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { MCP_TOOLS } from './mcp-tools.schemas';
import { MCPService } from './mcp.service';

/**
 * Controlador MCP compatible con HTTP Streamable (invariantlabs-ai style)
 * Basado en: https://github.com/invariantlabs-ai/mcp-streamable-http
 *
 * Este controlador maneja todas las peticiones MCP en un solo endpoint
 * usando Server-Sent Events (SSE) para la comunicación bidireccional
 */
@Controller('mcp')
export class McpSseController {
  private readonly logger = new Logger(McpSseController.name);

  constructor(private readonly mcpService: MCPService) {}

  /**
   * Endpoint único que maneja todas las comunicaciones MCP via SSE
   * Compatible con n8n MCP Client usando HTTP Streamable
   */
  @Post('sse')
  @UseGuards(ApiKeyGuard)
  @HttpCode(HttpStatus.OK)
  async handleMcpRequest(
    @Body() body: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    this.logger.log(`📨 MCP Request received: ${JSON.stringify(body)}`);

    // Configurar headers para SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Función helper para enviar eventos SSE
    const sendEvent = (data: any) => {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      res.write(message);
      this.logger.debug(`📤 Sent event: ${message.substring(0, 200)}...`);
    };

    try {
      // Manejar diferentes tipos de solicitudes MCP
      const method = body.method || body.type;
      const requestId = body.id !== undefined ? body.id : 1;

      switch (method) {
        case 'initialize':
          // Responder al initialize con el ID correcto
          sendEvent({
            jsonrpc: '2.0',
            id: requestId,
            result: {
              protocolVersion: '2024-11-05',
              serverInfo: {
                name: 'zeroq-mcp',
                version: '1.0.0',
              },
              capabilities: {
                tools: {},
              },
            },
          });

          // Enviar la lista de tools como notificación
          sendEvent({
            jsonrpc: '2.0',
            method: 'tools/list',
            params: {
              tools: MCP_TOOLS,
            },
          });
          break;

        case 'tools/list':
        case 'listTools':
          // Responder con lista de tools
          sendEvent({
            jsonrpc: '2.0',
            id: requestId,
            result: {
              tools: MCP_TOOLS,
            },
          });
          break;

        case 'tools/call':
        case 'callTool':
          // Ejecutar una tool
          const toolName = body.params?.name || body.tool;
          const toolArgs = body.params?.arguments || body.arguments || {};

          this.logger.log(`🔧 Executing tool: ${toolName}`);

          try {
            const result = await this.mcpService.executeTool(toolName, toolArgs);

            sendEvent({
              jsonrpc: '2.0',
              id: requestId,
              result: {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify(result, null, 2),
                  },
                ],
                isError: false,
              },
            });
          } catch (error) {
            this.logger.error(`❌ Tool execution error: ${error.message}`);
            sendEvent({
              jsonrpc: '2.0',
              id: requestId,
              error: {
                code: -32603,
                message: error.message,
              },
            });
          }
          break;

        case 'ping':
          // Responder a ping
          sendEvent({
            jsonrpc: '2.0',
            id: requestId,
            result: { status: 'pong' },
          });
          break;

        default:
          // Método desconocido
          this.logger.warn(`⚠️  Unknown method: ${method}`);
          sendEvent({
            jsonrpc: '2.0',
            id: requestId,
            error: {
              code: -32601,
              message: `Method not found: ${method}`,
            },
          });
      }

      // Cerrar la conexión después de enviar la respuesta
      res.end();
    } catch (error) {
      this.logger.error(`❌ Error handling MCP request: ${error.message}`);
      const requestId = body.id !== undefined ? body.id : 1;
      sendEvent({
        jsonrpc: '2.0',
        id: requestId,
        error: {
          code: -32603,
          message: 'Internal server error',
          data: error.message,
        },
      });
      res.end();
    }
  }

}

