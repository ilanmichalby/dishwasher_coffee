import { NextResponse } from 'next/server';

// One pre-Shabbat/chag verdict: coffee AND dishwashers, in a single answer.
//
// Two callers, one code path:
//   - the "בדוק והדפס" button, right before the schedule sheet is printed;
//   - the QStash follow-up enqueued 45 minutes after a scheduling session
//     starts (see /api/schedule), which lands while there is still time to fix
//     something by hand and asks GitHub to email on a problem.
//
// It deliberately does NOT reimplement either check — it calls the two existing
// endpoints with CRON_SECRET server-side, so there is exactly one definition of
// "healthy" and the emailed GitHub run and this page can never disagree.

export const dynamic = 'force-dynamic';

function baseUrlFrom(request) {
  const host = request.headers.get('host');
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  return `${protocol}://${host}`;
}

// The browser button has no secret to present. Accept CRON_SECRET (QStash, CI)
// or a same-origin browser request. Same-origin is weak — it stops a random
// cross-site fetch, not a deliberate curl — but this endpoint is read-only and
// returns no secrets. Real auth for the whole app is tracked separately.
function authorize(request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (secret && authHeader === `Bearer ${secret}`) return true;

  const host = request.headers.get('host');
  const origin = request.headers.get('origin') || request.headers.get('referer');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function runCheck(base, path, secret) {
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    });
    const body = await res.json();
    return { ok: res.status === 200, status: res.status, ...body };
  } catch (e) {
    // A check we could not run is not a check that passed.
    return { ok: false, status: 0, healthy: false, message: `הבדיקה לא רצה: ${e.message}` };
  }
}

// Telegram is the primary channel: one HTTPS call, a push notification on the
// phone rather than an email discovered after Shabbat, no SMTP, no app
// password, and no token that quietly expires in a year. Configure
// TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID to use it.
async function notifyViaTelegram(problems, warnings) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { channel: 'telegram', notified: false, error: 'not_configured' };

  const lines = ['⚠️ *לפני שבת/חג: משהו לא מוכן*', ''];
  for (const p of problems) lines.push(`🔴 ${p}`);
  for (const w of warnings) lines.push(`🟡 ${w}`);
  lines.push('', '_יש עדיין זמן לתקן. בשבת כבר לא._');

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: lines.join('\n'), parse_mode: 'Markdown' }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('Telegram sendMessage failed:', res.status, text);
      return { channel: 'telegram', notified: false, error: `telegram_${res.status}` };
    }
    return { channel: 'telegram', notified: true };
  } catch (e) {
    console.error('Telegram sendMessage threw:', e.message);
    return { channel: 'telegram', notified: false, error: e.message };
  }
}

// Fallback only. Triggers the GitHub workflow, whose own failure notification
// reaches the repo owner without any SMTP configuration. Kept because an alert
// that silently fails to send is the exact bug this whole feature exists to
// prevent — if Telegram is unconfigured or down, something must still shout.
async function notifyViaGitHub(reason) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY || 'ilanmichalby/dishwasher_coffee';
  if (!token) {
    console.warn('GITHUB_DISPATCH_TOKEN missing — cannot raise the email alert.');
    return { notified: false, error: 'missing_token' };
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({
        event_type: 'pre-shabbat-unhealthy',
        client_payload: { reason: String(reason).slice(0, 500) },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('repository_dispatch failed:', res.status, text);
      return { notified: false, error: `github_${res.status}` };
    }
    return { notified: true };
  } catch (e) {
    console.error('repository_dispatch threw:', e.message);
    return { notified: false, error: e.message };
  }
}

export async function POST(request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
  }

  const params = new URL(request.url).searchParams;
  // The scheduled verification notifies and is strict; the button does
  // neither — you are standing in front of the screen, still loading, and the
  // banner is the whole point.
  const wantsNotify = params.get('notify') === '1';
  const strict = params.get('strict') === '1' || wantsNotify;

  const base = baseUrlFrom(request);
  const [coffee, dishwashers] = await Promise.all([
    runCheck(base, '/api/health/coffee', secret),
    runCheck(base, `/api/health/dishwashers${strict ? '?strict=1' : ''}`, secret),
  ]);

  const healthy = coffee.ok && dishwashers.ok;

  const problems = [];
  if (!coffee.ok) problems.push(`קפה: ${coffee.message || 'לא תקין'}`);
  if (!dishwashers.ok) problems.push(`מדיחים: ${dishwashers.message || 'לא תקין'}`);

  // Surfaced even when healthy, so the button can show the amber reminder.
  const warnings = strict ? [] : (dishwashers.warnings || []);

  let notification = null;
  if (!healthy && wantsNotify) {
    notification = await notifyViaTelegram(problems, warnings);
    // An unconfigured or failing Telegram must not mean silence.
    if (!notification.notified) {
      const fallback = await notifyViaGitHub(problems.join(' | '));
      notification = { ...notification, fallback };
    }
  }

  return NextResponse.json({
    healthy,
    strict,
    problems,
    warnings,
    coffee,
    dishwashers,
    notification,
    checked_at: new Date().toISOString(),
    message: healthy
      ? (warnings.length > 0
          ? `מוכן להדפסה. תזכורת: ${warnings.join(' | ')}`
          : 'הכל מוכן — הקפה והמדיחים נבדקו ותקינים. אפשר להדפיס.')
      : problems.join(' | '),
  }, { status: healthy ? 200 : 503 });
}
