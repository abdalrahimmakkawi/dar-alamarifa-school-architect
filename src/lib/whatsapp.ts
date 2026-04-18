import axios from 'axios';

// Meta Cloud API direct integration
const WHATSAPP_TOKEN = (import.meta as any).env?.VITE_WHATSAPP_TOKEN || process.env.VITE_WHATSAPP_TOKEN;
const WHATSAPP_PHONE_ID = (import.meta as any).env?.VITE_WHATSAPP_PHONE_ID || process.env.VITE_WHATSAPP_PHONE_ID;

const API_VERSION = 'v18.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}/${WHATSAPP_PHONE_ID}/messages`;

export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    console.error('WhatsApp credentials missing');
    return false;
  }

  try {
    const response = await axios.post(
      BASE_URL,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.status === 200;
  } catch (error) {
    console.error('Failed to send WhatsApp message:', error);
    return false;
  }
}

export async function sendWhatsAppTemplate(to: string, templateName: string, languageCode: string = 'ar', components: any[] = []): Promise<boolean> {
  if (!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID) {
    console.error('WhatsApp credentials missing');
    return false;
  }

  try {
    const response = await axios.post(
      BASE_URL,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          components
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.status === 200;
  } catch (error) {
    console.error('Failed to send WhatsApp template:', error);
    return false;
  }
}
