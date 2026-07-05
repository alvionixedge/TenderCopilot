import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, withErrorHandling } from "@/lib/api";
import { registerWithPassword } from "@/lib/account";

const schema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email().max(255),
  password: z.string().min(8).max(200),
});

/**
 * POST /api/v1/account/register — creates a first-party email/password
 * account (deviation from spec §5.1). The client then signs in with the
 * credentials provider.
 */
export const POST = withErrorHandling(async (req: Request) => {
  const body = await parseBody(req, schema);
  const identity = await registerWithPassword(body);
  return NextResponse.json(
    { userId: identity.userId, plan: identity.plan, role: identity.role },
    { status: 201 },
  );
});
