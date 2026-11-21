// Design tokens for the "editorial engineering report" look. Colours are CSS custom properties
// (defined with their dark-mode values in GlobalStyle), so the palette switches with
// `prefers-color-scheme` without any JavaScript. Styled components use the `var(...)` strings
// below; scripts that need a resolved colour (the chart) read the property from the document.

const theme = {
  colors: {
    paper: 'var(--paper)',
    ink: 'var(--ink)',
    muted: 'var(--muted)',
    rule: 'var(--rule)',
    fill: 'var(--fill)',
    // Rust. Use `accent` for fills, rules and the focus ring; `accentText` for text, which is
    // darkened in light mode to keep AA contrast on the subtle fill.
    accent: 'var(--accent)',
    accentText: 'var(--accent-text)',
  },

  fonts: {
    sans: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    mono: "'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },

  layout: {
    maxWidth: '1180px',
    gutter: 'clamp(1rem, 4vw, 3rem)',
    columnGap: '1.5rem',
    headerHeight: '3.25rem',
  },

  radius: '2px',

  // The only transition used: short, on colour and opacity.
  transition: '120ms ease-out',
};

export default theme;
