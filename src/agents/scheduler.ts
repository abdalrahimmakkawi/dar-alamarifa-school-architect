import { supabase } from '../lib/supabase';
import { callAgent } from './engine';
import { AgentId } from '../types';

// Sudan Time is UTC+3
const getSudanTime = () => {
  const now = new Date();
  const sudanOffset = 3 * 60; // UTC+3 in minutes
  const localOffset = now.getTimezoneOffset(); // Local offset in minutes
  const sudanTime = new Date(now.getTime() + (sudanOffset + localOffset) * 60000);
  return sudanTime;
};

const saveReport = async (type: 'weekly' | 'monthly', title: string, content: string, agentId: AgentId) => {
  const { error } = await supabase.from('reports').insert({
    type,
    title,
    content,
    generated_by: agentId,
    is_auto: true
  });
  if (error) console.error(`Error saving ${type} report:`, error);
};

const saveAlert = async (type: string, severity: 'low' | 'medium' | 'high', title: string, body: string) => {
  const { error } = await supabase.from('alerts').insert({
    type,
    severity,
    title,
    body,
    resolved: false
  });
  if (error) console.error(`Error saving alert:`, error);
};

export const runWeeklyAnalytics = async () => {
  console.log('[Scheduler] Running Weekly Analytics...');
  try {
    // Fetch live data from Supabase for the report
    const { data: students } = await supabase.from('students').select('*');
    const studentData = JSON.stringify(students || []);
    
    const report = await callAgent('analytics', `Generate a weekly school report based on this student data: ${studentData}`);
    await saveReport('weekly', `Weekly School Report - ${new Date().toLocaleDateString()}`, report, 'analytics');
    console.log('[Scheduler] Weekly Analytics complete.');
  } catch (error) {
    console.error('[Scheduler] Weekly Analytics failed:', error);
  }
};

export const runMonthlyStrategy = async () => {
  console.log('[Scheduler] Running Monthly Strategy...');
  try {
    const { data: students } = await supabase.from('students').select('*');
    const { data: reports } = await supabase.from('reports').select('*').limit(4).order('created_at', { ascending: false });
    
    const context = JSON.stringify({ students, recentReports: reports });
    const brief = await callAgent('strategy', `Generate a monthly strategic brief based on this context: ${context}`);
    await saveReport('monthly', `Monthly Strategic Brief - ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}`, brief, 'strategy');
    console.log('[Scheduler] Monthly Strategy complete.');
  } catch (error) {
    console.error('[Scheduler] Monthly Strategy failed:', error);
  }
};

export const runFeeAudit = async () => {
  console.log('[Scheduler] Running Daily Fee Audit...');
  try {
    console.log('[Scheduler] Fetching students for audit...');
    const { data: students, error: fetchError } = await supabase.from('students').select('*');
    if (fetchError) throw fetchError;
    console.log(`[Scheduler] Found ${students?.length || 0} students.`);
    
    if (!students) return;

    const lowPaymentStudents = students.filter(s => (s.feesPaid / s.totalFees) < 0.3);
    console.log(`[Scheduler] Found ${lowPaymentStudents.length} low payment students.`);
    
    if (lowPaymentStudents.length > 3) {
      console.log('[Scheduler] Saving critical fee alert...');
      await saveAlert(
        'fee_audit',
        'high',
        'Critical Fee Alert',
        `${lowPaymentStudents.length} students have paid less than 30% of their fees. Immediate action required.`
      );
    }
    console.log('[Scheduler] Fee Audit complete.');
  } catch (error) {
    console.error('[Scheduler] Fee Audit failed:', error);
  }
};

let lastWeeklyRun: string | null = null;
let lastMonthlyRun: string | null = null;
let lastAuditRun: string | null = null;

let isStarted = false;

export const startScheduler = () => {
  if (isStarted) return;
  isStarted = true;
  
  console.log('[Scheduler] Starting autonomous agent scheduler...');
  
  // Run audit immediately on start
  runFeeAudit();

  setInterval(() => {
    const now = getSudanTime();
    const day = now.getDay(); // 0 is Sunday, 1 is Monday
    const hour = now.getHours();
    const date = now.getDate();
    const todayStr = now.toDateString();
    const monthStr = `${now.getMonth()}-${now.getFullYear()}`;

    // Weekly: Monday 07:00 Sudan Time
    if (day === 1 && hour === 7 && lastWeeklyRun !== todayStr) {
      runWeeklyAnalytics();
      lastWeeklyRun = todayStr;
    }

    // Monthly: 1st of every month 08:00 Sudan Time
    if (date === 1 && hour === 8 && lastMonthlyRun !== monthStr) {
      runMonthlyStrategy();
      lastMonthlyRun = monthStr;
    }

    // Daily: Every 24 hours (check once a day at midnight Sudan time)
    if (hour === 0 && lastAuditRun !== todayStr) {
      runFeeAudit();
      lastAuditRun = todayStr;
    }
  }, 60000); // Check every minute
};
