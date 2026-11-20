import React from 'react';
import PropTypes from 'prop-types';
import { BriefcaseIcon, CalendarIcon, LocationIcon } from './icons';
import UserInfoStyles from './styles/UserInfoStyles';
import { Section } from '../style';

const UserInfo = ({ userData }) => (
  <Section $dark>
    {userData && (
      <UserInfoStyles>
        {userData.avatar_url && (
          <div className="avatar">
            {/* GitHub serves avatars from its own CDN; next/image would add an unneeded optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={userData.avatar_url}
              alt={`${userData.login || 'User'} avatar`}
              width={150}
              height={150}
            />
          </div>
        )}

        {userData.name && <h1>{userData.name}</h1>}

        {userData.login && (
          <h2>
            <a href={userData.html_url} target="_blank" rel="noopener noreferrer">
              @{userData.login}
            </a>
          </h2>
        )}

        <div className="info">
          {userData.company && (
            <span className="info__item">
              <BriefcaseIcon />
              {userData.company}
            </span>
          )}

          {userData.location && (
            <span className="info__item">
              <LocationIcon />
              {userData.location}
            </span>
          )}

          {userData.created_at && (
            <span className="info__item">
              <CalendarIcon />
              Joined{' '}
              {new Date(userData.created_at).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          )}
        </div>

        <div className="stats">
          <div className="stats__item">
            <span className="num">{userData.public_repos.toLocaleString()}</span>
            <span className="num-label">Repositories</span>
          </div>
          <div className="stats__item">
            <span className="num">{userData.followers.toLocaleString()}</span>
            <span className="num-label">Followers</span>
          </div>
          <div className="stats__item">
            <span className="num">{userData.following.toLocaleString()}</span>
            <span className="num-label">Following</span>
          </div>
        </div>
      </UserInfoStyles>
    )}
  </Section>
);

UserInfo.propTypes = {
  userData: PropTypes.object.isRequired,
};

export default UserInfo;
