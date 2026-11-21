import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins, media } from '../../style';
import Skeleton from '../ui/Skeleton';
import { Caption, Label } from '../ui/Text';
import ScoreMeter from './ScoreMeter';
import { DimensionList } from './CheckList';
import RecommendationList from './RecommendationList';
import SectionError from './SectionError';
import StatusTag from './StatusTag';
import {
  archetypeLabel,
  fetchState,
  formatDateTime,
  formatProbability,
  layaAnswerView,
  layaSummary,
} from '../../lib/ui/format';
const { colors } = theme;

const Panel = styled.div`
  display: grid;
  gap: 1.75rem;
  padding: 1.25rem 0 1.5rem 1rem;
  border-left: 2px solid ${colors.accent};

  ${media.bp600`
    padding-left: 0.75rem;
  `};

  .rows {
    display: grid;
    gap: 0.75rem;
  }

  .fine {
    ${mixins.monoLabel};
    color: ${colors.muted};
    text-transform: none;
    letter-spacing: 0.02em;
  }
`;

const Archetype = styled.div`
  .line {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.9rem;
  }

  .name {
    font-size: 1.0625rem;
    font-weight: 600;
  }

  .detail {
    color: ${colors.muted};
    font-size: 0.875rem;
  }

  ul {
    margin-top: 0.5rem;
    color: ${colors.muted};
    font-size: 0.875rem;
  }
`;

const Laya = styled.div`
  .status {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.4rem 0.9rem;
  }

  .state {
    ${mixins.monoLabel};
    padding: 0.1rem 0.45rem;
    border: 1px solid ${colors.ink};
    font-size: 0.68rem;
  }

  .state.warn {
    border-style: dashed;
    border-color: ${colors.muted};
    color: ${colors.muted};
  }

  .text {
    max-width: 60ch;
    font-size: 0.9375rem;
  }

  ul {
    margin-top: 1rem;
    border-top: 1px solid ${colors.rule};
  }

  li {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 1fr) auto;
    column-gap: 0.9rem;
    align-items: baseline;
    padding: 0.6rem 0;
    border-bottom: 1px solid ${colors.rule};
    font-size: 0.9375rem;

    ${media.bp600`
      grid-template-columns: minmax(0, 1fr);
      row-gap: 0.2rem;
    `};
  }

  .value {
    font-weight: 600;
  }

  .value.none {
    color: ${colors.muted};
    font-weight: 400;
  }

  .why {
    display: block;
    color: ${colors.muted};
    font-size: 0.8125rem;
    font-weight: 400;
  }

  .numbers {
    ${mixins.monoText};
    color: ${colors.muted};
    font-size: 0.8125rem;
    white-space: nowrap;
  }

  .caveat {
    margin-top: 0.9rem;
  }
`;

const RULE_CONFIDENCE = {
  strong: 'strong signals',
  weak: 'weak signals',
  none: 'no signals found',
};

const ArchetypeBlock = ({ archetype }) => {
  const fromModel = archetype.source === 'model';
  const signals = fromModel
    ? []
    : (archetype.signals ?? []).filter(signal => signal.archetype === archetype.archetype);
  return (
    <Archetype>
      <div className="line">
        <span className="name">{archetypeLabel(archetype.archetype)}</span>
        <StatusTag status={fromModel ? 'model' : 'rule'} />
        <span className="detail">
          {fromModel
            ? `${formatProbability(archetype.answerConfidence) ?? 'probability unknown'} · threshold ${archetype.threshold?.toFixed(2) ?? 'unknown'}`
            : (RULE_CONFIDENCE[archetype.confidence] ?? 'no signals found')}
        </span>
      </div>
      {fromModel && (
        <p className="detail" style={{ marginTop: '0.4rem' }}>
          The rules found {RULE_CONFIDENCE[archetype.ruleConfidence] ?? 'no signals'}
          {archetype.ruleArchetype && archetype.ruleArchetype !== 'unknown'
            ? ` (${archetypeLabel(archetype.ruleArchetype)})`
            : ''}
          , so this is Laya&apos;s prediction, not a verified fact.
        </p>
      )}
      {signals.length > 0 && (
        <ul>
          {signals.map(signal => (
            <li key={`${signal.id}-${signal.detail}`}>{signal.detail}</li>
          ))}
        </ul>
      )}
    </Archetype>
  );
};

