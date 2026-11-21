import { useId } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins } from '../../style';
const { colors, radius, transition } = theme;

const Fieldset = styled.fieldset`
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;

  legend {
    ${mixins.monoLabel};
    padding: 0;
    margin-bottom: 0.4rem;
    color: ${colors.muted};
  }

  .group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .option {
    position: relative;
  }

  input {
    ${mixins.visuallyHidden};
  }

  label {
    display: inline-block;
    padding: 0.3rem 0.7rem;
    border: 1px solid ${colors.rule};
    border-radius: ${radius};
    font-size: 0.875rem;
    line-height: 1.3;
    cursor: pointer;
    transition:
      background-color ${transition},
      border-color ${transition},
      color ${transition};

    &:hover {
      border-color: ${colors.ink};
    }
  }

  input:checked + label {
    background: ${colors.ink};
    border-color: ${colors.ink};
    color: ${colors.paper};
  }

  input:focus-visible + label {
    ${mixins.focusRing};
  }

  input:disabled + label {
    cursor: default;
    opacity: 0.55;
  }
`;

/**
 * A single-choice control built on native radio inputs, so arrow keys and focus behave as the
 * platform defines. `value` may be null (nothing chosen yet).
 */
const Segmented = ({ legend, options, value, onChange, disabled = false }) => {
  const name = useId();
  return (
    <Fieldset disabled={disabled}>
      <legend>{legend}</legend>
      <div className="group">
        {options.map(option => (
          <span className="option" key={option.id}>
            <input
              type="radio"
              id={`${name}-${option.id}`}
              name={name}
              value={option.id}
              checked={value === option.id}
              onChange={() => onChange(option.id)}
            />
            <label htmlFor={`${name}-${option.id}`}>{option.label}</label>
          </span>
        ))}
      </div>
    </Fieldset>
  );
};

Segmented.propTypes = {
  legend: PropTypes.string.isRequired,
  options: PropTypes.arrayOf(
    PropTypes.shape({ id: PropTypes.string.isRequired, label: PropTypes.string.isRequired }),
  ).isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
};

export default Segmented;
