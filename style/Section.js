import styled from 'styled-components';
import theme from './theme';
import media from './media';
import mixins from './mixins';
const { colors, layout } = theme;

// A report section: a hairline rule, then a label column (3 of 12 columns) and the content
// (9 of 12) on desktop, stacked on small screens.
export const Section = styled.section`
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  column-gap: ${layout.columnGap};
  padding: clamp(1.75rem, 5vw, 3.25rem) 0;
  border-top: 1px solid ${colors.rule};
  scroll-margin-top: calc(${layout.headerHeight} + 0.5rem);

  ${media.bp900`
    display: block;
  `};
`;

export const SectionLabel = styled.div`
  grid-column: 1 / span 3;
  align-self: start;
  position: sticky;
  top: calc(${layout.headerHeight} + 1.5rem);

  .number {
    ${mixins.monoLabel};
    display: block;
    margin-bottom: 0.4rem;
    color: ${colors.accentText};
  }

  .title {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  ${media.bp900`
    position: static;
    margin-bottom: 1.5rem;

    .number {
      display: inline;
      margin: 0 0.4rem 0 0;

      &::after {
        content: ' —';
      }
    }

    .title {
      display: inline;
    }
  `};
`;

export const SectionBody = styled.div`
  grid-column: 4 / -1;
  min-width: 0;
`;

export default Section;
