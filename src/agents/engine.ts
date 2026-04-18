import { AgentId, AgentMessage } from '../types';
import { AGENT_REGISTRY } from './registry';
import { knowledgeService } from '../lib/knowledge';
import { memoryService } from '../lib/memory';
import { accountingService } from '../lib/accounting';
import { Attachment, buildAttachmentContext } from '../lib/attachments';

const REQUEST_TIMEOUT_MS = 120000;
const MAX_RETRIES = 3; // Increased retries
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

const requestHistory: { timestamp: number }[] = [];

function checkRateLimit() {
  const now = Date.now();
  // Cleanup old requests
  while (requestHistory.length > 0 && requestHistory[0].timestamp < now - RATE_LIMIT_WINDOW_MS) {
    requestHistory.shift();
  }
  
  if (requestHistory.length >= MAX_REQUESTS_PER_WINDOW) {
    throw new Error('Too many requests — please wait');
  }
  
  requestHistory.push({ timestamp: now });
}

async function fetchWithTimeout(url: string, options: any, timeout: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function callAgent(
  agentId: AgentId, 
  content: string, 
  history: AgentMessage[] = [], 
  language: 'en' | 'ar' = 'en',
  attachments?: Attachment[]
): Promise<string> {
  checkRateLimit();

  const agent = AGENT_REGISTRY.find(a => a.id === agentId);
  if (!agent) throw new Error(`Agent ${agentId} not found`);

  // Support for specialized agents using the new architecture
  if (['research', 'writer', 'coder', 'planner', 'analyst'].includes(agentId)) {
    console.log(`[Engine] Calling specialized agent API: ${agentId}`);
    
    try {
      const response = await fetch('/api/agents/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          input: { query: content },
          conversationId: history[0]?.session_id // Use session ID as conversation ID
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) return data.content;
        throw new Error(data.error || `Specialized agent ${agentId} failed`);
      }
      throw new Error(`API error: ${response.statusText}`);
    } catch (e: any) {
      console.error(`Specialized agent ${agentId} API call failed:`, e);
      throw e;
    }
  }

  // Key validation check
  if (agent.envKey && agent.envKey.includes('nvapi-xxxx')) {
    console.error(`[SECURITY ALERT] Agent ${agentId} is using a placeholder API key!`);
  }

  // Fetch relevant knowledge and memories
  let context = '';
  try {
    const [knowledge, memories, financialSnapshot] = await Promise.all([
      knowledgeService.search(content),
      memoryService.getRelevantMemories(content),
      agentId === 'analytics' ? accountingService.getFinancialSnapshot() : Promise.resolve(null)
    ]);

    if (knowledge.length > 0) {
      context += `\n\nOFFICIAL KNOWLEDGE:\n${knowledge.map(k => `--- ${k.title} ---\n${k.content}`).join('\n\n')}`;
    }

    if (memories.length > 0) {
      context += `\n\nLEARNED MEMORIES (from previous chats):\n${memories.map(m => `- ${m.fact}`).join('\n')}`;
    }

    if (financialSnapshot) {
      context += `\n\n${financialSnapshot}`;
    }
  } catch (error) {
    console.error('Context retrieval failed:', error);
  }

  // Build attachment context for non-image files
  const attachmentContext = attachments ? buildAttachmentContext(attachments) : '';

  const systemPrompt = `${agent.systemPrompt}
${attachmentContext ? `\n${attachmentContext}` : ''}

When analyzing attached files:
- Images: describe what you see relevant to the school context
- Documents: extract key information, summarize findings
- Spreadsheets/CSVs: identify patterns, flag anomalies
- Folders: understand the project/file structure
Always relate your analysis to the school's needs and context.
If the attachment contains student data, handle it with appropriate discretion.

USER PREFERRED LANGUAGE: ${language === 'ar' ? 'Arabic (Sudanese dialect preferred)' : 'English'}

${context}`;

  // Build messages with a sliding window for history (last 10 messages)
  const historyWindow = history.slice(-10);
  const messages: any[] = [
    { 
      role: 'system', 
      content: systemPrompt
    },
    ...historyWindow.map(m => ({ role: m.role, content: m.content }))
  ];

  // Multimodal support for vision models
  const hasImages = attachments?.some(a => a.type === 'image' && a.base64);
  const isVisionModel = agent.model.includes('kimi') || agent.model.includes('pixtral') || agent.model.includes('llama-3.2');

  if (hasImages && isVisionModel) {
    const userContent: any[] = [{ type: 'text', text: content || (language === 'ar' ? 'يرجى تحليل الملفات المرفقة.' : 'Please analyze the attached files.') }];
    
    attachments?.filter(a => a.type === 'image' && a.base64).forEach(a => {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${a.mimeType};base64,${a.base64}` }
      });
    });

    messages.push({ role: 'user', content: userContent });
  } else {
    const fullContent = attachmentContext ? `${attachmentContext}\n\nUser question: ${content || (language === 'ar' ? 'يرجى تحليل الملفات المرفقة.' : 'Please analyze the attached files.')}` : (content || (language === 'ar' ? 'يرجى تحليل الملفات المرفقة.' : 'Please analyze the attached files.'));
    messages.push({ role: 'user', content: fullContent });
  }

  // STRATEGY: 
  // 1. Use NVIDIA NIM (high reasoning) - Primary and only provider as requested.
  
  // Try NVIDIA
  let retries = 0;
  while (retries <= MAX_RETRIES) {
    try {
      const response = await fetchWithTimeout('/api/nvidia/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId,
          model: agent.model,
          messages,
          temperature: 0.7,
          max_tokens: 1024,
          stream: false
        })
      }, REQUEST_TIMEOUT_MS);

      if (response.ok) {
        const data = await response.json();
        if (data.choices && data.choices[0] && data.choices[0].message) {
          return data.choices[0].message.content;
        }
        throw new Error("Invalid response format from NVIDIA API");
      }
      
      const errorData = await response.json();
      console.warn(`NVIDIA Proxy failed for ${agentId} (Attempt ${retries + 1}):`, errorData);
      
      // If it's a 401, don't retry with the same key (though server rotates, we should be aware)
      if (response.status === 401) {
        throw new Error("NVIDIA Authentication failed. Please check your API keys.");
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.error(`NVIDIA Request timed out for ${agentId}`);
      }
      console.warn(`NVIDIA Fetch failed for ${agentId} (Attempt ${retries + 1}):`, error.message);
    }
    
    retries++;
    if (retries <= MAX_RETRIES) {
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
    }
  }

  throw new Error("The NVIDIA AI service is currently unavailable or timed out. Please verify your NVIDIA API keys in the secrets panel.");
}

export async function routeAndExecute(
  content: string, 
  history: AgentMessage[] = [], 
  language: 'en' | 'ar' = 'en',
  attachments?: Attachment[]
): Promise<{ agentId: AgentId, response: string }> {
  // Debug: Log message sending
  console.log("Sending message:", content, "Session:", history[0]?.session_id);

  try {
    // Determine routing based on attachments
    let specialistId: AgentId | null = null;
    const hasImages = attachments?.some(a => a.type === 'image');
    const hasDocs = attachments?.some(a => a.type !== 'image');

    // First, call the director to route
    const directorResponse = await callAgent('director', content, history, language, attachments);
    
    if (!directorResponse) {
      return { agentId: 'director', response: "I'm sorry, I couldn't process that request." };
    }
    
    // Check if director routed to a specialist
    const match = directorResponse.match(/\[(analytics|comms|faq|strategy|tutor|enrollment|legal|research|writer|coder|planner|analyst)\]/);
    
    if (match) {
      specialistId = match[1] as AgentId;
      console.log(`[Director] Routing to ${specialistId}`);
      const specialistResponse = await callAgent(specialistId, content, history, language, attachments);
      
      // Trigger autonomous learning in the background if enabled
      const isLearningActive = localStorage.getItem('da_learning_active') !== 'false';
      const sessionId = history[0]?.session_id;
      if (sessionId && isLearningActive) {
        memoryService.learnFromConversation(sessionId, [
          ...history,
          { role: 'user', content },
          { role: 'assistant', content: specialistResponse }
        ]).catch(err => console.error('Learning failed:', err));
      }

      const result = { agentId: specialistId, response: specialistResponse };
      console.log("Got result from routeAndExecute:", result);
      return result;
    }

    // If no specialist match, director responds directly
    // Trigger autonomous learning in the background if enabled
    const isLearningActive = localStorage.getItem('da_learning_active') !== 'false';
    const sessionId = history[0]?.session_id;
    if (sessionId && isLearningActive) {
      memoryService.learnFromConversation(sessionId, [
        ...history,
        { role: 'user', content },
        { role: 'assistant', content: directorResponse }
      ]).catch(err => console.error('Learning failed:', err));
    }

    const result = { agentId: 'director' as AgentId, response: directorResponse };
    console.log("Got result from routeAndExecute:", result);
    return result;
  } catch (error) {
    console.error('[Director] Routing failed, falling back to FAQ:', error);
    // Fallback to FAQ agent if director fails (likely due to timeout or service issue)
    try {
      const faqResponse = await callAgent('faq', content, history, language, attachments);
      const result = { agentId: 'faq' as AgentId, response: faqResponse };
      console.log("Got result from routeAndExecute (fallback):", result);
      return result;
    } catch (faqError) {
      throw error; // Re-throw original error if fallback also fails
    }
  }
}
