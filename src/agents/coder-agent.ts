import { BaseAgent, AgentResponse } from './base';
import { Code } from 'lucide-react';

export class CoderAgent extends BaseAgent {
  constructor() {
    super({
      id: 'coder-specialist',
      name: 'Coding Assistant',
      description: 'Write, debug, and explain code for school systems',
      icon: Code,
      color: '#8B5CF6',
      systemPrompt: `You are a technical coding assistant for Dar Alamarifa School's IT department.

RULES:
- Write clean, well-commented, production-ready code.
- Explain your technical approach clearly for other developers.
- Suggest best practices and performance optimizations.
- Support multiple programming languages (React/TS, Python, SQL, etc.).
- Include tests or validation steps where appropriate.

OUTPUT FORMAT:
1. 📝 Explanation of approach
2. 💻 Code (in properly formatted code blocks)
3. 🧪 Usage examples
4. ⚡ Optimization notes`,
      model: 'gemini-1.5-pro',
      temperature: 0.4,
      maxOutputTokens: 8192,
      capabilities: ['write', 'debug', 'explain', 'refactor', 'review'],
    });
  }

  async execute(input: {
    task: string;
    language?: string;
    context?: string;
    existingCode?: string;
    requirements?: string[];
    query?: string;
  }): Promise<AgentResponse> {
    try {
      const prompt = input.query || `
Coding Request:
- Task: ${input.task}
- Language: ${input.language || 'TypeScript'}
${input.context ? `- Context: ${input.context}` : ''}
${input.existingCode ? `- Existing Code:\n\`\`\`\n${input.existingCode}\n\`\`\`` : ''}
${input.requirements ? `- Requirements:\n${input.requirements.map(r => `  - ${r}`).join('\n')}` : ''}

Provide complete, working code with explanations.
`;

      const content = await this.generateResponse(prompt);

      return {
        success: true,
        content,
        metadata: { agentName: 'coder-specialist' }
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
