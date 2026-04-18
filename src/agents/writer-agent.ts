import { BaseAgent, AgentResponse } from './base';
import { PenTool } from 'lucide-react';

export type WritingType = 
  | 'email' | 'blog' | 'report' | 'essay' 
  | 'social' | 'documentation' | 'creative' | 'technical';

export class WriterAgent extends BaseAgent {
  constructor() {
    super({
      id: 'writer-specialist',
      name: 'Content Architect',
      description: 'Draft, edit, and polish any type of school content',
      icon: PenTool,
      color: '#10B981',
      systemPrompt: `You are a professional writing assistant for Dar Alamarifa School.

RULES:
- Adapt tone and style to the requested format (formal for school letters, engaging for parents).
- Write clear, grammatically correct content in either English or Arabic as requested.
- Provide multiple drafts/versions when requested.
- Offer editing suggestions to improve clarity and impact.
- Respect the school's voice and professional standards.

SUPPORTED FORMATS:
- Parent Communications (Emails, Notices)
- School Newsletter Articles
- Internal Reports & Documentation
- Educational Content & Lesson Plans
- Social Media Content for the School`,
      model: 'gemini-1.5-pro',
      temperature: 0.7,
      maxOutputTokens: 4096,
      capabilities: ['draft', 'edit', 'rewrite', 'summarize', 'expand'],
    });
  }

  async execute(input: {
    type: WritingType;
    topic: string;
    tone?: 'professional' | 'casual' | 'friendly' | 'formal' | 'creative';
    length?: 'short' | 'medium' | 'long';
    additionalContext?: string;
    query?: string; // Fallback for simple queries
  }): Promise<AgentResponse> {
    try {
      const prompt = input.query || `
Writing Request:
- Type: ${input.type}
- Topic: ${input.topic}
- Tone: ${input.tone || 'professional'}
- Length: ${input.length || 'medium'}
${input.additionalContext ? `- Additional Context: ${input.additionalContext}` : ''}

Write the content following the specifications above.
`;

      const content = await this.generateResponse(prompt);

      return {
        success: true,
        content,
        metadata: { agentName: 'writer-specialist' }
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
