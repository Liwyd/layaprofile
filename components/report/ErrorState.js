import PropTypes from 'prop-types';
import Link from 'next/link';
import styled from 'styled-components';
import { theme, mixins } from '../../style';
import Container from '../ui/Container';
import Button from '../ui/Button';
const { colors } = theme;

const Wrapper = styled.section`
  padding: clamp(1rem, 6vw, 4rem) 0;

  .kicker {
    ${mixins.monoLabel};
    margin-bottom: 1rem;
    color: ${colors.accentText};
  }

  h1 {
    max-width: 18ch;
    font-size: clamp(2.25rem, 6vw, 4rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.05;
    overflow-wrap: anywhere;
  }

  .message {
    max-width: 52ch;
    margin-top: 1.25rem;
    color: ${colors.muted};
    font-size: 1.0625rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 2rem;
  }

  .extra {
    margin-top: 2.5rem;
  }

  .actions a {
    ${mixins.button};
    background: transparent;
    border-color: ${colors.rule};
    color: ${colors.ink};

    &:hover {
      background: transparent;
      border-color: ${colors.ink};
      color: ${colors.ink};
    }
  }
`;

const COPY = {
  'not-found': {
    kicker: '404 — Not found',
    title: 'User not found',
  },
  invalid: {
    kicker: '404 — Not found',
    title: 'Not a GitHub username',
  },
  'rate-limited': {
    kicker: '429 — Rate limited',
    title: 'Request limit reached',
  },
  network: {
    kicker: 'Connection problem',
    title: 'Could not reach the server',
  },
  generic: {
    kicker: 'Error',
    title: 'Something went wrong',
  },
};

/**
 * A full-page failure (the profile itself could not be loaded). `error` comes from
 * `describeError`. Retrying only makes sense for failures that can pass, so a missing user offers
 * a new search instead. `copy` overrides the kicker, title or message for a page with its own
 * wording (the comparison); `children` render below the actions (a form to correct the input).
 */
const ErrorState = ({ error, username, onRetry, copy: override, children }) => {
  const copy = { ...(COPY[error.kind] ?? COPY.generic), ...override };
  const missing = error.kind === 'not-found' || error.kind === 'invalid';
  const message =
    override?.message ??
    (error.kind === 'invalid'
      ? 'GitHub usernames use letters, digits and single hyphens, up to 39 characters.'
      : error.kind === 'not-found'
        ? `GitHub has no public user named "${username}". Check the spelling and try again.`
        : error.message);
  return (
    <Container>
      <Wrapper role="alert">
        <p className="kicker">{copy.kicker}</p>
        <h1>{copy.title}</h1>
        <p className="message">{message}</p>
        <div className="actions">
          {!missing && onRetry && <Button onClick={onRetry}>Try again</Button>}
          <Link href="/">Search another profile</Link>
        </div>
        {children && <div className="extra">{children}</div>}
      </Wrapper>
    </Container>
  );
};

ErrorState.propTypes = {
  error: PropTypes.shape({ kind: PropTypes.string.isRequired, message: PropTypes.string })
    .isRequired,
  username: PropTypes.string,
  onRetry: PropTypes.func,
  copy: PropTypes.shape({
    kicker: PropTypes.string,
    title: PropTypes.string,
    message: PropTypes.string,
  }),
  children: PropTypes.node,
};

export default ErrorState;
