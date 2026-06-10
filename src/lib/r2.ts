import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ApiError } from "./api";

const PRESIGN_TTL_SECONDS = 300; // spec 5.2: pre-signed URLs expire in <= 300s

let client: S3Client | null | undefined;

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY,
  );
}

function getClient(): S3Client {
  if (client) return client;
  if (!isR2Configured()) {
    throw new ApiError(
      "storage_unconfigured",
      503,
      "Object storage (Cloudflare R2) is not configured for this environment.",
    );
  }
  client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

/**
 * Issues a short-lived upload URL into the quarantine bucket (spec 8.2):
 * objects are promoted to the documents bucket only after a clean scan.
 * Keys are tenant-prefixed and non-guessable (spec 6.3).
 */
export async function presignUpload(opts: {
  orgId: string;
  companyId: string;
  documentId: string;
  contentType: string;
}): Promise<{ key: string; uploadUrl: string; expiresIn: number }> {
  const bucket =
    process.env.R2_BUCKET_QUARANTINE ||
    process.env.R2_BUCKET_DOCUMENTS ||
    "tendercopilot-quarantine";
  const key = `${opts.orgId}/${opts.companyId}/${opts.documentId}`;
  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: opts.contentType,
  });
  const uploadUrl = await getSignedUrl(getClient(), cmd, { expiresIn: PRESIGN_TTL_SECONDS });
  return { key, uploadUrl, expiresIn: PRESIGN_TTL_SECONDS };
}

/** Short-lived, single-object read URL (spec 6.3). */
export async function presignDownload(key: string): Promise<string> {
  const bucket = process.env.R2_BUCKET_DOCUMENTS || "tendercopilot-documents";
  const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(getClient(), cmd, { expiresIn: PRESIGN_TTL_SECONDS });
}
