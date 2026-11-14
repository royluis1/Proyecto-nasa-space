import * as React from "react";
import { cn } from "@/lib/utils";

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(({ className, ...props }, ref) => (
  <div className="w-full overflow-x-auto">
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
