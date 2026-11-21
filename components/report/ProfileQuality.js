import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins, media } from '../../style';
import ReportSection from '../ui/ReportSection';
import Disclosure from '../ui/Disclosure';
import { Caption, Label } from '../ui/Text';
import ScoreMeter from './ScoreMeter';
import { DimensionList } from './CheckList';
import RecommendationList from './RecommendationList';
import SectionError from './SectionError';
const { colors } = theme;

const Block = styled.div`
  margin-top: 2.25rem;
`;

const Findings = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.5rem;

  ${media.bp900`
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  `};

  > details {
    border-top: 1px solid ${colors.rule};
  }

  ${media.bp900`
    > details:last-child {
      border-bottom: 1px solid ${colors.rule};
    }
  `};

  summary {
    padding: 0.75rem 0;
    font-weight: 600;
  }

  .count {
    ${mixins.monoText};
    margin-left: 0.5rem;
    color: ${colors.muted};
    font-weight: 400;
  }

  ul {
    padding-bottom: 0.75rem;
  }

  li {
    padding: 0.4rem 0;
    font-size: 0.875rem;
  }

  .ev {
    display: block;
    color: ${colors.muted};
  }

  .hint {
    padding-bottom: 0.5rem;
    color: ${colors.muted};
    font-size: 0.8125rem;
  }
`;

const FindingGroup = ({ title, items, hint, open = false }) => (
  <Disclosure open={open}>
    <summary>
      {title}
      <span className="count">{items.length}</span>
    </summary>
    {hint && <p className="hint">{hint}</p>}
    {items.length > 0 ? (
      <ul>
        {items.map(item => (
          <li key={`${item.dimensionId}.${item.checkId}`}>
            {item.label}
            <span className="ev">{item.evidence}</span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="hint">None.</p>
    )}
  </Disclosure>
);

FindingGroup.propTypes = {
  title: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  hint: PropTypes.string,
  open: PropTypes.bool,
};

/**
 * The transparent profile score: the headline with its coverage, every dimension with its
 * checks, the strengths, weaknesses and unknowns, and the improvement checklist.
 */
const ProfileQuality = ({ profileScore, onRetry }) => {
  if (!profileScore || !Array.isArray(profileScore.dimensions)) {
    return (
      <ReportSection id="quality">
        <SectionError
          title="Profile quality is unavailable"
          message="The profile score was not part of the response."
          onRetry={onRetry}
        />
      </ReportSection>
    );
  }

  const { score, label, coverage, dimensions, strengths, weaknesses, unknowns, recommendations } =
    profileScore;

  return (
    <ReportSection id="quality">
      <ScoreMeter score={score} label={label} coverage={coverage} />
      {profileScore.notes?.map(note => (
        <Caption key={note} style={{ marginTop: '0.75rem' }}>
          {note}
        </Caption>
      ))}

      <Block>
        <Label>Dimensions</Label>
        <DimensionList dimensions={dimensions} />
      </Block>

      <Block>
        <Label>Findings</Label>
        <Findings>
          <FindingGroup title="Strengths" items={strengths} />
          <FindingGroup title="Weaknesses" items={weaknesses} open={weaknesses.length > 0} />
          <FindingGroup
            title="Unknown"
            items={unknowns}
            hint="Not assessed. Excluded from the score, not counted as zero."
          />
        </Findings>
      </Block>

      <Block>
        <Label>Improvement checklist</Label>
        <RecommendationList
          items={recommendations}
          dimensions={dimensions}
          empty="No improvements to suggest from the data that could be assessed."
        />
      </Block>

      <Caption style={{ marginTop: '2rem' }}>
        A completeness checklist of public profile data, not an industry benchmark. Popularity is
        not scored.
      </Caption>
    </ReportSection>
  );
};

ProfileQuality.propTypes = {
  profileScore: PropTypes.object,
  onRetry: PropTypes.func,
};

export default ProfileQuality;
