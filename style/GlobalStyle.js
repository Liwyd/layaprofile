import { createGlobalStyle } from 'styled-components';
import theme from './theme';
const { fonts, transition } = theme;

// Only Inter is bundled (SIL OFL 1.1, license in public/assets/fonts/Inter). Monospace text uses
// the platform's own font (theme.fonts.mono): no non-redistributable font ships with the app.
// Only the weights the interface uses are declared. Browsers fetch a face when it is first used.
const face = (family, directory, file, weight) => `
  @font-face {
    font-family: '${family}';
    src: url('/assets/fonts/${directory}/${file}.woff2') format('woff2');
    font-weight: ${weight};
    font-style: normal;
    font-display: swap;
  }`;

const fontFaces = [
  face('Inter', 'Inter', 'Inter-Regular', 400),
  face('Inter', 'Inter', 'Inter-Medium', 500),
  face('Inter', 'Inter', 'Inter-SemiBold', 600),
  face('Inter', 'Inter', 'Inter-Bold', 700),
].join('\n');

// Contrast checked against WCAG 2.1 AA (4.5:1 for text):
//   light: ink on paper 15.3, muted on paper 5.2 and on fill 4.7, accent text on paper 5.7 and
//          on fill 5.1.
//   dark:  ink on paper 15.1, muted on paper 6.3 and on fill 5.8, accent text on paper 5.8 and
//          on fill 5.3.
const GlobalStyle = createGlobalStyle`
  ${fontFaces}

  :root {
    color-scheme: light dark;
    --paper: #f4f1ea;
    --ink: #1b1b18;
    --muted: #66655e;
    --rule: #d6d0c2;
    --fill: #eae5d9;
    --accent: #b4441c;
    --accent-text: #a53d17;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --paper: #141412;
      --ink: #ece8df;
      --muted: #9a978d;
      --rule: #34332e;
      --fill: #1e1d1a;
      --accent: #e0703f;
      --accent-text: #e0703f;
    }
  }

  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html {
    -webkit-text-size-adjust: 100%;
    text-size-adjust: 100%;
  }

  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font-family: ${fonts.sans};
    font-size: 1rem;
    line-height: 1.55;
    font-feature-settings: 'tnum' 1;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  ::selection {
    background: var(--accent);
    color: var(--paper);
  }

  h1, h2, h3, h4, h5, h6 {
    margin: 0;
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: -0.015em;
  }

  p {
    margin: 0;
  }

  ul, ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  dl, dd, figure {
    margin: 0;
  }

  a {
    color: inherit;
    text-decoration: underline;
    text-decoration-color: var(--muted);
    text-decoration-thickness: 1px;
    text-underline-offset: 0.2em;
    transition: color ${transition}, text-decoration-color ${transition};

    &:hover {
      color: var(--accent-text);
      text-decoration-color: var(--accent);
    }
  }

  img {
    max-width: 100%;
    vertical-align: middle;
  }

  button,
  input,
  select,
  textarea {
    font: inherit;
    color: inherit;
  }

  button {
    cursor: pointer;
  }

  code, kbd, samp {
    font-family: ${fonts.mono};
    font-size: 0.9em;
  }

  table {
    border-collapse: collapse;
    width: 100%;
  }

  :focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  [hidden] {
    display: none !important;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation: none !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
`;

export default GlobalStyle;
