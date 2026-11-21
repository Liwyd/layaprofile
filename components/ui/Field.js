import styled from 'styled-components';
import { theme, mixins, media } from '../../style';
const { colors, radius, transition } = theme;

// A labelled mono text input with an optional error line. Used by the search and compare forms.
// An invalid input (`aria-invalid="true"`) gets the accent border; the message is in `.error`.
const Field = styled.div`
  label {
    ${mixins.monoLabel};
    display: block;
    margin-bottom: 0.4rem;
    color: ${colors.muted};
  }

  .row {
    display: flex;
    gap: 0.5rem;

    ${media.bp400`
      flex-direction: column;
    `};
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 0.7rem 0.85rem;
    border: 1px solid ${colors.ink};
    border-radius: ${radius};
    background: transparent;
    font-family: ${theme.fonts.mono};
    font-size: 1.125rem;
    transition: border-color ${transition};

    &::placeholder {
      color: ${colors.muted};
      opacity: 1;
    }

    &[aria-invalid='true'] {
      border-color: ${colors.accent};
    }
  }

  .error {
    margin-top: 0.5rem;
    color: ${colors.accentText};
    font-size: 0.9375rem;
  }
`;

export default Field;
