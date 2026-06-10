import { desc, eq } from "drizzle-orm";
import { FileBadge2 } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/db";
import { companyDocuments } from "@/db/schema";
import { CompanyForm, DocumentUpload } from "@/components/company-form";
import { isR2Configured } from "@/lib/r2";
import { getActiveCompany } from "@/lib/tenant";
import { tryQuery } from "@/lib/safe";

export const metadata = { title: "Company profile" };
export const dynamic = "force-dynamic";

export default async function CompanyPage() {
  const session = (await auth())!;
  const company = await tryQuery(() => getActiveCompany(session.orgId), null);

  const documents = company
    ? await tryQuery(
        () =>
          db()
            .select()
            .from(companyDocuments)
            .where(eq(companyDocuments.companyId, company.id))
            .orderBy(desc(companyDocuments.createdAt)),
        [],
      )
    : [];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900">Company profile</h1>
      <p className="mt-1 text-sm text-slate-600">
        This profile drives tender matching, eligibility checks and proposal generation.
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {company ? (
          <div>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{company.companyName}</h2>
                <p className="mt-1 text-sm text-slate-600">{company.website}</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                Active profile
              </span>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[
                ["GSTIN", company.gstNumber ?? "—"],
                ["PAN", company.panNumber ?? "—"],
                ["MSME / Udyam", company.msmeNumber ?? "—"],
                [
                  "Annual turnover",
                  company.annualTurnover
                    ? `₹${Number(company.annualTurnover).toLocaleString("en-IN")}`
                    : "—",
                ],
                ["Employees", company.employeeCount?.toString() ?? "—"],
                ["Created", new Date(company.createdAt).toLocaleDateString("en-IN")],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-slate-50 p-3">
                  <dt className="text-xs text-slate-500">{k}</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
            {company.description && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Capability statement</div>
                <p className="mt-1 text-sm leading-6 text-slate-700">{company.description}</p>
              </div>
            )}
          </div>
        ) : (
          <CompanyForm />
        )}
      </div>

      {company && (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Supporting documents</h2>
          <p className="mt-1 text-sm text-slate-600">
            GST, PAN, MSME, certifications and case studies. Files are stored in a private
            bucket and scanned before use.
          </p>

          <div className="mt-4">
            {isR2Configured() ? (
              <DocumentUpload companyId={company.id} />
            ) : (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                Document upload requires Cloudflare R2 to be configured (R2_* environment
                variables). See DEPLOYMENT.md.
              </div>
            )}
          </div>

          {documents.length > 0 && (
            <ul className="mt-5 divide-y divide-slate-100">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <FileBadge2 className="h-5 w-5 text-brand-600" />
                    <div>
                      <div className="text-sm font-medium text-slate-800">
                        {doc.documentType}
                      </div>
                      <div className="text-xs text-slate-500">
                        Uploaded {new Date(doc.createdAt).toLocaleDateString("en-IN")}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium capitalize text-slate-600">
                      scan: {doc.scanStatus}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium capitalize text-slate-600">
                      {doc.verificationStatus}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
