import { useMemo } from 'react';
import PropTypes from 'prop-types';
import ProfilesSection from './ProfilesSection';
import MetricsSection from './MetricsSection';
import LanguagesSection from './LanguagesSection';
import SkillOverlapSection from './SkillOverlapSection';
import ActivitySection from './ActivitySection';
import DifferencesSection from './DifferencesSection';
import SectionBoundary from '../report/SectionBoundary';

/**
 * The six comparison sections for a loaded `/api/compare` response. Each sits in its own
 * boundary, so one section that fails to render never blanks the page. `logins` are the
 * canonical logins GitHub returned (the casing the visitor typed may differ).
 */
const Compare = ({ data }) => {
  const { a, b, comparison } = data;
  const logins = useMemo(() => ({ a: a.user.login, b: b.user.login }), [a, b]);
  return (
    <>
      <SectionBoundary id="profiles">
        <ProfilesSection a={a} b={b} />
      </SectionBoundary>
      <SectionBoundary id="metrics">
        <MetricsSection metrics={comparison.metrics} logins={logins} />
      </SectionBoundary>
      <SectionBoundary id="languages">
        <LanguagesSection languages={comparison.languages} logins={logins} />
      </SectionBoundary>
      <SectionBoundary id="skill-overlap">
        <SkillOverlapSection skills={comparison.skills} logins={logins} />
      </SectionBoundary>
      <SectionBoundary id="year-activity">
        <ActivitySection activity={comparison.activity} logins={logins} />
      </SectionBoundary>
      <SectionBoundary id="differences">
        <DifferencesSection differences={comparison.differences} caveats={comparison.caveats} />
      </SectionBoundary>
    </>
  );
};

Compare.propTypes = {
  data: PropTypes.shape({
    a: PropTypes.object.isRequired,
    b: PropTypes.object.isRequired,
    comparison: PropTypes.object.isRequired,
  }).isRequired,
};

export default Compare;
