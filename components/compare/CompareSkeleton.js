import ReportSection from '../ui/ReportSection';
import Skeleton from '../ui/Skeleton';
import { COMPARE_SECTION_IDS } from '../../lib/ui/sections';

// The shape of each section while the comparison loads, so the layout does not jump on arrival.
const SHAPES = {
  profiles: [{ height: '11rem' }],
  metrics: [
    { height: '1.5rem', width: 'min(34rem, 100%)' },
    { height: '2.6rem' },
    { height: '2.6rem' },
    { height: '2.6rem' },
    { height: '2.6rem' },
    { height: '2.6rem' },
  ],
  languages: [{ height: '8rem' }],
  'skill-overlap': [{ height: '3rem' }, { height: '3rem' }, { height: '3rem' }],
  'year-activity': [{ height: '2.2rem', width: 'min(18rem, 100%)' }, { height: '12rem' }],
  differences: [{ height: '2.6rem' }, { height: '2.6rem' }, { height: '2.6rem' }],
};

/** Skeleton blocks for every comparison section. The page's live region announces the state. */
const CompareSkeleton = () => (
  <>
    {COMPARE_SECTION_IDS.map(id => (
      <ReportSection key={id} id={id} busy>
        <div style={{ display: 'grid', gap: '0.9rem' }} aria-hidden="true">
          {SHAPES[id].map((shape, index) => (
            <Skeleton key={index} $height={shape.height} $width={shape.width} />
          ))}
        </div>
      </ReportSection>
    ))}
  </>
);

export default CompareSkeleton;
