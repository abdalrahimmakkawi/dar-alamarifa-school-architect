import { ResearchAgent } from './research-agent';
import { WriterAgent } from './writer-agent';
import { CoderAgent } from './coder-agent';
import { PlannerAgent } from './planner-agent';
import { AnalystAgent } from './analyst-agent';
import { BaseAgent, AgentConfig } from './base';

// Registry of all available specialized agents
export const specializedAgents: Record<string, BaseAgent> = {
  research: new ResearchAgent(),
  writer: new WriterAgent(),
  coder: new CoderAgent(),
  planner: new PlannerAgent(),
  analyst: new AnalystAgent(),
};

// Get all agent configs for UI
export function getSpecializedAgentConfigs(): AgentConfig[] {
  return Object.values(specializedAgents).map(agent => agent.getConfig());
}

// Get specific agent
export function getSpecializedAgent(id: string): BaseAgent | undefined {
  return specializedAgents[id];
}

// Export types and base class
export * from './base';
export * from './orchestrator';
