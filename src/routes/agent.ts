import express from 'express';
import { orchestrator, getSpecializedAgentConfigs } from '../agents';
import { knowledgeService } from '../lib/knowledge';
import { memoryService } from '../lib/memory';

const router = express.Router();

// List all available specialized agents
router.get('/list', (req, res) => {
  const configs = getSpecializedAgentConfigs();
  res.json({ success: true, agents: configs });
});

// Execute single agent
router.post('/execute', async (req, res) => {
  const { agentId, input, conversationId } = req.body;

  if (!agentId || !input) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: agentId, input'
    });
  }

  // Enhance input with context if it's a simple query
  const query = typeof input === 'string' ? input : input.query;
  
  let extraContext = '';
  try {
    const [knowledge, memories] = await Promise.all([
      knowledgeService.search(query || ''),
      memoryService.getRelevantMemories(query || '')
    ]);
    
    if (knowledge.length > 0) {
      extraContext += `\n\nSCHOOL KNOWLEDGE:\n${knowledge.map(k => `${k.title}: ${k.content}`).join('\n')}`;
    }
    if (memories.length > 0) {
      extraContext += `\n\nPAST MEMORIES:\n${memories.map(m => m.fact).join('\n')}`;
    }
  } catch (error) {
    console.error('Context attachment failed:', error);
  }

  const result = await orchestrator.execute({ 
    agentId, 
    input: typeof input === 'string' ? { query: input } : input, 
    conversationId,
    context: extraContext
  });
  res.json(result);
});

// Multi-agent execution
router.post('/multi', async (req, res) => {
  const { goal, agents, sequence = 'parallel' } = req.body;

  if (!goal || !agents || !Array.isArray(agents)) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: goal, agents (array)'
    });
  }

  const results = await orchestrator.executeMulti({ goal, agents, sequence: sequence as 'parallel' | 'sequential' });
  res.json({ success: true, results });
});

// Get conversation history
router.get('/conversation/:id', (req, res) => {
  const messages = orchestrator.getConversation(req.params.id);
  res.json({ success: true, messages });
});

// Clear conversation
router.delete('/conversation/:id', (req, res) => {
  orchestrator.clearConversation(req.params.id);
  res.json({ success: true });
});

// List all conversations
router.get('/conversations', (req, res) => {
  const ids = orchestrator.listConversations();
  res.json({ success: true, conversations: ids });
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    agents: Object.keys(getSpecializedAgentConfigs()),
    timestamp: new Date().toISOString()
  });
});

export default router;
