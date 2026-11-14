import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("relative flex gap-3 rounded-lg border p-4 text-base", {
  variants: {
    tone: {
      info: "border-agua-500/40 bg-agua-50 text-agua-900 dark:bg-agua-900/40 dark:text-agua-50",
      warning: "border-tierra-500/50 bg-tierra-50 text-tierra-900 dark:bg-tierra-900/50 dark:text-tierra-50",
      error: "border-destructive/50 bg-destructive/10 text-foreground",
      success: "border-cultivo-500/40 bg-cultivo-50 text-cultivo-900 dark:bg-cultivo-900/40 dark:text-cultivo-50",
    },
  },
  defaultVariants: { tone: "info" },
});

// Cada tono lleva su propio ícono y un título en texto: no se distingue solo por color.
const ICONS = { info: Info, warning: AlertTriangle, error: OctagonAlert, success: CheckCircle2 } as const;
const TITLES = { info: "Información", warning: "Atención", error: "Error", success: "Listo" } as const;

export interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title">, VariantProps<typeof alertVariants> {
  title?: React.ReactNode;
}

function Alert({ className, tone = "info", title, children, ...props }: AlertProps) {
  const t = tone ?? "info";
  const Icon = ICONS[t];
  return (
    <div role={t === "error" ? "alert" : "status"} className={cn(alertVariants({ tone }), className)} {...props}>
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold leading-tight">{title ?? TITLES[t]}</p>
        <div className="space-y-2 [&_a]:underline">{children}</div>
      </div>
    </div>
  );
}

export { Alert };
