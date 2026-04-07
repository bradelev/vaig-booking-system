"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface FunnelDataPoint {
  stage: string;
  count: number;
  percentage: number;
}

interface FunnelChartProps {
  data: FunnelDataPoint[];
}

const STAGE_LABELS: Record<string, string> = {
  started: "Iniciaron",
  service_selected: "Selec. servicio",
  data_completed: "Completaron",
  payment_done: "Pagaron",
};

export default function FunnelChart({ data }: FunnelChartProps) {
  const colors = ["#5a7a6a", "#6f9680", "#8aab9a", "#c5dace"];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 40, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#dce5df" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="stage"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={false}
          width={100}
          tickFormatter={(v: string) => STAGE_LABELS[v] ?? v}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #dce5df" }}
          formatter={(value, _name, props) => [
            `${value as number} (${(props.payload as FunnelDataPoint).percentage}%)`,
            "Sesiones",
          ]}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
