import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { auth } from "@/auth";
import { ApiError } from "./errors";

export { ApiError };

/** Standard error envelope (spec Section 4): { error: { code, message } } */
export function apiError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export interface SessionContext {
  userId: string;
  orgId: string;
  role: string;
  plan: string;
}

/** Resolves the authenticated tenant context; throws 401 when absent. */
export async function requireSession(): Promise<SessionContext> {
  const session = await auth();
  if (!session?.userId || !session.orgId) {
    throw new ApiError("unauthorized", 401, "Authentication required.");
  }
  return {
    userId: session.userId,
    orgId: session.orgId,
    role: session.role,
    plan: session.plan,
  };
}

export async function parseBody<T>(req: Request, schema: ZodSchema<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError("invalid_json", 400, "Request body must be valid JSON.");
  }
  try {
    return schema.parse(json);
  } catch (err) {
    if (err instanceof ZodError) {
      const first = err.errors[0];
      throw new ApiError(
        "validation_error",
        422,
        `${first?.path.join(".") || "body"}: ${first?.message || "invalid"}`,
      );
    }
    throw err;
  }
}

/** Wraps a route handler with uniform error handling. */
export function withErrorHandling<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return apiError(err.code, err.message, err.status);
      }
      console.error("[api] unhandled error", err);
      return apiError("internal_error", "An unexpected error occurred.", 500);
    }
  };
}
