import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AgentService } from './agent.service';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { ChatRequestDto, ChatResponseDto } from './dto/chat.dto';

/**
 * Controlador del Agente Conversacional
 * 
 * Endpoint inteligente que entiende lenguaje natural y ejecuta tools automáticamente
 */
@Controller('agent')
@UseGuards(ApiKeyGuard)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  /**
   * Endpoint conversacional principal
   * El usuario envía un mensaje en lenguaje natural y el agente:
   * 1. Entiende la intención
   * 2. Ejecuta las tools necesarias
   * 3. Responde de manera conversacional
   */
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() body: ChatRequestDto): Promise<ChatResponseDto> {
    return await this.agentService.chat(
      body.message,
      body.conversationHistory,
    );
  }

  /**
   * Health check del agente
   */
  @Post('ping')
  @HttpCode(HttpStatus.OK)
  ping() {
    return {
      status: 'ok',
      agent: 'active',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      timestamp: new Date().toISOString(),
    };
  }
}

