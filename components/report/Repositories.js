import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins, media } from '../../style';
import ReportSection from '../ui/ReportSection';
import Button from '../ui/Button';
import Segmented from '../ui/Segmented';
import LiveRegion from '../ui/LiveRegion';
import VisuallyHidden from '../ui/VisuallyHidden';
import { Caption } from '../ui/Text';
import RepoAnalysis from './RepoAnalysis';
import { useRepoAnalyses } from './hooks';
import { REPO_FILTERS, REPO_SORTS, recentlyPushed, viewRepos } from '../../lib/ui/repoList';
import { formatAge, formatCount } from '../../lib/ui/format';
import { safeHttpUrl } from '../../lib/ui/url';
const { colors } = theme;

const INITIAL_VISIBLE = 30;
const TOP_COUNT = 5;

const COLUMNS = 'minmax(0, 1fr) 8rem 4.5rem 6rem 9.5rem';

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem 2rem;
  margin-bottom: 1.5rem;

  .spacer {
    flex: 1;
  }

  .batch {
    display: grid;
    gap: 0.35rem;
    justify-items: start;
  }

  .progress {
    ${mixins.monoLabel};
    color: ${colors.muted};
    text-transform: none;
    letter-spacing: 0.02em;
  }
`;

const List = styled.ul`
  border-top: 1px solid ${colors.ink};

  .head,
  .row {
    display: grid;
    grid-template-columns: ${COLUMNS};
    column-gap: 1rem;
    align-items: baseline;
  }

  .head {
    ${mixins.monoLabel};
    padding: 0.5rem 0;
    border-bottom: 1px solid ${colors.rule};
    color: ${colors.muted};
  }

  .head .num,
  .row .num {
    text-align: right;
  }

  .item {
    border-bottom: 1px solid ${colors.rule};
  }

  .row {
    padding: 0.8rem 0;
  }

  .meta {
    display: contents;
  }

  .title {
    font-weight: 600;
    overflow-wrap: anywhere;
  }

  .flag {
    ${mixins.monoLabel};
    margin-left: 0.5rem;
    padding: 0 0.35rem;
    border: 1px solid ${colors.rule};
    color: ${colors.muted};
    font-size: 0.65rem;
    font-weight: 400;
    vertical-align: 0.1em;
  }

  .desc {
    margin-top: 0.15rem;
    color: ${colors.muted};
    font-size: 0.875rem;
    overflow-wrap: anywhere;
  }

  .lang,
  .pushed {
    font-size: 0.875rem;
  }

  .stars {
    ${mixins.monoText};
    font-size: 0.875rem;
  }

  .pushed {
    ${mixins.monoText};
    color: ${colors.muted};
  }

  .action {
    display: grid;
    gap: 0.3rem;
    justify-items: end;
    text-align: right;
  }

  .result {
    ${mixins.monoLabel};
    color: ${colors.muted};
    text-transform: none;
    letter-spacing: 0.02em;
  }

  .result.failed {
    color: ${colors.accentText};
  }

  ${media.bp900`
    .head {
      display: none;
    }

    .row {
      grid-template-columns: minmax(0, 1fr) auto;
      row-gap: 0.5rem;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1.25rem;
      grid-column: 1 / -1;
      grid-row: 2;
    }

    .head .num,
    .row .num {
      text-align: left;
    }

    .action {
      grid-column: 2;
      grid-row: 1;
    }
  `};
`;

const MoreRow = styled.div`
  margin-top: 1rem;
