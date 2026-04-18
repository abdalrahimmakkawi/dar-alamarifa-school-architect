import { supabase } from './supabase';
import { Student, Report } from '../types';
import { encryptStudent, decryptStudent } from './crypto';
import { logAction } from './audit';

/**
 * Database layer with encryption and auditing.
 */

export const db = {
  students: {
    async getAll(): Promise<Student[]> {
      const { data, error } = await supabase.from('students').select('*');
      if (error) throw error;
      
      const decryptedStudents = await Promise.all(
        (data || []).map(s => decryptStudent(s as Student))
      );
      return decryptedStudents;
    },

    async getById(id: string): Promise<Student | null> {
      const { data, error } = await supabase.from('students').select('*').eq('id', id).single();
      if (error) throw error;
      if (!data) return null;
      
      return await decryptStudent(data as Student);
    },

    async create(student: Partial<Student>, performedBy: string): Promise<Student> {
      const encrypted = await encryptStudent(student);
      const { data, error } = await supabase.from('students').insert(encrypted).select().single();
      if (error) throw error;
      
      const newStudent = data as Student;
      await logAction('student_created', performedBy, newStudent.id, null, newStudent);
      return await decryptStudent(newStudent);
    },

    async update(id: string, updates: Partial<Student>, performedBy: string): Promise<Student> {
      const oldStudent = await this.getById(id);
      const encrypted = await encryptStudent(updates);
      
      const { data, error } = await supabase.from('students').update(encrypted).eq('id', id).select().single();
      if (error) throw error;
      
      const updatedStudent = data as Student;
      await logAction('student_updated', performedBy, id, oldStudent, updatedStudent);
      return await decryptStudent(updatedStudent);
    },

    async delete(id: string, performedBy: string): Promise<void> {
      const oldStudent = await this.getById(id);
      const { error } = await supabase.from('students').delete().eq('id', id);
      if (error) throw error;
      
      await logAction('student_deleted', performedBy, id, oldStudent, null);
    }
  },

  reports: {
    async create(report: Partial<Report>, performedBy: string): Promise<Report> {
      const { data, error } = await supabase.from('reports').insert(report).select().single();
      if (error) throw error;
      
      const newReport = data as Report;
      await logAction('report_generated', performedBy, newReport.id, null, newReport);
      return newReport;
    },
    
    async getRecent(): Promise<Report[]> {
      const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data || [];
    }
  }
};
