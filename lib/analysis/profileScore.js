import { buildAssessment, buildDimension, scored, unknownCheck } from './scoring';
import { ageInDays, hasText, licenseState, listNames, plural, roundTo, toMs } from './signals';

export const PROFILE_WEIGHTS = { identity: 30, presentation: 40, maintenance: 30 };

export const ACTIVE_WITHIN_DAYS = 365;
export const RECENT_PUSH_WITHIN_DAYS = 90;
export const TRUNCATED_NOTE =
  'The account has more repositories than were loaded; scores use the most recently pushed ones.';

// ---------------------------------------------------------------------------------------------
// Identity (weight 30)
// ---------------------------------------------------------------------------------------------

const textFieldCheck = (
  user,
  { id, label, field, max, evidenceFound, evidenceMissing, recommendation },
) => {
  if (user[field] === undefined) {
    return unknownCheck({ id, label, max, evidence: `the ${field} field was not provided` });
  }
  const present = hasText(user[field]);
  return scored({
    id,
    label,
    points: present ? max : 0,
    max,
    status: 'verified',
    evidence: present ? evidenceFound : evidenceMissing,
    recommendation,
  });
};

const identityChecks = (user, profileReadme) => {
  const bio = textFieldCheck(user, {
    id: 'bio',
    label: 'Biography',
    field: 'bio',
    max: 4,
    evidenceFound: 'biography set',
    evidenceMissing: 'no biography on the profile',
    recommendation: 'Add a short bio describing what you work on.',
  });
  const name = textFieldCheck(user, {
    id: 'name',
    label: 'Display name',
    field: 'name',
    max: 2,
    evidenceFound: 'display name set',
    evidenceMissing: 'no display name on the profile',
    recommendation: 'Add your name so visitors know who you are.',
  });
  const website = textFieldCheck(user, {
    id: 'website',
    label: 'Website or portfolio link',
    field: 'blog',
    max: 2,
    evidenceFound: 'website link set',
    evidenceMissing: 'no website link on the profile',
    recommendation: 'Link your portfolio or website from your profile.',
  });

  const base = { id: 'location-company', label: 'Location or company (optional)', max: 1 };
  const placeKnown = user.location !== undefined || user.company !== undefined;
  const place = !placeKnown
    ? unknownCheck({ ...base, evidence: 'the location and company fields were not provided' })
    : scored({
        ...base,
        points: hasText(user.location) || hasText(user.company) ? 1 : 0,
        status: 'verified',
        evidence:
          hasText(user.location) || hasText(user.company)
            ? 'location or company set'
            : 'neither location nor company is set',
        recommendation: 'Optional: share a location or company if you want to.',
      });

  const readmeBase = { id: 'profile-readme', label: 'Profile README', max: 4 };
  let readme;
  if (profileReadme === undefined) {
    readme = unknownCheck({
      ...readmeBase,
      evidence: 'whether a profile README exists could not be determined',
    });
  } else {
    readme = scored({
      ...readmeBase,
      points: profileReadme.available ? 4 : 0,
      status: 'verified',
      evidence: profileReadme.available
        ? `README found in the ${user.login}/${user.login} repository`
        : `no ${user.login}/${user.login} repository with a README`,
      recommendation: `Create a repository named ${user.login}/${user.login} with a README to introduce yourself on your profile.`,
    });
  }

  return [bio, name, website, place, readme];
};

// ---------------------------------------------------------------------------------------------
// Presentation (weight 40): how the user's own repositories are presented, as shares.
// ---------------------------------------------------------------------------------------------

// Share of repositories satisfying a check. Repositories whose field was not provided are left
// out of the denominator. `credit(repo)` returns a value in [0, 1], or null when unknown.
const shareCheck = (repos, { id, label, max, credit, evidenceFor, missingPhrase, advice }) => {
  const credits = repos
    .map(repo => ({ repo, value: credit(repo) }))
    .filter(item => item.value !== null);
  if (credits.length === 0) {
    return unknownCheck({ id, label, max, evidence: 'the field was not provided by GitHub' });
  }
  const earned = credits.reduce((total, item) => total + item.value, 0);
  const points = roundTo(max * (earned / credits.length), 1);
  const lacking = credits.filter(item => item.value < 1).map(item => item.repo.name);
  return scored({
    id,
    label,
    points,
    max,
    status: 'verified',
    evidence: evidenceFor(credits),
    recommendation: lacking.length
      ? `${advice} ${plural(lacking.length, 'repository', 'repositories')} ${missingPhrase} (${listNames(lacking)}).`
      : undefined,
  });
};

const countOf = (credits, predicate) => credits.filter(item => predicate(item.value)).length;

