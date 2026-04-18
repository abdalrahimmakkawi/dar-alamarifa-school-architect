import { Student } from '../types';

/**
 * AES-256-GCM encryption for sensitive fields.
 * Key derived from VITE_ENCRYPTION_KEY env variable.
 */

const ENCRYPTION_KEY = (import.meta as any).env?.VITE_ENCRYPTION_KEY || process.env.VITE_ENCRYPTION_KEY;

async function getEncryptionKey(keyHex: string): Promise<CryptoKey> {
  const keyBuffer = new Uint8Array(keyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  return await window.crypto.subtle.importKey(
    'raw',
    keyBuffer,
    'AES-GCM',
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encrypt(plaintext: string): Promise<string> {
  if (!ENCRYPTION_KEY) throw new Error('VITE_ENCRYPTION_KEY is not defined');
  
  const key = await getEncryptionKey(ENCRYPTION_KEY);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  
  const encrypted = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  
  const encryptedArray = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + encryptedArray.length);
  combined.set(iv);
  combined.set(encryptedArray, iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(ciphertext: string): Promise<string> {
  if (!ENCRYPTION_KEY) throw new Error('VITE_ENCRYPTION_KEY is not defined');
  
  const key = await getEncryptionKey(ENCRYPTION_KEY);
  const combined = new Uint8Array(atob(ciphertext).split('').map(char => char.charCodeAt(0)));
  
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  
  const decrypted = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );
  
  return new TextDecoder().decode(decrypted);
}

export async function encryptStudent(student: Partial<Student>): Promise<Partial<Student>> {
  const encrypted = { ...student };
  
  // Fields to encrypt: parent_phone, parent_email, student notes
  // Note: These fields should be added to the Student type if they exist in DB
  if ((student as any).parent_phone) {
    (encrypted as any).parent_phone = await encrypt((student as any).parent_phone);
  }
  if ((student as any).parent_email) {
    (encrypted as any).parent_email = await encrypt((student as any).parent_email);
  }
  if ((student as any).notes) {
    (encrypted as any).notes = await encrypt((student as any).notes);
  }
  
  return encrypted;
}

export async function decryptStudent(student: Student): Promise<Student> {
  const decrypted = { ...student };
  
  try {
    if ((student as any).parent_phone) {
      (decrypted as any).parent_phone = await decrypt((student as any).parent_phone);
    }
    if ((student as any).parent_email) {
      (decrypted as any).parent_email = await decrypt((student as any).parent_email);
    }
    if ((student as any).notes) {
      (decrypted as any).notes = await decrypt((student as any).notes);
    }
  } catch (error) {
    console.error('Failed to decrypt student data. Ensure encryption key is correct.', error);
  }
  
  return decrypted;
}
