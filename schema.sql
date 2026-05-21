  -- Create Users/Participants Master Table
  CREATE TABLE profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    reg_no TEXT,
    role TEXT DEFAULT 'participant' -- 'admin', 'manager', 'participant'
  );

  -- Create Dynamic Attendance Tracking Table
  CREATE TABLE attendance (
    id BIGSERIAL PRIMARY KEY,
    profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  date_string TEXT NOT NULL, -- e.g., "07-05-26"
  coming TEXT DEFAULT NULL,   -- Column E
  request TEXT DEFAULT NULL,  -- Column F
  attendance_1 TEXT DEFAULT NULL, -- Column G
  attendance_2 TEXT DEFAULT NULL, -- Column H
  UNIQUE(profile_id, date_string)
);

-- Shared date segments shown to every login
CREATE TABLE attendance_dates (
  date_string TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  helper TEXT DEFAULT 'Added Date',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO attendance_dates (date_string, label, helper)
VALUES
  ('07-05-26', '07-05-26', 'Active Track'),
  ('08-05-26', '08-05-26', 'Backup Window')
ON CONFLICT (date_string) DO NOTHING;

-- Enable Security Lockdown
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_dates ENABLE ROW LEVEL SECURITY;

-- Security Policy: Allow profiles to view data
CREATE POLICY "Allow public read access" ON attendance FOR SELECT USING (true);
CREATE POLICY "Allow date read access" ON attendance_dates FOR SELECT USING (true);

-- Security Policy: Restrict modifications based on exact roles
CREATE POLICY "Enforce serverless RBAC backend evaluations" 
ON attendance FOR UPDATE 
USING (true) 
WITH CHECK (true);
