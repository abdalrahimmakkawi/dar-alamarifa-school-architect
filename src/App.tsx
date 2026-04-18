import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { supabase } from './lib/supabase';
import { getUserRole, handleFailedLogin, resetFailedLogin } from './lib/auth';
import { User } from './types';
import { Loader2, BookOpen, Mail, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import { translations } from './lib/translations';

// Lazy load scheduler to avoid blocking initial load
const loadAndStartScheduler = async () => {
  const { startScheduler } = await import('./agents/scheduler');
  startScheduler();
};

const AdminApp = lazy(() => import('./pages/admin/AdminApp'));
const StaffApp = lazy(() => import('./pages/staff/StaffApp'));

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [language, setLanguage] = useState<'en' | 'ar'>('en');

  const t = translations[language];

  useEffect(() => {
    // Check session immediately to speed up initial load
    const checkSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          setSession(currentSession);
          const role = getUserRole(currentSession.user.email || '');
          setUser({ email: currentSession.user.email || '', role });
        }
      } catch (e) {
        console.error("Initial session check failed:", e);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      // Update activity on any auth event
      localStorage.setItem('last_activity', Date.now().toString());

      // Only update session if token changed to prevent render loops
      setSession(prev => {
        if (prev?.access_token === currentSession?.access_token) return prev;
        return currentSession;
      });
      
      if (currentSession?.user) {
        const role = getUserRole(currentSession.user.email || '');
        setUser(prev => {
          if (prev?.email === currentSession.user.email && prev?.role === role) {
            return prev;
          }
          return { email: currentSession.user.email || '', role };
        });
      } else {
        setUser(null);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Start scheduler only when admin role is confirmed
  useEffect(() => {
    if (user?.role === 'admin') {
      loadAndStartScheduler();
    }
  }, [user?.role]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);
    
    const { error } = isSignUp 
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (!isSignUp) await handleFailedLogin(email);
      setAuthError(error.message);
      setLoading(false);
    } else {
      if (!isSignUp) resetFailedLogin(email);
      if (isSignUp) {
        setAuthError('Check your email for the confirmation link!');
        setLoading(false);
      }
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setAuthError('Please enter your email address first.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      setAuthError(error.message);
    } else {
      setAuthError('Password reset link sent to your email!');
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
      </div>
    );
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
      </div>
    }>
      <div className={language === 'ar' ? 'rtl' : 'ltr'} dir={language === 'ar' ? 'rtl' : 'ltr'}>
        <AnimatePresence mode="wait">
          {!session ? (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 p-4">
              <div className="mb-8 flex bg-white/10 p-1 rounded-xl border border-white/20 backdrop-blur-sm">
                <button 
                  onClick={() => setLanguage('en')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${language === 'en' ? 'bg-emerald-600 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}
                >
                  English
                </button>
                <button 
                  onClick={() => setLanguage('ar')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${language === 'ar' ? 'bg-emerald-600 text-white shadow-lg' : 'text-white/60 hover:text-white'}`}
                >
                  العربية
                </button>
              </div>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
              >
                <div className="p-8 bg-emerald-600 text-white text-center">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                    <BookOpen size={32} />
                  </div>
                  <h1 className="text-2xl font-bold">Dar Alamarifa</h1>
                  <p className="text-emerald-100 text-sm mt-1">{t.schoolArchitect}</p>
                </div>
                
                <form onSubmit={handleAuth} className="p-8 space-y-6">
                  {authError && (
                    <div className={`p-4 border text-sm rounded-xl flex items-center gap-2 ${
                      isSignUp && !authError.includes('Invalid') ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'
                    }`}>
                      <Lock size={16} />
                      {authError}
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Mail size={16} className="text-emerald-600" />
                      {t.emailAddress}
                    </label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                      placeholder={t.emailAddress}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <Lock size={16} className="text-emerald-600" />
                      {t.password}
                    </label>
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                      placeholder="••••••••"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                  >
                    {isSignUp ? t.createAccount : t.signIn}
                  </button>

                  <div className="text-center space-y-2">
                    <button 
                      type="button"
                      onClick={() => setIsSignUp(!isSignUp)}
                      className="text-sm text-emerald-600 font-medium hover:underline block w-full"
                    >
                      {isSignUp ? t.alreadyHaveAccount : t.needAccount}
                    </button>
                    {!isSignUp && (
                      <button 
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-xs text-slate-400 hover:text-emerald-600 transition-colors"
                      >
                        {t.forgotPassword}
                      </button>
                    )}
                  </div>
                </form>
                
                <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
                  <p className="text-xs text-slate-400">
                    {t.authorizedOnly}
                  </p>
                </div>
              </motion.div>
            </div>
          ) : (
            user?.role === 'admin' ? (
              <AdminApp user={user} language={language} setLanguage={setLanguage} />
            ) : (
              <StaffApp user={user!} language={language} setLanguage={setLanguage} />
            )
          )}
        </AnimatePresence>
      </div>
    </Suspense>
  );
}
