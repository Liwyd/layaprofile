import PropTypes from 'prop-types';
import VisuallyHidden from './VisuallyHidden';

/**
 * Announces asynchronous status changes to assistive technology without showing anything. The
 * region stays in the document so a later change to `message` is announced.
 */
const LiveRegion = ({ message }) => (
  <VisuallyHidden role="status" aria-live="polite" aria-atomic="true">
    {message}
  </VisuallyHidden>
);

LiveRegion.propTypes = {
  message: PropTypes.string,
};

export default LiveRegion;
