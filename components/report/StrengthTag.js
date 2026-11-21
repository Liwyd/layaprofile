import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins } from '../../style';
import { strengthLabel } from '../../lib/ui/format';
const { colors } = theme;

// Pips, shown with the text label: repeated 3, observed 2, weak 1, no public evidence 0.
const PIPS = { repeated: 3, observed: 2, weak: 1, unknown: 0 };

const Pips = styled.span`
  display: inline-flex;
  gap: 2px;

  i {
    width: 0.45rem;
    height: 0.45rem;
    border: 1px solid ${colors.ink};
  }

  i.on {
    background: ${colors.ink};
  }
`;

const Tag = styled.span`
  ${mixins.monoLabel};
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.1rem 0.45rem;
  border: 1px ${props => (props.$strength === 'unknown' ? 'dashed' : 'solid')}
    ${props => (props.$strength === 'unknown' ? colors.muted : colors.ink)};
  color: ${props => (props.$strength === 'unknown' ? colors.muted : colors.ink)};
  font-size: 0.68rem;
  white-space: nowrap;

  ${Pips} i {
    border-color: currentColor;
  }

  ${Pips} i.on {
    background: currentColor;
  }
`;

/**
 * How much public evidence supports a skill category: pips plus the word (repeated, observed,
 * weak or no public evidence). It is evidence strength, never a skill level.
 */
const StrengthTag = ({ strength }) => {
  const key = Object.hasOwn(PIPS, strength) ? strength : 'unknown';
  return (
    <Tag $strength={key}>
      <Pips aria-hidden="true">
        {[0, 1, 2].map(index => (
          <i key={index} className={index < PIPS[key] ? 'on' : undefined} />
        ))}
      </Pips>
      {strengthLabel(key)}
    </Tag>
  );
};

StrengthTag.propTypes = { strength: PropTypes.string };

export default StrengthTag;
