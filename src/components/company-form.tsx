"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";

export interface CompanyFormValues {
  companyName?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  msmeNumber?: string | null;
  website?: string | null;
  description?: string | null;
  employeeCount?: number | null;
  annualTurnover?: string | null;
}

export function CompanyForm({
  company,
  onDone,
}: {
  company?: CompanyFormValues;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = Boolean(company);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      companyName: fd.get("companyName"),
      gstNumber: fd.get("gstNumber") || "",
      panNumber: fd.get("panNumber") || "",
      msmeNumber: fd.get("msmeNumber") || "",
      website: fd.get("website") || "",
      description: fd.get("description"),
      employeeCount: fd.get("employeeCount") ? Number(fd.get("employeeCount")) : undefined,
      annualTurnover: fd.get("annualTurnover") ? Number(fd.get("annualTurnover")) : undefined,
    };
    try {
      const res = await fetch("/api/v1/companies", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to save profile");
      onDone?.();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Legal company name *
          </span>
          <input name="companyName" required minLength={2} defaultValue={company?.companyName ?? ""} className={field} placeholder="Acme Infotech Pvt. Ltd." />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">GSTIN *</span>
          <input name="gstNumber" required maxLength={15} minLength={15} defaultValue={company?.gstNumber ?? ""} className={field} placeholder="22AAAAA0000A1Z5" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Annual turnover (INR) *
          </span>
          <input name="annualTurnover" type="number" required min={1} defaultValue={company?.annualTurnover ? Number(company.annualTurnover) : ""} className={field} placeholder="25000000" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">PAN</span>
          <input name="panNumber" maxLength={10} minLength={10} defaultValue={company?.panNumber ?? ""} className={field} placeholder="AAAAA0000A" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">MSME / Udyam no.</span>
          <input name="msmeNumber" defaultValue={company?.msmeNumber ?? ""} className={field} placeholder="UDYAM-MH-00-0000000" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Website</span>
          <input name="website" type="url" defaultValue={company?.website ?? ""} className={field} placeholder="https://example.com" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Employee count</span>
          <input name="employeeCount" type="number" min={1} defaultValue={company?.employeeCount ?? ""} className={field} placeholder="40" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Capability statement * <span className="font-normal text-slate-500">(used for tender matching — describe services, sectors, certifications, past performance)</span>
          </span>
          <textarea
            name="description"
            required
            minLength={10}
            rows={5}
            defaultValue={company?.description ?? ""}
            className={field}
            placeholder="We are an IT services company specialising in web portals, cloud migration and AMC contracts for government departments…"
          />
          <p className="mt-1.5 rounded-lg bg-brand-50 px-3 py-2 text-xs leading-5 text-brand-800">
            💡 <strong>The more detail here, the better your tender matches.</strong> The feed is
            filtered on this text, so list your services, technologies, sectors, certifications
            (ISO, CMMI) and contract types (AMC, supply, turnkey). A one-line statement matches
            far fewer tenders than a thorough one.
          </p>
        </label>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {editing ? "Update profile" : "Save company profile"}
        </button>
        {editing && onDone && (
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

const DOC_TYPES = [
  "GST",
  "PAN",
  "MSME",
  "ISO",
  "AuditedFinancials",
  "CaseStudy",
  "ReferenceLetter",
] as const;

export function DocumentUpload({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file") as File | null;
    if (!file || file.size === 0) {
      setError("Choose a file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/companies/${companyId}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentType: fd.get("documentType"),
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? "Failed to get upload URL");

      const put = await fetch(json.uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });
      if (!put.ok) throw new Error("Upload to storage failed.");
      setMessage("Uploaded. The document will be verified after malware scanning.");
      form.reset();
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">Document type</span>
        <select
          name="documentType"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">File (PDF)</span>
        <input
          name="file"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="block text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-brand-700 px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        Upload
      </button>
      {message && <p className="w-full text-xs text-emerald-700">{message}</p>}
      {error && <p className="w-full text-xs text-rose-600">{error}</p>}
    </form>
  );
}
