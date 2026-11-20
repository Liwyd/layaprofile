import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  PieController,
  Tooltip,
} from 'chart.js';
import { theme } from '../style';
const { fonts } = theme;

// Register only the pieces the app uses so the rest of Chart.js is tree-shaken away.
Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Legend,
  LinearScale,
  PieController,
  Tooltip,
);

const font = { family: fonts.inter, size: 12 };

const buildScales = axes =>
  axes
    ? {
        x: { ticks: { font } },
        y: { beginAtZero: true, ticks: { font, precision: 0 } },
      }
    : undefined;

const buildLegend = legend =>
  legend
    ? { display: true, position: 'right', labels: { font: { family: fonts.inter } } }
    : { display: false };

const buildChart = config => {
  const { ctx, chartType, labels, data, backgroundColor, borderColor, axes, legend } = config;

  return new Chart(ctx, {
    type: chartType,
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor,
          borderColor,
          borderWidth: 1,
        },
      ],
    },
    options: {
      scales: buildScales(axes),
      plugins: {
        legend: buildLegend(legend),
        tooltip: {
          titleFont: { family: fonts.inter },
          bodyFont: { family: fonts.inter },
          cornerRadius: 3,
        },
      },
    },
  });
};

export default buildChart;
