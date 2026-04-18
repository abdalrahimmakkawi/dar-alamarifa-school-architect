import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  MessageSquare, 
  Settings, 
  Bell, 
  Search, 
  Plus, 
  TrendingUp, 
  DollarSign, 
  AlertCircle, 
  ChevronRight, 
  Send, 
  Bot, 
  Sparkles, 
  LogOut, 
  ShieldCheck, 
  PieChart, 
  FileText, 
  HelpCircle, 
  UserPlus, 
  GraduationCap, 
  Briefcase,
  Mail,
  BookOpen,
  Database,
  Phone,
  Gamepad2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, AgentMessage, Student, Report, Alert, AgentId, KnowledgeItem, ChatSession } from '../../types';
import { routeAndExecute, callAgent } from '../../agents/engine';
import { AGENT_REGISTRY } from '../../agents/registry';
import { supabase } from '../../lib/supabase';
import { knowledgeService } from '../../lib/knowledge';
import { memoryService } from '../../lib/memory';
import WhatsAppView from '../../components/admin/WhatsAppView';
import SecurityView from '../../components/admin/SecurityView';
import EduPlayPanel from '../../components/shared/EduPlayPanel';
import AgentConsole from '../../components/shared/AgentConsole';
import { db } from '../../lib/db';
import { translations } from '../../lib/translations';

import { AdminGuard } from '../../lib/guards';

interface AdminAppProps {
  user: User;
  language: 'en' | 'ar';
  setLanguage: (lang: 'en' | 'ar') => void;
}

export default function AdminApp({ user, language, setLanguage }: AdminAppProps) {
  return (
    <AdminGuard user={user}>
      <AdminAppContent user={user} language={language} setLanguage={setLanguage} />
    </AdminGuard>
  );
}

