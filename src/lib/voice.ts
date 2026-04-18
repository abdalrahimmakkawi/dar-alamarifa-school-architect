// Web Speech API wrapper for TTS and STT
// Supports Arabic and English
// No API key needed — uses browser/OS built-in voices

export interface VoiceOptions {
  language: 'en' | 'ar';
  rate?: number;    // 0.5 - 2.0, default 1.0
  pitch?: number;   // 0.5 - 2.0, default 1.0
  volume?: number;  // 0.0 - 1.0, default 1.0
}

let currentUtterance: SpeechSynthesisUtterance | null = null;
let currentAudio: HTMLAudioElement | null = null;
let recognition: any = null;

export function isTTSSupported(): boolean {
  return 'speechSynthesis' in window || !!(window as any).Audio;
}

export function getVoices(language: 'en' | 'ar'): SpeechSynthesisVoice[] {
  if (!('speechSynthesis' in window)) return [];
  const voices = window.speechSynthesis.getVoices();
  return voices.filter(v => v.lang.startsWith(language));
}

function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
    .replace(/[*_#`~-]/g, '') // Markdown chars
    .replace(/\n+/g, ' ') // Newlines to spaces
    .trim();
}

export async function speak(text: string, options?: VoiceOptions): Promise<void> {
  const lang = options?.language || (text.match(/[\u0600-\u06FF]/) ? 'ar' : 'en');
  const cleanText = stripMarkdown(text).split(' ').slice(0, 500).join(' ');

  stopSpeaking();

  // Try NVIDIA TTS first (High Quality)
  try {
    const response = await fetch('/api/nvidia/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: cleanText,
        language: lang,
        voice: lang === 'ar' ? "female_ar_1" : "female_en_1"
      })
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      
      return new Promise((resolve) => {
        audio.onended = () => {
          currentAudio = null;
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onerror = () => {
          currentAudio = null;
          URL.revokeObjectURL(url);
          // Fallback to Web Speech API on audio error
          speakWebSpeech(cleanText, lang, options).then(resolve);
        };
        audio.play().catch(() => {
          // Handle autoplay restrictions
          currentAudio = null;
          speakWebSpeech(cleanText, lang, options).then(resolve);
        });
      });
    }
  } catch (error) {
    console.warn('[NVIDIA TTS] Failed, falling back to browser voice:', error);
  }

  // Fallback to Web Speech API
  return speakWebSpeech(cleanText, lang, options);
}

function speakWebSpeech(text: string, lang: 'en' | 'ar', options?: VoiceOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!('speechSynthesis' in window)) {
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    currentUtterance = utterance;

    // Voice selection
    const voices = window.speechSynthesis.getVoices();
    let selectedVoice: SpeechSynthesisVoice | null = null;

    if (lang === 'ar') {
      selectedVoice = voices.find(v => v.name.includes('Arabic')) ||
                      voices.find(v => v.lang.startsWith('ar-')) ||
                      voices.find(v => v.lang.startsWith('ar_')) ||
                      null;
      utterance.rate = (options?.rate || 1.0) * 0.9;
    } else {
      selectedVoice = voices.find(v => v.lang.startsWith('en')) || null;
      utterance.rate = options?.rate || 1.0;
    }

    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.pitch = options?.pitch || 1.0;
    utterance.volume = options?.volume || 1.0;
    utterance.lang = lang === 'ar' ? 'ar-SA' : 'en-US';

    utterance.onend = () => {
      currentUtterance = null;
      resolve();
    };

    utterance.onerror = (e) => {
      currentUtterance = null;
      reject(e);
    };

    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking(): void {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

export function isSpeaking(): boolean {
  return !!currentUtterance || !!currentAudio;
}

// Speech to Text (STT)
export function isVoiceInputSupported(): boolean {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

export function startVoiceInput(
  language: 'en' | 'ar',
  onResult: (text: string) => void,
  onEnd: () => void,
  onError?: (error: string) => void
): void {
  if (!isVoiceInputSupported()) return;

  const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  
  recognition.lang = language === 'ar' ? 'ar-SD' : 'en-US';
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onresult = (event: any) => {
    const transcript = Array.from(event.results)
      .map((result: any) => result[0])
      .map((result: any) => result.transcript)
      .join('');
    onResult(transcript);
  };

  recognition.onend = () => {
    onEnd();
  };

  recognition.onerror = (event: any) => {
    console.error('Speech recognition error', event.error);
    if (onError) onError(event.error);
    onEnd();
  };

  recognition.start();
}

export function stopVoiceInput(): void {
  if (recognition) {
    recognition.stop();
    recognition = null;
  }
}
