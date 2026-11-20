// All schedule input/output is in Israel time, regardless of the browser's
// own time zone (e.g. when the owner is travelling abroad).
export const IL_TZ = 'Asia/Jerusalem';

// Israel's UTC offset (minutes) at a given instant, DST-aware.
function israelOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: IL_TZ, hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - at.getTime()) / 60000);
}

// "2026-11-20" + "07:00" (Israel wall clock) -> UTC ISO string.
export function israelToISO(date: string, time: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes so a date near a DST switch resolves correctly.
  let ts = naive - israelOffsetMinutes(new Date(naive)) * 60000;
  ts = naive - israelOffsetMinutes(new Date(ts)) * 60000;
  return new Date(ts).toISOString();
}

// UTC ISO -> { date: "YYYY-MM-DD", time: "HH:MM" } in Israel.
export function isoToIsrael(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-CA', { timeZone: IL_TZ });
  const time = d.toLocaleTimeString('en-GB', { timeZone: IL_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return { date, time };
}

// Israel calendar date, offset by N days from today.
export function israelDate(addDays = 0): string {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: IL_TZ });
  const [y, m, d] = today.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + addDays)).toISOString().slice(0, 10);
}
