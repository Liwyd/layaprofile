import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins, media } from '../../style';
import ReportSection from '../ui/ReportSection';
import Disclosure from '../ui/Disclosure';
import Segmented from '../ui/Segmented';
import Skeleton from '../ui/Skeleton';
import LiveRegion from '../ui/LiveRegion';
import { Caption, Label } from '../ui/Text';
import SectionError from './SectionError';
import { useLearningPath } from './hooks';
import { ROLES, ROLE_IDS } from '../../lib/analysis/learningPath';
import {
  foundationStatusLabel,
  stepKindLabel,
  stepStrengthLabel,
  strengthLabel,
} from '../../lib/ui/format';
import { repoUrl } from '../../lib/ui/url';
const { colors } = theme;

const ROLE_OPTIONS = ROLE_IDS.map(id => ({ id, label: ROLES[id].label }));

const Summary = styled.div`
  margin-top: 2rem;

  .core {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1.5rem;
    font-size: 0.9375rem;
  }

  .core span span {
    ${mixins.monoLabel};
    margin-left: 0.5rem;
    color: ${colors.muted};
  }

  .notes {
    display: grid;
    gap: 0.35rem;
    margin-top: 0.9rem;
  }

  details {
    margin-top: 0.9rem;
  }

  summary {
    ${mixins.monoLabel};
    padding: 0.4rem 0;
    color: ${colors.muted};
  }

  details li {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    max-width: 30rem;
    padding: 0.3rem 0;
    border-bottom: 1px solid ${colors.rule};
    font-size: 0.875rem;
  }

  details li span:last-child {
    ${mixins.monoLabel};
    color: ${colors.muted};
    text-transform: none;
    letter-spacing: 0.02em;
  }
`;

const Steps = styled.ol`
  margin-top: 1.5rem;
  border-top: 1px solid ${colors.ink};

  > li {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 1fr);
    column-gap: 1rem;
    padding: 1.1rem 0;
    border-bottom: 1px solid ${colors.rule};

    ${media.bp600`
      grid-template-columns: minmax(0, 1fr);
    `};
  }

  /* Every step keeps the same indent; a step with weak or no evidence gets a dashed rule. */
  .body {
    padding-left: 0.9rem;
    border-left: 2px solid transparent;
  }

  > li.weak .body {
    border-left: 2px dashed ${colors.muted};
  }

  .priority {
    ${mixins.monoText};
    white-space: nowrap;
    color: ${colors.muted};
    font-size: 0.8125rem;
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.3rem 0.8rem;
  }

  .kind {
    ${mixins.monoLabel};
    padding: 0 0.4rem;
    border: 1px solid ${colors.ink};
    font-size: 0.65rem;
  }

  h3 {
    font-size: 1.0625rem;
    letter-spacing: -0.01em;
  }

  .rationale {
    margin-top: 0.4rem;
    max-width: 66ch;
    color: ${colors.muted};
    font-size: 0.9375rem;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem 1rem;
    margin-top: 0.6rem;
    font-size: 0.8125rem;
  }

  .evidence {
    ${mixins.monoLabel};
    color: ${colors.ink};
  }

  .evidence.limited {
    padding: 0 0.4rem;
    border: 1px dashed ${colors.muted};
    color: ${colors.muted};
  }

  .based {
    ${mixins.monoText};
    color: ${colors.muted};
    overflow-wrap: anywhere;
  }
`;

const BasedOn = ({ items }) => (
  <span className="based">
    based on:{' '}
    {items.map((item, index) => {
      const href = repoUrl(item);
      return (
        <span key={item}>
          {index > 0 && ', '}
          {href ? (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {item}
            </a>
          ) : (
            item
          )}
        </span>
      );
    })}
  </span>
);

BasedOn.propTypes = { items: PropTypes.arrayOf(PropTypes.string).isRequired };

const Path = ({ path }) => (
  <>
    <Summary>
      <Label>Evidence for {path.roleLabel}</Label>
      <div className="core">
        {path.summary.coreCategories.map(category => (
          <span key={category.id}>
            {category.label}
            <span>{strengthLabel(category.strength)}</span>
          </span>
        ))}
      </div>
      <div className="notes">
        {path.summary.notes.map(note => (
          <Caption key={note}>{note}</Caption>
        ))}
      </div>
      {path.summary.foundations.length > 0 && (
        <Disclosure>
          <summary>Foundations checked ({path.summary.foundations.length})</summary>
          <ul>
            {path.summary.foundations.map(foundation => (
              <li key={foundation.id}>
                <span>{foundation.label}</span>
                <span>{foundationStatusLabel(foundation.status)}</span>
              </li>
            ))}
          </ul>
        </Disclosure>
      )}
    </Summary>

    {path.steps.length > 0 ? (
      <Steps>
        {path.steps.map(step => {
          const limited = step.evidenceStrength !== 'strong';
          return (
            <li key={step.id} className={limited ? 'weak' : undefined}>
              <span className="priority">Priority {step.priority}</span>
              <div className="body">
                <div className="head">
                  <span className="kind">{stepKindLabel(step.kind)}</span>
                  <h3>{step.title}</h3>
                </div>
                <p className="rationale">{step.rationale}</p>
                <div className="meta">
                  <span className={`evidence${limited ? ' limited' : ''}`}>
                    {stepStrengthLabel(step.evidenceStrength)}
                  </span>
                  {step.basedOn.length > 0 && <BasedOn items={step.basedOn} />}
                </div>
              </div>
            </li>
          );
        })}
      </Steps>
    ) : (
      <Caption style={{ marginTop: '1.5rem' }}>
        No next steps to suggest from the evidence that could be assessed.
      </Caption>
    )}
  </>
);

Path.propTypes = { path: PropTypes.object.isRequired };

/**
 * Practical next steps for a chosen role, from a fixed ruleset and the public evidence. Nothing is
 * requested until a role is chosen; changing the role reloads only this section.
 */
const LearningPath = ({ login }) => {
  const { role, selectRole, retry, status, path, error } = useLearningPath(login);

  let announcement = '';
  if (status === 'loading') announcement = 'Loading learning path';
  else if (status === 'ready') announcement = `Learning path for ${path.roleLabel} loaded`;
  else if (status === 'error') announcement = 'The learning path could not be loaded';

  return (
    <ReportSection id="learning" busy={status === 'loading'}>
      <Segmented legend="Target role" options={ROLE_OPTIONS} value={role} onChange={selectRole} />
      <LiveRegion message={announcement} />

      {status === 'idle' && (
        <Caption style={{ marginTop: '1.5rem' }}>
          Choose a target role to see next steps based on the evidence above. Steps come from a
          fixed, transparent ruleset. They contain no courses, links or certifications, and they say
          when the evidence behind them is weak.
        </Caption>
      )}

      {status === 'loading' && (
        <div style={{ marginTop: '2rem', display: 'grid', gap: '0.9rem' }} aria-hidden="true">
          <Skeleton $height="1.25rem" $width="40%" />
          <Skeleton $height="4rem" />
          <Skeleton $height="4rem" />
          <Skeleton $height="4rem" />
        </div>
      )}

      {status === 'error' && (
        <div style={{ marginTop: '1.5rem' }}>
          <SectionError
            title="Could not load the learning path"
            message={error.message}
            onRetry={retry}
          />
        </div>
      )}

      {status === 'ready' && <Path path={path} />}
    </ReportSection>
  );
};

LearningPath.propTypes = {
  login: PropTypes.string.isRequired,
};

export default LearningPath;
