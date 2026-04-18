import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Paperclip, 
  Mic, 
  Volume2, 
  VolumeX, 
  Square, 
  Image as ImageIcon, 
  FileText, 
  Folder, 
  X,
  Bot,
  Loader2,
  Plus,
  AlertCircle,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AgentMessage, AgentId, User, ChatSession, Agent } from '../../types';
import { AGENT_REGISTRY } from '../../agents/registry';
import { routeAndExecute } from '../../agents/engine';
import { supabase } from '../../lib/supabase';
import { speak, stopSpeaking, isSpeaking, startVoiceInput, stopVoiceInput, isVoiceInputSupported } from '../../lib/voice';
import { Attachment, processFile, processFolder } from '../../lib/attachments';
import { offlineQueue } from '../../lib/offlineQueue';

interface AgentConsoleProps {
  user: User;
  language: 'en' | 'ar';
  messages: AgentMessage[];
  selectedAgent: AgentId | 'auto';
  setSelectedAgent: (id: AgentId | 'auto') => void;
  currentSessionId: string | null;
  sessions: ChatSession[];
  startNewSession: () => void;
  loadSession: (id: string) => void;
  availableAgents?: Agent[];
  t: any;
}

export default function AgentConsole({ 
  user, 
  language, 
  messages, 
  selectedAgent, 
  setSelectedAgent, 
  currentSessionId,
  sessions,
  startNewSession,
  loadSession,
  availableAgents,
  t 
}: AgentConsoleProps) {
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [pendingMessages, setPendingMessages] = useState<AgentMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    const saved = localStorage.getItem('da_voice_settings');
    return saved ? JSON.parse(saved).enabled : false;
  });
  const [voiceSpeed, setVoiceSpeed] = useState(() => {
    const saved = localStorage.getItem('da_voice_settings');
    return saved ? JSON.parse(saved).speed : 1.0;
  });

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    localStorage.setItem('da_voice_settings', JSON.stringify({ enabled: voiceEnabled, speed: voiceSpeed }));
  }, [voiceEnabled, voiceSpeed]);

  // Auto-speak new messages if enabled
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (voiceEnabled && lastMessage && lastMessage.role === 'assistant') {
      speak(lastMessage.content, { language, rate: voiceSpeed });
    }
  }, [messages.length]);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { error } = await supabase.from('chat_sessions').select('id').limit(1);
        if (error) throw error;
        setIsSupabaseConnected(true);
      } catch (err) {
        console.error('Supabase connection check failed:', err);
        setIsSupabaseConnected(false);
      }
    };
    checkConnection();
  }, []);

  // Clear pending messages that have now been confirmed by the server
  useEffect(() => {
    if (messages.length > 0) {
      setPendingMessages(prev => prev.filter(pm => 
        !messages.some(m => m.content === pm.content && m.role === pm.role)
      ));
    }
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() && attachments.length === 0) return;
    if (isTyping || isSending) return;
    
    setIsSending(true);
    const userMessage = input.trim();
    const currentAttachments = [...attachments];
    
    setInput('');
    setAttachments([]);
    setIsTyping(true);
    setError(null);
    stopSpeaking();

    let sessionId = currentSessionId || localStorage.getItem('da_current_session_id');

    // Optimistic update
    const optimisticMsg: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userMessage || (language === 'ar' ? 'يرجى تحليل الملفات المرفقة.' : 'Please analyze the attached files.'),
      agent_id: selectedAgent === 'auto' ? 'director' : selectedAgent,
      created_at: new Date().toISOString(),
      user_id: user.email,
      user_role: user.role,
      is_auto: false,
      session_id: sessionId || 'temp',
      language
    };
    setPendingMessages(prev => [...prev, optimisticMsg]);

    try {
      // 0. Auto-create session if it doesn't exist
      if (!sessionId) {
        console.log('[AgentConsole] No session ID found, creating new session...');
        const newSession: Partial<ChatSession> = {
          id: crypto.randomUUID(),
          title: userMessage.substring(0, 30) + (userMessage.length > 30 ? '...' : ''),
          agent_id: selectedAgent === 'auto' ? 'director' : selectedAgent,
          user_id: user.email,
        };
        const { data: sessionData, error: sessionError } = await supabase
          .from('chat_sessions')
          .insert([newSession])
          .select()
          .single();

        if (sessionError) {
          console.error('[AgentConsole] Failed to auto-create session:', sessionError);
          throw new Error(`Failed to initialize chat session: ${sessionError.message}`);
        }
        
        if (sessionData) {
          sessionId = sessionData.id;
          // Notify parent to update currentSessionId and sessions list
          await loadSession(sessionId);
          console.log('[AgentConsole] Auto-created session:', sessionId);
        }
      } else {
        // If we have a sessionId but currentSessionId prop is null, sync it
        if (!currentSessionId) {
          await loadSession(sessionId);
        }
        
        // Update session's updated_at to bring it to the top
        await supabase
          .from('chat_sessions')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', sessionId);
      }

      // 1. Save user message to Supabase (or queue if offline)
      console.log('[AgentConsole] Saving user message...');
      const userMsgPayload = {
        agent_id: selectedAgent === 'auto' ? 'director' : selectedAgent,
        role: 'user',
        content: userMessage || (language === 'ar' ? 'يرجى تحليل الملفات المرفقة.' : 'Please analyze the attached files.'),
        language,
        user_id: user.email,
        user_role: user.role,
        session_id: sessionId
      };

      if (!navigator.onLine) {
        await offlineQueue.saveToQueue('agent_message', userMsgPayload);
      } else {
        const { error: saveError } = await supabase.from('agent_messages').insert(userMsgPayload);
        if (saveError) {
          console.error('[AgentConsole] Supabase Insert Error:', saveError);
          await offlineQueue.saveToQueue('agent_message', userMsgPayload);
        }
      }

      // 2. Execute agent logic
      console.log('[AgentConsole] Executing agent logic...');
      const result = await routeAndExecute(userMessage, messages, language, currentAttachments);
      
      // 3. Save assistant response (or queue if offline)
      console.log('[AgentConsole] Saving assistant response...');
      const assistantMsgPayload = {
        agent_id: result.agentId,
        role: 'assistant',
        content: result.response,
        language,
        user_id: user.email,
        user_role: user.role,
        session_id: sessionId
      };

      if (!navigator.onLine) {
        await offlineQueue.saveToQueue('agent_message', assistantMsgPayload);
      } else {
        const { error: saveError } = await supabase.from('agent_messages').insert(assistantMsgPayload);
        if (saveError) {
          console.error('[AgentConsole] Supabase Assistant Insert Error:', saveError);
          await offlineQueue.saveToQueue('agent_message', assistantMsgPayload);
        }
      }

    } catch (error: any) {
      console.error("Full error in handleSendMessage:", error);
      const errorMsg = error.message || 'The AI service is currently unavailable. Please check your API keys and connection.';
      setError(errorMsg);
      
      // Try to save error message to Supabase for history, but don't fail if it fails
      try {
        await supabase.from('agent_messages').insert({
          agent_id: selectedAgent === 'auto' ? 'director' : selectedAgent,
          role: 'assistant',
          content: `Error: ${errorMsg}`,
          language,
          user_id: user.email,
          user_role: user.role,
          session_id: sessionId
        });
      } catch (e) {
        console.error('Failed to save error message to Supabase:', e);
      }
    } finally {
      setIsTyping(false);
      setIsSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsProcessingFiles(true);
    setShowAttachmentMenu(false);
    try {
      const newAttachments = await Promise.all(
        Array.from(files).map(file => processFile(file as File))
      );
      setAttachments(prev => [...prev, ...newAttachments]);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsProcessingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsProcessingFiles(true);
    setShowAttachmentMenu(false);
    try {
      const folderAttachment = await processFolder(files);
      setAttachments(prev => [...prev, folderAttachment]);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsProcessingFiles(false);
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const toggleVoiceInput = () => {
    if (isRecording) {
      stopVoiceInput();
      setIsRecording(false);
    } else {
      setIsRecording(true);
      startVoiceInput(language, (text) => {
        setInput(text);
      }, () => {
        setIsRecording(false);
      }, (error) => {
        if (error === 'not-allowed') {
          alert(language === 'ar' ? 'يرجى السماح بالوصول إلى الميكروفون في إعدادات المتصفح.' : 'Please allow microphone access in your browser settings.');
        } else {
          console.error('Voice input error:', error);
        }
      });
    }
  };

  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden relative">
      {/* Header with Agent Selection and History Toggle */}
      <div className="px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between z-20">
        <div className="flex items-center gap-4 overflow-x-auto scrollbar-hide max-w-[70%]">
          {!availableAgents && (
            <button
              onClick={() => setSelectedAgent('auto')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
                selectedAgent === 'auto' 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Bot size={16} />
              <span className="text-xs font-bold">{t.adminControl}</span>
            </button>
          )}

          {(availableAgents || AGENT_REGISTRY).map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all whitespace-nowrap ${
                selectedAgent === agent.id 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' 
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <agent.icon size={16} />
              <span className="text-xs font-bold">{agent.name}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-xl transition-all ${showHistory ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
            title={t.recentChats}
          >
            <History size={20} />
          </button>
          <button 
            type="button"
            onClick={startNewSession}
            className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
            title={t.newChat}
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* History Overlay */}
      <AnimatePresence>
        {showHistory && (
          <motion.div 
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="absolute top-[73px] right-0 bottom-0 w-72 bg-white border-l border-slate-100 shadow-2xl z-30 flex flex-col"
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">{t.recentChats}</span>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    loadSession(session.id);
                    setShowHistory(false);
                  }}
                  className={`w-full text-left p-3 rounded-xl text-xs transition-all ${
                    currentSessionId === session.id 
                      ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-100' 
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <div className="truncate">{session.title}</div>
                  <div className="text-[10px] opacity-50">{new Date(session.updated_at).toLocaleDateString()}</div>
                </button>
              ))}
              {sessions.length === 0 && (
                <div className="text-center p-8 text-slate-400 text-xs italic">
                  No recent chats
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Toolbar */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              voiceEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
            }`}
          >
            {voiceEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            {voiceEnabled ? 'Voice ON' : 'Voice OFF'}
          </button>

          {voiceEnabled && (
            <div className="flex items-center bg-white rounded-xl border border-slate-200 p-1">
              {[
                { label: 'Slow', value: 0.7 },
                { label: 'Normal', value: 1.0 },
                { label: 'Fast', value: 1.4 }
              ].map((speed) => (
                <button
                  key={speed.value}
                  onClick={() => setVoiceSpeed(speed.value)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${
                    voiceSpeed === speed.value ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {speed.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {isSpeaking() && (
          <button 
            onClick={stopSpeaking}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-all"
          >
            <Square size={12} fill="currentColor" />
            Stop
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
        {messages.length === 0 && pendingMessages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8">
            <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mb-4 text-emerald-600">
              <Bot size={40} />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{t.welcomeAgent}</h3>
            <p className="text-slate-500 max-w-xs">{t.agentDescription}</p>
          </div>
        )}
        
        {isSupabaseConnected === false && (
          <div className="p-4 mb-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{t.supabaseError}</span>
          </div>
        )}

        {[...messages, ...pendingMessages].map((msg, idx) => (
          <motion.div 
            key={msg.id || idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} ${pendingMessages.some(pm => pm.id === msg.id) ? 'opacity-70' : ''}`}
          >
            <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${
              msg.role === 'user' 
                ? 'bg-emerald-600 text-white rounded-tr-none' 
                : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
            }`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                    {msg.agent_id} Specialist
                  </span>
                </div>
              )}
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              <span className="text-[10px] opacity-60 mt-2 block">
                {new Date(msg.created_at).toLocaleTimeString()}
              </span>
            </div>
          </motion.div>
        ))}

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="max-w-[85%] p-4 rounded-2xl rounded-tl-none bg-red-50 border border-red-100 text-red-600 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                  System Error
                </span>
              </div>
              <p className="text-sm leading-relaxed">{error}</p>
            </div>
          </motion.div>
        )}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none border border-slate-200 flex gap-1">
              <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
              <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
              <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        {/* Attachment Chips */}
        <AnimatePresence>
          {attachments.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex flex-wrap gap-2 mb-4"
            >
              {attachments.map((att) => (
                <div key={att.id} className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm group">
                  {att.type === 'image' ? <ImageIcon size={14} className="text-blue-500" /> : <FileText size={14} className="text-slate-500" />}
                  <span className="text-xs font-medium text-slate-700 max-w-[120px] truncate">{att.name}</span>
                  <button onClick={() => removeAttachment(att.id)} className="text-slate-400 hover:text-red-500 transition-all">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSendMessage} className="relative flex items-end gap-2">
          <div className="relative">
            <button 
              type="button"
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className="p-4 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm"
            >
              <Paperclip size={20} />
            </button>

            <AnimatePresence>
              {showAttachmentMenu && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: -10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  className="absolute bottom-full left-0 mb-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 p-2 z-50"
                >
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-3 p-3 text-sm text-slate-700 hover:bg-slate-50 rounded-xl transition-all"
                  >
                    <ImageIcon size={18} className="text-blue-500" />
                    Image
                  </button>
                  <button 
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full flex items-center gap-3 p-3 text-sm text-slate-700 hover:bg-slate-50 rounded-xl transition-all"
                  >
                    <FileText size={18} className="text-emerald-500" />
                    Document
                  </button>
                  <button 
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    className="w-full flex items-center gap-3 p-3 text-sm text-slate-700 hover:bg-slate-50 rounded-xl transition-all"
                  >
                    <Folder size={18} className="text-amber-500" />
                    Folder
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 relative">
            <textarea 
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={t.askAgent.replace('{name}', selectedAgent === 'auto' ? t.adminControl : AGENT_REGISTRY.find(a => a.id === selectedAgent)?.name || '')}
              className="w-full p-4 pr-12 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 transition-all outline-none shadow-sm resize-none max-h-32"
            />
            
            {isVoiceInputSupported() && (
              <button 
                type="button"
                onClick={toggleVoiceInput}
                className={`absolute right-3 bottom-3 p-2 rounded-xl transition-all ${
                  isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'text-slate-400 hover:text-emerald-600'
                }`}
              >
                <Mic size={20} />
              </button>
            )}
          </div>

          <button 
            type="submit"
            disabled={isTyping || isProcessingFiles || (!input.trim() && attachments.length === 0)}
            className="p-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-lg shadow-emerald-100"
          >
            {isTyping ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
          </button>
        </form>

        {/* Hidden Inputs */}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          multiple 
          onChange={handleFileUpload}
          accept="image/*,.pdf,.docx,.doc,.txt,.md,.csv,.json"
        />
        <input 
          type="file" 
          ref={folderInputRef} 
          className="hidden" 
          {...{ webkitdirectory: "", directory: "" } as any} 
          onChange={handleFolderUpload}
        />
      </div>
    </div>
  );
}
