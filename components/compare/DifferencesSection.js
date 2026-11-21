import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme } from '../../style';
import ReportSection from '../ui/ReportSection';
import { Caption, Label } from '../ui/Text';
const { colors } = theme;

const List = styled.ul`
  border-top: 1px solid ${colors.ink};

  li {
    padding: 0.8rem 0;
    border-bottom: 1px solid ${colors.rule};
    font-size: 1.0625rem;
  }
`;

const Caveats = styled.ul`
  display: grid;
  gap: 0.4rem;
  max-width: 70ch;
  padding-left: 1.1rem;
  list-style: disc;
  color: ${colors.muted};
  font-size: 0.875rem;
  line-height: 1.5;
`;

/**
 * The API's neutral difference sentences (the largest gaps in repository and checklist rows;
 * never popularity) followed by the caveats that frame how to read the comparison.
 */
const DifferencesSection = ({ differences, caveats }) => (
  <ReportSection id="differences">
    <Label>Largest differences</Label>
    {differences.length > 0 ? (
      <List>
        {differences.map(difference => (
          <li key={difference.id}>{difference.text}</li>
        ))}
      </List>
    ) : (
      <Caption>
        No repository or checklist row shows a large gap. A difference is listed only when the gap
        is at least 20% of the row&apos;s scale.
      </Caption>
    )}

    <Label style={{ marginTop: '2.5rem' }}>Caveats</Label>
    <Caveats>
      {caveats.map(caveat => (
        <li key={caveat}>{caveat}</li>
      ))}
    </Caveats>
  </ReportSection>
);

DifferencesSection.propTypes = {
  differences: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string, text: PropTypes.string }))
    .isRequired,
  caveats: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default DifferencesSection;
