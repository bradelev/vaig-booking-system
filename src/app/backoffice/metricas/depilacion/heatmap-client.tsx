"use client";

const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const SLOT_LABELS = ["08-10", "10-12", "12-14", "14-16", "16-18", "18-20"];

interface HeatmapProps {
  /** data[dayIndex (0=Lunes)][slotIndex] = count */
  data: number[][];
  totalBookings: number;
}

export default function DemandHeatmap({ data, totalBookings }: HeatmapProps) {
  if (totalBookings < 30) {
    return (
      <p className="py-8 text-center text-sm text-gray-500">
        No hay suficientes datos para mostrar el heatmap (se necesitan al menos 30 turnos).
        Actualmente hay {totalBookings}.
      </p>
    );
  }

  const maxVal = Math.max(...data.flat(), 1);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr>
            <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              Día
            </th>
            {SLOT_LABELS.map((slot) => (
              <th
                key={slot}
                className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                {slot}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAY_LABELS.map((day, dayIdx) => (
            <tr key={day}>
              <td className="px-3 py-2 text-sm font-medium text-gray-700">
                {day}
              </td>
              {SLOT_LABELS.map((_, slotIdx) => {
                const val = data[dayIdx]?.[slotIdx] ?? 0;
                const opacity = val > 0 ? 0.15 + (val / maxVal) * 0.75 : 0;
                return (
                  <td
                    key={slotIdx}
                    className="px-3 py-2 text-center text-sm font-medium"
                    style={{
                      backgroundColor: val > 0 ? `rgba(13, 148, 136, ${opacity.toFixed(2)})` : undefined,
                      color: opacity > 0.5 ? "#fff" : "#374151",
                    }}
                  >
                    {val > 0 ? val : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
