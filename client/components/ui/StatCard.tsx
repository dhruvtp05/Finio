export default function StatCard({
  title,
  value,
  hint,
  valueClassName = "text-slate-900 dark:text-slate-50",
  className = "",
}: {
  title: string;
  value: string;
  hint?: string;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={`finio-card ${className}`}>
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${valueClassName}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{hint}</p>}
    </div>
  );
}
