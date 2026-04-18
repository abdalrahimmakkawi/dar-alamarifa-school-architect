-- Dar Alamarifa School Architect: Supabase Schema Upgrade
-- Run this in your Supabase SQL Editor

-- 1. Students Table
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  grade TEXT NOT NULL,
  status TEXT CHECK (status IN ('active', 'inactive', 'displaced')) DEFAULT 'active',
  "feesPaid" NUMERIC DEFAULT 0,
  "totalFees" NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Agent Messages Table (Multi-Agent Chat History)
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id TEXT NOT NULL,
  role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
  content TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  user_id TEXT,
  user_role TEXT CHECK (user_role IN ('admin', 'staff')),
  is_auto BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Reports Table (Autonomous Generation)
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT CHECK (type IN ('weekly', 'monthly', 'custom')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  generated_by TEXT NOT NULL,
  is_auto BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Alerts Table (Autonomous Monitoring)
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Enable Realtime for Chat
ALTER PUBLICATION supabase_realtime ADD TABLE agent_messages;

-- 6. Basic RLS (Row Level Security)
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid "already exists" errors
DROP POLICY IF EXISTS "Allow authenticated read students" ON students;
DROP POLICY IF EXISTS "Admins full access students" ON students;
DROP POLICY IF EXISTS "Admins full access messages" ON agent_messages;
DROP POLICY IF EXISTS "Admins full access reports" ON reports;
DROP POLICY IF EXISTS "Admins full access alerts" ON alerts;
DROP POLICY IF EXISTS "Staff read own messages" ON agent_messages;
DROP POLICY IF EXISTS "Staff insert own messages" ON agent_messages;

-- Re-create policies
-- Allow all authenticated users to read students
CREATE POLICY "Allow authenticated read students" ON students FOR SELECT TO authenticated USING (true);

-- Allow admins full access to everything
-- Note: Replace with your actual admin emails
CREATE POLICY "Admins full access students" ON students TO authenticated 
  USING (auth.jwt() ->> 'email' IN ('abdalrahimmakkawi@gmail.com', 'daralmarifaalsodania@gmail.com'));

CREATE POLICY "Admins full access messages" ON agent_messages TO authenticated 
  USING (auth.jwt() ->> 'email' IN ('abdalrahimmakkawi@gmail.com', 'daralmarifaalsodania@gmail.com'));

CREATE POLICY "Admins full access reports" ON reports TO authenticated 
  USING (auth.jwt() ->> 'email' IN ('abdalrahimmakkawi@gmail.com', 'daralmarifaalsodania@gmail.com'));

CREATE POLICY "Admins full access alerts" ON alerts TO authenticated 
  USING (auth.jwt() ->> 'email' IN ('abdalrahimmakkawi@gmail.com', 'daralmarifaalsodania@gmail.com'));

-- Staff can read their own messages and all students
CREATE POLICY "Staff read own messages" ON agent_messages FOR SELECT TO authenticated 
  USING (user_id = auth.jwt() ->> 'email');

CREATE POLICY "Staff insert own messages" ON agent_messages FOR INSERT TO authenticated 
  WITH CHECK (user_id = auth.jwt() ->> 'email');
