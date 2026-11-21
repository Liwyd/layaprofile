import PropTypes from 'prop-types';
import Link from 'next/link';
import styled from 'styled-components';
import { theme } from '../../style';
import Container from './Container';
import Footer from './Footer';
const { colors, layout, radius } = theme;

const SkipLink = styled.a`
  position: absolute;
  top: 0.5rem;
  left: 0.5rem;
  z-index: 100;
  padding: 0.5rem 0.9rem;
  border-radius: ${radius};
  background: ${colors.ink};
  color: ${colors.paper};
  font-size: 0.875rem;
  transform: translateY(-300%);

  &:focus {
    transform: none;
    color: ${colors.paper};
  }
`;

const Header = styled.header`
  position: sticky;
  top: 0;
  z-index: 10;
  background: ${colors.paper};
  border-bottom: 1px solid ${colors.rule};

  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    min-height: ${layout.headerHeight};
  }

  .wordmark {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    font-size: 1.0625rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    text-decoration: none;

    &::before {
      content: '';
      width: 0.55rem;
      height: 0.55rem;
      background: ${colors.accent};
    }

    &:hover {
      color: ${colors.ink};
    }
  }
`;

const Main = styled.main`
  padding-top: clamp(1.5rem, 5vw, 3rem);

  &:focus {
    outline: none;
  }
`;

/**
 * Page frame shared by every page: skip link, sticky header (with an optional in-page `nav`),
 * the main landmark and the footer.
 */
const Layout = ({ nav = null, children }) => (
  <>
    <SkipLink href="#main">Skip to content</SkipLink>
    <Header>
      <Container>
        <div className="bar">
          <Link href="/" className="wordmark" aria-label="LayaProfile home">
            LayaProfile
          </Link>
          {nav}
        </div>
      </Container>
    </Header>
    <Main id="main" tabIndex={-1}>
      {children}
    </Main>
    <Footer />
  </>
);

Layout.propTypes = {
  nav: PropTypes.node,
  children: PropTypes.node,
};

export default Layout;
