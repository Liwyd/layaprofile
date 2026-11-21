import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme } from '../../style';
const { colors } = theme;

// A small square that keys one side of a comparison: side A is ink, side B the muted grey. The two
// differ in lightness rather than hue, and every use sits next to the user's name, so the mark
// never carries meaning alone. Neither side is "better".
const Mark = styled.span`
  display: inline-block;
  flex: none;
  width: 0.6rem;
  height: 0.6rem;
  margin-right: 0.4rem;
  background: ${props => (props.$side === 'a' ? colors.ink : colors.muted)};
`;

const SideMark = ({ side }) => <Mark $side={side} aria-hidden="true" />;

SideMark.propTypes = { side: PropTypes.oneOf(['a', 'b']).isRequired };

export default SideMark;
