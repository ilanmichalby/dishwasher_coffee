// Shabbat entry/exit times for the printed fridge sheet. The numbers come from
// the Yerucham Shabbat app (https://ilanmichalby.github.io/shabbat-yerucham/),
// which reads this same public JSON, so the two always agree.

const DATA_URL =
  'https://raw.githubusercontent.com/ilanmichalby/shabbat-yerucham/main/docs/shabbat-times.json'

// A Shabbat further out than this is not what the sheet is for.
const MAX_DAYS_AHEAD = 7

export interface ShabbatTimes {
  parsha: string
  dateISO: string // the Saturday
  candleLighting: string // Friday evening, HH:MM
  sunset: string // Friday sunset, HH:MM
  havdalah: string // Saturday night, HH:MM
}

// YYYY-MM-DD in Israel, so a late-evening print is not judged by the UTC date.
const israelToday = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })

const daysBetween = (fromISO: string, toISO: string) =>
  Math.round((Date.parse(toISO) - Date.parse(fromISO)) / 86_400_000)

// Returns null on any failure. A sheet without the times is fine; a sheet with
// wrong times on the fridge is not, so there is no guessing and no fallback.
export async function fetchUpcomingShabbat(): Promise<ShabbatTimes | null> {
  try {
    const res = await fetch(`${DATA_URL}?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    const json = await res.json()

    const today = israelToday()
    const next = ((json.shabbats ?? []) as ShabbatTimes[])
      .filter(s => s.dateISO >= today && s.candleLighting && s.havdalah)
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO))[0]

    if (!next || daysBetween(today, next.dateISO) > MAX_DAYS_AHEAD) return null
    return next
  } catch {
    return null
  }
}
