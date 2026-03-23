const BASE_URL = "https://api.cron-job.org";

function getApiKey(): string {
  const key = process.env.CRONJOB_API_KEY;
  if (!key) throw new Error("CRONJOB_API_KEY is not set");
  return key;
}

function getAppUrl(): string {
  const vercelUrl = process.env.VERCEL_URL;
  if (!vercelUrl) throw new Error("VERCEL_URL is not set");
  return `https://${vercelUrl}`;
}

/** Format a Date as YYYYMMDDhhmmss (as a number) for cron-job.org expiresAt */
function toExpiresAt(date: Date): number {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getUTCFullYear();
  const mo = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const mi = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  return Number(`${y}${mo}${d}${h}${mi}${s}`);
}

export async function createCronJob(params: {
  title: string;
  url: string;
  scheduledAt: Date;
  authHeader: string;
}): Promise<number> {
  const apiKey = getApiKey();
  const { title, url, scheduledAt, authHeader } = params;

  // Convert UTC time to ART (UTC-3) for schedule fields
  const artOffset = -3 * 60; // minutes
  const artDate = new Date(scheduledAt.getTime() + artOffset * 60 * 1000);
  const hour = artDate.getUTCHours();
  const minute = artDate.getUTCMinutes();
  const mday = artDate.getUTCDate();
  const month = artDate.getUTCMonth() + 1; // 1-based

  const expiresAt = toExpiresAt(new Date(scheduledAt.getTime() + 2 * 60 * 1000));

  const body = {
    job: {
      url,
      title,
      enabled: true,
      requestMethod: 0, // GET
      extendedData: {
        headers: { Authorization: authHeader },
      },
      schedule: {
        timezone: "America/Argentina/Buenos_Aires",
        hours: [hour],
        minutes: [minute],
        mdays: [mday],
        months: [month],
        wdays: [-1],
        expiresAt,
      },
    },
  };

  const res = await fetch(`${BASE_URL}/jobs`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`cron-job.org createCronJob failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const jobId = data?.jobId ?? data?.job?.jobId;
  if (typeof jobId !== "number") {
    throw new Error(`cron-job.org createCronJob: unexpected response — no jobId: ${JSON.stringify(data)}`);
  }

  return jobId;
}

export async function deleteCronJob(jobId: number): Promise<void> {
  const apiKey = getApiKey();

  const res = await fetch(`${BASE_URL}/jobs/${jobId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  // Silence 404 — job may have already expired/been deleted
  if (res.status === 404) return;

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`cron-job.org deleteCronJob failed (${res.status}): ${text}`);
  }
}

/** Returns the campaigns processor endpoint URL */
export function getCampaignsEndpointUrl(): string {
  return `${getAppUrl()}/api/internal/campaigns`;
}
