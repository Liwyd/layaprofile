import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins } from '../../style';
import Container from '../ui/Container';
import { formatDateTime } from '../../lib/ui/format';
const { colors } = theme;

const Strip = styled.aside`
  padding: 0.7rem 0;
  border-bottom: 1px solid ${colors.rule};
  background: ${colors.fill};
  font-size: 0.875rem;

  p + p {
    margin-top: 0.25rem;
  }

  .k {
    ${mixins.monoLabel};
    margin-right: 0.6rem;
    color: ${colors.accentText};
  }
`;

/**
 * Quiet notes about how current or complete the data is: a stale cached fallback, and a
 * repository list that was cut at the fetch limit. Renders nothing when there is nothing to say.
 */
const Notices = ({ stale = false, fetchedAt, truncated = false, repoCount }) => {
  if (!stale && !truncated) return null;
  const when = stale ? formatDateTime(fetchedAt) : null;
  return (
    <Strip role="status">
      <Container>
        {stale && (
          <p>
            <span className="k">Stale</span>
            {when
              ? `GitHub is unreachable or limiting requests, so this is cached data from ${when}.`
              : 'GitHub is unreachable or limiting requests, so this is cached data that may be out of date.'}
          </p>
        )}
        {truncated && (
          <p>
            <span className="k">Partial</span>
            {`Only the ${repoCount} most recently pushed repositories were loaded. Counts and scores use those.`}
          </p>
        )}
      </Container>
    </Strip>
  );
};

Notices.propTypes = {
  stale: PropTypes.bool,
  fetchedAt: PropTypes.string,
  truncated: PropTypes.bool,
  repoCount: PropTypes.number,
};

export default Notices;
