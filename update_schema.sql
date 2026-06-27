-- הוספת עמודה של מזהה המדיח (כדי לתמוך במספר מדיחים - חלבי ובשרי)
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS appliance_id TEXT;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS appliance_id TEXT;

CREATE TABLE IF NOT EXISTS schedule_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES schedules(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
