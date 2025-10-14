import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ZeroQService } from '../tools/zeroq/zeroq.service';
import { AgentService } from '../agent/agent.service';
import { MCP_TOOLS } from './mcp-tools.schemas';

/**
 * Servicio MCP que orquesta las tools disponibles
 */
@Injectable()
export class MCPService {
  private readonly logger = new Logger(MCPService.name);

  constructor(
    private readonly zeroqService: ZeroQService,
    private readonly agentService: AgentService,
  ) {}

  /**
   * Retorna la lista de tools disponibles (para n8n)
   */
  listTools() {
    return {
      tools: MCP_TOOLS,
      version: '1.0.0',
      provider: 'zeroq-mcp',
    };
  }

  /**
   * Ejecuta una tool específica con los argumentos proporcionados
   */
  async executeTool(toolName: string, args: any): Promise<any> {
    this.logger.log(`Executing tool: ${toolName} with args:`, args);

    try {
      switch (toolName) {
        case 'chatAgent':
          this.validateRequired(args, ['message']);
          const chatResult = await this.agentService.chat(
            args.message,
            args.conversationHistory,
          );
          return {
            message: chatResult.message,
            conversationHistory: chatResult.conversationHistory,
            toolCallsMade: chatResult.toolCallsMade,
          };

        case 'listWebOffices':
          return await this.zeroqService.listWebOffices();

        case 'getOfficeDetails':
          this.validateRequired(args, ['officeSlug']);
          return await this.zeroqService.getOfficeDetails(args.officeSlug);

        case 'getOfficeLines':
          this.validateRequired(args, ['officeSlug']);
          return await this.zeroqService.getOfficeLines(args.officeSlug);

        case 'getAvailableBlocks':
          this.validateRequired(args, ['lineSlug', 'from', 'to']);
          return await this.zeroqService.getAvailableBlocks(
            args.lineSlug,
            args.from,
            args.to,
            args.tz || 'America/Santiago',
          );

        case 'createReservation':
          this.validateRequired(args, [
            'officeSlug',
            'lineSlug',
            'from',
            'to',
            'personName',
            'personPhone',
            'personEmail',
          ]);
          return await this.zeroqService.createReservation({
            officeSlug: args.officeSlug,
            lineSlug: args.lineSlug,
            from: args.from,
            to: args.to,
            meet: args.meet || false,
            meta: {
              forms: {
                type: 'default',
                questions: [
                  { question: 'Nombre', answer: args.personName },
                  { question: 'Teléfono', answer: args.personPhone },
                  { question: 'Email', answer: args.personEmail },
                  ...(args.personRut
                    ? [{ question: 'RUT', answer: args.personRut }]
                    : []),
                ],
              },
              utm: null,
              formsError: null,
            },
          });

        case 'getReservation':
          this.validateRequired(args, ['reservationId']);
          return await this.zeroqService.getReservation(args.reservationId);

        default:
          throw new BadRequestException(`Unknown tool: ${toolName}`);
      }
    } catch (error) {
      this.logger.error(`Error executing tool ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Valida que los campos requeridos estén presentes
   */
  private validateRequired(args: any, required: string[]): void {
    const missing = required.filter((field) => !args[field]);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Missing required fields: ${missing.join(', ')}`,
      );
    }
  }
}

