import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins, media } from '../../style';
import ReportSection from '../ui/ReportSection';
import { countRepos } from '../../lib/ui/repoList';
import {
  fetchState,
  formatCount,
  formatDate,
  formatDateTime,
  formatTime,
} from '../../lib/ui/format';
import { safeHttpUrl } from '../../lib/ui/url';
const { colors, radius } = theme;

const Identity = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;

  .avatar {
    flex: none;
    width: 4.5rem;
    height: 4.5rem;
    border-radius: ${radius};
    background: ${colors.fill};
    object-fit: cover;
  }

  h1 {
    font-size: clamp(2.5rem, 6vw, 4.5rem);
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1.02;
    overflow-wrap: anywhere;
  }

  .login {
    ${mixins.monoText};
    margin-top: 0.5rem;
    font-size: 0.9375rem;
  }

  .org {
    ${mixins.monoLabel};
    margin-left: 0.75rem;
    padding: 0.05rem 0.4rem;
    border: 1px solid ${colors.rule};
    color: ${colors.muted};
  }

  ${media.bp400`
    flex-direction: column;
    gap: 0.9rem;
  `};
`;

const Bio = styled.p`
  max-width: 60ch;
  margin-top: 1.5rem;
  font-size: 1.125rem;
  line-height: 1.5;
`;

const Meta = styled.dl`
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 2rem;
  margin-top: 1.25rem;
  font-size: 0.9375rem;

  div {
    display: flex;
    gap: 0.6rem;
    align-items: baseline;
  }

  dt {
    ${mixins.monoLabel};
    color: ${colors.muted};
  }
`;

const Strip = styled.dl`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  margin-top: 2rem;
  border-top: 1px solid ${colors.rule};
  border-bottom: 1px solid ${colors.rule};

  > div {
    padding: 0.9rem 1rem 0.9rem 0;
  }

  > div + div {
    padding-left: 1rem;
    border-left: 1px solid ${colors.rule};
  }

  dt {
    ${mixins.monoLabel};
    color: ${colors.muted};
  }

  dd {
    ${mixins.monoText};
    margin-top: 0.25rem;
    font-size: 1.5rem;
    font-weight: 500;
    letter-spacing: -0.02em;
  }

  ${media.bp900`
    grid-template-columns: repeat(3, minmax(0, 1fr));

    > div:nth-child(n + 4) {
      border-top: 1px solid ${colors.rule};
    }

    > div:nth-child(4) {
      padding-left: 0;
      border-left: 0;
    }
  `};

  ${media.bp600`
    grid-template-columns: repeat(2, minmax(0, 1fr));

    > div:nth-child(n) {
      padding-left: 0;
      border-left: 0;
    }

    > div:nth-child(even) {
      padding-left: 1rem;
      border-left: 1px solid ${colors.rule};
    }

    > div:nth-child(n + 3) {
      border-top: 1px solid ${colors.rule};
    }
  `};
`;

const Freshness = styled.div`
  ${mixins.monoLabel};
  display: grid;
  gap: 0.25rem;
  margin-top: 1rem;
  color: ${colors.muted};
  text-transform: none;
  letter-spacing: 0.02em;

  .state-stale {
    color: ${colors.accentText};
  }
`;

const Stat = ({ label, value }) => (
  <div>
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);

Stat.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.string.isRequired };

/** Identity, key counts, and how fresh the data is. */
const Overview = ({ profile }) => {
  const { user, repos, fetchedAt, rateLimit } = profile;
  const counts = countRepos(repos);
  const website = safeHttpUrl(user.blog);
  const joined = formatDate(user.created_at);
  const fetched = formatDateTime(fetchedAt);
  const state = fetchState(profile);
  const resets = rateLimit?.resetAt ? formatTime(rateLimit.resetAt) : null;

  return (
    <ReportSection id="overview" plainTitle>
      <Identity>
        {user.avatar_url && (
          // GitHub serves avatars from its own CDN; next/image would add an unneeded optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar" src={user.avatar_url} alt="" width={72} height={72} />
        )}
        <div>
          <h1>{user.name || user.login}</h1>
          <p className="login">
            <a href={user.html_url} target="_blank" rel="noopener noreferrer">
              @{user.login}
            </a>
            {user.type === 'Organization' && <span className="org">Organization</span>}
          </p>
        </div>
      </Identity>

      {user.bio && <Bio>{user.bio}</Bio>}

      <Meta>
        {user.location && (
          <div>
            <dt>Location</dt>
            <dd>{user.location}</dd>
          </div>
        )}
        {user.company && (
          <div>
            <dt>Company</dt>
            <dd>{user.company}</dd>
          </div>
        )}
        {user.blog?.trim() && (
          <div>
            <dt>Website</dt>
            <dd>
              {website ? (
                <a href={website} target="_blank" rel="noopener noreferrer">
                  {user.blog.trim()}
                </a>
              ) : (
                user.blog.trim()
              )}
            </dd>
          </div>
        )}
        {joined && (
          <div>
            <dt>Joined</dt>
            <dd>{joined}</dd>
          </div>
        )}
      </Meta>

      <Strip>
        <Stat label="Public repos" value={formatCount(user.public_repos)} />
        <Stat label="Followers" value={formatCount(user.followers)} />
        <Stat label="Following" value={formatCount(user.following)} />
        <Stat label="Own repos" value={formatCount(counts.own)} />
        <Stat label="Forked repos" value={formatCount(counts.forks)} />
      </Strip>

      <Freshness>
        <p>
          Fetched {fetched ?? 'at an unknown time'} {'· '}
          <span className={state === 'stale' ? 'state-stale' : undefined}>{state}</span>
        </p>
        {rateLimit && (
          <p>
            Shared GitHub API quota: {formatCount(rateLimit.remaining)} of{' '}
            {formatCount(rateLimit.limit)} left
            {resets ? ` · resets ${resets}` : ''}
          </p>
        )}
      </Freshness>
    </ReportSection>
  );
};

Overview.propTypes = {
  profile: PropTypes.shape({
    user: PropTypes.object.isRequired,
    repos: PropTypes.array.isRequired,
    fetchedAt: PropTypes.string,
    rateLimit: PropTypes.object,
  }).isRequired,
};

export default Overview;
