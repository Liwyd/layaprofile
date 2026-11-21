import styled from 'styled-components';
import { theme, mixins } from '../../style';
const { colors } = theme;

// A native <details> element, so it is keyboard operable and announced correctly. The summary
// gets a "+" / "-" marker in place of the browser triangle. Style the summary's content where
// the disclosure is used.
const Disclosure = styled.details`
  > summary {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    list-style: none;
    cursor: pointer;

    &::-webkit-details-marker {
      display: none;
    }

    &::before {
      ${mixins.monoText};
      content: '+';
      flex: none;
      width: 1ch;
      color: ${colors.muted};
    }
  }

  &[open] > summary::before {
    content: '−';
  }
`;

export default Disclosure;
