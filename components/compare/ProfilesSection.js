import PropTypes from 'prop-types';
import Link from 'next/link';
import styled from 'styled-components';
import { theme, mixins, media } from '../../style';
import ReportSection from '../ui/ReportSection';
import SideMark from './SideMark';
import { LABEL_INSUFFICIENT } from '../../lib/analysis/labels';
import { formatCoverage, formatDate, formatScore } from '../../lib/ui/format';
const { colors, radius } = theme;

const Pair = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2rem;

  ${media.bp600`
    grid-template-columns: minmax(0, 1fr);
    gap: 2.5rem;
  `};
`;

const Person = styled.article`
  padding-top: 0.9rem;
  border-top: 1px solid ${colors.ink};

  .who {
    ${mixins.monoLabel};
    display: flex;
    align-items: center;
    margin-bottom: 0.9rem;
    color: ${colors.muted};
  }

  .head {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .avatar {
    flex: none;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: ${radius};
    background: ${colors.fill};
    object-fit: cover;
  }

  h3 {
    font-size: 1.375rem;
    letter-spacing: -0.02em;
    overflow-wrap: anywhere;
  }

  .login {
    ${mixins.monoText};
    margin-top: 0.15rem;
    font-size: 0.875rem;
    overflow-wrap: anywhere;
  }

  .bio {
    margin-top: 0.9rem;
    max-width: 52ch;
    font-size: 0.9375rem;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .facts {
    display: grid;
    grid-template-columns: repeat(2, auto);
    justify-content: start;
    gap: 0.15rem 2rem;
    margin-top: 1rem;
  }

  .facts div {
    min-width: 0;
  }

  dt {
    ${mixins.monoLabel};
    color: ${colors.muted};
  }

  dd {
    ${mixins.monoText};
    font-size: 0.9375rem;
  }

  .score {
    font-size: 1.5rem;
    font-weight: 500;
    letter-spacing: -0.02em;
  }

  .scale {
    margin-left: 0.2rem;
    color: ${colors.muted};
    font-size: 0.8125rem;
  }

  .label {
    font-family: inherit;
    font-weight: 600;
  }

  .label.insufficient {
    color: ${colors.muted};
  }

  .full {
    display: inline-block;
    margin-top: 1rem;
    ${mixins.monoLabel};
  }
`;

const Side = ({ side, data }) => {
  const { user, profileScore } = data;
  const hasScore = Number.isFinite(profileScore?.score);
  const joined = formatDate(user.created_at);
  return (
    <Person aria-label={`${user.login}`}>
      <p className="who">
        <SideMark side={side} />
        {side === 'a' ? 'First profile' : 'Second profile'}
      </p>
      <div className="head">
        {user.avatar_url && (
          // GitHub serves avatars from its own CDN; next/image would add an unneeded optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img className="avatar" src={user.avatar_url} alt="" width={56} height={56} />
        )}
        <div>
          <h3>{user.name || user.login}</h3>
          <p className="login">
            <a href={user.html_url} target="_blank" rel="noopener noreferrer">
              @{user.login}
            </a>
          </p>
        </div>
      </div>
      {user.bio && <p className="bio">{user.bio}</p>}
      <dl className="facts">
        <div>
          <dt>Checklist score</dt>
          <dd>
            <span className="score">{formatScore(profileScore?.score)}</span>
            {hasScore && <span className="scale">/100</span>}
          </dd>
        </div>
        <div>
          <dt>Evidence coverage</dt>
          <dd>{formatCoverage(profileScore?.coverage)}</dd>
        </div>
        <div>
          <dt>Label</dt>
          <dd
            className={`label${profileScore?.label === LABEL_INSUFFICIENT ? ' insufficient' : ''}`}>
            {profileScore?.label ?? 'Not assessed'}
          </dd>
        </div>
        {joined && (
          <div>
            <dt>Joined</dt>
            <dd>{joined}</dd>
          </div>
        )}
      </dl>
      <Link className="full" href={`/user/${encodeURIComponent(user.login)}`}>
        Full report →
      </Link>
    </Person>
  );
};

Side.propTypes = {
  side: PropTypes.oneOf(['a', 'b']).isRequired,
  data: PropTypes.shape({
    user: PropTypes.object.isRequired,
    profileScore: PropTypes.object,
  }).isRequired,
};

/** Two compact identity blocks, each linking to its own full report. */
const ProfilesSection = ({ a, b }) => (
  <ReportSection id="profiles">
    <Pair>
      <Side side="a" data={a} />
      <Side side="b" data={b} />
    </Pair>
  </ReportSection>
);

ProfilesSection.propTypes = {
  a: PropTypes.object.isRequired,
  b: PropTypes.object.isRequired,
};

export default ProfilesSection;
