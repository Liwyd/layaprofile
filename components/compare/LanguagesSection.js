import { useMemo } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins, media } from '../../style';
import ReportSection from '../ui/ReportSection';
import { Caption, Label } from '../ui/Text';
import VisuallyHidden from '../ui/VisuallyHidden';
import SideMark from './SideMark';
import { groupLanguages } from '../../lib/ui/compare';
const { colors } = theme;

const Groups = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2rem;

  ${media.bp900`
    grid-template-columns: minmax(0, 1fr);
    gap: 2.25rem;
  `};

  ol {
    border-top: 1px solid ${colors.ink};
  }

  li {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.55rem 0;
    border-bottom: 1px solid ${colors.rule};
    font-size: 0.9375rem;
  }

  .name {
    min-width: 0;
    ${mixins.ellipsis};
  }

  .counts {
    ${mixins.monoText};
    display: flex;
    flex: none;
    align-items: center;
    gap: 0.9rem;
    font-size: 0.875rem;
  }

  .counts span {
    display: inline-flex;
    align-items: center;
  }

  .none {
    padding: 0.55rem 0;
    border-bottom: 1px solid ${colors.rule};
    color: ${colors.muted};
    font-size: 0.9375rem;
  }
`;

// The repository count of each side that is shown, with the side's name for screen readers.
const Counts = ({ entry, sides, logins }) => (
  <span className="counts">
    {sides.map(side => (
      <span key={side}>
        <SideMark side={side} />
        <VisuallyHidden>{logins[side]}: </VisuallyHidden>
        {entry[side]}
        <VisuallyHidden> repositories</VisuallyHidden>
      </span>
    ))}
  </span>
);

Counts.propTypes = {
  entry: PropTypes.object.isRequired,
  sides: PropTypes.arrayOf(PropTypes.string).isRequired,
  logins: PropTypes.object.isRequired,
};

const Group = ({ title, entries, sides, logins, empty }) => (
  <div>
    <Label>{`${title} (${entries.length})`}</Label>
    {entries.length > 0 ? (
      <ol>
        {entries.map(entry => (
          <li key={entry.language}>
            <span className="name">{entry.language}</span>
            <Counts entry={entry} sides={sides} logins={logins} />
          </li>
        ))}
      </ol>
    ) : (
      <p className="none">{empty}</p>
    )}
  </div>
);

Group.propTypes = {
  title: PropTypes.string.isRequired,
  entries: PropTypes.arrayOf(PropTypes.object).isRequired,
  sides: PropTypes.arrayOf(PropTypes.string).isRequired,
  logins: PropTypes.object.isRequired,
  empty: PropTypes.string.isRequired,
};

/** Primary languages split into shared, only A and only B, with repository counts (no shares). */
const LanguagesSection = ({ languages, logins }) => {
  const groups = useMemo(() => groupLanguages(languages), [languages]);

  if (languages.length === 0) {
    return (
      <ReportSection id="languages">
        <Caption>
          Neither profile reports a primary language for its own repositories, so there is nothing
          to compare.
        </Caption>
      </ReportSection>
    );
  }

  return (
    <ReportSection id="languages">
      <Groups>
        <Group
          title="Shared"
          entries={groups.shared}
          sides={['a', 'b']}
          logins={logins}
          empty="No language is the primary language of repositories on both sides."
        />
        <Group
          title={`Only ${logins.a}`}
          entries={groups.onlyA}
          sides={['a']}
          logins={logins}
          empty="No language is the primary language of this profile alone."
        />
        <Group
          title={`Only ${logins.b}`}
          entries={groups.onlyB}
          sides={['b']}
          logins={logins}
          empty="No language is the primary language of this profile alone."
        />
      </Groups>
      <Caption style={{ marginTop: '1rem' }}>
        Repositories per primary language (own, non-fork), for the most used languages on each side.
        Counts only: not lines of code, and not a skill level.
      </Caption>
    </ReportSection>
  );
};

LanguagesSection.propTypes = {
  languages: PropTypes.arrayOf(PropTypes.object).isRequired,
  logins: PropTypes.shape({ a: PropTypes.string, b: PropTypes.string }).isRequired,
};

export default LanguagesSection;
