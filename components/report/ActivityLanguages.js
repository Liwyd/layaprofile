import { useMemo } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins, media } from '../../style';
import ReportSection from '../ui/ReportSection';
import { Caption, Label } from '../ui/Text';
import VisuallyHidden from '../ui/VisuallyHidden';
import YearChart from './YearChart';
import { computeLanguageStats } from '../../lib/languageStats';
import { buildYearHistogram } from '../../lib/ui/histogram';
import { mostStarred, recentlyPushed } from '../../lib/ui/repoList';
import { formatAge, formatCount } from '../../lib/ui/format';
import { safeHttpUrl } from '../../lib/ui/url';
const { colors } = theme;

const LANGUAGE_LIMIT = 8;
const LIST_LIMIT = 5;

const Block = styled.div`
  & + & {
    margin-top: 2.5rem;
  }

  ${Caption} {
    margin-top: 0.75rem;
  }
`;

const Languages = styled.ul`
  display: grid;
  gap: 0.45rem;

  li {
    display: grid;
    grid-template-columns: 10rem minmax(0, 1fr) 3.5rem;
    align-items: center;
    gap: 0.9rem;
    font-size: 0.9375rem;

    ${media.bp600`
      grid-template-columns: 7rem minmax(0, 1fr) 2.5rem;
      gap: 0.6rem;
    `};
  }

  .name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    ${mixins.ellipsis};
  }

  .swatch {
    flex: none;
    width: 0.6rem;
    height: 0.6rem;
    outline: 1px solid ${colors.rule};
  }

  .bar {
    height: 0.6rem;
    background: ${colors.fill};
  }

  .bar span {
    display: block;
    height: 100%;
    background: ${colors.ink};
  }

  .count {
    ${mixins.monoText};
    text-align: right;
    font-size: 0.875rem;
  }
`;

const Lists = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 2rem;

  ${media.bp600`
    grid-template-columns: minmax(0, 1fr);
    gap: 2.5rem;
  `};

  ol {
    border-top: 1px solid ${colors.rule};
  }

  li {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.55rem 0;
    border-bottom: 1px solid ${colors.rule};
  }

  .name {
    min-width: 0;
    ${mixins.ellipsis};
  }

  .value {
    ${mixins.monoText};
    flex: none;
    color: ${colors.muted};
    font-size: 0.8125rem;
  }

  .none {
    padding: 0.55rem 0;
    border-bottom: 1px solid ${colors.rule};
    color: ${colors.muted};
    font-size: 0.9375rem;
  }
`;

const RepoLink = ({ repo }) => {
  const href = safeHttpUrl(repo.html_url);
  return href ? (
    <a className="name" href={href} target="_blank" rel="noopener noreferrer">
      {repo.name}
    </a>
  ) : (
    <span className="name">{repo.name}</span>
  );
};

RepoLink.propTypes = { repo: PropTypes.object.isRequired };

/**
 * Language distribution (repository counts), repositories per year, and two short lists. All of it
 * comes from the repositories already loaded: no extra requests, no commit history.
 */
const ActivityLanguages = ({ repos, now }) => {
  const languages = useMemo(() => computeLanguageStats(repos, LANGUAGE_LIMIT), [repos]);
  const histogram = useMemo(() => buildYearHistogram(repos), [repos]);
  const starred = useMemo(() => mostStarred(repos, LIST_LIMIT), [repos]);
  const recent = useMemo(() => recentlyPushed(repos, LIST_LIMIT), [repos]);
  const peak = Math.max(1, ...languages.map(language => language.value));

  if (recent.length === 0) {
    return (
      <ReportSection id="activity">
        <Caption>No public repositories to analyze. Forks are not counted here.</Caption>
      </ReportSection>
    );
  }

  return (
    <ReportSection id="activity">
      <Block>
        <Label>Languages</Label>
        {languages.length > 0 ? (
          <Languages>
            {languages.map(language => (
              <li key={language.label}>
                <span className="name">
                  <span
                    className="swatch"
                    style={{ background: language.color }}
                    aria-hidden="true"
                  />
                  {language.label}
                </span>
                <span className="bar" aria-hidden="true">
                  <span style={{ width: `${(language.value / peak) * 100}%` }} />
                </span>
                <span className="count">
                  {formatCount(language.value)}
                  <VisuallyHidden> repositories</VisuallyHidden>
                </span>
              </li>
            ))}
          </Languages>
        ) : (
          <Caption>No primary language is reported for the own repositories.</Caption>
        )}
        <Caption>
          Repositories per primary language (own, non-fork). Not lines of code or skill level.
        </Caption>
      </Block>

      {histogram.years.length > 0 && (
        <Block>
          <Label>Repositories by year</Label>
          <YearChart histogram={histogram} />
          <Caption>
            Based on created_at and pushed_at of public repositories (forks excluded); not commit
            history.
          </Caption>
        </Block>
      )}

      <Block>
        <Lists>
          <div>
            <Label>Most starred</Label>
            {starred.length > 0 ? (
              <ol>
                {starred.map(repo => (
                  <li key={repo.id ?? repo.name}>
                    <RepoLink repo={repo} />
                    <span className="value">{formatCount(repo.stargazers_count)} stars</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="none">No own repository has stars yet.</p>
            )}
          </div>
          <div>
            <Label>Recently pushed</Label>
            <ol>
              {recent.map(repo => (
                <li key={repo.id ?? repo.name}>
                  <RepoLink repo={repo} />
                  <span className="value">{formatAge(repo.pushed_at, now) ?? 'no push date'}</span>
                </li>
              ))}
            </ol>
          </div>
        </Lists>
      </Block>
    </ReportSection>
  );
};

ActivityLanguages.propTypes = {
  repos: PropTypes.arrayOf(PropTypes.object).isRequired,
  now: PropTypes.number.isRequired,
};

export default ActivityLanguages;
