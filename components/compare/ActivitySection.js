import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import ReportSection from '../ui/ReportSection';
import Segmented from '../ui/Segmented';
import { Caption, Label } from '../ui/Text';
import YearChart from '../report/YearChart';
import { ACTIVITY_MEASURES, activitySeries } from '../../lib/ui/compare';

/**
 * Repositories created or last pushed per year for both profiles, as one grouped bar chart. One
 * measure is drawn at a time (the toggle); the table alternative carries all four series. These
 * are repository dates, not commit history.
 */
const ActivitySection = ({ activity, logins }) => {
  const [measure, setMeasure] = useState(ACTIVITY_MEASURES[0].id);
  const bySource = useMemo(
    () => ({
      created: activitySeries(activity, 'created'),
      pushed: activitySeries(activity, 'pushed'),
    }),
    [activity],
  );

  const { years } = bySource.created;
  const series = useMemo(
    () => [
      { label: logins.a, data: bySource[measure].a, tone: 'ink' },
      { label: logins.b, data: bySource[measure].b, tone: 'muted' },
    ],
    [bySource, measure, logins],
  );
  const tableSeries = useMemo(
    () =>
      ACTIVITY_MEASURES.flatMap(({ id, label }) => [
        { label: `${logins.a} ${label.toLowerCase()}`, data: bySource[id].a, tone: 'ink' },
        { label: `${logins.b} ${label.toLowerCase()}`, data: bySource[id].b, tone: 'muted' },
      ]),
    [bySource, logins],
  );

  if (years.length === 0) {
    return (
      <ReportSection id="year-activity">
        <Caption>
          No repository dates are available for either profile, so there is no activity to chart.
        </Caption>
      </ReportSection>
    );
  }

  const measureWord = measure === 'created' ? 'creation' : 'last push';
  return (
    <ReportSection id="year-activity">
      <Label>{activity.label ?? 'Repository creation and last-push years'}</Label>
      <div style={{ marginBottom: '1rem' }}>
        <Segmented
          legend="Chart shows repositories by"
          options={ACTIVITY_MEASURES}
          value={measure}
          onChange={setMeasure}
        />
      </div>
      <YearChart
        years={years}
        series={series}
        tableSeries={tableSeries}
        description={`Grouped bar chart of repositories by year of ${measureWord} for ${logins.a} and ${logins.b}`}
        tableCaption={`Repositories created and last pushed per year, for ${logins.a} and ${logins.b}`}
      />
      <Caption style={{ marginTop: '0.75rem' }}>
        {activity.note ?? 'These are repository creation and last-push dates, not commit history.'}
      </Caption>
    </ReportSection>
  );
};

ActivitySection.propTypes = {
  activity: PropTypes.shape({
    label: PropTypes.string,
    note: PropTypes.string,
    years: PropTypes.arrayOf(PropTypes.object).isRequired,
  }).isRequired,
  logins: PropTypes.shape({ a: PropTypes.string, b: PropTypes.string }).isRequired,
};

export default ActivitySection;
