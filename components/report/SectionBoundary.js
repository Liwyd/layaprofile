import { Component } from 'react';
import PropTypes from 'prop-types';
import ReportSection from '../ui/ReportSection';
import SectionError from './SectionError';

/**
 * Contains a rendering failure to one section (`id` is the section id), so one broken optional
 * section never blanks the page. The failure is logged; the section keeps its frame and shows an
 * inline error with a way to try again.
 */
class SectionBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(`Section "${this.props.id}" failed to render:`, error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <ReportSection id={this.props.id}>
        <SectionError
          title="This section could not be displayed"
          message="The rest of the report is not affected."
          onRetry={() => this.setState({ failed: false })}
        />
      </ReportSection>
    );
  }
}

SectionBoundary.propTypes = {
  id: PropTypes.string.isRequired,
  children: PropTypes.node,
};

export default SectionBoundary;
