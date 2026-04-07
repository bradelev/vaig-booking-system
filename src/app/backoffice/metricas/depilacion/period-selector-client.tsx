"use client";

const PERIODS = [
  { label: "30d", days: 30 },
  { label: "60d", days: 60 },
  { label: "90d", days: 90 },
  { label: "6m", days: 180 },
];

interface PeriodSelectorProps {
  currentDays: number;
}

export default function PeriodSelector({ currentDays }: PeriodSelectorProps) {
  return (
    <div className="flex gap-2">
      {PERIODS.map((p) => (
        <a
          key={p.days}
          href={`?periodo=${p.days}`}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
            p.days === currentDays
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          {p.label}
        </a>
      ))}
    </div>
  );
}
