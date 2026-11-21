import styled, { keyframes } from 'styled-components';
import { theme } from '../../style';
const { colors, radius } = theme;

const sweep = keyframes`
  to {
    transform: translateX(100%);
  }
`;

// A placeholder block. The highlight sweep is a transform animation and is removed entirely
// under `prefers-reduced-motion`, which leaves a static block.
const Skeleton = styled.div`
  position: relative;
  overflow: hidden;
  width: ${props => props.$width ?? '100%'};
  height: ${props => props.$height ?? '1rem'};
  border-radius: ${radius};
  background: ${colors.fill};

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    transform: translateX(-100%);
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(in srgb, ${colors.paper} 55%, transparent),
      transparent
    );
    animation: ${sweep} 1.4s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    &::after {
      display: none;
    }
  }
`;

export default Skeleton;
