"use client";

import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import { Bar } from "react-chartjs-2";

import type { MonthlyCashFlow } from "@/lib/transactions";
import { formatAmount } from "@/lib/utils";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend);

const CashFlowChart = ({ data }: { data: MonthlyCashFlow[] }) => {
  return (
    <Bar
      aria-label="Monthly income and expenses"
      role="img"
      data={{
        labels: data.map((m) => m.label),
        datasets: [
          { label: "Income", data: data.map((m) => m.income), backgroundColor: "#12B76A", borderRadius: 4, maxBarThickness: 18 },
          { label: "Expenses", data: data.map((m) => m.expenses), backgroundColor: "#0179FE", borderRadius: 4, maxBarThickness: 18 },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatAmount(Number(ctx.raw))}` } },
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { callback: (value) => formatAmount(Number(value)).replace(".00", "") } },
        },
      }}
    />
  );
};

export default CashFlowChart;
