import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins, media } from '../../style';
import Meter from '../ui/Meter';
import { formatCoverage, formatScore } from '../../lib/ui/format';
import { LABEL_INSUFFICIENT } from '../../lib/analysis/labels';
const { colors } = theme;

const Wrapper = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem 2rem;

  .figure {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
  }

  .score {
    ${mixins.monoText};
    font-size: clamp(3rem, 7vw, 4.5rem);
    font-weight: 500;
    line-height: 1;
    letter-spacing: -0.04em;
  }

  .scale {
    ${mixins.monoLabel};
    color: ${colors.muted};
  }

  .details {
    flex: 1;
    min-width: min(18rem, 100%);
    display: grid;
    gap: 0.6rem;
  }

  .label {
    font-size: 1.125rem;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .label.insufficient {
    color: ${colors.muted};
  }

  .coverage {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    max-width: 26rem;
  }

  .coverage .k {
    ${mixins.monoLabel};
    flex: none;
    color: ${colors.muted};
  }

  .coverage .v {
    ${mixins.monoText};
    flex: none;
    min-width: 3ch;
    text-align: right;
    font-size: 0.875rem;
  }

  .note {
    max-width: 46ch;
    color: ${colors.muted};
    font-size: 0.875rem;
  }

  ${media.bp600`
    .coverage {
      flex-wrap: wrap;
    }
  `};
`;

/**
 * The headline of an assessment: the score, its qualitative label and, separately, how much of
 * the evidence could be assessed. Quality and coverage are never merged. A null score (not
 * enough evidence) is shown as a dash with that explanation, never as 0.
 */
const ScoreMeter = ({ score, label, coverage }) => {
  const hasScore = Number.isFinite(score);
  const hasCoverage = Number.isFinite(coverage);
  return (
    <Wrapper>
      <div className="figure">
        <span className="score">{formatScore(score)}</span>
        {hasScore && <span className="scale">/100</span>}
      </div>
      <div className="details">
        <p className={`label${label === LABEL_INSUFFICIENT ? ' insufficient' : ''}`}>{label}</p>
        {hasCoverage && (
          <div className="coverage">
            <span className="k">Evidence coverage</span>
            <Meter value={coverage * 100} label="Evidence coverage" tone="muted" />
            <span className="v">{formatCoverage(coverage)}</span>
          </div>
        )}
        {!hasScore && (
          <p className="note">
            Not enough public data to assign a score. Missing data is excluded, never counted as
            zero.
          </p>
        )}
      </div>
    </Wrapper>
  );
};

ScoreMeter.propTypes = {
  score: PropTypes.number,
  label: PropTypes.string.isRequired,
  coverage: PropTypes.number,
};

export default ScoreMeter;
