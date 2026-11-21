import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme } from '../../style';
const { colors } = theme;

const Track = styled.div`
  flex: 1;
  min-width: 3rem;
  height: ${props => props.$height};
  background: ${colors.fill};
  box-shadow: inset 0 0 0 1px ${colors.rule};

  span {
    display: block;
    height: 100%;
    background: ${props => (props.$tone === 'muted' ? colors.muted : colors.ink)};
  }
`;

/**
 * A thin horizontal bar for a value from 0 to `max`. It is exposed as an ARIA meter with a text
 * label, and the figure is always shown next to it by the caller, so it never carries meaning
 * alone. Out-of-range values are clamped.
 */
const Meter = ({ value, max = 100, label, tone = 'ink', height = '6px' }) => {
  const clamped = Math.min(max, Math.max(0, value));
  return (
    <Track
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      $tone={tone}
      $height={height}>
      <span style={{ width: `${(clamped / max) * 100}%` }} />
    </Track>
  );
};

Meter.propTypes = {
  value: PropTypes.number.isRequired,
  max: PropTypes.number,
  label: PropTypes.string.isRequired,
  tone: PropTypes.oneOf(['ink', 'muted']),
  height: PropTypes.string,
};

export default Meter;