function AdminAppContent({ user, language, setLanguage }: AdminAppProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(() => localStorage.getItem('da_current_session_id'));
  const [selectedAgent, setSelectedAgent] = useState<AgentId | 'auto'>(() => (localStorage.getItem('da_selected_agent') as AgentId | 'auto') || 'auto');
  const [isEditingKnowledge, setIsEditingKnowledge] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<KnowledgeItem> | null>(null);
  const [schoolInfo, setSchoolInfo] = useState({
    name: 'Dar Alamarifa School',
    location: 'Khartoum, Sudan',
    capacity: 500,
    founded: '2010'
  });
  
  const [isLearningActive, setIsLearningActive] = useState(() => {
    const saved = localStorage.getItem('da_learning_active');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('da_learning_active', JSON.stringify(isLearningActive));
  }, [isLearningActive]);

  const t = translations[language];

  const currentSessionIdRef = useRef(currentSessionId);
  
  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    fetchData();
    
    // Listen for session changes (new or updated)
    const sessionChannel = supabase.channel('chat_sessions_global')
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
    // This prevents "window of silence" during session switching
    const msgChannel = supabase.channel(`user-messages-${user.email}`)
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
        reportsData,
        { data: alertsData },
        knowledgeData,
        { data: sessionsData }
      ] = await Promise.all([
        db.students.getAll(),
        db.reports.getRecent(),
        supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(10),
        knowledgeService.getAll(),
        supabase.from('chat_sessions').select('*').order('updated_at', { ascending: false })
      ]);
      
      if (studentsData) setStudents(studentsData);
      if (reportsData) setReports(reportsData);
      if (alertsData) setAlerts(alertsData);
      if (knowledgeData) setKnowledge(knowledgeData);
      if (sessionsData) setSessions(sessionsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  };

  const startNewSession = async () => {
    const newSession: Partial<ChatSession> = {
      id: crypto.randomUUID(),
      title: `New Chat ${new Date().toLocaleTimeString()}`,
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
  const stats = useMemo(() => [
    { label: t.totalStudents || 'Total Students', value: students.length, icon: Users, color: 'bg-blue-500' },
    { label: t.monthlyRevenue || 'Monthly Revenue', value: `${students.reduce((acc, s) => acc + s.feesPaid, 0).toLocaleString()}`, icon: DollarSign, color: 'bg-emerald-500' },
    { label: t.activeAlerts || 'Active Alerts', value: alerts.filter(a => !a.resolved).length, icon: AlertCircle, color: 'bg-amber-500' },
    { label: t.reportsReady || 'Reports Ready', value: reports.length, icon: TrendingUp, color: 'bg-purple-500' },
  ], [students, alerts, reports, t]);

  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} p-3 rounded-2xl text-white`}>
                <stat.icon size={24} />
              </div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live</span>
            </div>
            <h3 className="text-slate-500 text-sm font-medium">{stat.label}</h3>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-900">{t.reportsReady}</h2>
              <button className="text-emerald-600 text-sm font-bold hover:underline">{t.filter}</button>
            </div>
            <div className="space-y-4">
              {reports.slice(0, 3).map((report, i) => (
                <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-emerald-200 transition-all cursor-pointer">
                  <div className="bg-white p-3 rounded-xl shadow-sm">
                    <FileText className="text-emerald-600" size={20} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-slate-900">{report.title}</h4>
                    <p className="text-xs text-slate-500">Generated by {report.generated_by} • {new Date(report.created_at).toLocaleDateString()}</p>
                  </div>
                  <ChevronRight className="text-slate-300" size={20} />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-bold text-slate-900 mb-6">{t.activeAlerts}</h2>
            <div className="space-y-4">
              {alerts.filter(a => !a.resolved).slice(0, 4).map((alert, i) => (
                <div key={i} className={`p-4 rounded-2xl border ${alert.severity === 'high' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className={alert.severity === 'high' ? 'text-red-600' : 'text-amber-600'} size={16} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${alert.severity === 'high' ? 'text-red-600' : 'text-amber-600'}`}>
                      {alert.severity} Priority
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{alert.title}</h4>
                  <p className="text-xs text-slate-600 mt-1">{alert.body}</p>
                </div>
              ))}
            </div>
          </div>
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
        setSelectedAgent={setSelectedAgent}
        currentSessionId={currentSessionId}
        sessions={sessions}
        startNewSession={startNewSession}
        loadSession={loadSession}
        t={t}
      />
    </div>
  );

  const renderKnowledgeBase = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t.knowledgeBase}</h2>
          <p className="text-slate-500">{t.curriculumResources}</p>
        </div>
        <button 
          onClick={() => {
            setEditingItem({ title: '', content: '', category: 'general', tags: [] });
            setIsEditingKnowledge(true);
          }}
          className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
        >
          <Plus size={20} />
          {t.addKnowledge}
        </button>
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
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    setEditingItem(item);
                    setIsEditingKnowledge(true);
                  }}
                  className="p-2 text-slate-400 hover:text-emerald-600 transition-all"
                >
                  <Settings size={16} />
                </button>
                <button 
                  onClick={async () => {
                    if (confirm('Are you sure you want to delete this?')) {
                      await knowledgeService.delete(item.id);
                      fetchData();
                    }
                  }}
                  className="p-2 text-slate-400 hover:text-red-600 transition-all"
                >
                  <AlertCircle size={16} />
                </button>
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

      {isEditingKnowledge && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="text-xl font-bold text-slate-900">
                {editingItem?.id ? t.editKnowledge : t.addKnowledge}
              </h3>
              <button onClick={() => setIsEditingKnowledge(false)} className="text-slate-400 hover:text-slate-600">
                <Plus className="rotate-45" size={24} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">{t.title}</label>
                <input 
                  type="text"
                  value={editingItem?.title || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  placeholder="e.g., School Opening Hours"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">{t.category}</label>
                  <select 
                    value={editingItem?.category || 'general'}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, category: e.target.value as any }))}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                  >
                    <option value="general">{t.general}</option>
                    <option value="policy">{t.policy}</option>
                    <option value="curriculum">{t.curriculum}</option>
                    <option value="schedule">{t.schedule}</option>
                    <option value="legal">{t.legal}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">{t.tags}</label>
                  <input 
                    type="text"
                    value={editingItem?.tags?.join(', ') || ''}
                    onChange={(e) => setEditingItem(prev => ({ ...prev, tags: e.target.value.split(',').map(t => t.trim()).filter(t => t) }))}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    placeholder="hours, schedule, morning"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">{t.content}</label>
                <textarea 
                  rows={6}
                  value={editingItem?.content || ''}
                  onChange={(e) => setEditingItem(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
                  placeholder="Enter the detailed information here..."
                />
              </div>
            </div>
            <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-4">
              <button 
                onClick={() => setIsEditingKnowledge(false)}
                className="px-6 py-3 text-slate-600 font-bold hover:text-slate-900 transition-all"
              >
                {t.cancel}
              </button>
              <button 
                onClick={async () => {
                  if (!editingItem?.title || !editingItem?.content) return;
                  if (editingItem.id) {
                    await knowledgeService.update(editingItem.id, editingItem);
                  } else {
                    await knowledgeService.add(editingItem as any);
                  }
                  setIsEditingKnowledge(false);
                  fetchData();
                }}
                className="px-8 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
              >
                {t.saveKnowledge}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-4xl mx-auto space-y-8">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">{t.schoolName}</label>
              <input 
                type="text"
                value={schoolInfo.name}
                onChange={(e) => setSchoolInfo(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">{t.location}</label>
              <input 
                type="text"
                value={schoolInfo.location}
                onChange={(e) => setSchoolInfo(prev => ({ ...prev, location: e.target.value }))}
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100">
            <h3 className="font-bold text-slate-900 mb-4">{t.aiBrainConfig}</h3>
            <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-600 p-2 rounded-lg text-white">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-emerald-900 text-sm">{t.autonomousLearning}</h4>
                  <p className="text-xs text-emerald-700">{t.autonomousLearningDesc}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsLearningActive(!isLearningActive)}
                className={`w-12 h-6 rounded-full relative transition-all ${isLearningActive ? 'bg-emerald-600' : 'bg-slate-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${isLearningActive ? (language === 'ar' ? 'left-1' : 'right-1') : (language === 'ar' ? 'right-1' : 'left-1')}`}></div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
        <h3 className="font-bold text-slate-900 mb-4">{t.adminProfile}</h3>
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center text-3xl font-bold text-white shadow-xl shadow-emerald-100">
            {user.email[0].toUpperCase()}
          </div>
          <div>
            <p className="font-bold text-slate-900">{user.email}</p>
            <p className="text-sm text-slate-500">{t.schoolDirector}</p>
            <button className="mt-2 text-emerald-600 text-xs font-bold hover:underline">{t.editProfile}</button>
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
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">{t.adminControl}</span>
          </div>
        </div>

        <nav className="space-y-2 flex-1">
          {[
            { id: 'dashboard', label: t.dashboard, icon: LayoutDashboard },
            { id: 'students', label: t.students, icon: Users },
            { id: 'events', label: t.calendar, icon: Calendar },
            { id: 'agents', label: t.agentConsole, icon: MessageSquare },
            { id: 'eduplay', label: t.eduPlayModule, icon: Gamepad2 },
            { id: 'whatsapp', label: t.whatsapp, icon: Phone },
            { id: 'security', label: 'Security', icon: ShieldCheck },
            { id: 'knowledge', label: t.knowledgeBase, icon: Database },
            { id: 'reports', label: t.reports, icon: FileText },
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
              <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">{t.superAdmin}</p>
            </div>
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
                placeholder={t.searchPlaceholder} 
                className={`w-full ${language === 'ar' ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-sm`}
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-all relative">
              <Bell size={20} />
              <span className={`absolute top-2 ${language === 'ar' ? 'left-2' : 'right-2'} w-2 h-2 bg-red-500 rounded-full border-2 border-white`}></span>
            </button>
            <button className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100">
              <Plus size={18} />
              {t.newEntry}
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
              {activeTab === 'whatsapp' && <WhatsAppView language={language} />}
              {activeTab === 'security' && <SecurityView language={language} />}
              {activeTab === 'knowledge' && renderKnowledgeBase()}
              {activeTab === 'settings' && renderSettings()}
              {activeTab === 'students' && (
                <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900">{t.studentDirectory}</h2>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-sm font-bold border border-slate-200">{t.filter}</button>
                      <button className="px-4 py-2 bg-slate-50 text-slate-600 rounded-xl text-sm font-bold border border-slate-200">{t.export}</button>
                    </div>
                  </div>
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-8 py-4">{t.name}</th>
                        <th className="px-8 py-4">{t.grade}</th>
                        <th className="px-8 py-4">{t.status}</th>
                        <th className="px-8 py-4">{t.feesStatus}</th>
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
                            <div className="w-full max-w-[120px] bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full" 
                                style={{ width: `${(student.feesPaid / student.totalFees) * 100}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              ${student.feesPaid.toLocaleString()} / ${student.totalFees.toLocaleString()}
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
