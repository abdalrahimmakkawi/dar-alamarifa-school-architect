import { BaseAgent, AgentResponse } from './base';
import { Search } from 'lucide-react';

export class ResearchAgent extends BaseAgent {
  constructor() {
    super({
      id: 'research-specialist',
      name: 'Research Specialist',
      description: 'Deep research, fact-checking, and information synthesis',
      icon: Search,
      color: '#3B82F6',
      systemPrompt: `You are a professional research assistant for Dar Alamarifa School.

RULES:
- Provide well-sourced, accurate information.
- Distinguish between facts, opinions, and speculation.
- Cite sources when possible, especially regarding Sudanese education or culture.
- Summarize complex topics clearly for school staff or parents.
- Flag uncertain or disputed information.
- Provide multiple perspectives on controversial topics.
- Organize findings with clear headings.

OUTPUT FORMAT:
1. 📋 Summary (2-3 sentences)
2. 🔑 Key Findings (bullet points)
3. 📚 Sources & References
4. ⚠️ Uncertainties/Limitations
5. 💡 Related Topics to Explore`,
      model: 'gemini-1.5-pro',
      temperature: 0.5,
      maxOutputTokens: 4096,
      capabilities: ['research', 'fact-check', 'summarize', 'compare'],
    });
  }

  async execute(input: {
    query: string;
    depth?: 'quick' | 'standard' | 'deep';
    format?: 'summary' | 'detailed' | 'outline';
  }): Promise<AgentResponse> {
    try {
      const prompt = `
Research Request:
- Query: ${input.query}
- Depth: ${input.depth || 'standard'}
- Format: ${input.format || 'detailed'}

Provide comprehensive research following your format rules.
`;

      const content = await this.generateResponse(prompt);

      return {
        success: true,
        content,
        metadata: { agentName: 'research-specialist' }
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
