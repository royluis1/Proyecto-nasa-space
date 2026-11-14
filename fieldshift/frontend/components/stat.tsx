import { cn } from "@/lib/utils";

/** Un número importante con su explicación en palabras. */
export function Stat({ label, value, hint, className, children }: { label: string; value: React.ReactNode; hint?: React.ReactNode; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}
