import { useCallback, useEffect, useRef, useState } from 'react';
import {
  analysisUrl,
  compareUrl,
  describeError,
  getJson,
  isAnalysisResponse,
  isCompareResponse,
  isLearningPathResponse,
  isProfileResponse,
  learningPathUrl,
  profileUrl,
} from '../../lib/ui/api';
import { runWithConcurrency } from '../../lib/ui/queue';

/** Analyses of different repositories running at once. Kept low so GitHub limits are respected. */
export const ANALYSIS_CONCURRENCY = 2;

/**
 * Loads the profile payload for `username`. `status` is `loading`, `ready` or `error`; `error` is
 * the raw failure (see `describeError`). `retry` reloads. A stale response is ignored when the
 * username changes or the component unmounts.
 */
export const useProfile = username => {
  const [state, setState] = useState({ status: 'loading', profile: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!username) return undefined;
    setState({ status: 'loading', profile: null, error: null });
    const controller = new AbortController();
    const { signal } = controller;

    getJson(profileUrl(username), { signal, validate: isProfileResponse })
      .then(profile => {
        if (!signal.aborted) setState({ status: 'ready', profile, error: null });
      })
      .catch(err => {
        if (signal.aborted) return;
        console.error('Profile request failed:', err);
        setState({ status: 'error', profile: null, error: err });
      });

    return () => controller.abort();
  }, [username, attempt]);

  const retry = useCallback(() => setAttempt(count => count + 1), []);
  return { ...state, retry };
};

/**
 * Loads the comparison of two usernames. `status` is `loading`, `ready` or `error`; on error
 * `error` is the raw failure (see `describeError`, which also says which side was not found).
 * `retry` reloads, and a response for an earlier pair is ignored.
 */
export const useCompare = (a, b) => {
  const [state, setState] = useState({ status: 'loading', data: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!a || !b) return undefined;
    setState({ status: 'loading', data: null, error: null });
    const controller = new AbortController();
    const { signal } = controller;

    getJson(compareUrl(a, b), { signal, validate: isCompareResponse })
      .then(data => {
        if (!signal.aborted) setState({ status: 'ready', data, error: null });
      })
      .catch(err => {
        if (signal.aborted) return;
        console.error('Comparison request failed:', err);
        setState({ status: 'error', data: null, error: err });
      });

    return () => controller.abort();
  }, [a, b, attempt]);

  const retry = useCallback(() => setAttempt(count => count + 1), []);
  return { ...state, retry };
};

/**
 * On-demand repository analyses for one user. `entries[name]` is `{ status: 'loading' }`,
 * `{ status: 'done', data }` or `{ status: 'error', error }` (`error` from `describeError`); a
 * repository that was never requested has no entry. Results stay in state, so a repository is
 * fetched once unless `force` is passed (Retry). Requests are aborted on unmount.
 * `analyzeMany` runs a list with a small concurrency cap.
 */
export const useRepoAnalyses = login => {
  const [entries, setEntries] = useState({});
  const statuses = useRef({});
  const controllerRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    return () => controller.abort();
  }, []);

  const analyze = useCallback(
    async (name, { force = false } = {}) => {
      const controller = controllerRef.current;
      const current = statuses.current[name];
      if (!controller || (!force && (current === 'loading' || current === 'done'))) return;

      const record = entry => {
        statuses.current[name] = entry.status;
        setEntries(previous => ({ ...previous, [name]: entry }));
      };

      record({ status: 'loading' });
      try {
        const data = await getJson(analysisUrl(login, name), {
          signal: controller.signal,
          validate: isAnalysisResponse,
        });
        if (!controller.signal.aborted) record({ status: 'done', data });
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(`Analysis of ${name} failed:`, err);
        record({ status: 'error', error: describeError(err) });
      }
    },
    [login],
  );

  const analyzeMany = useCallback(
    names =>
      runWithConcurrency(names, ANALYSIS_CONCURRENCY, name => analyze(name), {
        signal: controllerRef.current?.signal,
      }),
    [analyze],
  );

  return { entries, analyze, analyzeMany };
};

/**
 * The learning path of the chosen role. Nothing is requested until a role is selected. `status`
 * is `idle`, `loading`, `ready` or `error` (`error` from `describeError`). Changing the role
 * aborts the previous request.
 */
export const useLearningPath = login => {
  const [role, setRole] = useState(null);
  const [state, setState] = useState({ status: 'idle', path: null, error: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!role) return undefined;
    setState({ status: 'loading', path: null, error: null });
    const controller = new AbortController();
    const { signal } = controller;

    getJson(learningPathUrl(login, role), { signal, validate: isLearningPathResponse })
      .then(path => {
        if (!signal.aborted) setState({ status: 'ready', path, error: null });
      })
      .catch(err => {
        if (signal.aborted) return;
        console.error('Learning path request failed:', err);
        setState({ status: 'error', path: null, error: describeError(err) });
      });

    return () => controller.abort();
  }, [login, role, attempt]);

  const retry = useCallback(() => setAttempt(count => count + 1), []);
  return { role, selectRole: setRole, retry, ...state };
};

/**
 * The id of the section being read: the last section that reaches the upper band of the
 * viewport, found with an IntersectionObserver. At the very bottom of the page the last section
 * is current, because a short final section may never reach the band. Pass a `refreshKey` that
 * changes whenever the section elements are re-created.
 */
export const useActiveSection = (ids, refreshKey) => {
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const last = ids[ids.length - 1];
    // A page that does not scroll at all is never "at the bottom".
    const atBottom = () => {
      const { scrollHeight } = document.documentElement;
      return (
        scrollHeight > window.innerHeight && window.innerHeight + window.scrollY >= scrollHeight - 2
      );
    };

    const inBand = new Set();
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) inBand.add(entry.target.id);
          else inBand.delete(entry.target.id);
        });
        const current = ids.filter(id => inBand.has(id)).pop();
        if (atBottom()) setActive(last);
        else if (current) setActive(current);
      },
      { rootMargin: '0px 0px -65% 0px' },
    );
    ids.forEach(id => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });

    const onScroll = () => {
      if (atBottom()) setActive(last);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
    // `refreshKey` re-observes the sections when they are replaced (loading to loaded).
  }, [ids, refreshKey]);

  return active;
};
