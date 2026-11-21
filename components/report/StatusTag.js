import PropTypes from 'prop-types';
import styled, { css } from 'styled-components';
import { theme, mixins } from '../../style';
import { statusInfo } from '../../lib/ui/format';
const { colors, radius } = theme;

// Every status carries a text label and a distinct marker, so colour is never the only cue:
//   verified: filled square, ink        rule: hollow square, ink
//   model: rotated square, accent       unknown: hatched square, muted, dashed outline
const TONES = {
  verified: css`
    border-color: ${colors.ink};
    color: ${colors.ink};

    &::before {
      background: currentColor;
    }
  `,
  rule: css`
    border-color: ${colors.ink};
    color: ${colors.ink};

    &::before {
      box-shadow: inset 0 0 0 1.5px currentColor;
    }
  `,
  model: css`
    border-color: ${colors.accent};
    color: ${colors.accentText};

    &::before {
      background: currentColor;
      transform: rotate(45deg) scale(0.85);
    }
  `,
  unknown: css`
    border-style: dashed;
    border-color: ${colors.muted};
    color: ${colors.muted};

    &::before {
      background: repeating-linear-gradient(135deg, currentColor 0 1.5px, transparent 1.5px 3px);
      box-shadow: inset 0 0 0 1px currentColor;
    }
  `,
};

const Tag = styled.span`
  ${mixins.monoLabel};
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.1rem 0.45rem;
  border: 1px solid;
  border-radius: ${radius};
  font-size: 0.68rem;
  white-space: nowrap;

  &::before {
    content: '';
    flex: none;
    width: 0.5rem;
    height: 0.5rem;
  }

  ${props => TONES[props.$status]};
`;

/** The evidence status of a check: verified, rule, model or unknown. */
const StatusTag = ({ status }) => {
  const { label, hint } = statusInfo(status);
  return (
    <Tag $status={Object.hasOwn(TONES, status) ? status : 'unknown'} title={hint}>
      {label}
    </Tag>
  );
};

StatusTag.propTypes = {
  status: PropTypes.string,
};

export default StatusTag;
