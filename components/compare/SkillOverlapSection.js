import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins, media } from '../../style';
import ReportSection from '../ui/ReportSection';
import { Caption, Label } from '../ui/Text';
import VisuallyHidden from '../ui/VisuallyHidden';
import StrengthTag from '../report/StrengthTag';
import SideMark from './SideMark';
const { colors } = theme;

const Legend = styled.p`
  ${mixins.monoLabel};
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1.25rem;
  margin-bottom: 1.25rem;
  color: ${colors.muted};
`;

const Blocks = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2.25rem 2rem;

  ${media.bp900`
    grid-template-columns: minmax(0, 1fr);
  `};

  ul {
    border-top: 1px solid ${colors.ink};
  }

  li {
    display: grid;
    gap: 0.4rem;
    padding: 0.7rem 0;
    border-bottom: 1px solid ${colors.rule};
  }

  .name {
    font-size: 0.9375rem;
    font-weight: 500;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1rem;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    min-width: 0;
  }

  .none {
    padding: 0.7rem 0;
    border-bottom: 1px solid ${colors.rule};
    color: ${colors.muted};
    font-size: 0.9375rem;
  }

  .plain {
    padding: 0.7rem 0;
    border-bottom: 1px solid ${colors.rule};
    color: ${colors.muted};
    font-size: 0.9375rem;
  }
`;

const Sides = ({ entry, logins }) => (
  <div className="tags">
    {['a', 'b'].map(side => (
      <span key={side} className="tag">
        <SideMark side={side} />
        <VisuallyHidden>{logins[side]}: </VisuallyHidden>
        <StrengthTag strength={entry[side]} />
      </span>
    ))}
  </div>
);

Sides.propTypes = {
  entry: PropTypes.object.isRequired,
  logins: PropTypes.object.isRequired,
};

const Block = ({ title, entries, logins, empty, plain = false }) => (
  <div>
    <Label>{`${title} (${entries.length})`}</Label>
    {entries.length === 0 ? (
      <p className="none">{empty}</p>
    ) : plain ? (
      <p className="plain">{entries.map(entry => entry.label).join(', ')}</p>
    ) : (
      <ul>
        {entries.map(entry => (
          <li key={entry.id}>
            <span className="name">{entry.label}</span>
            <Sides entry={entry} logins={logins} />
          </li>
        ))}
      </ul>
    )}
  </div>
);

Block.propTypes = {
  title: PropTypes.string.isRequired,
  entries: PropTypes.arrayOf(PropTypes.object).isRequired,
  logins: PropTypes.object.isRequired,
  empty: PropTypes.string.isRequired,
  plain: PropTypes.bool,
};

/**
 * Skill categories by who has public evidence: both, one side only, or neither. Strength words
 * say how much public evidence was found, never a skill level; "no public evidence" is not a
 * verified negative.
 */
const SkillOverlapSection = ({ skills, logins }) => (
  <ReportSection id="skill-overlap">
    <Legend aria-hidden="true">
      <span>
        <SideMark side="a" />
        {logins.a}
      </span>
      <span>
        <SideMark side="b" />
        {logins.b}
      </span>
    </Legend>
    <Blocks>
      <Block
        title="Evidence on both sides"
        entries={skills.overlap ?? []}
        logins={logins}
        empty="No category has solid public evidence on both sides."
      />
      <Block
        title={`Distinctive to ${logins.a}`}
        entries={skills.distinctiveToA ?? []}
        logins={logins}
        empty="No category has solid evidence for this profile alone."
      />
      <Block
        title={`Distinctive to ${logins.b}`}
        entries={skills.distinctiveToB ?? []}
        logins={logins}
        empty="No category has solid evidence for this profile alone."
      />
      <Block
        title="No public evidence for either"
        entries={skills.unknownInBoth ?? []}
        logins={logins}
        empty="Every category has some public evidence on at least one side."
        plain
      />
    </Blocks>
    {skills.note && <Caption style={{ marginTop: '1.25rem' }}>{skills.note}</Caption>}
  </ReportSection>
);

SkillOverlapSection.propTypes = {
  skills: PropTypes.shape({
    overlap: PropTypes.array,
    distinctiveToA: PropTypes.array,
    distinctiveToB: PropTypes.array,
    unknownInBoth: PropTypes.array,
    note: PropTypes.string,
  }).isRequired,
  logins: PropTypes.shape({ a: PropTypes.string, b: PropTypes.string }).isRequired,
};

export default SkillOverlapSection;
