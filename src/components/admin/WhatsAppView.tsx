import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Phone, 
  Clock, 
  Send, 
  CheckCircle2, 
  XCircle,
  Users,
  AlertCircle,
  Bot
} from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { AgentMessage } from '../../types';
import { sendWhatsAppMessage } from '../../lib/whatsapp';

import { translations } from '../../lib/translations';

interface WhatsAppViewProps {
  language?: 'en' | 'ar';
}

export default function WhatsAppView({ language = 'en' }: WhatsAppViewProps) {
  const [conversations, setConversations] = useState<Record<string, AgentMessage[]>>({});
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [isWebhookActive, setIsWebhookActive] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const t = translations[language];

  useEffect(() => {
    fetchWhatsAppMessages();
    
    const channel = supabase.channel('whatsapp_messages')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'agent_messages',
        filter: 'user_id=like.whatsapp:*' 
      }, (payload) => {
        const msg = payload.new as AgentMessage;
        const phone = msg.user_id.split(':')[1];
        setConversations(prev => ({
          ...prev,
          [phone]: [...(prev[phone] || []), msg]
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchWhatsAppMessages = async () => {
    const { data } = await supabase
      .from('agent_messages')
      .select('*')
      .ilike('user_id', 'whatsapp:%')
      .order('created_at', { ascending: true });

    if (data) {
      const grouped = data.reduce((acc: Record<string, AgentMessage[]>, msg) => {
        const phone = msg.user_id.split(':')[1];
        if (!acc[phone]) acc[phone] = [];
        acc[phone].push(msg);
        return acc;
      }, {});
      setConversations(grouped);
      if (!selectedPhone && Object.keys(grouped).length > 0) {
        setSelectedPhone(Object.keys(grouped)[0]);
      }
    }
  };

  const handleSendAnnouncement = async () => {
    setIsSending(true);
    const phones = Object.keys(conversations);
    const message = t.announcementMessage;
    
    for (const phone of phones) {
      await sendWhatsAppMessage(phone, message);
    }
    setIsSending(false);
    alert(t.announcementSent.replace('{count}', phones.length.toString()));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-12rem)]">
      {/* Sidebar: Conversations List */}
      <div className="lg:col-span-1 bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Phone size={18} className="text-emerald-600" />
              WhatsApp
            </h3>
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${isWebhookActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {isWebhookActive ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
              {isWebhookActive ? t.active : t.offline}
            </div>
          </div>
          <div className="space-y-2">
            <button 
              onClick={handleSendAnnouncement}
              disabled={isSending}
              className="w-full p-3 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50"
            >
              <Users size={14} />
              {t.sendAnnouncement}
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {Object.entries(conversations).map(([phone, messages]) => {
            const msgs = messages as AgentMessage[];
            return (
              <button
                key={phone}
                onClick={() => setSelectedPhone(phone)}
                className={`w-full p-4 rounded-2xl text-left transition-all border ${
                  selectedPhone === phone 
                    ? 'bg-emerald-50 border-emerald-200 shadow-sm' 
                    : 'bg-white border-transparent hover:bg-slate-50'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-slate-900 text-sm">+{phone}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(msgs[msgs.length - 1].created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate">
                  {msgs[msgs.length - 1].content}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="lg:col-span-3 bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col overflow-hidden">
        {selectedPhone ? (
          <>
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                  <Phone size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">+{selectedPhone}</h3>
                  <p className="text-xs text-emerald-600 font-bold uppercase tracking-widest">{t.whatsAppBusinessActive}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {conversations[selectedPhone].map((msg, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
                      : 'bg-emerald-600 text-white rounded-tr-none' 
                  }`}>
                    {msg.role === 'assistant' && (
                      <div className="flex items-center gap-2 mb-2">
                        <Bot size={12} className="opacity-60" />
                        <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                          {msg.agent_id} Agent
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
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
            <div className="bg-slate-50 p-6 rounded-full mb-4">
              <MessageSquare size={48} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">{t.noConversationSelected}</h3>
            <p className="text-sm max-w-xs">{t.selectParentDesc}</p>
          </div>
        )}
      </div>
    </div>
  );
}
