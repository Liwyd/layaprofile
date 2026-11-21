import styled from 'styled-components';
import { theme } from '../../style';
const { layout } = theme;

// Centers content in the report column: up to 1180px wide with a fluid gutter.
const Container = styled.div`
  width: 100%;
  max-width: ${layout.maxWidth};
  margin: 0 auto;
  padding: 0 ${layout.gutter};
`;

export default Container;
