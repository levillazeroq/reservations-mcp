export class ChatRequestDto {
  message: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export class ChatResponseDto {
  success: boolean;
  message: string;
  conversationHistory?: any[];
  toolCallsMade?: number;
}

