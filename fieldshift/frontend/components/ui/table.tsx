import * as React from "react";
import { cn } from "@/lib/utils";

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  /** Para tablas anchas: el contenedor con desplazamiento horizontal recibe foco (teclado) y este nombre. */
  scrollLabel?: string;
}

// `relative`: los textos solo para lectores de pantalla (sr-only, posición absoluta) quedan dentro del desplazamiento
// y no ensanchan la página en el celular.
const Table = React.forwardRef<HTMLTableElement, TableProps>(({ className, scrollLabel, ...props }, ref) => (
  <div className="relative w-full overflow-x-auto" {...(scrollLabel ? { tabIndex: 0, role: "region", "aria-label": scrollLabel } : {})}>
    <table ref={ref} className={cn("w-full caption-bottom text-base", className)} {...props} />
  </div>
));
Table.displayName = "Table";

const TableHeader = (props: React.HTMLAttributes<HTMLTableSectionElement>) => <thead className="border-b [&_th]:text-left" {...props} />;
const TableBody = (props: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody className="[&_tr:last-child]:border-0" {...props} />;
const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => <tr className={cn("border-b", className)} {...props} />;
const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th scope="col" className={cn("h-11 px-3 align-middle text-sm font-semibold text-muted-foreground", className)} {...props} />
);
const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn("px-3 py-3 align-middle", className)} {...props} />;
const TableCaption = ({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) => (
  <caption className={cn("mt-3 text-sm text-muted-foreground", className)} {...props} />
);

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption };
