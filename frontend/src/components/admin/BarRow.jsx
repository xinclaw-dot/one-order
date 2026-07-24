export default function BarRow({ label, valueLabel, pct, accent = "chili", rank }) {
  const gradient = accent === "chili" ? "from-chili to-guava" : "from-sky to-guava";
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
        <span className="flex min-w-0 items-center gap-1.5 font-semibold">
          {rank != null && (
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-[10px] font-extrabold text-cream">{rank}</span>
          )}
          <span className="truncate">{label}</span>
        </span>
        <span className="shrink-0 font-ticket text-[11px] text-ink-soft">{valueLabel}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink/8">
        <div className={`h-full rounded-full bg-gradient-to-r ${gradient}`} style={{ width: `${Math.max(4, pct)}%` }} />
      </div>
    </div>
  );
}
