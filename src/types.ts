export interface Student {
  id: string;
  name: string;
  grade: string;
  status: 'active' | 'inactive' | 'displaced';
  feesPaid: number;
  totalFees: number;
  created_at?: string;
}

export interface SchoolEvent {
  id: string;
  title: string;
  date: string;
  type: 'academic' | 'admin' | 'training';
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: 'admissions' | 'curriculum' | 'safety';
}

export type AgentId = 'director' | 'analytics' | 'comms' | 'faq' | 'strategy' | 'tutor' | 'enrollment' | 'legal' | 'research' | 'writer' | 'coder' | 'planner' | 'analyst';

export interface Agent {
  id: AgentId;
  name: string;
  model: string;
  envKey: string;
  purpose: string;
  systemPrompt: string;
  icon: any;
  role: string;
}

export interface AgentMessage {
  id: string;
  session_id?: string;
  agent_id: AgentId;
  role: 'user' | 'assistant';
  content: string;
  language: 'en' | 'ar';
  user_id?: string;
  user_role: 'admin' | 'staff';
  is_auto: boolean;
  created_at: string;
}

export interface Report {
  id: string;
  type: 'weekly' | 'monthly' | 'custom';
  title: string;
  content: string;
  generated_by: AgentId;
  is_auto: boolean;
  created_at: string;
}

export interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  body: string;
  resolved: boolean;
  created_at: string;
}

export interface User {
  email: string;
  role: 'admin' | 'staff';
}

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  category: 'policy' | 'curriculum' | 'schedule' | 'legal' | 'general';
  tags: string[];
  created_at?: string;
  updated_at?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  agent_id: AgentId | 'auto';
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface MemoryItem {
  id: string;
  fact: string;
  source_session_id: string;
  category: string;
  confidence: number;
  created_at: string;
}
