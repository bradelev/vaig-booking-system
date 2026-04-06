import { type ReactNode } from "react";
import Link from "next/link";

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
  if (!direction) return <span className="ml-1 text-gray-300">↕</span>;
  return <span className="ml-1">{direction === "asc" ? "▲" : "▼"}</span>;
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
    <div className="rounded-lg border bg-white shadow-sm">
      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.header}
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500"
                >
                  {col.sortHref ? (
                    <Link
                      href={col.sortHref}
                      className={`inline-flex items-center gap-0.5 hover:text-gray-800 transition-colors ${
                        col.sortActive ? "text-gray-900" : ""
                      }`}
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
          <tbody className="divide-y divide-gray-200 bg-white">
            {data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-6 py-8 text-center text-sm text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={keyExtractor(row)} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <td key={col.header} className="px-6 py-4 text-sm text-gray-700">
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
      <div className="md:hidden divide-y divide-gray-200">
        {data.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500">{emptyMessage}</p>
        ) : (
          data.map((row) => (
            <div key={keyExtractor(row)} className="p-4 space-y-2">
              <div className="font-medium text-sm text-gray-900">
                {primaryColumn.accessor(row)}
              </div>
              {secondaryColumns.map((col) => (
                <div key={col.header} className="flex items-start gap-2 text-sm">
                  <span className="text-gray-500 min-w-[80px] shrink-0">{col.header}:</span>
                  <span className="text-gray-700">{col.accessor(row)}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
