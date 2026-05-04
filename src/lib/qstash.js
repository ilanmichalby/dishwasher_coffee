import { Client } from "@upstash/qstash";

/**
 * Utility to schedule tasks with Upstash QStash
 */
export const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN || "",
});

/**
 * Schedules a call to a specific URL at a specific time
 * @param {string} url - The URL to call (Webhook)
 * @param {string} scheduledTimeIso - The ISO timestamp when the task should run
 * @param {Object} body - Optional body to send to the webhook
 */
export async function scheduleWebhook(url, scheduledTimeIso, body = {}) {
  if (!process.env.QSTASH_TOKEN) {
    console.warn("QSTASH_TOKEN is missing in environment variables. Scheduling skipped.");
    return null;
  }

  // Calculate delay in seconds
  const targetTime = new Date(scheduledTimeIso).getTime();
  const now = Date.now();
  const delaySeconds = Math.max(0, Math.floor((targetTime - now) / 1000));

  console.log(`Scheduling webhook to ${url} with delay of ${delaySeconds} seconds`);

  try {
    const result = await qstashClient.publishJSON({
      url: url,
      body: body,
      delay: delaySeconds,
      // Add a header to identify the request source
      headers: {
        "x-qstash-source": "dishwasher-app",
      }
    });

    return result;
  } catch (error) {
    console.error("QStash scheduling failed:", error);
    throw error;
  }
}
