import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "text-foreground",
        // Tonos del dominio. Siempre se usan con ícono y texto: el color nunca es la única señal.
        cultivo: "border-cultivo-500/40 bg-cultivo-50 text-cultivo-700 dark:bg-cultivo-900/50 dark:text-cultivo-100",
        tierra: "border-tierra-500/40 bg-tierra-50 text-tierra-700 dark:bg-tierra-900/60 dark:text-tierra-100",
        agua: "border-agua-500/40 bg-agua-50 text-agua-700 dark:bg-agua-900/60 dark:text-agua-100",
        alerta: "border-destructive/50 bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
