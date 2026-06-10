import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { ApiError } from "./api";

let limiter: Ratelimit | null | undefined;

function getLimiter(): Ratelimit | null {
  if (limiter !== undefined) return limiter;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(10, "1 m"),
      prefix: "tc:ai",
    });
  } else {
    limiter = null; // Upstash not configured — limiter disabled (MVP fallback)
  }
  return limiter;
}

/**
 * Sliding-window rate limit on AI-invoking endpoints, keyed per user and
 * per org (spec 5.3). No-op when Upstash is not configured.
 */
export async function enforceAiRateLimit(userId: string, orgId: string): Promise<void> {
  const l = getLimiter();
  if (!l) return;
  const [byUser, byOrg] = await Promise.all([
    l.limit(`user:${userId}`),
    l.limit(`org:${orgId}`),
  ]);
  if (!byUser.success || !byOrg.success) {
    throw new ApiError("rate_limited", 429, "Too many AI requests. Please retry in a minute.");
  }
}
