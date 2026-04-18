import { supabase } from './supabase';
import { MemoryItem } from '../types';
import { callAgent } from '../agents/engine';

export const memoryService = {
  async getRelevantMemories(query: string): Promise<MemoryItem[]> {
    // In a real app, we'd use vector search. For now, we'll do a simple text search.
    const { data, error } = await supabase
      .from('school_memory')
      .select('*')
      .ilike('fact', `%${query}%`)
      .limit(10);

    if (error) {
      console.error('Error fetching memories:', error);
      return [];
    }

    return data || [];
  },

  async learnFromConversation(sessionId: string, messages: { role: string, content: string }[]): Promise<void> {
    const conversationText = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    
    const extractionPrompt = `
      You are the "Brain" of Dar Alamarifa School. 
      Analyze the following conversation and extract any NEW factual information about the school (schedules, student updates, policies, events).
      
      Conversation:
      ${conversationText}
      
      Rules:
      1. Only extract facts that are clearly stated.
      2. Format each fact as a single concise sentence.
      3. If no new facts are found, respond with "NONE".
      4. Categorize each fact (e.g., "schedule", "student", "policy").
      
      Output format:
      FACT: [The fact] | CATEGORY: [The category]
    `;

    try {
      // Use the director agent to extract facts (or a specialized 'brain' agent if we had one)
      const extraction = await callAgent('director', extractionPrompt);
      
      if (extraction.includes('NONE')) return;

      const lines = extraction.split('\n').filter(l => l.includes('FACT:'));
      
      for (const line of lines) {
        const factMatch = line.match(/FACT: (.*?) \|/);
        const catMatch = line.match(/CATEGORY: (.*)/);
        
        if (factMatch && factMatch[1]) {
          await supabase.from('school_memory').insert([{
            fact: factMatch[1].trim(),
            category: catMatch ? catMatch[1].trim() : 'general',
            source_session_id: sessionId,
            confidence: 0.9
          }]);
        }
      }
    } catch (error) {
      console.error('Learning process failed:', error);
    }
  }
};
