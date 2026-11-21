import { useState } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins, media } from '../../style';
import Button from '../ui/Button';
import { Caption } from '../ui/Text';
import { formatImpact } from '../../lib/ui/format';
const { colors, radius } = theme;

const List = styled.ol`
  border-top: 1px solid ${colors.rule};

  li {
    display: grid;
    grid-template-columns: 1.1rem 5.5rem minmax(0, 1fr);
    column-gap: 0.9rem;
    align-items: baseline;
    padding: 0.75rem 0;
    border-bottom: 1px solid ${colors.rule};
  }

  /* An empty box, as on a printed checklist. */
  .box {
    width: 0.8rem;
    height: 0.8rem;
    border: 1.5px solid ${colors.ink};
    border-radius: ${radius};
    transform: translateY(0.1rem);
  }

  .impact {
    ${mixins.monoText};
    font-size: 0.875rem;
    font-weight: 600;
    color: ${colors.accentText};
  }

  .what {
    font-weight: 500;
  }

  .where {
    ${mixins.monoLabel};
    margin-left: 0.6rem;
    color: ${colors.muted};
    font-weight: 400;
  }

  .why {
    margin-top: 0.15rem;
    color: ${colors.muted};
    font-size: 0.875rem;
  }

  ${media.bp600`
    li {
      grid-template-columns: 1.1rem minmax(0, 1fr);
    }

    .impact,
    .text {
      grid-column: 2;
    }
  `};
`;

const MoreButton = styled.div`
  margin-top: 0.9rem;
`;

/**
 * Recommendations sorted by potential gain, as a checklist. `impact` is the overall points that
 * would be gained if the check reached its maximum. `dimensions` only names where each item
 * belongs. The same list serves the profile and a repository analysis.
 */
const RecommendationList = ({ items, dimensions, limit = 5, empty }) => {
  const [all, setAll] = useState(false);
  if (items.length === 0) return <Caption>{empty}</Caption>;

  const names = new Map(dimensions.map(dimension => [dimension.id, dimension.label]));
  const visible = all ? items : items.slice(0, limit);
  return (
    <>
      <List>
        {visible.map(item => (
          <li key={`${item.dimensionId}.${item.checkId}`}>
            <span className="box" aria-hidden="true" />
            <span className="impact">{formatImpact(item.impact)}</span>
            <div className="text">
              <p className="what">
                {item.recommendation}
                <span className="where">{names.get(item.dimensionId) ?? item.dimensionId}</span>
              </p>
              <p className="why">
                {item.label}: {item.evidence}
              </p>
            </div>
          </li>
        ))}
      </List>
      {items.length > limit && (
        <MoreButton>
          <Button
            $variant="ghost"
            $size="small"
            aria-expanded={all}
            onClick={() => setAll(value => !value)}>
            {all ? 'Show fewer' : `Show all (${items.length})`}
          </Button>
        </MoreButton>
      )}
    </>
  );
};

RecommendationList.propTypes = {
  items: PropTypes.arrayOf(PropTypes.object).isRequired,
  dimensions: PropTypes.arrayOf(PropTypes.object).isRequired,
  limit: PropTypes.number,
  empty: PropTypes.string.isRequired,
};

export default RecommendationList;
