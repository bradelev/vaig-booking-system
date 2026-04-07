"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ProfessionalData {
  name: string;
  realizados: number;
  cancelados: number;
}

interface ProfessionalChartProps {
  data: ProfessionalData[];
}

export default function ProfessionalChart({ data }: ProfessionalChartProps) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 60)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 40, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: "#374151" }}
          tickLine={false}
          axisLine={false}
          width={100}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey="realizados"
          name="Realizados"
          fill="#0d9488"
          radius={[0, 4, 4, 0]}
          stackId="stack"
        />
        <Bar
          dataKey="cancelados"
          name="Cancelados / No show"
          fill="#d1d5db"
          radius={[0, 4, 4, 0]}
          stackId="stack"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
