import { useState } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins } from '../../style';
import ReportSection from '../ui/ReportSection';
import Button from '../ui/Button';
import Disclosure from '../ui/Disclosure';
import { Caption } from '../ui/Text';
import SectionError from './SectionError';
import StatusTag from './StatusTag';
import { formatDate, sourceLabel, strengthLabel } from '../../lib/ui/format';
import { repoUrl } from '../../lib/ui/url';
const { colors, radius, transition } = theme;

// Pips, shown with the text label: repeated 3, observed 2, weak 1, no public evidence 0.
const PIPS = { repeated: 3, observed: 2, weak: 1, unknown: 0 };

const Pips = styled.span`
  display: inline-flex;
  gap: 2px;

  i {
    width: 0.45rem;
    height: 0.45rem;
    border: 1px solid ${colors.ink};
  }

  i.on {
    background: ${colors.ink};
  }
`;

const Tag = styled.span`
  ${mixins.monoLabel};
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.1rem 0.45rem;
  border: 1px ${props => (props.$strength === 'unknown' ? 'dashed' : 'solid')}
    ${props => (props.$strength === 'unknown' ? colors.muted : colors.ink)};
  color: ${props => (props.$strength === 'unknown' ? colors.muted : colors.ink)};
  font-size: 0.68rem;
  white-space: nowrap;

  ${Pips} i {
    border-color: currentColor;
  }

  ${Pips} i.on {
    background: currentColor;
  }
`;

const StrengthTag = ({ strength }) => {
  const key = Object.hasOwn(PIPS, strength) ? strength : 'unknown';
  return (
    <Tag $strength={key}>
      <Pips aria-hidden="true">
        {[0, 1, 2].map(index => (
          <i key={index} className={index < PIPS[key] ? 'on' : undefined} />
        ))}
      </Pips>
      {strengthLabel(key)}
    </Tag>
  );
};

StrengthTag.propTypes = { strength: PropTypes.string };

const Intro = styled.div`
  display: grid;
  gap: 0.35rem;
  margin-bottom: 1.5rem;

  .meta {
    ${mixins.monoLabel};
    color: ${colors.muted};
    text-transform: none;
    letter-spacing: 0.02em;
  }
`;

const Categories = styled.ul`
  border-top: 1px solid ${colors.ink};

  > li {
    padding: 1rem 0;
    border-bottom: 1px solid ${colors.rule};
  }

  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem 0.9rem;
  }

  h3 {
    font-size: 1.0625rem;
    letter-spacing: -0.01em;
  }

  .meta {
    ${mixins.monoLabel};
    color: ${colors.muted};
    text-transform: none;
    letter-spacing: 0.02em;
  }

  .note {
    margin-top: 0.35rem;
    max-width: 62ch;
    color: ${colors.muted};
    font-size: 0.875rem;
  }

  .techs {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin-top: 0.75rem;
  }

  .tech {
    display: inline-flex;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.25rem 0.6rem;
    border: 1px solid ${colors.rule};
    border-radius: ${radius};
    background: transparent;
    font-size: 0.875rem;
    transition:
      border-color ${transition},
      color ${transition};

    &:hover {
      border-color: ${colors.ink};
    }

    &[aria-expanded='true'] {
      border-color: ${colors.accent};
      color: ${colors.accentText};
    }

    .n {
      ${mixins.monoText};
      color: ${colors.muted};
      font-size: 0.75rem;
    }
  }

  .evidence {
    margin-top: 0.75rem;
    padding-left: 1rem;
    border-left: 2px solid ${colors.accent};
  }

  .evidence button {
    margin: 0.4rem 0 0.2rem;
  }

  .evidence h4 {
    ${mixins.monoLabel};
    margin-bottom: 0.4rem;
    color: ${colors.muted};
  }

  .evidence li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.75rem;
    padding: 0.3rem 0;
    font-size: 0.875rem;
  }

  .source {
    ${mixins.monoLabel};
    padding: 0 0.35rem;
    border: 1px solid ${colors.rule};
    color: ${colors.muted};
    font-size: 0.65rem;
  }

  .detail {
    color: ${colors.muted};
  }
`;

const Quiet = styled.div`
  margin-top: 1.5rem;

  summary {
    ${mixins.monoLabel};
    padding: 0.5rem 0;
    color: ${colors.muted};
  }

  ul {
    margin-top: 0.4rem;
  }

  li {
    padding: 0.3rem 0;
    color: ${colors.muted};
    font-size: 0.875rem;
  }
`;

const RepoName = ({ name }) => {
  const href = repoUrl(name);
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {name}
    </a>
  ) : (
    <span>{name}</span>
  );
};

RepoName.propTypes = { name: PropTypes.string.isRequired };

const EVIDENCE_LIMIT = 8;

