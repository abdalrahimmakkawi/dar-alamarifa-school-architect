import { specializedAgents } from './index';
import { BaseAgent, AgentResponse, Message } from './base';

export interface OrchestratorRequest {
  agentId: string;
  input: any;
  conversationId?: string;
  context?: string;
}

export interface MultiAgentRequest {
  goal: string;
  agents: string[];
  sequence: 'parallel' | 'sequential';
}

export class AgentOrchestrator {
  private conversations: Map<string, Message[]> = new Map();

  async execute(request: OrchestratorRequest): Promise<AgentResponse> {
    const agent = specializedAgents[request.agentId];
    
    if (!agent) {
      return {
        success: false,
        content: '',
        error: `Agent "${request.agentId}" not found`
      };
    }

    // Get conversation history if exists
    const history = this.conversations.get(request.conversationId || '') || [];
    const context = history.length > 0 
      ? `Previous conversation:\n${history.map(m => `${m.role}: ${m.content}`).join('\n')}`
      : undefined;

    try {
      // If input is just a string, wrap it in a query object for simplicity
      const input = typeof request.input === 'string' ? { query: request.input } : request.input;
      const result = await agent.execute(input, request.conversationId);
      
      // Store conversation
      if (request.conversationId && result.success) {
        const messages = this.conversations.get(request.conversationId) || [];
        messages.push(
          { id: crypto.randomUUID(), role: 'user', content: typeof request.input === 'string' ? request.input : JSON.stringify(request.input), timestamp: Date.now() },
          { id: crypto.randomUUID(), role: 'assistant', content: result.content, timestamp: Date.now() }
        );
        this.conversations.set(request.conversationId, messages);
      }

      return result;
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async executeMulti(request: MultiAgentRequest): Promise<Record<string, AgentResponse>> {
    const results: Record<string, AgentResponse> = {};

    if (request.sequence === 'parallel') {
      const promises = request.agents.map(async (agentId) => {
        const result = await this.execute({
          agentId,
          input: { query: request.goal }
        });
        return { agentId, result };
      });

      const resolved = await Promise.all(promises);
      resolved.forEach(({ agentId, result }) => {
        results[agentId] = result;
      });
    } else {
      // Sequential with context passing
      let currentGoal = request.goal;
      
      for (const agentId of request.agents) {
        const result = await this.execute({
          agentId,
          input: { query: currentGoal }
        });
        
        results[agentId] = result;
        
        if (result.success) {
          currentGoal = `${currentGoal}\n\nPrevious agent (${agentId}) output:\n${result.content}`;
        }
      }
    }

    return results;
  }

  getConversation(conversationId: string): Message[] {
    return this.conversations.get(conversationId) || [];
  }

  clearConversation(conversationId: string): void {
    this.conversations.delete(conversationId);
  }

  listConversations(): string[] {
    return Array.from(this.conversations.keys());
  }
}

export const orchestrator = new AgentOrchestrator();
