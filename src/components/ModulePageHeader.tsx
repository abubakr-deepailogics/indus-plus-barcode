import type { LucideIcon } from "lucide-react";

type ModuleAccent = "indigo" | "emerald" | "amber" | "rose";

const accentClasses: Record<ModuleAccent, string> = {
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200/80",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200/80",
  amber: "bg-amber-50 text-amber-800 ring-amber-200/80",
  rose: "bg-rose-50 text-rose-700 ring-rose-200/80",
};

const eyebrowClasses: Record<ModuleAccent, string> = {
  indigo: "text-indigo-700",
  emerald: "text-emerald-700",
  amber: "text-amber-800",
  rose: "text-rose-700",
};

const accentLineClasses: Record<ModuleAccent, string> = {
  indigo: "bg-indigo-600",
  emerald: "bg-emerald-600",
  amber: "bg-amber-600",
  rose: "bg-rose-600",
};

export function ModulePageHeader({
  eyebrow,
  title,
  detail,
  icon: Icon,
  actions,
  compact = false,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  icon: LucideIcon;
  accent?: ModuleAccent;
  actions?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <header className={`flex flex-col justify-between border-b border-slate-200 sm:flex-row sm:items-center ${compact ? "gap-3 pb-3" : "gap-5 pb-5"}`}>
      <div className={`flex items-start ${compact ? "gap-3" : "gap-4"}`}>
        <div className={`flex shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white shadow-sm ${compact ? "size-10" : "size-12"}`}>
          <Icon className={compact ? "size-4" : "size-5"} />
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-indigo-700">
            {eyebrow}
          </p>
          <h1 className={`${compact ? "mt-0.5 text-xl" : "mt-1 text-2xl"} font-semibold text-slate-950`}>
            {title}
          </h1>
          {detail && <p className="mt-1 text-sm text-slate-500">{detail}</p>}
        </div>
      </div>
      {actions && <div className="w-full shrink-0 sm:w-auto">{actions}</div>}
    </header>
  );
}
