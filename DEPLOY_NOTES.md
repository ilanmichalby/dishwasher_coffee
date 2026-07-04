# הוראות פריסה — עדכון 04.07.2026 (לפני שישי!)

## מה השתנה
1. **רענון טוקן Bosch** (`src/lib/bosch.js`) — רענון כשנותרו <10 דקות, עמיד לריצות מקבילות, retry על שמירת הטוקן החדש (איבוד refresh_token מרוטט = התחברות מחדש ידנית).
2. **קפה — לחיצה אחת** (`src/app/api/process-queue/route.js`) — הוסרה סדרת 5 הלחיצות. לחיצת SwitchBot אחת; retry רק אם קריאת ה-API של SwitchBot נכשלה. מצב "השלב הבא" נשמר ב-DB **לפני** הלחיצה, כך ש-timeout של Netlify או retry של QStash לא יגרמו ללחיצה כפולה.
3. **אבטחת Supabase** — כל קוד השרת עובר דרך `SUPABASE_SERVICE_ROLE_KEY` (`src/lib/supabase-admin.js`). שמירת טוקן = upsert לשורה קבועה אחת. הפרונט בודק חיבור דרך `/api/auth/bosch/status` ולא קורא את `bosch_auth`.
4. **מניעת כפילויות** — ה-claim של תזמון מקדם את `scheduled_time` לרגע התפיסה, כך שמנגנון שחרור התקיעות לא משחרר שורה שנתפסה לפני שניות (זה מקור הריצות הכפולות של 02:00). בנוסף: חסימת תזמון כפול לאותו מכשיר בחלון של ±5 דקות (כל המכשירים, לא רק קפה).

## סדר פריסה — חשוב!
1. **לפני הכל:** ב-Netlify → Environment variables → להוסיף `SUPABASE_SERVICE_ROLE_KEY`
   (מ-Supabase Dashboard → Settings → API → service_role secret).
2. לדחוף ל-main ולוודא שה-build ב-Netlify עבר.
3. לבדוק שהדשבורד עולה ומראה מחובר (`/api/auth/bosch/status` מחזיר `connected: true`).
4. **רק אז** להריץ ב-Supabase SQL Editor את
   `supabase_migrations/2026-07-04_secure_bosch_auth.sql`
   (מוחק את ה-policies הפתוחות על `bosch_auth`; RLS נשאר דלוק בלי גישה ציבורית).
5. לבדוק שוב שהדשבורד עדיין מראה מחובר ושמשיכת מדיחים עובדת.

אם מריצים את ה-SQL לפני שלב 1 — חוזרים לתקלת "No Bosch authentication found" של השבת שעברה.

## בדיקה בטוחה (בלי להפעיל מכשירים)
- תזמון קפה "הכנה בלבד" ביום חול לשעה קרובה, ולעקוב ב-`schedule_events`:
  צריך להופיע `coffee.press.success` **אחד** ואז `schedule.completed` (בתזמון מלא: `coffee.power_off.next_scheduled` אחד).
- ניסיון ליצור פעמיים אותו תזמון מדיח → הבקשה השנייה צריכה להיחסם עם 409.

## הערות
- `COFFEE_PRESS_ATTEMPTS` כבר לא בשימוש — אפשר למחוק מ-Netlify.
- policies של `schedules`/`schedule_events` נשארו פתוחים לקריאה — הדשבורד קורא אותם ישירות (אין שם סודות). אפשר להקשיח בהמשך.
