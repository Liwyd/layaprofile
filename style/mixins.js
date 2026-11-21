import { css } from 'styled-components';
import theme from './theme';
const { colors, fonts, radius, transition } = theme;

const mixins = {
  // Small uppercase mono text for labels, metadata and numbers.
  monoLabel: css`
    font-family: ${fonts.mono};
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.06em;
    line-height: 1.4;
    text-transform: uppercase;
    font-variant-numeric: tabular-nums;
  `,

  // Mono text that is not a label: figures, names and values.
  monoText: css`
    font-family: ${fonts.mono};
    font-variant-numeric: tabular-nums;
  `,

  // Hidden visually but still announced by assistive technology.
  visuallyHidden: css`
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  `,

  ellipsis: css`
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  `,

  focusRing: css`
    outline: 2px solid ${colors.accent};
    outline-offset: 2px;
  `,

  // Shared by buttons and button-like links.
  button: css`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.55rem 1rem;
    border: 1px solid ${colors.ink};
    border-radius: ${radius};
    background: ${colors.ink};
    color: ${colors.paper};
    font-family: inherit;
    font-size: 0.9375rem;
    font-weight: 500;
    line-height: 1.25;
    text-decoration: none;
    cursor: pointer;
    transition:
      background-color ${transition},
      border-color ${transition},
      color ${transition};

    &:hover:not(:disabled) {
      background: ${colors.accentText};
      border-color: ${colors.accentText};
    }

    &:disabled {
      cursor: default;
      opacity: 0.55;
    }
  `,
};

export default mixins;
