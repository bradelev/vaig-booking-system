interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number; // percentage change, e.g. 10 means +10%, -5 means -5%
    label: string; // e.g. "vs ayer"
  };
}

export default function StatCard({ title, value, subtitle, trend }: StatCardProps) {
  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      {trend !== undefined && (
        <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${
          trend.value > 0 ? "text-green-600" : trend.value < 0 ? "text-red-600" : "text-gray-500"
        }`}>
          {trend.value > 0 ? (
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 2L10 7H2L6 2Z" fill="currentColor"/>
            </svg>
          ) : trend.value < 0 ? (
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 10L2 5H10L6 10Z" fill="currentColor"/>
            </svg>
          ) : null}
          <span>
            {trend.value > 0 ? "+" : ""}{trend.value}% {trend.label}
          </span>
        </div>
      )}
    </div>
  );
}
