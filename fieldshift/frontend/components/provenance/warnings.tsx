import { Alert } from "@/components/ui/alert";
import { friendlyWarnings } from "@/lib/plain";

/** Advertencias del servidor: las primeras a la vista y el resto plegadas. */
export function WarningsList({ warnings, title = "Advertencias sobre los datos", max = 3 }: { warnings: string[]; title?: string; max?: number }) {
  const list = friendlyWarnings(warnings).filter(Boolean);
  if (list.length === 0) return null;
  const visible = list.slice(0, max);
  const hidden = list.slice(max);
  return (
    <Alert tone="warning" title={title}>
      <ul className="list-disc space-y-1 pl-5">
        {visible.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
      {hidden.length > 0 && (
        <details>
          <summary className="cursor-pointer font-medium">Ver {hidden.length} más</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {hidden.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </details>
      )}
    </Alert>
  );
}
