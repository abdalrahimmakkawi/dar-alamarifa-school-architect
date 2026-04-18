import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import http from "http";
import https from "https";
import compression from "compression";
import "dotenv/config";
import agentRoutes from "./src/routes/agent";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const httpsAgent = new https.Agent({ keepAlive: true });
const httpAgent = new http.Agent({ keepAlive: true });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use("/api/agents", agentRoutes);

  // Audit and Security Event Endpoints
  app.post("/api/audit", async (req, res) => {
    const { action, performedBy, targetId, oldValue, newValue } = req.body;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: "Supabase service role not configured" });
    }

    try {
      await axios.post(`${supabaseUrl}/rest/v1/audit_log`, {
        action,
        performed_by: performedBy,
        target_id: targetId,
        old_value: oldValue,
        new_value: newValue
      }, {
        headers: {
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        }
      });
      res.status(204).end();
    } catch (error: any) {
      console.error("[Audit Log] Error:", error.message);
      res.status(500).json({ error: "Failed to log audit action" });
    }
  });

  app.post("/api/security-event", async (req, res) => {
    const { eventType, userEmail, details } = req.body;
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: "Supabase service role not configured" });
    }

    try {
      await axios.post(`${supabaseUrl}/rest/v1/security_events`, {
        event_type: eventType,
        user_email: userEmail,
        details
      }, {
        headers: {
          "apikey": serviceRoleKey,
          "Authorization": `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        }
      });
      res.status(204).end();
    } catch (error: any) {
      console.error("[Security Event] Error:", error.message);
      res.status(500).json({ error: "Failed to log security event" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // NVIDIA Proxy Route
  app.post("/api/nvidia/chat", async (req, res) => {
    const { agentId, model, messages, temperature, max_tokens, stream } = req.body;
    
    // Map agentId to the correct server-side environment variable
    const keyMap: Record<string, string | undefined> = {
      director: process.env.NVIDIA_KEY_DIRECTOR || process.env.VITE_NVIDIA_KEY_DIRECTOR,
      analytics: process.env.NVIDIA_KEY_ANALYTICS || process.env.VITE_NVIDIA_KEY_ANALYTICS,
      comms: process.env.NVIDIA_KEY_COMMS || process.env.VITE_NVIDIA_KEY_COMMS,
      faq: process.env.NVIDIA_KEY_FAQ || process.env.VITE_NVIDIA_KEY_FAQ,
      strategy: process.env.NVIDIA_KEY_STRATEGY || process.env.VITE_NVIDIA_KEY_STRATEGY,
      tutor: process.env.NVIDIA_KEY_TUTOR || process.env.VITE_NVIDIA_KEY_TUTOR,
      enrollment: process.env.NVIDIA_KEY_ENROLLMENT || process.env.VITE_NVIDIA_KEY_ENROLLMENT,
      legal: process.env.NVIDIA_KEY_LEGAL || process.env.VITE_NVIDIA_KEY_LEGAL,
    };

    const isValidKey = (key: string | undefined) => {
      if (!key) return false;
      const k = key.trim();
      return k !== "" && k !== "undefined" && !k.toLowerCase().includes("nvapi-xxxx");
    };

    const keysToTry = Array.from(new Set([
      (agentId ? keyMap[agentId] : null),
      process.env.NVIDIA_KEY_DIRECTOR,
      process.env.VITE_NVIDIA_KEY_DIRECTOR,
      process.env.NVIDIA_API_KEY,
      process.env.VITE_NVIDIA_API_KEY
    ].filter(isValidKey))) as string[];

    if (keysToTry.length === 0) {
      console.error(`[NVIDIA Proxy] No valid API Keys found for agent: ${agentId}.`);
      return res.status(500).json({ error: `NVIDIA API Key is not configured on the server. Please add NVIDIA_API_KEY to your secrets.` });
    }

    let lastError: any = null;
    const endpoints = [
      "https://integrate.api.nvidia.com/v1/chat/completions",
      "https://ai.api.nvidia.com/v1/chat/completions",
      "https://api.nvidia.com/v1/chat/completions"
    ];

    for (const apiKey of keysToTry) {
      const cleanKey = apiKey.replace(/^Bearer\s+/i, "");
      
      for (const endpoint of endpoints) {

        // Try model variations to handle 404s and EOL models
        const pureModel = model?.includes('/') ? model.split('/')[1] : (model || "llama-3.1-70b-instruct");
        
        // Filter out known EOL models
        const isEOL = (m: string) => m.includes('gemma-2-27b') || m.includes('gemma-2-9b');

        const modelVariations = Array.from(new Set([
          model,
          `meta/${pureModel}`,
          `nvidia/${pureModel}`,
          `mistralai/${pureModel}`,
          `meta/llama-3.3-70b-instruct`,
          `meta/llama-3.1-70b-instruct`,
          `nvidia/llama-3.1-nemotron-70b-instruct`,
          pureModel
        ].filter(m => m && !isEOL(m))));

        for (const modelVariant of modelVariations) {
          try {
            console.log(`[NVIDIA Proxy] Trying ${endpoint} | Model: ${modelVariant} | Key: ${cleanKey.substring(0, 10)}...`);
            const response = await axios.post(endpoint, {
              model: modelVariant,
              messages,
              temperature: temperature ?? 0.7,
              max_tokens: max_tokens ?? 2048,
              stream: stream ?? false
            }, {
              timeout: 60000, 
              httpsAgent,
              headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": `Bearer ${cleanKey}`
              }
            });

            console.log(`[NVIDIA Proxy] SUCCESS! Endpoint: ${endpoint} | Model: ${modelVariant}`);
            return res.json(response.data);
          } catch (error: any) {
            const errorMsg = error.response?.data?.detail || error.response?.data?.message || error.message;
            const status = error.response?.status;
            
            console.warn(`[NVIDIA Proxy] FAILED: ${endpoint} | Model: ${modelVariant} | Status: ${status} | Error: ${typeof errorMsg === 'object' ? JSON.stringify(errorMsg) : errorMsg}`);
            
            lastError = { status: status || 500, detail: errorMsg };
            
            if (status === 401) break; // Try next key
            continue; // Try next model variation or endpoint
          }
        }
        if (lastError?.status === 401) break;
      }
    }

    // If we get here, all keys and endpoints failed
    console.error(`[NVIDIA Proxy] All keys/endpoints failed for ${agentId}. Last error:`, lastError);
    res.status(lastError?.status || 500).json({ 
      error: "NVIDIA API Failure", 
      detail: lastError?.detail || "All provided keys and endpoints failed"
    });
  });

  // NVIDIA TTS Proxy Route
  app.post("/api/nvidia/tts", async (req, res) => {
    const { input, voice, language } = req.body;
    
    const apiKey = process.env.VITE_NVIDIA_KEY_TTS || 
                   process.env.NVIDIA_KEY_TTS || 
                   process.env.VITE_NVIDIA_KEY_DIRECTOR || 
                   process.env.NVIDIA_API_KEY;

    if (!apiKey || apiKey.includes("nvapi-xxxx")) {
      return res.status(500).json({ error: "NVIDIA TTS API Key not configured" });
    }

    const cleanKey = apiKey.replace(/^Bearer\s+/i, "");
    const endpoints = [
      "https://integrate.api.nvidia.com/v1/audio/speech",
      "https://ai.api.nvidia.com/v1/audio/speech"
    ];
    const models = [
      "nvidia/magpie-tts-multilingual",
      "magpie-tts-multilingual"
    ];

    let lastError: any = null;

    for (const endpoint of endpoints) {
      for (const modelName of models) {
        try {
          console.log(`[NVIDIA TTS] Calling ${endpoint} for ${modelName}...`);
          const response = await axios.post(endpoint, {
            model: modelName,
            input,
            voice: voice || (language === 'ar' ? "female_ar_1" : "female_en_1"),
            response_format: "mp3"
          }, {
            timeout: 30000,
            httpsAgent,
            headers: {
              "Authorization": `Bearer ${cleanKey}`,
              "Accept": "audio/mpeg",
              "Content-Type": "application/json"
            },
            responseType: "arraybuffer"
          });

          console.log(`[NVIDIA TTS] Success with ${endpoint} and ${modelName}`);
          res.set("Content-Type", "audio/mpeg");
          return res.send(response.data);
        } catch (error: any) {
          const errorMsg = error.response?.data?.toString() || error.message;
          const status = error.response?.status;
          console.warn(`[NVIDIA TTS] Failed at ${endpoint} with ${modelName} (status ${status}):`, errorMsg);
          
          lastError = { status: status || 500, detail: errorMsg };
          if (status === 404) continue;
          break;
        }
      }
    }

    res.status(lastError?.status || 500).json({ 
      error: "NVIDIA TTS Failure", 
      detail: lastError?.detail || "All TTS endpoints failed"
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath, {
      maxAge: '1d',
      etag: true,
      lastModified: true
    }));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"), {
        maxAge: '1h'
      });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