`;

const resultText = entry => {
  if (!entry || entry.status !== 'done') return null;
  const { analysis } = entry.data;
  if (analysis.dimensions.length === 0) return 'not scored';
  return Number.isFinite(analysis.score)
    ? `${analysis.score}/100 · ${analysis.label}`
    : analysis.label;
};

const RepoRow = ({ repo, entry, queued, open, now, onToggle, onAnalyze }) => {
  const href = safeHttpUrl(repo.html_url);
  const detailId = `analysis-${repo.id ?? repo.name}`;
  const status = entry?.status ?? (queued ? 'queued' : 'idle');

  let label = 'Analyze';
  if (status === 'queued') label = 'Queued';
  else if (status === 'loading') label = 'Analyzing…';
  else if (status === 'done') label = open ? 'Hide analysis' : 'View analysis';
  else if (status === 'error') label = 'Retry';

  const handleClick = () => {
    if (status === 'done') onToggle(repo.name);
    else onAnalyze(repo.name, { force: status === 'error' });
  };

  const summary = resultText(entry);
  return (
    <li className="item">
      <div className="row">
        <div>
          <p className="title">
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {repo.name}
              </a>
            ) : (
              repo.name
            )}
            {repo.fork && <span className="flag">fork</span>}
            {repo.archived && <span className="flag">archived</span>}
          </p>
          {repo.description && <p className="desc">{repo.description}</p>}
        </div>
        <div className="meta">
          <span className="lang">{repo.language ?? 'No language'}</span>
          <span className="stars num">
            {formatCount(repo.stargazers_count)}
            <VisuallyHidden> stars</VisuallyHidden>
          </span>
          <span className="pushed num">
            <VisuallyHidden>Last push: </VisuallyHidden>
            {formatAge(repo.pushed_at, now) ?? 'no push date'}
          </span>
        </div>
        <div className="action">
          {repo.fork ? (
            <span className="result">forks are not scored</span>
          ) : (
            <>
              <Button
                $variant="ghost"
                $size="small"
                disabled={status === 'loading' || status === 'queued'}
                aria-expanded={status === 'done' ? open : undefined}
                aria-controls={status === 'done' && open ? detailId : undefined}
                aria-label={`${label}: ${repo.name}`}
                onClick={handleClick}>
                {label}
              </Button>
              {status === 'error' && <span className="result failed">analysis failed</span>}
              {summary && <span className="result">{summary}</span>}
            </>
          )}
        </div>
      </div>
      {open && entry && (
        <div id={detailId} role="region" aria-label={`Analysis of ${repo.name}`}>
          <RepoAnalysis
            repo={repo}
            entry={entry}
            onRetry={() => onAnalyze(repo.name, { force: true })}
          />
        </div>
      )}
    </li>
  );
};

RepoRow.propTypes = {
  repo: PropTypes.object.isRequired,
  entry: PropTypes.object,
  queued: PropTypes.bool,
  open: PropTypes.bool,
  now: PropTypes.number.isRequired,
  onToggle: PropTypes.func.isRequired,
  onAnalyze: PropTypes.func.isRequired,
};

/**
 * Own repositories as a dense list. Quality analysis is requested on demand per repository (or for
 * the five most recently pushed ones, two at a time) and never automatically, to respect GitHub
 * rate limits. Results stay in state; a failed analysis has its own Retry.
 */
const Repositories = ({ repos, login, now }) => {
  const [sort, setSort] = useState('pushed');
  const [filter, setFilter] = useState('own');
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState({});
  const [batch, setBatch] = useState(null);
  const { entries, analyze, analyzeMany } = useRepoAnalyses(login);

  const list = useMemo(() => viewRepos(repos, { filter, sort }), [repos, filter, sort]);
  const visible = showAll ? list : list.slice(0, INITIAL_VISIBLE);

  const handleAnalyze = (name, options) => {
    setOpen(previous => ({ ...previous, [name]: true }));
    analyze(name, options);
  };

  const handleToggle = name => setOpen(previous => ({ ...previous, [name]: !previous[name] }));

  const handleBatch = () => {
    const names = recentlyPushed(repos, TOP_COUNT)
      .filter(repo => repo.fork !== true)
      .map(repo => repo.name);
    setBatch(names);
    analyzeMany(names);
  };

  const settled = batch
    ? batch.filter(name => entries[name]?.status === 'done' || entries[name]?.status === 'error')
        .length
    : 0;
  const failed = batch ? batch.filter(name => entries[name]?.status === 'error').length : 0;
  const batchRunning = batch !== null && settled < batch.length;

  let progress = '';
  if (batch) {
    progress = batchRunning
      ? `Analyzing top ${batch.length}: ${settled} of ${batch.length} done`
      : `${batch.length - failed} of ${batch.length} analyzed${failed > 0 ? `, ${failed} failed` : ''}`;
  }

  if (repos.length === 0) {
    return (
      <ReportSection id="repositories">
        <Caption>No public repositories to analyze.</Caption>
      </ReportSection>
    );
  }

  return (
    <ReportSection id="repositories">
      <Toolbar>
        <Segmented legend="Show" options={REPO_FILTERS} value={filter} onChange={setFilter} />
        <Segmented legend="Sort by" options={REPO_SORTS} value={sort} onChange={setSort} />
        <span className="spacer" />
        <div className="batch">
          <Button $variant="ghost" onClick={handleBatch} disabled={batchRunning}>
            Analyze top {TOP_COUNT}
          </Button>
          {progress && <span className="progress">{progress}</span>}
        </div>
      </Toolbar>
      <LiveRegion message={progress} />

      {list.length === 0 ? (
        <Caption>No repositories match this filter.</Caption>
      ) : (
        <List>
          <li className="head" aria-hidden="true">
            <span>Repository</span>
            <span>Language</span>
            <span className="num">Stars</span>
            <span className="num">Last push</span>
            <span />
          </li>
          {visible.map(repo => (
            <RepoRow
              key={repo.id ?? repo.name}
              repo={repo}
              entry={entries[repo.name]}
              queued={batchRunning && batch.includes(repo.name)}
              open={open[repo.name] === true}
              now={now}
              onToggle={handleToggle}
              onAnalyze={handleAnalyze}
            />
          ))}
        </List>
      )}

      {list.length > INITIAL_VISIBLE && (
        <MoreRow>
          <Button $variant="ghost" $size="small" onClick={() => setShowAll(value => !value)}>
            {showAll ? `Show first ${INITIAL_VISIBLE}` : `Show all (${list.length})`}
          </Button>
        </MoreRow>
      )}

      <Caption style={{ marginTop: '1.5rem' }}>
        Analyses are requested one repository at a time because every analysis reads the README and
        top-level file names from GitHub, which has request limits.
      </Caption>
    </ReportSection>
  );
};

Repositories.propTypes = {
  repos: PropTypes.arrayOf(PropTypes.object).isRequired,
  login: PropTypes.string.isRequired,
  now: PropTypes.number.isRequired,
};

export default Repositories;
