import { openDB, IDBPDatabase } from 'idb';
import { supabase } from './supabase';

// Queue actions when offline, execute when back online
export interface QueuedAction {
  id: string;
  type: 'agent_message' | 'save_student' | 'save_report' | 'whatsapp_reply';
  payload: any;
  timestamp: string;
  retries: number;
}

const DB_NAME = 'dar_alamarifa_offline';
const STORE_NAME = 'action_queue';

let db: IDBPDatabase | null = null;

async function getDB() {
  if (db) return db;
  db = await openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    },
  });
  return db;
}

export const offlineQueue = {
  async saveToQueue(type: QueuedAction['type'], payload: any) {
    const db = await getDB();
    const action: QueuedAction = {
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: new Date().toISOString(),
      retries: 0,
    };
    await db.add(STORE_NAME, action);
    
    if (!navigator.onLine) {
      console.log(`[Offline] Action ${type} queued.`);
    } else {
      this.processQueue();
    }
  },

  async processQueue() {
    if (!navigator.onLine) return;
    
    const db = await getDB();
    const actions = await db.getAll(STORE_NAME);
    
    if (actions.length === 0) return;

    console.log(`[Sync] Connection restored — syncing ${actions.length} pending actions`);

    for (const action of actions) {
      try {
        await this.executeAction(action);
        await db.delete(STORE_NAME, action.id);
      } catch (error) {
        console.error(`[Sync] Failed to process action ${action.id}:`, error);
        action.retries += 1;
        if (action.retries > 3) {
          await db.delete(STORE_NAME, action.id); // Give up after 3 retries
        } else {
          await db.put(STORE_NAME, action);
        }
      }
    }
  },

  async executeAction(action: QueuedAction) {
    switch (action.type) {
      case 'agent_message':
        await supabase.from('agent_messages').insert([action.payload]);
        break;
      case 'save_student':
        await supabase.from('students').upsert([action.payload]);
        break;
      case 'save_report':
        await supabase.from('reports').insert([action.payload]);
        break;
      // Add more cases as needed
    }
  },

  isOnline() {
    return navigator.onLine;
  }
};

// Listen for online status
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => offlineQueue.processQueue());
}
