import { supabase } from './supabase';
import { Student } from '../types';

export const accountingService = {
  async getFinancialSnapshot() {
    const { data: students, error } = await supabase
      .from('students')
      .select('grade, feesPaid, totalFees');

    if (error) {
      console.error('Error fetching financial data:', error);
      return null;
    }

    if (!students || students.length === 0) {
      return "No student financial data available.";
    }

    const totalFees = students.reduce((sum, s) => sum + (s.totalFees || 0), 0);
    const totalPaid = students.reduce((sum, s) => sum + (s.feesPaid || 0), 0);
    const totalOutstanding = totalFees - totalPaid;
    const collectionRate = totalFees > 0 ? (totalPaid / totalFees) * 100 : 0;

    // Group by grade
    const gradeStats = students.reduce((acc: any, s) => {
      const grade = s.grade || 'Unknown';
      if (!acc[grade]) {
        acc[grade] = { total: 0, paid: 0, count: 0 };
      }
      acc[grade].total += (s.totalFees || 0);
      acc[grade].paid += (s.feesPaid || 0);
      acc[grade].count += 1;
      return acc;
    }, {});

    let snapshot = `--- FINANCIAL SNAPSHOT (LIVE DATA) ---\n`;
    snapshot += `Total Students: ${students.length}\n`;
    snapshot += `Total Fees Expected: $${totalFees.toLocaleString()}\n`;
    snapshot += `Total Fees Collected: $${totalPaid.toLocaleString()}\n`;
    snapshot += `Total Outstanding: $${totalOutstanding.toLocaleString()}\n`;
    snapshot += `Overall Collection Rate: ${collectionRate.toFixed(1)}%\n\n`;
    
    snapshot += `BREAKDOWN BY GRADE:\n`;
    Object.entries(gradeStats).forEach(([grade, stats]: [string, any]) => {
      const outstanding = stats.total - stats.paid;
      const rate = stats.total > 0 ? (stats.paid / stats.total) * 100 : 0;
      snapshot += `- ${grade}: ${stats.count} students | Collected: $${stats.paid.toLocaleString()} | Outstanding: $${outstanding.toLocaleString()} | Rate: ${rate.toFixed(1)}%\n`;
    });

    return snapshot;
  }
};
