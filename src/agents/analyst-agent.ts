import { BaseAgent, AgentResponse } from './base';
import { BarChart3 } from 'lucide-react';

export class AnalystAgent extends BaseAgent {
  constructor() {
    super({
      id: 'analyst-specialist',
      name: 'Data Insight Specialist',
      description: 'Analyze school data, find patterns, and generate insights',
      icon: BarChart3,
      color: '#EC4899',
      systemPrompt: `You are a data analysis specialist for Dar Alamarifa School administration.

RULES:
- Identify patterns and trends in school data (enrollment, fee collection, student performance).
- Provide clear, actionable insights for decision-makers.
- Suggest visualizations to represent the findings.
- Explain complex data concepts simply.
- Flag anomalies or outliers that require immediate attention.

SUPPORTED ANALYSIS:
- Enrollment Trend Analysis
- Financial/Fee Collection Health
- Academic Performance Evaluation
- Comparison against historical benchmarks
- Root cause analysis for specific school issues`,
      model: 'gemini-1.5-pro',
      temperature: 0.5,
      maxOutputTokens: 4096,
      capabilities: ['analyze', 'compare', 'identify-patterns', 'recommend'],
    });
  }

  async execute(input: {
    dataDescription: string;
    analysisType: 'summary' | 'comparison' | 'trend' | 'root-cause' | 'recommendation';
    data?: string;
    questions?: string[];
    query?: string;
  }): Promise<AgentResponse> {
    try {
      const prompt = input.query || `
Analysis Request:
- Type: ${input.analysisType}
- Data Description: ${input.dataDescription}
${input.data ? `- Data:\n${input.data}` : ''}
${input.questions ? `- Questions to Answer:\n${input.questions.map(q => `  - ${q}`).join('\n')}` : ''}

Provide clear analysis with actionable insights.
`;

      const content = await this.generateResponse(prompt);

      return {
        success: true,
        content,
        metadata: { agentName: 'analyst-specialist' }
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
