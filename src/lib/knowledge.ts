import { supabase } from './supabase';
import { KnowledgeItem } from '../types';

export const knowledgeService = {
  async getAll(): Promise<KnowledgeItem[]> {
    const { data, error } = await supabase
      .from('school_knowledge')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching knowledge:', error);
      return [];
    }

    return data || [];
  },

  async add(item: Omit<KnowledgeItem, 'id' | 'created_at' | 'updated_at'>): Promise<KnowledgeItem | null> {
    const { data, error } = await supabase
      .from('school_knowledge')
      .insert([item])
      .select()
      .single();

    if (error) {
      console.error('Error adding knowledge:', error);
      return null;
    }

    return data;
  },

  async update(id: string, item: Partial<KnowledgeItem>): Promise<KnowledgeItem | null> {
    const { data, error } = await supabase
      .from('school_knowledge')
      .update({ ...item, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating knowledge:', error);
      return null;
    }

    return data;
  },

  async delete(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('school_knowledge')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting knowledge:', error);
      return false;
    }

    return true;
  },

  async search(query: string): Promise<KnowledgeItem[]> {
    // Simple text search for now. In a real app, we'd use vector search or full-text search.
    const { data, error } = await supabase
      .from('school_knowledge')
      .select('*')
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .limit(5);

    if (error) {
      console.error('Error searching knowledge:', error);
      return [];
    }

    return data || [];
  }
};
