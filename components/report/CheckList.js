import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins, media } from '../../style';
import Disclosure from '../ui/Disclosure';
import Meter from '../ui/Meter';
import StatusTag from './StatusTag';
import { formatCoverage, formatPoints, formatScore } from '../../lib/ui/format';
const { colors } = theme;

const List = styled.ul`
  border-top: 1px solid ${colors.rule};

  > li {
    display: grid;
    grid-template-columns: 6rem minmax(0, 1fr) 4.5rem;
    grid-template-areas:
      'tag name points'
      '. evidence evidence'
      '. suggestion suggestion';
    column-gap: 1rem;
    row-gap: 0.15rem;
    align-items: baseline;
    padding: 0.7rem 0;
    border-bottom: 1px solid ${colors.rule};
  }

  .tag {
    grid-area: tag;
  }

  .name {
    grid-area: name;
    font-weight: 500;
  }

  .points {
    ${mixins.monoText};
    grid-area: points;
    justify-self: end;
    font-size: 0.875rem;
  }

  .evidence {
    grid-area: evidence;
    color: ${colors.muted};
    font-size: 0.875rem;
  }

  .suggestion {
    grid-area: suggestion;
    font-size: 0.875rem;
  }

  .suggestion .k {
    ${mixins.monoLabel};
    margin-right: 0.5rem;
    color: ${colors.accentText};
  }

  ${media.bp600`
    > li {
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas:
        'tag points'
        'name name'
        'evidence evidence'
        'suggestion suggestion';
    }
  `};
`;

/**
 * The checks of one dimension. Each shows its status, its points out of the maximum ("\u2014" for
 * unknown, which is excluded from the score), the evidence it was based on and, when points are
 * missing, a suggestion.
 */
const CheckList = ({ checks }) => (
  <List>
    {checks.map(check => (
      <li key={check.id}>
        <span className="tag">
          <StatusTag status={check.status} />
        </span>
        <span className="name">{check.label}</span>
        <span className="points">{formatPoints(check.points, check.max)}</span>
        <p className="evidence">{check.evidence}</p>
        {check.recommendation && (
          <p className="suggestion">
            <span className="k">Suggestion</span>
            {check.recommendation}
          </p>
        )}
      </li>
    ))}
  </List>
);

CheckList.propTypes = {
  checks: PropTypes.arrayOf(PropTypes.object).isRequired,
};

const Dimensions = styled.div`
  border-top: 1px solid ${colors.rule};

  > details {
    border-bottom: 1px solid ${colors.rule};
  }

  summary {
    display: grid;
    grid-template-columns: 1.5ch minmax(0, 1fr) 9rem 3ch 5.5rem;
    align-items: center;
    column-gap: 0.9rem;
    padding: 0.85rem 0;

    ${media.bp600`
      grid-template-columns: 1.5ch minmax(0, 1fr) 3ch 4.5rem;

      .meter {
        display: none;
      }
    `};
  }

  .name {
    font-weight: 600;
  }

  .weight {
    ${mixins.monoLabel};
    margin-left: 0.6rem;
    color: ${colors.muted};
    font-weight: 400;
    white-space: nowrap;

    ${media.bp600`
      display: block;
      margin: 0.1rem 0 0;
    `};
  }

  .score {
    ${mixins.monoText};
    text-align: right;
    font-size: 1.125rem;
    font-weight: 600;
  }

  .score.none {
    color: ${colors.muted};
  }

  .coverage {
    ${mixins.monoLabel};
    text-align: right;
    color: ${colors.muted};
  }

  .body {
    padding: 0 0 1rem 2.4ch;
  }

  .note {
    margin-bottom: 0.6rem;
    color: ${colors.muted};
    font-size: 0.875rem;
  }
`;

/**
 * Expandable dimension rows with their scores and coverage; each opens to its checks. Used for
 * both the profile and a repository analysis.
 */
export const DimensionList = ({ dimensions }) => (
  <Dimensions>
    {dimensions.map(dimension => {
      const scored = Number.isFinite(dimension.score);
      return (
        <Disclosure key={dimension.id}>
          <summary>
            <span className="name">
              {dimension.label}
              <span className="weight">weight {dimension.weight}%</span>
            </span>
            <span className="meter">
              {scored && <Meter value={dimension.score} label={`${dimension.label} score`} />}
            </span>
            <span className={`score${scored ? '' : ' none'}`}>{formatScore(dimension.score)}</span>
            <span className="coverage" title="Share of the possible points that could be assessed">
              cov {formatCoverage(dimension.coverage)}
            </span>
          </summary>
          <div className="body">
            {!scored && (
              <p className="note">
                Not scored: too little of this dimension could be assessed. Unknown checks are
                excluded, not counted as zero.
              </p>
            )}
            <CheckList checks={dimension.checks} />
          </div>
        </Disclosure>
      );
    })}
  </Dimensions>
);

DimensionList.propTypes = {
  dimensions: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default CheckList;
