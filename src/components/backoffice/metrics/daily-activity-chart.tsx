"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DailyDataPoint {
  date: string;
  sesiones: number;
}

interface DailyActivityChartProps {
  data: DailyDataPoint[];
}

export default function DailyActivityChart({ data }: DailyActivityChartProps) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorSesiones" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#171717" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#171717" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          width={28}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
          labelStyle={{ fontWeight: 600 }}
          formatter={(value) => [value as number, "Sesiones"]}
        />
        <Area
          type="monotone"
          dataKey="sesiones"
          stroke="#171717"
          strokeWidth={2}
          fill="url(#colorSesiones)"
          dot={false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
