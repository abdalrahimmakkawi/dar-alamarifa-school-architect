import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  History, 
  Lock, 
  UserX, 
  Eye, 
  RefreshCw,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { translations } from '../../lib/translations';

interface SecurityEvent {
  id: string;
  event_type: string;
  user_email: string;
  details: string;
  created_at: string;
}

interface AuditLog {
  id: string;
  action: string;
  performed_by: string;
  target_id: string;
  created_at: string;
}

export default function SecurityView({ language }: { language: 'en' | 'ar' }) {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const t = translations[language];

  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    setLoading(true);
    try {
      const [eventsRes, auditRes] = await Promise.all([
        supabase.from('security_events').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(50)
      ]);

      if (eventsRes.data) setEvents(eventsRes.data);
      if (auditRes.data) setAuditLogs(auditRes.data);
    } catch (error) {
      console.error('Failed to fetch security data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-nile-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-nile-600" />
            Security Monitoring
          </h2>
          <p className="text-nile-600">Real-time security events and audit trails</p>
        </div>
        <button 
          onClick={fetchSecurityData}
          className="p-2 hover:bg-nile-100 rounded-full transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-nile-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <span className="font-medium text-nile-900">Critical Events</span>
          </div>
          <div className="text-2xl font-bold text-red-600">
            {events.filter(e => e.event_type === 'unauthorized_access').length}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-nile-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="font-medium text-nile-900">Failed Logins</span>
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {events.filter(e => e.event_type === 'failed_login').length}
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-nile-100 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 rounded-lg">
              <History className="w-5 h-5 text-green-600" />
            </div>
            <span className="font-medium text-nile-900">Audit Actions</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{auditLogs.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Events */}
        <div className="bg-white rounded-xl border border-nile-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-nile-100 bg-nile-50/50 flex items-center justify-between">
            <h3 className="font-bold text-nile-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Security Alerts
            </h3>
          </div>
          <div className="divide-y divide-nile-50 max-h-[400px] overflow-y-auto">
            {events.length === 0 ? (
              <div className="p-8 text-center text-nile-400">No security events detected</div>
            ) : (
              events.map((event) => (
                <div key={event.id} className="p-4 hover:bg-nile-50/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-nile-900 capitalize">
                        {event.event_type.replace('_', ' ')}
                      </div>
                      <div className="text-sm text-nile-600 mt-1">{event.details}</div>
                      <div className="text-xs text-nile-400 mt-2 flex items-center gap-2">
                        <span>{event.user_email || 'Anonymous'}</span>
                        <span>•</span>
                        <span>{new Date(event.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                    {event.event_type === 'unauthorized_access' ? (
                      <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Audit Log */}
        <div className="bg-white rounded-xl border border-nile-100 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-nile-100 bg-nile-50/50 flex items-center justify-between">
            <h3 className="font-bold text-nile-900 flex items-center gap-2">
              <History className="w-4 h-4 text-nile-600" />
              Audit Trail
            </h3>
          </div>
          <div className="divide-y divide-nile-50 max-h-[400px] overflow-y-auto">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-nile-400">No audit logs found</div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-nile-50/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-medium text-nile-900 capitalize">
                        {log.action.replace('_', ' ')}
                      </div>
                      <div className="text-sm text-nile-600 mt-1">
                        Performed by: {log.performed_by}
                      </div>
                      <div className="text-xs text-nile-400 mt-2">
                        {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
