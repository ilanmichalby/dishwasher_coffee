-- 1. Create bosch_auth table (Stores Home Connect Tokens)
CREATE TABLE IF NOT EXISTS bosch_auth (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create schedules table
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
    program_key TEXT NOT NULL,
    options JSONB DEFAULT '{}'::jsonb, -- Store additional options if needed (like VarioSpeed)
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_error TEXT
);

-- 3. Create schedule_events table (Detailed execution log)
CREATE TABLE IF NOT EXISTS schedule_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create templates table
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    program_key TEXT NOT NULL,
    default_time_of_day TEXT -- e.g. "22:00"
);

-- Insert some default templates (you can adjust these later)
INSERT INTO templates (name, program_key, default_time_of_day) VALUES
('Eco 50°', 'Dishcare.Dishwasher.Program.Eco50', '22:00'),
('Auto 45-65°', 'Dishcare.Dishwasher.Program.Auto2', '21:00')
ON CONFLICT DO NOTHING;

-- Note: Since this is for your personal use, you can just disable RLS (Row Level Security) 
-- on these tables via the Supabase dashboard, or leave them as is if you are the only one calling the API via a secret key.
