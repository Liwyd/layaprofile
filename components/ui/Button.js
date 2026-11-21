import styled, { css } from 'styled-components';
import { theme, mixins } from '../../style';
const { colors } = theme;

// Solid ink button; `$variant="ghost"` is the quiet outlined form, `$size="small"` the compact one.
const Button = styled.button.attrs(props => ({ type: props.type ?? 'button' }))`
  ${mixins.button};

  ${props =>
    props.$variant === 'ghost' &&
    css`
      background: transparent;
      border-color: ${colors.rule};
      color: ${colors.ink};

      &:hover:not(:disabled) {
        background: transparent;
        border-color: ${colors.ink};
        color: ${colors.ink};
      }

      &[aria-expanded='true'],
      &[aria-pressed='true'] {
        border-color: ${colors.accent};
        color: ${colors.accentText};
      }
    `};

  ${props =>
    props.$size === 'small' &&
    css`
      padding: 0.3rem 0.65rem;
      font-size: 0.8125rem;
    `};
`;

export default Button;
