import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from 'chart.js';
import { theme, mixins } from '../../style';
import Disclosure from '../ui/Disclosure';
import VisuallyHidden from '../ui/VisuallyHidden';
const { colors, fonts } = theme;

// Register only the pieces this chart uses so the rest of Chart.js is tree-shaken away.
Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const readColor = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// Chart.js draws on a canvas, which cannot use CSS variables, so the palette is resolved from the
// document and read again whenever the color scheme changes.
const readPalette = () => ({
  ink: readColor('--ink'),
  muted: readColor('--muted'),
  rule: readColor('--rule'),
  paper: readColor('--paper'),
});

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A series is drawn in ink or in the muted grey: two tones that differ in lightness, so the
// chart does not rely on hue.
const TONES = ['ink', 'muted'];

const buildConfig = (years, series, palette) => {
  const mono = { family: fonts.mono.split(',')[0].replace(/'/g, ''), size: 11 };
  return {
    type: 'bar',
    data: {
      labels: years.map(String),
      datasets: series.map(item => ({
        label: item.label,
        data: item.data,
        backgroundColor: palette[item.tone],
        borderWidth: 0,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: prefersReducedMotion() ? 0 : 150 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: palette.ink,
          titleColor: palette.paper,
          bodyColor: palette.paper,
          titleFont: mono,
          bodyFont: mono,
          cornerRadius: 2,
          padding: 8,
        },
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: palette.rule },
          ticks: { color: palette.muted, font: mono, maxRotation: 0, autoSkipPadding: 12 },
        },
        y: {
          beginAtZero: true,
          grid: { display: false },
          border: { display: false },
          ticks: { color: palette.muted, font: mono, precision: 0, maxTicksLimit: 4 },
        },
      },
    },
  };
};

const Figure = styled.figure`
  .legend {
    ${mixins.monoLabel};
    display: flex;
    gap: 1.25rem;
    margin-bottom: 0.75rem;
    color: ${colors.muted};
  }

  .legend span::before {
    content: '';
    display: inline-block;
    width: 0.6rem;
    height: 0.6rem;
    margin-right: 0.4rem;
  }

  .legend .ink::before {
    background: ${colors.ink};
  }

  .legend .muted::before {
    background: ${colors.muted};
  }

  .canvas {
    position: relative;
    height: 13.5rem;
  }

  details {
    margin-top: 0.75rem;
    font-size: 0.875rem;
  }

  summary {
    ${mixins.monoLabel};
    color: ${colors.muted};
  }

  table {
    ${mixins.monoText};
    margin-top: 0.5rem;
    font-size: 0.8125rem;
  }

  th,
  td {
    padding: 0.25rem 0 0.25rem 1.25rem;
    border-bottom: 1px solid ${colors.rule};
    text-align: right;
  }

  th:first-child,
  td:first-child {
    padding-left: 0;
    text-align: left;
  }

  th {
    ${mixins.monoLabel};
    color: ${colors.muted};
  }
`;

/**
 * Repositories per year, as a minimal grouped bar chart of one or more series
 * (`{ label, data, tone }`, `data` parallel to `years`, `tone` `ink` or `muted`). The same numbers
 * are available as a table, which is the accessible alternative to the canvas; `tableSeries`
 * lets the table carry more series than the chart draws. `description` names what is charted for
 * assistive technology.
 */
const YearChart = ({ years, series, tableSeries, description, tableCaption }) => {
  const canvas = useRef(null);
  const [scheme, setScheme] = useState(0);

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setScheme(count => count + 1);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    // The chart must be destroyed so React strict mode and re-renders never reuse a live canvas.
    const chart = new Chart(canvas.current, buildConfig(years, series, readPalette()));
    return () => chart.destroy();
  }, [years, series, scheme]);

  const rows = tableSeries ?? series;
  return (
    <Figure>
      <div className="legend" aria-hidden="true">
        {series.map(item => (
          <span key={item.label} className={item.tone}>
            {item.label}
          </span>
        ))}
      </div>
      <div className="canvas">
        <canvas
          ref={canvas}
          role="img"
          aria-label={`${description}, ${years[0]} to ${years[years.length - 1]}. The same numbers are in the table below.`}
        />
      </div>
      <Disclosure>
        <summary>View as table</summary>
        <table>
          <caption>
            <VisuallyHidden>{tableCaption}</VisuallyHidden>
          </caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              {rows.map(item => (
                <th scope="col" key={item.label}>
                  {item.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((year, index) => (
              <tr key={year}>
                <th scope="row">{year}</th>
                {rows.map(item => (
                  <td key={item.label}>{item.data[index]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Disclosure>
    </Figure>
  );
};

const seriesShape = PropTypes.shape({
  label: PropTypes.string.isRequired,
  data: PropTypes.arrayOf(PropTypes.number).isRequired,
  tone: PropTypes.oneOf(TONES).isRequired,
});

YearChart.propTypes = {
  years: PropTypes.arrayOf(PropTypes.number).isRequired,
  series: PropTypes.arrayOf(seriesShape).isRequired,
  tableSeries: PropTypes.arrayOf(seriesShape),
  description: PropTypes.string.isRequired,
  tableCaption: PropTypes.string.isRequired,
};

export default YearChart;