ArchetypeBlock.propTypes = { archetype: PropTypes.object.isRequired };

const LayaBlock = ({ laya }) => {
  const summary = layaSummary(laya);
  const answers = Object.entries(laya.answers ?? {}).map(([id, answer]) =>
    layaAnswerView(id, answer),
  );
  const healthy = summary.key === 'ok' || summary.key === 'partial';
  return (
    <Laya>
      <div className="status">
        <span className={`state${healthy ? '' : ' warn'}`}>{summary.key}</span>
        <p className="text">{summary.text}</p>
      </div>
      {laya.model && <p className="fine">checkpoint: {laya.model}</p>}
      {laya.error?.message && <p className="fine">{laya.error.message}</p>}
      {answers.length > 0 && (
        <ul>
          {answers.map(answer => (
            <li key={answer.id}>
              <span>
                <StatusTag status="model" />
              </span>
              <span className={`value${answer.state === 'confident' ? '' : ' none'}`}>
                {answer.question}
                <span className="why">
                  {answer.state === 'confident'
                    ? answer.value
                    : `uncertain: ${answer.reason}. Not used.`}
                </span>
              </span>
              <span className="numbers">
                {[answer.probability, answer.threshold && `threshold ${answer.threshold}`]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Caption className="caveat">
        Laya predictions are probabilistic. A probability is not a guarantee, and a prediction is
        never treated as a verified fact. Uncertain answers are not used.
      </Caption>
    </Laya>
  );
};

LayaBlock.propTypes = { laya: PropTypes.object.isRequired };

/**
 * The detail panel of one repository analysis: score and coverage, project type, every dimension
 * with its checks, the Laya assessment and the recommendations.
 */
const RepoAnalysis = ({ repo, entry, onRetry }) => {
  if (entry.status === 'loading') {
    return (
      <Panel aria-busy="true">
        <Skeleton $height="3.5rem" $width="14rem" />
        <div className="rows">
          <Skeleton $height="0.9rem" />
          <Skeleton $height="0.9rem" $width="80%" />
          <Skeleton $height="0.9rem" $width="65%" />
        </div>
      </Panel>
    );
  }

  if (entry.status === 'error') {
    return (
      <Panel>
        <SectionError
          title={`Analysis of ${repo.name} failed`}
          message={entry.error.message}
          onRetry={onRetry}
        />
      </Panel>
    );
  }

  const { analysis, laya, evidenceMeta } = entry.data;
  const scored = analysis.dimensions.length > 0;
  const when = formatDateTime(evidenceMeta?.fetchedAt);
  const unavailable = evidenceMeta?.unavailable ?? [];

  return (
    <Panel>
      <ScoreMeter score={analysis.score} label={analysis.label} coverage={analysis.coverage} />

      {analysis.notes?.length > 0 && (
        <div className="rows">
          {analysis.notes.map(note => (
            <Caption key={note}>{note}</Caption>
          ))}
        </div>
      )}

      {analysis.archetype && (
        <div>
          <Label>Project type</Label>
          <ArchetypeBlock archetype={analysis.archetype} />
        </div>
      )}

      {scored && (
        <div>
          <Label>Dimensions</Label>
          <DimensionList dimensions={analysis.dimensions} />
        </div>
      )}

      <div>
        <Label>Laya assessment</Label>
        <LayaBlock laya={laya} />
      </div>

      {scored && (
        <div>
          <Label>Recommendations</Label>
          <RecommendationList
            items={analysis.recommendations}
            dimensions={analysis.dimensions}
            limit={4}
            empty="No improvements to suggest from the data that could be assessed."
          />
        </div>
      )}

      <p className="fine">
        Fetched {when ?? 'at an unknown time'} {'· '}
        {fetchState(evidenceMeta ?? {})}
        {unavailable.length > 0 &&
          ` · could not be retrieved: ${unavailable.join(', ')} (related checks are unknown)`}
      </p>
    </Panel>
  );
};

RepoAnalysis.propTypes = {
  repo: PropTypes.shape({ name: PropTypes.string.isRequired }).isRequired,
  entry: PropTypes.shape({
    status: PropTypes.string.isRequired,
    data: PropTypes.object,
    error: PropTypes.object,
  }).isRequired,
  onRetry: PropTypes.func.isRequired,
};

export default RepoAnalysis;
