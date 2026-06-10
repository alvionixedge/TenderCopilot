export function ScoreBadge({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  if (value == null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
        {label}: —
      </span>
    );
  }
  const tone =
    value >= 70
      ? "bg-emerald-100 text-emerald-800"
      : value >= 45
        ? "bg-amber-100 text-amber-800"
        : "bg-rose-100 text-rose-700";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>
      {label}: {value}
    </span>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tones: Record<string, string> = {
    open: "bg-emerald-100 text-emerald-800",
    ready: "bg-emerald-100 text-emerald-800",
    generating: "bg-amber-100 text-amber-800",
    draft: "bg-slate-100 text-slate-600",
    failed: "bg-rose-100 text-rose-700",
    submitted: "bg-brand-100 text-brand-800",
    amended: "bg-amber-100 text-amber-800",
    closed: "bg-slate-200 text-slate-600",
    cancelled: "bg-rose-100 text-rose-700",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tones[status] ?? "bg-slate-100 text-slate-600"}`}
    >
      {status}
    </span>
  );
}
