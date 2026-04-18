import { BaseAgent, AgentResponse } from './base';
import { ClipboardList } from 'lucide-react';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in-progress' | 'completed' | 'blocked';
  dueDate?: string;
  tags: string[];
  subtasks?: Task[];
}

export class PlannerAgent extends BaseAgent {
  constructor() {
    super({
      id: 'planner-specialist',
      name: 'Strategy Planner',
      description: 'Break down school goals into actionable plans',
      icon: ClipboardList,
      color: '#F59E0B',
      systemPrompt: `You are a strategic planning assistant for Dar Alamarifa School management.

RULES:
- Break large school goals into specific, actionable steps.
- Prioritize tasks based on school priorities and urgency.
- Suggest realistic timelines considering the Sudanese school calendar.
- Identify potential obstacles or resource requirements.
- Provide motivation and structural accountability.

OUTPUT FORMAT (Markdown with clear structure):
1. Goal Definition
2. Phase-by-Phase Breakdown
3. Priority Task List
4. Resource Requirements
5. Risk Assessment`,
      model: 'gemini-1.5-pro',
      temperature: 0.6,
      maxOutputTokens: 4096,
      capabilities: ['plan', 'prioritize', 'schedule', 'breakdown', 'track'],
    });
  }

  async execute(input: {
    goal: string;
    timeframe?: string;
    constraints?: string[];
    existingTasks?: Task[];
    query?: string;
  }): Promise<AgentResponse> {
    try {
      const prompt = input.query || `
Planning Request:
- Goal: ${input.goal}
- Timeframe: ${input.timeframe || 'Not specified'}
${input.constraints ? `- Constraints:\n${input.constraints.map(c => `  - ${c}`).join('\n')}` : ''}

Create an actionable plan with prioritized tasks.
`;

      const content = await this.generateResponse(prompt);

      return {
        success: true,
        content,
        metadata: { agentName: 'planner-specialist' }
      };
    } catch (error) {
      return {
        success: false,
        content: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
