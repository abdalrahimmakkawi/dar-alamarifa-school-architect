import { supabase } from './supabase';
import { User } from '../types';
import { logSecurityEvent } from './audit';

/**
 * SECURITY NOTE: Magic link tokens must be single-use and expire in 15 minutes.
 * Configure this in Supabase Dashboard -> Authentication -> Providers -> Email -> Magic Links.
 */

const SESSION_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes

const getAdminEmails = (): string[] => {
  const hardcoded = [
    'abdalrahimmakkawi@gmail.com',
    'daralmarifaalsodania@gmail.com'
  ];
  
  const envEmails: string[] = [];
  
  try {
    // Safely access Vite environment variables
    const v1 = (import.meta as any).env?.VITE_ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS;
    if (v1 && typeof v1 === 'string') {
      envEmails.push(...v1.split(','));
    }
    
    const v2 = (import.meta as any).env?.VITE_ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL;
    if (v2 && typeof v2 === 'string') {
      envEmails.push(v2);
    }
  } catch (e) {
    // Silently fail if import.meta.env is not available
  }
  
  const all = [...hardcoded, ...envEmails]
    .filter(Boolean)
    .map(email => email.trim().toLowerCase());
  
  return Array.from(new Set(all));
};

export const getUserRole = (email: string): 'admin' | 'staff' => {
  if (!email) return 'staff';
  
  const normalizedEmail = email.trim().toLowerCase();
  
  // Hardcoded check for absolute certainty
  if (normalizedEmail === 'abdalrahimmakkawi@gmail.com' || 
      normalizedEmail === 'daralmarifaalsodania@gmail.com') {
    return 'admin';
  }

  const admins = getAdminEmails();
  const isMatch = admins.includes(normalizedEmail);
  return isMatch ? 'admin' : 'staff';
};

export const getCurrentUser = async (): Promise<User | null> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const user = session.user;
  const lastActivity = localStorage.getItem('last_activity');
  const now = Date.now();

  // Session expiry check — force re-login after 8 hours of inactivity
  if (lastActivity && now - parseInt(lastActivity) > SESSION_EXPIRY_MS) {
    await signOut();
    return null;
  }
  localStorage.setItem('last_activity', now.toString());

  // Concurrent session detection (Simplified)
  // In a real app, you would check a 'sessions' table in Supabase
  const currentSessionId = session.access_token.substring(0, 20);
  const storedSessionId = localStorage.getItem('session_id');
  if (storedSessionId && storedSessionId !== currentSessionId) {
    // This is a very basic check, real implementation would use real-time listeners
    console.warn('New login detected from another device');
  }
  localStorage.setItem('session_id', currentSessionId);

  return {
    email: user.email || '',
    role: getUserRole(user.email || '')
  };
};

export const handleFailedLogin = async (email: string) => {
  const attemptsKey = `failed_attempts_${email}`;
  const lockoutKey = `lockout_${email}`;
  
  const now = Date.now();
  const lockoutTime = localStorage.getItem(lockoutKey);
  
  if (lockoutTime && now < parseInt(lockoutTime)) {
    throw new Error('Account locked. Please try again later.');
  }

  const attempts = parseInt(localStorage.getItem(attemptsKey) || '0') + 1;
  localStorage.setItem(attemptsKey, attempts.toString());

  if (attempts >= MAX_FAILED_ATTEMPTS) {
    localStorage.setItem(lockoutKey, (now + LOCKOUT_DURATION_MS).toString());
    localStorage.removeItem(attemptsKey);
    
    console.error(`[SECURITY ALERT] Account locked for ${email} after ${MAX_FAILED_ATTEMPTS} failed attempts.`);
    logSecurityEvent('failed_login', email, `Account locked after ${MAX_FAILED_ATTEMPTS} failed attempts.`);
    
    throw new Error('Too many failed attempts. Account locked for 30 minutes.');
  }
};

export const resetFailedLogin = (email: string) => {
  localStorage.removeItem(`failed_attempts_${email}`);
  localStorage.removeItem(`lockout_${email}`);
};

export const signOut = async () => {
  localStorage.removeItem('last_activity');
  localStorage.removeItem('session_id');
  await supabase.auth.signOut();
};
