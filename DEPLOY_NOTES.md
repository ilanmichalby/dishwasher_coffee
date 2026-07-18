# הוראות פריסה — עדכון 18.07.2026 (רשת ביטחון לקפה)

## הבעיה שתוקנה — "נדלקה אבל אין קפה"
הכנת קפה מלאה היא רצף של 3 שלבים (הדלקה → לחיצה → כיבוי), וכל מעבר בין שלב לשלב
הועבר **אך ורק** דרך משלוח QStash בודד. אם המשלוח של שלב ה-PRESS אבד/התעכב, או
ש-Netlify עשה timeout באמצע — השורה נשארה `pending` עם זמן עתידי **בלי שאף אחד
יאסוף אותה**: המכונה נדלקה אבל לא הכינה קפה, ובלי שגיאה גלויה. זה מה שקרה בשבת.

## מה השתנה
1. **רשת ביטחון תקופתית** (`.github/workflows/process-queue-cron.yml`) — GitHub Action
   שרץ כל 5 דקות וקורא ל-`/api/process-queue`. הוא אוסף מחדש כל שורת `pending`
   שהגיע זמנה ומקדם אותה שלב אחד. ה-claim האטומי בראוט מבטיח שאין הדלקה/לחיצה כפולה
   גם אם ה-cron ומשלוח QStash רצים במקביל. QStash נשאר הנתיב המהיר (~60 שנ׳); ה-cron
   הוא רשת הביטחון — גם בהעדר QStash מוחלט הרצף מסתיים (הדלקה → +5 דק׳ לחיצה → +5 דק׳ כיבוי).
2. **מסירת QStash עמידה לכשל** (`src/app/api/process-queue/route.js`) — כל תזמון
   של השלב הבא עטוף ב-`safeScheduleWebhook`; חריגה של QStash כבר לא מפילה את השלב
   באמצע. בנוסף, אירוע `coffee.*.next_scheduled` כולל עכשיו `qstash: scheduled |
   skipped_fallback_cron`, כך שבפעם הבאה רואים בדשבורד אם המשלוח נכשל.

## נדרש לפני שהתיקון פועל — חשוב!
1. ב-GitHub → Settings → Secrets and variables → Actions → להוסיף שני secrets:
   - `APP_URL` — כתובת הפרודקשן, למשל `https://your-site.netlify.app`
   - `CRON_SECRET` — **אותו ערך** שמוגדר כבר ב-Netlify Environment variables.
2. **ל-merge ל-main** — GitHub Actions מריץ טריגרי `schedule` **רק מהברנץ׳ הראשי**.
   כל עוד זה בברנץ׳ פיצ׳ר, ה-cron לא ירוץ.
3. לוודא: בטאב Actions → להריץ ידנית (`workflow_dispatch`) ולראות `HTTP 200`.

## הערה
GitHub Actions cron יכול להתעכב מספר דקות תחת עומס. זה בסדר כרשת ביטחון (עדיף קפה
באיחור של דקות מאשר "אין קפה"). למי שרוצה גיבוי אמין יותר — אפשר להוסיף גם QStash
Schedule (cron) שקורא לאותו URL עם ה-`CRON_SECRET`; אותו ראוט, בלי שינוי קוד.

---

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
