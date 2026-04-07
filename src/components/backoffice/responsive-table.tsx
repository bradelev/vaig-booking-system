import { type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface TableColumn<T> {
  header: string;
  accessor: (row: T) => ReactNode;
  primaryOnMobile?: boolean;
  hideOnMobile?: boolean;
  sortHref?: string;
  sortActive?: "asc" | "desc" | null;
}

interface ResponsiveTableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
}

function SortIndicator({ direction }: { direction: "asc" | "desc" | null | undefined }) {
  if (!direction) return <span className="ml-1 text-muted-foreground/40">&#8597;</span>;
  return <span className="ml-1">{direction === "asc" ? "&#9650;" : "&#9660;"}</span>;
}

export default function ResponsiveTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No hay datos",
}: ResponsiveTableProps<T>) {
  const mobileVisibleColumns = columns.filter((c) => !c.hideOnMobile);
  const primaryColumn = columns.find((c) => c.primaryOnMobile) ?? columns[0];
  const secondaryColumns = mobileVisibleColumns.filter((c) => c !== primaryColumn);

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted/50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.header}
                  className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  {col.sortHref ? (
                    <Link
                      href={col.sortHref}
                      className={cn(
                        "inline-flex items-center gap-0.5 hover:text-foreground transition-colors",
                        col.sortActive && "text-foreground"
                      )}
                    >
                      {col.header}
                      <SortIndicator direction={col.sortActive} />
                    </Link>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={keyExtractor(row)} className="transition-colors duration-150 hover:bg-muted/50">
                  {columns.map((col) => (
                    <td key={col.header} className="px-4 py-4 text-sm text-foreground">
                      {col.accessor(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-border">
        {data.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          data.map((row) => (
            <div key={keyExtractor(row)} className="p-4 space-y-2">
              <div className="font-medium text-sm text-foreground">
                {primaryColumn.accessor(row)}
              </div>
              {secondaryColumns.map((col) => (
                <div key={col.header} className="flex items-start gap-2 text-sm">
                  <span className="text-muted-foreground min-w-[80px] shrink-0">{col.header}:</span>
                  <span className="text-foreground">{col.accessor(row)}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
