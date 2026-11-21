import { useState } from 'react';
import PropTypes from 'prop-types';
import Overview from './Overview';
import ActivityLanguages from './ActivityLanguages';
import ProfileQuality from './ProfileQuality';
import Repositories from './Repositories';
import SkillEvidence from './SkillEvidence';
import LearningPath from './LearningPath';
import SectionBoundary from './SectionBoundary';

/**
 * The six report sections for a loaded profile. Each sits in its own boundary, so a section that
 * fails to render or is missing its data shows an inline error and never blanks the page.
 */
const Report = ({ profile, onReload }) => {
  // One clock reading per loaded report keeps every relative date on the page consistent. The
  // report is unmounted while a profile loads, so each load reads the clock again.
  const [now] = useState(Date.now);
  const { user, repos } = profile;

  return (
    <>
      <SectionBoundary id="overview">
        <Overview profile={profile} />
      </SectionBoundary>
      <SectionBoundary id="activity">
        <ActivityLanguages repos={repos} now={now} />
      </SectionBoundary>
      <SectionBoundary id="quality">
        <ProfileQuality profileScore={profile.profileScore} onRetry={onReload} />
      </SectionBoundary>
      <SectionBoundary id="repositories">
        <Repositories repos={repos} login={user.login} now={now} />
      </SectionBoundary>
      <SectionBoundary id="skills">
        <SkillEvidence skills={profile.skills} onRetry={onReload} />
      </SectionBoundary>
      <SectionBoundary id="learning">
        <LearningPath login={user.login} />
      </SectionBoundary>
    </>
  );
};

Report.propTypes = {
  profile: PropTypes.shape({
    user: PropTypes.object.isRequired,
    repos: PropTypes.array.isRequired,
    profileScore: PropTypes.object,
    skills: PropTypes.object,
  }).isRequired,
  onReload: PropTypes.func.isRequired,
};

export default Report;
