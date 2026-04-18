# Dar Alamarifa School Architect

Modern AI-powered management system for Dar Alamarifa Elementary and Secondary School.

## Features
- **AI Specialist Agents**: Specialized agents for Comms, Analytics, Strategy, Legal, and Tutoring.
- **Bilingual Interface**: Seamless switching between English and Sudanese Arabic.
- **Desktop Application**: Standalone installable app for Windows/Mac.
- **Supabase Integration**: Real-time database and secure authentication.
- **NVIDIA AI Proxy**: High-performance reasoning using NVIDIA NIM APIs.

## Installation & Setup

### 1. Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### 2. Environment Configuration
Create a `.env` file in the root directory (based on `.env.example`) and add your keys:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NVIDIA_API_KEY` (or specialist keys)
- `GEMINI_API_KEY`

### 3. Local Development (Web)
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### 4. Desktop Application (Electron)
**Development Mode:**
```bash
npm run app:dev
```

**Build Installer:**
```bash
npm run app:build
```
The installer will be generated in the `release/` folder.

## Project Structure
- `src/`: Frontend React source code.
- `electron/`: Desktop application main and preload scripts.
- `server.ts`: Custom Express server with NVIDIA proxy logic.
- `scripts/`: Build and installation utilities.

## Deployment
While optimized for local installation via Electron, it can also be containerized or hosted on any Node.js compatible platform.

---
© 2026 Dar Alamarifa School
