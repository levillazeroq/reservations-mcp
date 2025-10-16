import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { ConfigService } from '../config/config.service';
import { ZeroQService } from '../tools/zeroq/zeroq.service';
import { MCP_TOOLS } from '../mcp/mcp-tools.schemas';

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);
  private openai: OpenAI;

  constructor(
    private readonly configService: ConfigService,
    private readonly zeroqService: ZeroQService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.configService.openaiApiKey,
    });
  }

  /**
   * Conversación inteligente con el agente
   */
  async chat(userMessage: string, conversationHistory: Message[] = []) {
    this.logger.log(`User message: ${userMessage}`);

    const messages: Message[] = [
      {
        role: 'system',
        content: this.getSystemPrompt(),
      },
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage,
      },
    ];

    try {
      // Convertir tools a formato OpenAI
      const tools = this.convertToolsToOpenAIFormat();

      // Llamar a OpenAI con tool calling
      let response = await this.openai.chat.completions.create({
        model: this.configService.openaiModel,
        messages: messages as any,
        tools: tools,
        tool_choice: 'auto',
        temperature: this.configService.openaiTemperature,
        max_tokens: this.configService.openaiMaxTokens,
      });

      let assistantMessage = response.choices[0].message;
      messages.push(assistantMessage as any);

      // Loop para ejecutar tool calls
      let iterations = 0;
      const maxIterations = 10; // Prevenir loops infinitos

      while (
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0 &&
        iterations < maxIterations
      ) {
        iterations++;
        this.logger.log(
          `Iteration ${iterations}: Processing ${assistantMessage.tool_calls.length} tool calls`,
        );

        // Ejecutar todas las tool calls
        for (const toolCall of assistantMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          this.logger.log(
            `Executing tool: ${functionName} with args:`,
            functionArgs,
          );

          try {
            const toolResult = await this.executeTool(
              functionName,
              functionArgs,
            );

            // Agregar resultado como mensaje de tool
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: functionName,
              content: JSON.stringify(toolResult),
            } as any);
          } catch (error) {
            this.logger.error(
              `Error executing tool ${functionName}:`,
              error,
            );
            messages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: functionName,
              content: JSON.stringify({
                error: error.message || 'Error executing tool',
              }),
            } as any);
          }
        }

        // Llamar nuevamente a OpenAI con los resultados de las tools
        response = await this.openai.chat.completions.create({
          model: this.configService.openaiModel,
          messages: messages as any,
          tools: tools,
          tool_choice: 'auto',
          temperature: this.configService.openaiTemperature,
          max_tokens: this.configService.openaiMaxTokens,
        });

        assistantMessage = response.choices[0].message;
        messages.push(assistantMessage as any);
      }

      // Retornar la respuesta final del asistente
      return {
        success: true,
        message: assistantMessage.content || 'No response generated',
        conversationHistory: messages.slice(1), // Sin el system prompt
        toolCallsMade: iterations,
      };
    } catch (error) {
      this.logger.error('Error in agent chat:', error);
      throw error;
    }
  }

  /**
   * Prompt del sistema para el agente
   */
  private getSystemPrompt(): string {
    return `Eres un asistente inteligente para el sistema de reservas ZeroQ.

Tu objetivo es ayudar a los usuarios a:
- Buscar oficinas disponibles
- Consultar líneas de atención en oficinas
- Verificar disponibilidad de bloques horarios
- Crear reservas
- Consultar el estado de reservas existentes

IMPORTANTE:
- Siempre confirma la información clave antes de crear una reserva (oficina, fecha, hora, datos de contacto)
- Si falta información necesaria, pregunta al usuario de manera clara y amigable
- Al mostrar horarios, conviértalos a un formato legible (no solo ISO 8601)
- Sé conciso pero completo en tus respuestas
- Si no hay disponibilidad en el horario solicitado, sugiere alternativas cercanas
- Usa los datos reales de las tools, no inventes información

⚠️ CRÍTICO - MANEJO DE SLUGS:
- Los "officeSlug" y "lineSlug" son diferentes y NO debes confundirlos
- officeSlug ejemplo: "demo-web-oscar" (identifica la oficina)
- lineSlug ejemplo: "demo-web-oscar-fila-01" (identifica una línea específica dentro de la oficina)
- NUNCA uses el officeSlug donde se requiere un lineSlug
- SIEMPRE llama primero a "getOfficeLines" para obtener los lineSlugs correctos
- El lineSlug COMPLETO viene en la propiedad "slug" de cada línea devuelta por getOfficeLines

Flujo típico para crear una reserva:
1. Obtener lista de oficinas (si no se especifica el slug)
2. Obtener líneas de la oficina seleccionada
3. Consultar bloques disponibles para la línea en el rango de fechas
4. Confirmar con el usuario el bloque seleccionado y los datos de contacto
5. Crear la reserva

Formatos de fecha:
- Las fechas en las APIs son en formato ISO 8601 (ej: "2025-10-15T11:00:00.000Z")
- Al mostrar al usuario, usa formato legible (ej: "15 de octubre a las 11:00 AM")
- La zona horaria por defecto es America/Santiago

Datos requeridos para una reserva:
- officeSlug
- lineSlug
- from (fecha/hora inicio del bloque)
- to (fecha/hora fin del bloque)
- personName
- personPhone (con código de país, ej: +56912345678)
- personEmail

Responde en español de manera profesional y amigable.`;
  }

  /**
   * Convierte las tools MCP a formato OpenAI
   */
  private convertToolsToOpenAIFormat() {
    return MCP_TOOLS.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  /**
   * Ejecuta una tool específica
   */
  private async executeTool(toolName: string, args: any): Promise<any> {
    this.logger.log(`Executing tool: ${toolName}`);

    switch (toolName) {
      case 'listWebOffices':
        return await this.zeroqService.listWebOffices();

      case 'getOfficeDetails':
        return await this.zeroqService.getOfficeDetails(args.officeSlug);

      case 'getOfficeLines':
        return await this.zeroqService.getOfficeLines(args.officeSlug);

      case 'getAvailableBlocks':
        return await this.zeroqService.getAvailableBlocks(
          args.lineSlug,
          args.date,
          args.tz || 'America/Santiago',
        );

        case 'createReservation':
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
          return await this.zeroqService.getReservation(args.reservationId);

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
}

