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

// --- Public (unauthenticated) endpoints, keyed by client IP -------------------
const publicLimiters = new Map<string, Ratelimit | null>();

function getPublicLimiter(bucket: string, perMinute: number): Ratelimit | null {
  if (publicLimiters.has(bucket)) return publicLimiters.get(bucket)!;
  let l: Ratelimit | null = null;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    l = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(perMinute, "1 m"),
      prefix: `tc:pub:${bucket}`,
    });
  }
  publicLimiters.set(bucket, l);
  return l;
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  return xff?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "anon";
}

/**
 * Per-IP rate limit for public, unauthenticated endpoints (the free-check
 * funnel). Protects the email-sending lead endpoint from abuse. No-op when
 * Upstash is not configured — configure UPSTASH_* in production.
 */
export async function enforcePublicRateLimit(
  req: Request,
  bucket: string,
  perMinute: number,
): Promise<void> {
  const l = getPublicLimiter(bucket, perMinute);
  if (!l) return;
  const { success } = await l.limit(clientIp(req));
  if (!success) {
    throw new ApiError("rate_limited", 429, "Too many requests. Please slow down and try again shortly.");
  }
}
