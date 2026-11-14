import Link from "next/link";
import { ShieldAlert } from "lucide-react";

/** Advertencia visible en toda la app (también en el pie y en cada recomendación). */
export function DisclaimerBar() {
  return (
    <aside aria-label="Aviso importante" className="border-b bg-tierra-50 text-tierra-900 dark:bg-tierra-900/40 dark:text-tierra-50 print:hidden">
      <p className="container flex items-start gap-2 py-2 text-sm">
        <ShieldAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong>Herramienta de apoyo a decisiones.</strong> No reemplaza el asesoramiento de un ingeniero agrónomo ni el análisis de suelo.{" "}
          <Link href="/metodologia" className="underline">
            Cómo se calcula
          </Link>
        </span>
      </p>
    </aside>
  );
}
