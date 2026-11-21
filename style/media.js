import { css } from 'styled-components';

// Breakpoints apply to viewports at or below the given width.
const sizes = {
  bp900: 900,
  bp600: 600,
  bp400: 400,
};

// Iterate through the sizes and create a media template. `em` units keep working when users
// change their browser font size: https://zellwk.com/blog/media-query-units/
export const media = Object.keys(sizes).reduce((accumulator, label) => {
  const emSize = sizes[label] / 16;
  accumulator[label] = (...args) => css`
    @media (max-width: ${emSize}em) {
      ${css(...args)};
    }
  `;
  return accumulator;
}, {});

export default media;
