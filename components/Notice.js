import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, media } from '../style';
const { colors } = theme;

const NoticeStyles = styled.aside`
  padding: 0.75rem 5rem;
  font-size: 0.875rem;
  color: ${colors.grey2};
  background-color: ${colors.offWhite};
  border-top: 1px solid #e1e4e8;

  ${media.bp900`
    padding: 0.75rem 2rem;
  `};
  ${media.bp400`
    padding: 0.75rem 1rem;
  `};

  p {
    margin: 0;
  }
  p + p {
    margin-top: 0.25rem;
  }
`;

const formatDateTime = iso => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

/**
 * Quiet notes about how complete or current the displayed data is.
 * Renders nothing when there is nothing to say.
 */
const Notice = ({ stale = false, fetchedAt, truncated = false, repoLimit = 300 }) => {
  const when = stale && fetchedAt ? formatDateTime(fetchedAt) : null;
  if (!stale && !truncated) return null;

  return (
    <NoticeStyles role="status">
      {stale && (
        <p>
          {when
            ? `GitHub is unreachable or limiting requests, so this data is cached from ${when}.`
            : 'GitHub is unreachable or limiting requests, so this data is cached and may be out of date.'}
        </p>
      )}
      {truncated && <p>{`Only the ${repoLimit} most recently pushed repositories are shown.`}</p>}
    </NoticeStyles>
  );
};

Notice.propTypes = {
  stale: PropTypes.bool,
  fetchedAt: PropTypes.string,
  truncated: PropTypes.bool,
  repoLimit: PropTypes.number,
};

export default Notice;
