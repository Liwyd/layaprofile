import styled from 'styled-components';
import { theme, mixins } from '../../style';
const { colors } = theme;

// A small muted note under a chart or list.
export const Caption = styled.p`
  max-width: 62ch;
  color: ${colors.muted};
  font-size: 0.875rem;
  line-height: 1.5;
`;

// A subheading inside a section, set as a mono label.
export const Label = styled.h3`
  ${mixins.monoLabel};
  margin: 0 0 0.75rem;
  color: ${colors.muted};
  letter-spacing: 0.06em;
`;

// Mono figures and names.
export const Mono = styled.span`
  ${mixins.monoText};
`;
