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
} from '../../components';
import { computeLanguageStats } from '../../lib/languageStats';
import { isValidUsername } from '../../lib/validation';

const GITHUB_API = 'https://api.github.com';

// Error types understood by the Error component.
const ERROR_NOT_FOUND = 404;
const ERROR_RATE_LIMITED = 403;
const ERROR_UNKNOWN = 500;
const INVALID_USERNAME_ERROR = { type: ERROR_NOT_FOUND };

class HttpError extends globalThis.Error {
  constructor(status) {
    super(`GitHub API responded with status ${status}`);
    this.name = 'HttpError';
    this.status = status;
  }
}

const errorTypeFor = err => {
  if (err instanceof HttpError) {
    if (err.status === 404) return ERROR_NOT_FOUND;
    // GitHub signals primary and secondary rate limits with 403 or 429.
    if (err.status === 403 || err.status === 429) return ERROR_RATE_LIMITED;
  }
  return ERROR_UNKNOWN;
};

const fetchGitHub = async (path, signal) => {
  const response = await fetch(`${GITHUB_API}${path}`, {
    signal,
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!response.ok) {
    throw new HttpError(response.status);
  }
  return response.json();
};

const User = ({ username }) => {
  const [userData, setUserData] = useState(null);
  const [repoData, setRepoData] = useState(null);
  const [error, setError] = useState(null);
  const [rateLimit, setRateLimit] = useState(null);

  // Language stats are derived from the repositories already fetched; no extra requests.
  const langData = useMemo(() => (repoData ? computeLanguageStats(repoData) : null), [repoData]);

  useEffect(() => {
    // Invalid usernames are rejected before any request is made.
    if (!username) return undefined;

    // The page component is reused when navigating between profiles, so reset the state.
    setUserData(null);
    setRepoData(null);
    setRateLimit(null);
    setError(null);

    const controller = new AbortController();
    const { signal } = controller;

    const reportError = err => {
      if (signal.aborted) return;
      console.error('Error:', err);
      setError({ type: errorTypeFor(err) });
    };

    // The rate limit indicator is optional: a failure is logged but never replaces the page.
    fetchGitHub('/rate_limit', signal)
      .then(json => {
        if (signal.aborted) return;
        const { core } = json.resources;
        setRateLimit(core);
        if (core.remaining < 1) {
          setError({ type: ERROR_RATE_LIMITED });
        }
      })
      .catch(err => {
        if (!signal.aborted) console.error('Failed to load the rate limit:', err);
      });

    fetchGitHub(`/users/${username}`, signal)
      .then(json => {
        if (!signal.aborted) setUserData(json);
      })
      .catch(reportError);

    fetchGitHub(`/users/${username}/repos?per_page=100`, signal)
      .then(json => {
        if (!Array.isArray(json)) {
          throw new globalThis.Error('Unexpected repository response from GitHub');
        }
        if (!signal.aborted) setRepoData(json);
      })
      .catch(reportError);

    return () => controller.abort();
  }, [username]);

  const failure = username ? error : INVALID_USERNAME_ERROR;

  return (
    <main>
      {rateLimit && <RateLimit rateLimit={rateLimit} />}

      {failure ? (
        <ErrorState error={failure} />
      ) : (
        <>
          <Head title={`OctoProfile | ${username}`} />

          <Corner />

          {userData && <UserInfo userData={userData} />}

          {langData && repoData && <Charts langData={langData} repoData={repoData} />}

          {repoData && <Repos repoData={repoData} />}

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
