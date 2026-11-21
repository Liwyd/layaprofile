import { useMemo } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins, media } from '../../style';
import { SECTIONS } from '../../lib/ui/sections';
import { useActiveSection } from './hooks';
const { colors, transition } = theme;

const Nav = styled.nav`
  ${media.bp900`
    display: none;
  `};

  ol {
    display: flex;
    gap: 1.1rem;
  }

  a {
    ${mixins.monoLabel};
    display: inline-block;
    padding: 0.3rem 0;
    border-bottom: 2px solid transparent;
    color: ${colors.muted};
    text-decoration: none;
    transition:
      color ${transition},
      border-color ${transition};

    &:hover {
      color: ${colors.ink};
    }

    &[aria-current='location'] {
      border-bottom-color: ${colors.accent};
      color: ${colors.ink};
    }
  }

  .n {
    margin-right: 0.4rem;
    color: ${colors.accentText};
  }
`;

/**
 * In-page navigation to the numbered sections (the report's by default); the one being read is
 * marked as current. `sections` must be a stable list, such as a module constant.
 */
const SectionNav = ({ refreshKey, sections = SECTIONS, label = 'Report sections' }) => {
  const ids = useMemo(() => sections.map(section => section.id), [sections]);
  const active = useActiveSection(ids, refreshKey);
  return (
    <Nav aria-label={label}>
      <ol>
        {sections.map(section => (
          <li key={section.id}>
            <a
              href={`#${section.id}`}
              aria-current={active === section.id ? 'location' : undefined}>
              <span className="n">{section.number}</span>
              {section.navLabel}
            </a>
          </li>
        ))}
      </ol>
    </Nav>
  );
};

SectionNav.propTypes = {
  refreshKey: PropTypes.string,
  sections: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      number: PropTypes.string.isRequired,
      navLabel: PropTypes.string.isRequired,
    }),
  ),
  label: PropTypes.string,
};

export default SectionNav;
