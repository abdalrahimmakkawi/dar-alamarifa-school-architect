import { GoogleGenerativeAI } from '@google/generative-ai';

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  icon: any; // Using any for Lucide icons compatibility
  color: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  capabilities: string[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    tokensUsed?: number;
    duration?: number;
    attachments?: string[];
  };
}

export interface Conversation {
  id: string;
  agentId: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

export interface AgentResponse {
  success: boolean;
  content: string;
  conversationId?: string;
  metadata?: {
    tokensUsed?: number;
    duration?: number;
    agentName?: string;
  };
  error?: string;
}

export abstract class BaseAgent {
  protected config: AgentConfig;
  private apiKey: string;
  protected history: Message[] = [];

  constructor(config: AgentConfig) {
    this.config = config;
    // Safely get API key from environment
    this.apiKey = process.env.GEMINI_API_KEY || '';
  }

  protected async generateResponse(prompt: string, context?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in the environment.');
    }

    const genAI = new GoogleGenerativeAI(this.apiKey);
    const model = genAI.getGenerativeModel({ 
      model: this.config.model,
      systemInstruction: this.config.systemPrompt + (context ? `\n\nContext:\n${context}` : '')
    });

    const startTime = Date.now();
    
    // In @google/generative-ai, systemInstruction is part of getGenerativeModel
    // contents should be the history + current prompt
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: this.config.temperature,
        maxOutputTokens: this.config.maxOutputTokens,
      },
    });

    const response = await result.response;
    const text = response.text();
    const duration = Date.now() - startTime;

    // Track in history
    this.history.push({ 
      id: crypto.randomUUID(),
      role: 'user', 
      content: prompt,
      timestamp: Date.now()
    });
    this.history.push({ 
      id: crypto.randomUUID(),
      role: 'assistant', 
      content: text,
      timestamp: Date.now(),
      metadata: { duration, tokensUsed: text.length }
    });

    return text;
  }

  protected getHistory(): Message[] {
    return this.history;
  }

  public clearHistory(): void {
    this.history = [];
  }

  public getConfig(): AgentConfig {
    return this.config;
  }

  public abstract execute(input: any, conversationId?: string): Promise<AgentResponse>;
}