// Lists the repositories behind a technology, as many as `EVIDENCE_LIMIT` until expanded.
const EvidenceList = ({ title, items }) => {
  const [all, setAll] = useState(false);
  const visible = all ? items : items.slice(0, EVIDENCE_LIMIT);
  return (
    <div className="evidence">
      <h4>{title}</h4>
      <ul>
        {visible.map(item => (
          <li key={`${item.repo}-${item.source}`}>
            <RepoName name={item.repo} />
            <span className="source">{sourceLabel(item.source)}</span>
            {item.source === 'model' && <StatusTag status="model" />}
            <span className="detail">{item.detail}</span>
          </li>
        ))}
      </ul>
      {items.length > EVIDENCE_LIMIT && (
        <Button
          $variant="ghost"
          $size="small"
          aria-expanded={all}
          onClick={() => setAll(value => !value)}>
          {all ? 'Show fewer' : `Show all (${items.length})`}
        </Button>
      )}
    </div>
  );
};

EvidenceList.propTypes = {
  title: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
};

const Category = ({ category, technologies }) => {
  const [selected, setSelected] = useState(null);
  const members = category.technologies
    .map(id => technologies.get(id))
    .filter(technology => technology !== undefined);
  const chosen = members.find(technology => technology.id === selected);
  const last = formatDate(category.lastActivity);

  return (
    <li>
      <div className="head">
        <h3>{category.label}</h3>
        <StrengthTag strength={category.strength} />
        {category.source === 'model-inferred' && <StatusTag status="model" />}
        {category.repoCount > 0 && (
          <span className="meta">
            {category.repoCount} {category.repoCount === 1 ? 'repository' : 'repositories'}
            {last ? ` · last push ${last}` : ''}
          </span>
        )}
      </div>
      <p className="note">{category.note}</p>

      {members.length > 0 && (
        <ul className="techs">
          {members.map(technology => (
            <li key={technology.id}>
              <button
                type="button"
                className="tech"
                aria-expanded={selected === technology.id}
                aria-controls={selected === technology.id ? `evidence-${category.id}` : undefined}
                onClick={() => setSelected(selected === technology.id ? null : technology.id)}>
                {technology.name}
                <span className="n">{technology.repoCount}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div id={`evidence-${category.id}`}>
        {chosen && (
          <EvidenceList
            key={chosen.id}
            title={`${chosen.name}: ${strengthLabel(chosen.strength)}, ${chosen.repoCount} ${chosen.repoCount === 1 ? 'repository' : 'repositories'}`}
            items={chosen.evidence}
          />
        )}
      </div>

      {category.modelEvidence.length > 0 && (
        <EvidenceList title="Laya predictions (not verified)" items={category.modelEvidence} />
      )}
    </li>
  );
};

Category.propTypes = {
  category: PropTypes.object.isRequired,
  technologies: PropTypes.instanceOf(Map).isRequired,
};

/**
 * The skill evidence map: technical areas with how much public evidence was found, and for each
 * technology the repositories (and the kind of signal) behind it. Strength is evidence, never a
 * skill level, and there are no percentages.
 */
const SkillEvidence = ({ skills, onRetry }) => {
  if (!Array.isArray(skills?.categories) || !Array.isArray(skills?.technologies)) {
    return (
      <ReportSection id="skills">
        <SectionError
          title="Skill evidence is unavailable"
          message="The skill evidence was not part of the response."
          onRetry={onRetry}
        />
      </ReportSection>
    );
  }

  const technologies = new Map(skills.technologies.map(technology => [technology.id, technology]));
  const withEvidence = skills.categories.filter(category => category.strength !== 'unknown');
  const withoutEvidence = skills.categories.filter(category => category.strength === 'unknown');

  return (
    <ReportSection id="skills">
      <Intro>
        <Caption>
          Signals from public repositories. Activity is not proof of professional expertise.
        </Caption>
        <p className="meta">
          Based on {skills.analyzed?.repos ?? 0} own repositories
          {skills.notCounted?.forks > 0 ? ` · ${skills.notCounted.forks} forks not counted` : ''}
        </p>
      </Intro>

      {withEvidence.length > 0 ? (
        <Categories>
          {withEvidence.map(category => (
            <Category key={category.id} category={category} technologies={technologies} />
          ))}
        </Categories>
      ) : (
        <Caption>No public evidence was found in the analyzed repositories.</Caption>
      )}

      {withoutEvidence.length > 0 && (
        <Quiet>
          <Disclosure>
            <summary>No public evidence found ({withoutEvidence.length})</summary>
            <ul>
              {withoutEvidence.map(category => (
                <li key={category.id}>{category.label}</li>
              ))}
            </ul>
            <Caption style={{ marginTop: '0.5rem' }}>
              This is not a verified negative: private work and other platforms are not visible.
            </Caption>
          </Disclosure>
        </Quiet>
      )}

      {skills.caveats?.length > 0 && (
        <Quiet>
          <Disclosure>
            <summary>About this evidence</summary>
            <ul>
              {skills.caveats.map(caveat => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          </Disclosure>
        </Quiet>
      )}
    </ReportSection>
  );
};

SkillEvidence.propTypes = {
  skills: PropTypes.object,
  onRetry: PropTypes.func,
};

export default SkillEvidence;
