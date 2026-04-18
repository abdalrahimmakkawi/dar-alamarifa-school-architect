import { KnowledgeItem } from '../types';
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const model = "gemini-3-flash-preview";
export const nvidiaLogicModel = "meta/llama-3.1-405b-instruct";
export const nvidiaCreativeModel = "meta/llama-3.1-70b-instruct";
export const nvidiaRouterModel = "meta/llama-3.1-8b-instruct";

const GEMMA_4_PROTOCOLS = `
OPERATIONAL PROTOCOLS (GEMMA 4):
1. DEEP THINKING: Analyze the local Sudanese context (internet stability, displacement, currency fluctuations) before providing solutions.
2. NATIVE ARABIC/ENGLISH: Use fluent English and Sudanese Arabic.
3. REVENUE & GROWTH: Focus on enrollment strategies and identifying revenue leaks.
4. MANAGEMENT & STRATEGY: Act as a Chief of Staff for Sudanese Dar Alamarifa Elementary School.
`;

export async function generateSchoolReport(notes: string) {
  return processAgentTask(`Convert these unstructured school notes into a professional, structured report for the School Director. Notes: ${notes}`, 'gemini');
}

export async function draftParentEmail(intent: string, language: 'en' | 'ar') {
  return processAgentTask(`Draft a professional, empathetic email regarding: ${intent}`, 'gemini');
}

export async function suggestEnrollmentStrategies() {
  const response = await processAgentTask("Suggest 5 innovative enrollment and revenue optimization strategies for Dar Alamarifa school. Return ONLY a JSON array of objects with title, description, and impact (High, Medium, Low).", 'gemini');
  try {
    return JSON.parse(response);
  } catch (e) {
    console.error("Failed to parse enrollment strategies:", e);
    return [];
  }
}

export async function processAgentTask(task: string, provider: 'gemini' | 'nvidia' | 'auto' = 'auto') {
  const systemInstruction = `You are the Lead School Operations Architect for Sudanese Dar Alamarifa Elementary School. ${GEMMA_4_PROTOCOLS} 
  Your goal is to transform user intent into successful school outcomes. 
  
  STRICT LANGUAGE RULES:
  - Respond ONLY in English or Sudanese Arabic as requested.
  - NEVER use Chinese characters or any other language.
  - If the user speaks in Arabic, respond in high-quality Sudanese Arabic.
  
  If the user asks for a specific task (e.g., "Draft a report", "Suggest a strategy"), respond as an executive action engine.
  Provide structured, professional, and actionable results.`;

  // Default to Gemini as it's more reliable in this environment
  let selectedProvider: 'gemini' | 'nvidia' = provider === 'auto' ? 'gemini' : provider;

  if (selectedProvider === 'nvidia') {
    try {
      const response = await fetch("/api/nvidia/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: nvidiaLogicModel,
          messages: [
            { role: "system", content: systemInstruction },
            { role: "user", content: task }
          ],
          temperature: 0.7,
          max_tokens: 1024
        })
      });

      if (response.ok) {
        const data = await response.json();
        return data.choices[0].message.content;
      }
      throw new Error("NVIDIA API failed");
    } catch (error) {
      console.warn("NVIDIA Error, falling back to Gemini:", error);
      selectedProvider = 'gemini';
    }
  }

  // Gemini Implementation directly from frontend
  try {
    const response = await ai.models.generateContent({
      model,
      contents: task,
      config: {
        systemInstruction,
        temperature: 0.7
      }
    });

    return response.text || "I'm sorry, I couldn't generate a response.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    throw new Error("The AI service is currently unavailable. Please try again in a few minutes.");
  }
}
