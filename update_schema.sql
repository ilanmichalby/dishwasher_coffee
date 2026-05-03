-- הוספת עמודה של מזהה המדיח (כדי לתמוך במספר מדיחים - חלבי ובשרי)
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS appliance_id TEXT;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS appliance_id TEXT;
