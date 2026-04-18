import React, { useState, useEffect, useRef } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  MessageSquare, 
  LogOut, 
  Bell, 
  Search, 
  Plus, 
  Send, 
  Bot, 
  Sparkles, 
  Mail, 
  HelpCircle, 
  GraduationCap, 
  ChevronRight, 
  BookOpen,
  ShieldCheck,
  FileText,
  Database,
  Settings,
  Gamepad2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, AgentMessage, Student, AgentId, KnowledgeItem, ChatSession } from '../../types';
import { callAgent } from '../../agents/engine';
import { AGENT_REGISTRY } from '../../agents/registry';
import { supabase } from '../../lib/supabase';
import { knowledgeService } from '../../lib/knowledge';
import { memoryService } from '../../lib/memory';
import EduPlayPanel from '../../components/shared/EduPlayPanel';
import AgentConsole from '../../components/shared/AgentConsole';
import { db } from '../../lib/db';
import { translations } from '../../lib/translations';

interface StaffAppProps {
  user: User;
  language: 'en' | 'ar';
  setLanguage: (lang: 'en' | 'ar') => void;
}

export default function StaffApp({ user, language, setLanguage }: StaffAppProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => localStorage.getItem('da_current_session_id'));
  const [selectedAgent, setSelectedAgent] = useState<AgentId>(() => (localStorage.getItem('da_selected_agent') as AgentId) || 'tutor');
  
  const t = translations[language];

  // Staff only has access to specific agents
  const staffAgents = AGENT_REGISTRY.filter(a => ['tutor'].includes(a.id));

  const currentSessionIdRef = useRef(currentSessionId);
  
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    fetchData();
    
    // Listen for session changes (new or updated)
    const sessionChannel = supabase.channel('chat_sessions_staff')
      .on('postgres_changes', {
        event: '*', 
        schema: 'public',
        table: 'chat_sessions',
        filter: `user_id=eq.${user.email}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newSession = payload.new as ChatSession;
          setSessions(prev => {
            if (prev.some(s => s.id === newSession.id)) return prev;
            return [newSession, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          const updatedSession = payload.new as ChatSession;
          setSessions(prev => {
            const filtered = prev.filter(s => s.id !== updatedSession.id);
            return [updatedSession, ...filtered]; // Move to top
          });
        }
      })
      .subscribe();

    // Listen for ALL messages for this user and filter by current session in callback
    const msgChannel = supabase.channel(`staff-messages-${user.email}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'agent_messages',
        filter: `user_id=eq.${user.email}`
      }, (payload) => {
        const newMsg = payload.new as AgentMessage;
        if (newMsg.session_id === currentSessionIdRef.current) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sessionChannel);
      supabase.removeChannel(msgChannel);
    };
  }, []);

  useEffect(() => {
    if (currentSessionId) {
      fetchMessages(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  const fetchMessages = async (sessionId: string) => {
    const { data } = await supabase
      .from('agent_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const fetchData = async () => {
    try {
      const [
        studentsData,
        knowledgeData,
        { data: sessionsData }
      ] = await Promise.all([
        db.students.getAll(),
        knowledgeService.getAll(),
        supabase.from('chat_sessions').select('*').order('updated_at', { ascending: false })
      ]);
      
      if (studentsData) setStudents(studentsData);
      if (knowledgeData) setKnowledge(knowledgeData);
      if (sessionsData) setSessions(sessionsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const startNewSession = async () => {
    const newSession: Partial<ChatSession> = {
      id: crypto.randomUUID(),
      title: `${t.staffPortal} Chat ${new Date().toLocaleTimeString()}`,
      agent_id: selectedAgent,
      user_id: user.email,
    };
    const { data } = await supabase.from('chat_sessions').insert([newSession]).select().single();
    if (data) {
      setSessions(prev => [data, ...prev]);
      setCurrentSessionId(data.id);
      localStorage.setItem('da_current_session_id', data.id);
      setMessages([]);
    }
  };

  const loadSession = async (sessionId: string) => {
    if (currentSessionId === sessionId) return;
    setCurrentSessionId(sessionId);
    localStorage.setItem('da_current_session_id', sessionId);
    // Messages will be fetched by the useEffect
  };

  useEffect(() => {
    if (selectedAgent) {
      localStorage.setItem('da_selected_agent', selectedAgent);
    }
  }, [selectedAgent]);

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-6">
          <div className="bg-blue-500 p-4 rounded-2xl text-white">
            <Users size={32} />
          </div>
          <div>
            <h3 className="text-slate-500 text-sm font-medium">{t.myStudents}</h3>
            <p className="text-3xl font-bold text-slate-900">{students.length}</p>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-6">
          <div className="bg-emerald-500 p-4 rounded-2xl text-white">
            <Calendar size={32} />
          </div>
          <div>
            <h3 className="text-slate-500 text-sm font-medium">{t.upcomingEvents}</h3>
            <p className="text-3xl font-bold text-slate-900">4</p>
          </div>
        </div>
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-6">
          <div className="bg-purple-500 p-4 rounded-2xl text-white">
            <MessageSquare size={32} />
          </div>
          <div>
            <h3 className="text-slate-500 text-sm font-medium">{t.agentSupport}</h3>
            <p className="text-3xl font-bold text-slate-900">{t.active}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h2 className="text-xl font-bold text-slate-900 mb-6">{t.quickActions}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <button onClick={() => { setActiveTab('agents'); setSelectedAgent('tutor'); }} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 transition-all text-left flex flex-col gap-3">
            <BookOpen className="text-emerald-600" size={24} />
            <div>
              <h4 className="font-bold text-slate-900">{t.subjectHelp}</h4>
              <p className="text-xs text-slate-500">{t.subjectHelpDesc}</p>
            </div>
          </button>
          <button onClick={() => { setActiveTab('agents'); setSelectedAgent('tutor'); }} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 transition-all text-left flex flex-col gap-3">
            <FileText className="text-emerald-600" size={24} />
            <div>
              <h4 className="font-bold text-slate-900">{t.examDrafting}</h4>
              <p className="text-xs text-slate-500">{t.examDraftingDesc}</p>
            </div>
          </button>
          <button onClick={() => { setActiveTab('agents'); setSelectedAgent('tutor'); }} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 transition-all text-left flex flex-col gap-3">
            <Calendar className="text-emerald-600" size={24} />
            <div>
              <h4 className="font-bold text-slate-900">{t.scheduleSupport}</h4>
              <p className="text-xs text-slate-500">{t.scheduleSupportDesc}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );

  const renderAgentConsole = () => (
    <div className="h-[calc(100vh-12rem)]">
      <AgentConsole 
        user={user}
        language={language}
        messages={messages}
        selectedAgent={selectedAgent}
        setSelectedAgent={(id) => setSelectedAgent(id as AgentId)}
        currentSessionId={currentSessionId}
        sessions={sessions}
        startNewSession={startNewSession}
        loadSession={loadSession}
        availableAgents={staffAgents}
        t={t}
      />
    </div>
  );

  const renderKnowledgeBase = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">{t.knowledgeBase}</h2>
        <p className="text-slate-500">{t.curriculumResources}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {knowledge.map((item) => (
          <div key={item.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                item.category === 'policy' ? 'bg-blue-50 text-blue-600' :
                item.category === 'curriculum' ? 'bg-emerald-50 text-emerald-600' :
                item.category === 'schedule' ? 'bg-purple-50 text-purple-600' :
                item.category === 'legal' ? 'bg-red-50 text-red-600' :
                'bg-slate-50 text-slate-600'
              }`}>
                {item.category}
              </div>
            </div>
            <h3 className="font-bold text-slate-900 mb-2">{item.title}</h3>
            <p className="text-sm text-slate-600 line-clamp-3 mb-4 flex-1">{item.content}</p>
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag, i) => (
                <span key={i} className="text-[10px] bg-slate-50 text-slate-500 px-2 py-1 rounded-lg">#{tag}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-bold text-slate-900 mb-6">{t.systemSettings}</h2>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
            <div>
              <h3 className="font-bold text-slate-900">{t.language}</h3>
              <p className="text-sm text-slate-500">{t.languageDesc}</p>
            </div>
            <div className="flex bg-white p-1 rounded-xl border border-slate-200">
              <button 
                onClick={() => setLanguage('en')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${language === 'en' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'}`}
              >
                English
              </button>
              <button 
                onClick={() => setLanguage('ar')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${language === 'ar' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500'}`}
              >
                العربية
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen bg-slate-50 flex font-sans ${language === 'ar' ? 'rtl' : 'ltr'}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Sidebar */}
      <div className="w-72 bg-slate-900 text-white p-6 flex flex-col hidden lg:flex">
        <div className="flex items-center gap-3 mb-10">
          <div className="bg-emerald-500 p-2 rounded-xl">
            <BookOpen size={24} />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">Dar Alamarifa</h1>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">{t.staffPortal}</span>
          </div>
        </div>

        <nav className="space-y-2 flex-1">
          {[
            { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
            { id: 'students', label: t.students, icon: Users },
            { id: 'events', label: t.calendar, icon: Calendar },
            { id: 'agents', label: t.agentSupport, icon: MessageSquare },
            { id: 'eduplay', label: t.eduPlayModule, icon: Gamepad2 },
            { id: 'knowledge', label: t.knowledgeBase, icon: Database },
            { id: 'settings', label: t.settings, icon: Settings },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                activeTab === item.id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-800">
          <div className="flex items-center gap-3 p-3 mb-4">
            <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center font-bold">
              {user.email[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{user.email}</p>
              <div className="flex items-center gap-1">
                <p className="text-[10px] text-emerald-400 font-bold uppercase">{user.role === 'staff' ? t.staff : user.role}</p>
                {user.role === 'staff' && (
                  <HelpCircle 
                    size={10} 
                    className="text-slate-500 cursor-help" 
                  />
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <button 
              onClick={() => setLanguage('en')}
              className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${language === 'en' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              EN
            </button>
            <button 
              onClick={() => setLanguage('ar')}
              className={`flex-1 py-1 rounded text-[10px] font-bold transition-all ${language === 'ar' ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              AR
            </button>
          </div>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="w-full flex items-center gap-3 p-3 rounded-xl text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all"
          >
            <LogOut size={20} />
            <span className="font-medium">{t.signOut}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-100 flex items-center justify-between px-8">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-md">
              <Search className={`absolute ${language === 'ar' ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`} size={18} />
              <input 
                type="text" 
                placeholder={t.searchStaffPlaceholder} 
                className={`w-full ${language === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-sm`}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-all relative">
              <Bell size={20} />
              <span className={`absolute top-2 ${language === 'ar' ? 'left-2' : 'right-2'} w-2 h-2 bg-red-500 rounded-full border-2 border-white`}></span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'dashboard' && renderDashboard()}
              {activeTab === 'agents' && renderAgentConsole()}
              {activeTab === 'eduplay' && <EduPlayPanel appLanguage={language} />}
              {activeTab === 'knowledge' && renderKnowledgeBase()}
              {activeTab === 'settings' && renderSettings()}
              {activeTab === 'students' && (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-8 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-900">{t.studentDirectory}</h2>
                  </div>
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-8 py-4">{t.name}</th>
                        <th className="px-8 py-4">{t.grade}</th>
                        <th className="px-8 py-4">{t.status}</th>
                        <th className="px-8 py-4">{t.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.map((student) => (
                        <tr key={student.id} className="hover:bg-slate-50 transition-all">
                          <td className="px-8 py-4 font-bold text-slate-900">{student.name}</td>
                          <td className="px-8 py-4 text-slate-600">{student.grade}</td>
                          <td className="px-8 py-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                              student.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 
                              student.status === 'displaced' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {student.status === 'active' ? t.active : student.status === 'displaced' ? t.displaced : t.inactive}
                            </span>
                          </td>
                          <td className="px-8 py-4">
                            <button className="text-slate-400 hover:text-emerald-600 transition-all">
                              <ChevronRight size={20} className={language === 'ar' ? 'rotate-180' : ''} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
