"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { CompanyForm } from "./company-form";

export interface EditableCompany {
  companyName: string;
  website: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  msmeNumber: string | null;
  annualTurnover: string | null;
  employeeCount: number | null;
  description: string | null;
  createdAt: string; // ISO
}

export function CompanyProfileEditable({
  company,
  initialEdit = false,
}: {
  company: EditableCompany;
  initialEdit?: boolean;
}) {
  const [editing, setEditing] = useState(initialEdit);

  if (editing) {
    return <CompanyForm company={company} onDone={() => setEditing(false)} />;
  }

  const cells: [string, string][] = [
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
  ];

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{company.companyName}</h2>
          <p className="mt-1 text-sm text-slate-600">{company.website}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            Active profile
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        </div>
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {cells.map(([k, v]) => (
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
  );
}
