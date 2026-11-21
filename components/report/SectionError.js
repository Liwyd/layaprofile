import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins } from '../../style';
import Button from '../ui/Button';
const { colors, radius } = theme;

const Box = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  padding: 0.9rem 1rem;
  border: 1px dashed ${colors.muted};
  border-radius: ${radius};

  .title {
    ${mixins.monoLabel};
    margin-bottom: 0.2rem;
    color: ${colors.accentText};
  }

  .message {
    max-width: 60ch;
    color: ${colors.muted};
    font-size: 0.9375rem;
  }
`;

/**
 * An inline failure of one optional part of the page, with Retry. It never replaces the rest of
 * the report.
 */
const SectionError = ({
  title = 'Could not load this section',
  message,
  onRetry,
  retryLabel = 'Retry',
}) => (
  <Box role="status">
    <div>
      <p className="title">{title}</p>
      {message && <p className="message">{message}</p>}
    </div>
    {onRetry && (
      <Button $variant="ghost" $size="small" onClick={onRetry}>
        {retryLabel}
      </Button>
    )}
  </Box>
);

SectionError.propTypes = {
  title: PropTypes.string,
  message: PropTypes.string,
  onRetry: PropTypes.func,
  retryLabel: PropTypes.string,
};

export default SectionError;
