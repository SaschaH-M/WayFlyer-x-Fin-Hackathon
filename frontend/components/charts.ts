"use client";
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Filler, Tooltip, Legend,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip, Legend);

export const baseOptions: any = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 400 },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "rgba(28,28,30,0.95)", titleColor: "#f5f5f7", bodyColor: "#98989d",
      borderColor: "rgba(255,255,255,0.1)", borderWidth: 1, padding: 12,
    },
  },
  scales: {
    x: { ticks: { color: "#6e6e73", font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.03)" } },
    y: { ticks: { color: "#6e6e73", font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.04)" } },
  },
};

export const COLORS = { bl: "#0a84ff", gr: "#30d158", rd: "#ff453a", am: "#ff9f0a", pu: "#bf5af2", t: "#f5f5f7" };
