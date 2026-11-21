import styled from 'styled-components';
import { theme, mixins } from '../../style';
import Container from './Container';
const { colors } = theme;

const StyledFooter = styled.footer`
  margin-top: clamp(2rem, 6vw, 4rem);
  padding: 1.75rem 0 2.5rem;
  border-top: 1px solid ${colors.rule};
  color: ${colors.muted};
  font-size: 0.875rem;

  .lines {
    display: grid;
    gap: 0.4rem;
  }

  .meta {
    ${mixins.monoLabel};
    text-transform: none;
    letter-spacing: 0.02em;
  }
`;

const REPO_URL = 'https://github.com/Liwyd/layaprofile';
const ORIGINAL_URL = 'https://github.com/bchiang7/octoprofile';

const External = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer">
    {children}
  </a>
);

const Footer = () => (
  <StyledFooter>
    <Container>
      <div className="lines">
        <p>
          Built on <External href={ORIGINAL_URL}>OctoProfile</External> by Brittany Chiang (MIT).
        </p>
        <p className="meta">
          <External href={REPO_URL}>LayaProfile on GitHub</External>
          {' · '}Public GitHub data. Scores are transparent checklists, not benchmarks.
        </p>
      </div>
    </Container>
  </StyledFooter>
);

export default Footer;
