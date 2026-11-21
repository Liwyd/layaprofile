import { useId, useState } from 'react';
import { useRouter } from 'next/router';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { media } from '../../style';
import Button from './Button';
import Field from './Field';
import { comparePath, pairProblemMessage, parseComparePair } from '../../lib/ui/compare';

const Fields = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: end;
  gap: 0.75rem;
  max-width: 42rem;

  ${media.bp600`
    grid-template-columns: minmax(0, 1fr);
  `};

  input {
    width: 100%;
    font-size: 1rem;
  }

  .error {
    grid-column: 1 / -1;
    margin: 0;
  }
`;

/**
 * Two username inputs that lead to /compare/[a]/[b]. Used on the home page and, with the current
 * names filled in, to edit a comparison. Validation is shared with the page itself
 * (`parseComparePair`), so the form refuses exactly what the page would.
 */
const CompareForm = ({ initialA = '', initialB = '', submitLabel = 'Compare' }) => {
  const router = useRouter();
  const id = useId();
  const [first, setFirst] = useState(initialA);
  const [second, setSecond] = useState(initialB);
  const [error, setError] = useState(null);

  const handleSubmit = event => {
    event.preventDefault();
    const pair = parseComparePair(first, second);
    if (!pair.ok) {
      setError(pairProblemMessage(pair));
      return;
    }
    router.push(comparePath(pair.a, pair.b));
  };

  const inputProps = {
    type: 'text',
    autoComplete: 'off',
    autoCapitalize: 'none',
    spellCheck: false,
    'aria-invalid': error !== null,
    'aria-describedby': error ? `${id}-error` : undefined,
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field>
        <Fields>
          <div>
            <label htmlFor={`${id}-a`}>First username</label>
            <input
              id={`${id}-a`}
              value={first}
              onChange={event => {
                setFirst(event.target.value);
                setError(null);
              }}
              {...inputProps}
            />
          </div>
          <div>
            <label htmlFor={`${id}-b`}>Second username</label>
            <input
              id={`${id}-b`}
              value={second}
              onChange={event => {
                setSecond(event.target.value);
                setError(null);
              }}
              {...inputProps}
            />
          </div>
          <Button type="submit" $variant="ghost">
            {submitLabel}
          </Button>
          {error && (
            <p id={`${id}-error`} className="error" role="alert">
              {error}
            </p>
          )}
        </Fields>
      </Field>
    </form>
  );
};

CompareForm.propTypes = {
  initialA: PropTypes.string,
  initialB: PropTypes.string,
  submitLabel: PropTypes.string,
};

export default CompareForm;
