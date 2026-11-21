import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins, media } from '../../style';
import { SECTIONS, SECTION_IDS } from '../../lib/ui/sections';
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

/** In-page navigation to the numbered sections; the one being read is marked as current. */
const SectionNav = ({ refreshKey }) => {
  const active = useActiveSection(SECTION_IDS, refreshKey);
  return (
    <Nav aria-label="Report sections">
      <ol>
        {SECTIONS.map(section => (
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
};

export default SectionNav;
