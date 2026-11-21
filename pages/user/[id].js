import PropTypes from 'prop-types';
import Head from '../../components/Head';
import Layout from '../../components/ui/Layout';
import Container from '../../components/ui/Container';
import LiveRegion from '../../components/ui/LiveRegion';
import ErrorState from '../../components/report/ErrorState';
import Notices from '../../components/report/Notices';
import Report from '../../components/report/Report';
import ReportSkeleton from '../../components/report/ReportSkeleton';
import SectionNav from '../../components/report/SectionNav';
import { useProfile } from '../../components/report/hooks';
import { describeError } from '../../lib/ui/api';
import { isValidUsername } from '../../lib/validation';

// What the visitor hears while the page changes state.
const announcement = ({ status, profile, error, username }) => {
  if (status === 'loading') return `Loading the profile of ${username}`;
  if (status === 'ready') return `Profile of ${profile.user.name || profile.user.login} loaded`;
  return error.message;
};

const User = ({ username }) => {
  const { status, profile, error, retry } = useProfile(username);

  // Usernames that GitHub could never have are rejected on the server before any request is made.
  if (!username) {
    return (
      <Layout>
        <Head title="Not found | LayaProfile" />
        <ErrorState error={{ kind: 'invalid' }} />
      </Layout>
    );
  }

  if (status === 'error') {
    const info = describeError(error);
    return (
      <Layout>
        <Head title={`${username} | LayaProfile`} />
        <LiveRegion message={info.message} />
        <ErrorState error={info} username={username} onRetry={retry} />
      </Layout>
    );
  }

  const ready = status === 'ready';
  return (
    <Layout nav={<SectionNav refreshKey={status} />}>
      <Head title={`${username} | LayaProfile`} />
      <LiveRegion message={announcement({ status, profile, error, username })} />
      {ready && (
        <Notices
          stale={profile.stale === true}
          fetchedAt={profile.fetchedAt}
          truncated={profile.truncated === true}
          repoCount={profile.repos.length}
        />
      )}
      <Container>
        {ready ? <Report profile={profile} onReload={retry} /> : <ReportSkeleton />}
      </Container>
    </Layout>
  );
};

User.propTypes = {
  username: PropTypes.string,
};

export const getServerSideProps = async ({ params, res }) => {
  const { id } = params;
  if (!isValidUsername(id)) {
    res.statusCode = 404;
    return { props: { username: null } };
  }
  return { props: { username: id } };
};

export default User;
