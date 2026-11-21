import { useMemo } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins } from '../../style';
import ReportSection from '../ui/ReportSection';
import { Caption, Label } from '../ui/Text';
import SideMark from './SideMark';
import {
  buildFootnotes,
  formatMetricValue,
  metricLabel,
  pairScale,
  splitMetrics,
} from '../../lib/ui/compare';
const { colors } = theme;

// Below this width the table becomes stacked rows (label, then the two values) instead of
// scrolling sideways.
const STACKED = '@media (max-width: 39.99em)';

const Table = styled.table`
  th,
  td {
    padding: 0.7rem 0;
    border-bottom: 1px solid ${colors.rule};
    text-align: left;
    vertical-align: middle;
  }

  thead th {
    ${mixins.monoLabel};
    padding-top: 0;
    border-bottom-color: ${colors.ink};
    color: ${colors.muted};
    font-weight: 500;
  }

  .metric {
    padding-right: 1.25rem;
    font-size: 0.9375rem;
    font-weight: 500;
  }

  .value {
    ${mixins.monoText};
    width: 9rem;
    padding-right: 1rem;
    white-space: nowrap;
    font-size: 0.9375rem;
  }

  .value .who {
    display: none;
  }

  .bars {
    width: 30%;
    min-width: 8rem;
  }

  .group th {
    ${mixins.monoLabel};
    padding-top: 1.75rem;
    border-bottom-color: ${colors.ink};
    color: ${colors.muted};
    font-weight: 500;
  }

  sup {
    margin-left: 0.15rem;
    font-size: 0.7rem;
    line-height: 0;
  }

  sup a {
    ${mixins.monoText};
    text-decoration: none;
    color: ${colors.accentText};
  }

  ${STACKED} {
    thead {
      ${mixins.visuallyHidden};
    }

    display: block;

    tbody {
      display: block;
    }

    tr {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: 1rem;
      padding: 0.85rem 0;
      border-bottom: 1px solid ${colors.rule};
    }

    tr.group {
      display: block;
      padding: 1.5rem 0 0.5rem;
      border-bottom-color: ${colors.ink};
    }

    th,
    td {
      padding: 0;
      border-bottom: 0;
    }

    .group th {
      padding: 0;
    }

    .metric {
      grid-column: 1 / -1;
      margin-bottom: 0.35rem;
      padding-right: 0;
    }

    .value {
      width: auto;
      padding-right: 0;
      white-space: normal;
    }

    .value .who {
      ${mixins.monoLabel};
      display: flex;
      align-items: center;
      color: ${colors.muted};
      font-size: 0.68rem;
      overflow-wrap: anywhere;
    }

    .bars {
      grid-column: 1 / -1;
      width: auto;
      min-width: 0;
      margin-top: 0.55rem;
    }
  }
`;

// Two thin bars, one per side, scaled within their own row. A missing bar means that side has no
// value to draw (unknown), not zero.
const Bars = styled.span`
  display: grid;
  gap: 3px;

  .track {
    display: block;
    height: 6px;
    background: ${colors.fill};
    box-shadow: inset 0 0 0 1px ${colors.rule};
  }

  .track.unknown {
    background: transparent;
    box-shadow: none;
    border-bottom: 1px dashed ${colors.rule};
    height: 3px;
  }

  .fill {
    display: block;
    height: 100%;
  }

  .a .fill {
    background: ${colors.ink};
  }

  .b .fill {
    background: ${colors.muted};
  }
`;

const PairedBars = ({ metric }) => {
  const scale = pairScale(metric);
  if (scale.a === null && scale.b === null) return null;
  return (
    <Bars aria-hidden="true">
      {['a', 'b'].map(side => (
        <span key={side} className={`track ${side}${scale[side] === null ? ' unknown' : ''}`}>
          {scale[side] !== null && (
            <span className="fill" style={{ width: `${scale[side] * 100}%` }} />
          )}
        </span>
      ))}
    </Bars>
  );
};

PairedBars.propTypes = { metric: PropTypes.object.isRequired };

const Notes = styled.ol`
  display: grid;
  gap: 0.3rem;
  max-width: 70ch;
  margin-top: 0.5rem;
  padding-left: 2rem;
  list-style: decimal;
  color: ${colors.muted};
  font-size: 0.8125rem;
  line-height: 1.45;

  li::marker {
    ${mixins.monoText};
  }
`;

const Row = ({ metric, logins, number }) => (
  <tr>
    <th scope="row" className="metric">
      {metricLabel(metric)}
      {number && (
        <sup>
          <a href={`#metric-note-${number}`} aria-label={`Note ${number}`}>
            {number}
          </a>
        </sup>
      )}
    </th>
    {['a', 'b'].map(side => (
      <td key={side} className="value">
        <span className="who">
          <SideMark side={side} />
          {logins[side]}
        </span>
        {formatMetricValue(metric, side)}
      </td>
    ))}
    <td className="bars">
      <PairedBars metric={metric} />
    </td>
  </tr>
);

Row.propTypes = {
  metric: PropTypes.object.isRequired,
  logins: PropTypes.shape({ a: PropTypes.string, b: PropTypes.string }).isRequired,
  number: PropTypes.number,
};

/**
 * The metrics of both profiles in one table: a value column per side and a pair of thin bars
 * scaled within each row. There is no winner styling. Popularity rows sit under their own
 * sub-heading, and the API's notes are footnotes.
 */
const MetricsSection = ({ metrics, logins }) => {
  const { main, popularity } = useMemo(() => splitMetrics(metrics), [metrics]);
  const { notes, numbers } = useMemo(
    () => buildFootnotes([...main, ...popularity]),
    [main, popularity],
  );

  return (
    <ReportSection id="metrics">
      <Caption style={{ marginBottom: '1rem' }}>
        Each row has its own scale, so bars are only comparable within a row. A dash means the value
        is unknown, not zero.
      </Caption>
      <Table aria-label="Metrics of both profiles">
        <thead>
          <tr>
            <th scope="col">Metric</th>
            {['a', 'b'].map(side => (
              <th scope="col" key={side}>
                <SideMark side={side} />
                {logins[side]}
              </th>
            ))}
            <th scope="col" className="bars">
              Relative size
            </th>
          </tr>
        </thead>
        <tbody>
          {main.map(metric => (
            <Row key={metric.id} metric={metric} logins={logins} number={numbers[metric.id]} />
          ))}
        </tbody>
        {popularity.length > 0 && (
          <tbody>
            <tr className="group">
              <th scope="colgroup" colSpan={4}>
                Popularity (not quality)
              </th>
            </tr>
            {popularity.map(metric => (
              <Row key={metric.id} metric={metric} logins={logins} number={numbers[metric.id]} />
            ))}
          </tbody>
        )}
      </Table>

      {notes.length > 0 && (
        <>
          <Label style={{ marginTop: '2rem' }}>Notes</Label>
          <Notes>
            {notes.map((note, index) => (
              <li key={note} id={`metric-note-${index + 1}`}>
                {note}
              </li>
            ))}
          </Notes>
        </>
      )}
    </ReportSection>
  );
};

MetricsSection.propTypes = {
  metrics: PropTypes.arrayOf(PropTypes.object).isRequired,
  logins: PropTypes.shape({ a: PropTypes.string, b: PropTypes.string }).isRequired,
};

export default MetricsSection;
