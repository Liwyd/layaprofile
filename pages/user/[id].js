import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Head,
  UserInfo,
  Charts,
  Repos,
  Footer,
  Corner,
  Error as ErrorState,
  RateLimit,
  Notice,
} from '../../components';
import { computeLanguageStats } from '../../lib/languageStats';
import { isValidUsername } from '../../lib/validation';

// Error types understood by the Error component.
const ERROR_NOT_FOUND = 404;
const ERROR_RATE_LIMITED = 403;
const ERROR_UNKNOWN = 500;
const INVALID_USERNAME_ERROR = { type: ERROR_NOT_FOUND };

// Mirrors the repository cap enforced by the server (3 pages of 100).
const REPO_LIMIT = 300;

// Our API answers with `{ error: { code, message } }`; GitHub itself is never called from the browser.
class ApiError extends globalThis.Error {
  constructor(status, code) {
    super(`Profile API responded with status ${status}${code ? ` (${code})` : ''}`);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const errorTypeFor = err => {
  if (err instanceof ApiError) {
    if (err.code === 'NOT_FOUND') return ERROR_NOT_FOUND;
    if (err.code === 'RATE_LIMITED') return ERROR_RATE_LIMITED;
  }
  return ERROR_UNKNOWN;
};

const fetchProfile = async (username, signal) => {
  const response = await fetch(`/api/profile/${encodeURIComponent(username)}`, {
    signal,
    headers: { Accept: 'application/json' },
  });

  let body = null;
  try {
    body = await response.json();
  } catch (err) {
    if (signal.aborted) throw err;
    // A non-JSON body (for example a proxy error page) is handled through the status below.
    console.error('Profile API returned a non-JSON body:', err);
  }

  if (!response.ok) {
    throw new ApiError(response.status, body?.error?.code);
  }
  if (!body || !body.user || !Array.isArray(body.repos)) {
    throw new globalThis.Error('Unexpected profile response from the API');
  }
  return body;
};

const User = ({ username }) => {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState(null);

  const userData = profile?.user ?? null;
  const repoData = profile?.repos ?? null;

  // Language stats are derived from the repositories already fetched; no extra requests.
  const langData = useMemo(() => (repoData ? computeLanguageStats(repoData) : null), [repoData]);

  useEffect(() => {
    // Invalid usernames are rejected before any request is made.
    if (!username) return undefined;

    // The page component is reused when navigating between profiles, so reset the state.
    setProfile(null);
    setError(null);

    const controller = new AbortController();
    const { signal } = controller;

    fetchProfile(username, signal)
      .then(json => {
        if (!signal.aborted) setProfile(json);
      })
      .catch(err => {
        if (signal.aborted) return;
        console.error('Error:', err);
        setError({ type: errorTypeFor(err) });
      });

    return () => controller.abort();
  }, [username]);

  const failure = username ? error : INVALID_USERNAME_ERROR;

  return (
    <main>
      {profile?.rateLimit && <RateLimit rateLimit={profile.rateLimit} />}

      {failure ? (
        <ErrorState error={failure} />
      ) : (
        <>
          <Head title={`OctoProfile | ${username}`} />

          <Corner />

          {userData && <UserInfo userData={userData} />}

          {langData && repoData && <Charts langData={langData} repoData={repoData} />}

          {repoData && <Repos repoData={repoData} />}

          {profile && (
            <Notice
              stale={profile.stale === true}
              fetchedAt={profile.fetchedAt}
              truncated={profile.truncated === true}
              repoLimit={REPO_LIMIT}
            />
          )}

          <Footer />
        </>
      )}
    </main>
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