const presentationChecks = repos => {
  if (repos.length === 0) {
    const evidence = 'no public non-fork repositories';
    return [
      { id: 'descriptions', label: 'Repository descriptions', max: 4 },
      { id: 'topics', label: 'Repository topics', max: 3 },
      { id: 'licenses', label: 'Repository licenses', max: 3 },
      { id: 'homepages', label: 'Repository homepages', max: 1 },
    ].map(check => unknownCheck({ ...check, evidence }));
  }

  const ofRepos = (credits, count, what) =>
    `${count} of ${plural(credits.length, 'repository', 'repositories')} ${what}`;

  return [
    shareCheck(repos, {
      id: 'descriptions',
      label: 'Repository descriptions',
      max: 4,
      credit: repo => (repo.description === undefined ? null : hasText(repo.description) ? 1 : 0),
      evidenceFor: credits =>
        ofRepos(
          credits,
          countOf(credits, v => v === 1),
          'have a description',
        ),
      advice: 'Describe each project in one sentence.',
      missingPhrase: 'lack a description',
    }),
    shareCheck(repos, {
      id: 'topics',
      label: 'Repository topics',
      max: 3,
      credit: repo => (!Array.isArray(repo.topics) ? null : repo.topics.length > 0 ? 1 : 0),
      evidenceFor: credits =>
        ofRepos(
          credits,
          countOf(credits, v => v === 1),
          'have topics',
        ),
      advice: 'Add topics so projects can be categorized.',
      missingPhrase: 'have no topics',
    }),
    shareCheck(repos, {
      id: 'licenses',
      label: 'Repository licenses',
      max: 3,
      credit: repo => {
        const state = licenseState(repo);
        if (state === 'unknown') return null;
        return state === 'recognized' ? 1 : state === 'unrecognized' ? 0.5 : 0;
      },
      evidenceFor: credits => {
        const unrecognized = countOf(credits, v => v === 0.5);
        return `${ofRepos(
          credits,
          countOf(credits, v => v === 1),
          'have a recognized license',
        )}${unrecognized ? ` (${unrecognized} more have an unrecognized license file)` : ''}`;
      },
      advice: 'Add a recognized open-source license where you intend others to reuse the code.',
      missingPhrase: 'have no recognized license',
    }),
    shareCheck(repos, {
      id: 'homepages',
      label: 'Repository homepages',
      max: 1,
      credit: repo => (repo.homepage === undefined ? null : hasText(repo.homepage) ? 1 : 0),
      evidenceFor: credits =>
        ofRepos(
          credits,
          countOf(credits, v => v === 1),
          'have a homepage',
        ),
      advice: 'Where a project has a site or docs, set the homepage.',
      missingPhrase: 'have no homepage',
    }),
  ];
};

// ---------------------------------------------------------------------------------------------
// Maintenance (weight 30): recent activity across the user's own, non-archived repositories.
// ---------------------------------------------------------------------------------------------

const maintenanceChecks = (active, nowMs) => {
  if (active.length === 0) {
    const evidence = 'no non-archived, non-fork repositories';
    return [
      unknownCheck({ id: 'active-share', label: 'Recently active repositories', max: 4, evidence }),
      unknownCheck({ id: 'recent-push', label: 'Pushed in the last 90 days', max: 2, evidence }),
    ];
  }

  const ages = active
    .map(repo => ({ repo, days: ageInDays(repo.pushed_at, nowMs) }))
    .filter(item => item.days !== null);
  if (ages.length === 0) {
    const evidence = 'the push dates were not provided';
    return [
      unknownCheck({ id: 'active-share', label: 'Recently active repositories', max: 4, evidence }),
      unknownCheck({ id: 'recent-push', label: 'Pushed in the last 90 days', max: 2, evidence }),
    ];
  }

  const recent = ages.filter(item => item.days <= ACTIVE_WITHIN_DAYS).length;
  const share = scored({
    id: 'active-share',
    label: 'Recently active repositories',
    points: roundTo(4 * (recent / ages.length), 1),
    max: 4,
    status: 'rule',
    evidence: `${recent} of ${plural(ages.length, 'non-archived repository', 'non-archived repositories')} pushed within ${ACTIVE_WITHIN_DAYS} days`,
    recommendation:
      'Archive repositories you no longer maintain, and update the ones that are still in use.',
  });

  const newest = ages.reduce((best, item) => (item.days < best.days ? item : best));
  const hasRecent = newest.days <= RECENT_PUSH_WITHIN_DAYS;
  const recentPush = scored({
    id: 'recent-push',
    label: 'Pushed in the last 90 days',
    points: hasRecent ? 2 : 0,
    max: 2,
    status: 'rule',
    evidence: `most recent push ${Math.floor(newest.days)} days ago (${newest.repo.name})`,
    recommendation:
      'Push to at least one active project regularly so visitors can see ongoing work.',
  });

  return [share, recentPush];
};

/**
 * Scores a GitHub profile from `{ user, repos }` (the output of `loadProfile`).
 * Only presentation and activity signals are used: followers, stars, forks and watchers
 * never influence the score. `now` (Date or ms) is required.
 *
 * @param {object} [options]
 * @param {{available: boolean}} [options.profileReadme]  undefined means "not determined"
 * @param {boolean} [options.truncated]  the repository list was cut at the fetch limit
 */
export const scoreProfile = (
  { user, repos = [] },
  { now, profileReadme, truncated = false } = {},
) => {
  const nowMs = toMs(now);
  const own = repos.filter(repo => repo.fork !== true);
  const active = own.filter(repo => repo.archived !== true);

  const pinned = unknownCheck({
    id: 'pinned',
    label: 'Pinned repositories',
    max: 0,
    evidence: 'not available via the public REST API',
  });

  const dimensions = [
    buildDimension({
      id: 'identity',
      label: 'Identity',
      weight: PROFILE_WEIGHTS.identity,
      checks: identityChecks(user, profileReadme),
    }),
    buildDimension({
      id: 'presentation',
      label: 'Repository presentation',
      weight: PROFILE_WEIGHTS.presentation,
      checks: [...presentationChecks(own), pinned],
    }),
    buildDimension({
      id: 'maintenance',
      label: 'Maintenance',
      weight: PROFILE_WEIGHTS.maintenance,
      checks: maintenanceChecks(active, nowMs),
    }),
  ];

  return {
    ...buildAssessment(dimensions),
    notes: truncated ? [TRUNCATED_NOTE] : [],
    facts: {
      repositories: repos.length,
      ownRepositories: own.length,
      forks: repos.length - own.length,
      archived: own.length - active.length,
    },
  };
};
