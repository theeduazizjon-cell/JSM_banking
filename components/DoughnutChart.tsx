"use client";
import React from 'react'
import { Chart as ChartsJS, ArcElement, Tooltip, Legend} from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartsJS.register(ArcElement, Tooltip, Legend);

const DoughnutChart = ({ accounts }:DoughnutChartProps) => {
  const accountNames = accounts.map((a) => a.name);
  const balances = accounts.map((a) => a.currentBalance)

    const data = {
        datasets: 
        [
            {
                label: 'Banks', 
                data: balances,
                backgroundColor: ['#0747b6', '#2265d8', '#2f91fa']
            }
        ], 
        labels: accountNames
    }

  // An empty ring keeps the layout steady before any bank is linked
  if (accounts.length === 0 || balances.every((b) => b === 0)) {
    return (
      <div
        role="img"
        aria-label="No balances to chart yet"
        className="aspect-square w-full rounded-full border-[14px] border-gray-200"
      />
    );
  }

  return (
    <Doughnut data={data} aria-label={`Balance split across ${accounts.length} bank account${accounts.length === 1 ? '' : 's'}`} 
    options={{
        cutout: '60%', 
        plugins: {
            legend: {
                display: false 
            }
        }
    }}
    />
  )
}

export default DoughnutChart; 