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
            <stop offset="5%" stopColor="#5a7a6a" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#5a7a6a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#dce5df" />
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
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #dce5df" }}
          labelStyle={{ fontWeight: 600 }}
          formatter={(value) => [value as number, "Sesiones"]}
        />
        <Area
          type="monotone"
          dataKey="sesiones"
          stroke="#5a7a6a"
          strokeWidth={2}
          fill="url(#colorSesiones)"
          dot={false}
          activeDot={{ r: 4, fill: "#5a7a6a" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
