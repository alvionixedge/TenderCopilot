import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { companyDocuments } from "@/db/schema";
import { parseBody, requireSession, withErrorHandling } from "@/lib/api";
import { recordAudit } from "@/lib/audit";
import { presignUpload } from "@/lib/r2";
import { assertCompanyInOrg } from "@/lib/tenant";

const requestSchema = z.object({
  documentType: z.enum([
    "GST",
    "PAN",
    "MSME",
    "ISO",
    "AuditedFinancials",
    "CaseStudy",
    "ReferenceLetter",
  ]),
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(3).max(120),
  expiryDate: z.string().date().optional(),
});

/**
 * POST /api/v1/companies/:id/documents — issue a pre-signed R2 upload URL
 * (spec 4.2). Uploads land in the quarantine bucket pending scan (spec 8.2).
 */
export const POST = withErrorHandling(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const ctx = await requireSession();
    const { id: companyId } = await params;
    await assertCompanyInOrg(ctx.orgId, companyId);
    const body = await parseBody(req, requestSchema);

    const [doc] = await db()
      .insert(companyDocuments)
      .values({
        orgId: ctx.orgId,
        companyId,
        documentType: body.documentType,
        fileUrl: "pending", // replaced with the object key below
        scanStatus: "pending",
        expiryDate: body.expiryDate ?? null,
      })
      .returning({ id: companyDocuments.id });

    const { key, uploadUrl, expiresIn } = await presignUpload({
      orgId: ctx.orgId,
      companyId,
      documentId: doc.id,
      contentType: body.contentType,
    });

    const { eq } = await import("drizzle-orm");
    await db()
      .update(companyDocuments)
      .set({ fileUrl: key })
      .where(eq(companyDocuments.id, doc.id));

    await recordAudit({
      orgId: ctx.orgId,
      actorUserId: ctx.userId,
      action: "document.upload_url_issued",
      entityType: "company_documents",
      entityId: doc.id,
      metadata: { documentType: body.documentType },
    });

    return NextResponse.json({ documentId: doc.id, uploadUrl, expiresIn });
  },
);
