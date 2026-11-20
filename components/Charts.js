import React, { useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { buildChart, backgroundColor, borderColor } from '../utils';
import { getLanguageColor } from '../lib/languageStats';
import ChartsStyles from './styles/ChartsStyles';
import { Section } from '../style';

const CHART_SIZE = 300;
const MOST_STARRED_LIMIT = 5;

// Expands "#abc" or "#aabbcc" to a translucent "#aabbccB3" fill color.
const toTranslucent = color => {
  const hex = color.slice(1);
  const full = hex.length === 3 ? [...hex].map(char => char + char).join('') : hex;
  return `#${full}B3`;
};

const buildLangChart = langData => ({
  chartType: 'pie',
  labels: langData.map(lang => lang.label),
  data: langData.map(lang => lang.value),
  backgroundColor: langData.map(lang => toTranslucent(lang.color)),
  borderColor: langData.map(lang => lang.color),
  axes: false,
  legend: true,
});

const buildStarChart = repoData => {
  const mostStarredRepos = repoData
    .filter(repo => !repo.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, MOST_STARRED_LIMIT);
  return {
    chartType: 'bar',
    labels: mostStarredRepos.map(repo => repo.name),
    data: mostStarredRepos.map(repo => repo.stargazers_count),
    backgroundColor,
    borderColor,
    axes: true,
    legend: false,
  };
};

const buildStarsPerLanguageChart = repoData => {
  const starredRepos = repoData.filter(repo => !repo.fork && repo.stargazers_count > 0);
  const labels = [...new Set(starredRepos.map(repo => repo.language))].filter(Boolean);
  const data = labels.map(lang =>
    starredRepos
      .filter(repo => repo.language === lang)
      .reduce((sum, repo) => sum + repo.stargazers_count, 0),
  );
  const colors = labels.map(getLanguageColor);
  return {
    chartType: 'doughnut',
    labels,
    data,
    backgroundColor: colors.map(toTranslucent),
    borderColor: colors,
    axes: false,
    legend: true,
  };
};

const Charts = ({ langData, repoData }) => {
  const langCanvas = useRef(null);
  const starCanvas = useRef(null);
  const starsPerLangCanvas = useRef(null);

  const langChart = useMemo(() => buildLangChart(langData), [langData]);
  const starChart = useMemo(() => buildStarChart(repoData), [repoData]);
  const starsPerLangChart = useMemo(() => buildStarsPerLanguageChart(repoData), [repoData]);

  useEffect(() => {
    const charts = [
      [langCanvas, langChart],
      [starCanvas, starChart],
      [starsPerLangCanvas, starsPerLangChart],
    ]
      .filter(([canvas, config]) => canvas.current && config.data.length > 0)
      .map(([canvas, config]) => buildChart({ ctx: canvas.current, ...config }));

    // Charts must be destroyed so React strict mode and re-renders never reuse a live canvas.
    return () => charts.forEach(chart => chart.destroy());
  }, [langChart, starChart, starsPerLangChart]);

  return (
    <Section>
      <ChartsStyles>
        <div className="chart">
          <header>
            <h2>Top Languages</h2>
          </header>

          <div className="chart-container">
            {langChart.data.length === 0 && <p>Nothing to see here!</p>}
            <canvas
              ref={langCanvas}
              width={CHART_SIZE}
              height={CHART_SIZE}
              role="img"
              aria-label="Pie chart of repositories per primary language"
            />
          </div>
        </div>

        <div className="chart">
          <header>
            <h2>Most Starred</h2>
          </header>
          <div className="chart-container">
            {starChart.data.length === 0 && <p>Nothing to see here!</p>}
            <canvas
              ref={starCanvas}
              width={CHART_SIZE}
              height={CHART_SIZE}
              role="img"
              aria-label="Bar chart of the most starred repositories"
            />
          </div>
        </div>

        <div className="chart">
          <header>
            <h2>Stars per Language</h2>
          </header>
          <div className="chart-container">
            {starsPerLangChart.data.length === 0 && <p>Nothing to see here!</p>}
            <canvas
              ref={starsPerLangCanvas}
              width={CHART_SIZE}
              height={CHART_SIZE}
              role="img"
              aria-label="Doughnut chart of stars per language"
            />
          </div>
        </div>
      </ChartsStyles>
    </Section>
  );
};

Charts.propTypes = {
  langData: PropTypes.array.isRequired,
  repoData: PropTypes.array.isRequired,
};

export default Charts;
