import ReportSection from '../ui/ReportSection';
import Skeleton from '../ui/Skeleton';
import { SECTION_IDS } from '../../lib/ui/sections';

// The shape of each section while the profile loads, so the layout does not jump when it arrives.
const SHAPES = {
  overview: [
    { height: '4.5rem', width: 'min(32rem, 100%)' },
    { height: '1rem', width: 'min(18rem, 60%)' },
    { height: '1.1rem', width: 'min(38rem, 100%)' },
    { height: '4.5rem' },
  ],
  activity: [{ height: '0.9rem' }, { height: '0.9rem', width: '70%' }, { height: '12rem' }],
  quality: [
    { height: '4.5rem', width: 'min(18rem, 100%)' },
    { height: '3rem' },
    { height: '3rem' },
  ],
  repositories: [
    { height: '2.2rem', width: 'min(24rem, 100%)' },
    { height: '3rem' },
    { height: '3rem' },
    { height: '3rem' },
  ],
  skills: [{ height: '1.1rem', width: 'min(24rem, 100%)' }, { height: '3rem' }, { height: '3rem' }],
  learning: [
    { height: '2.2rem', width: 'min(32rem, 100%)' },
    { height: '1.1rem', width: 'min(24rem, 80%)' },
  ],
};

/** Skeleton blocks for every section. The status is announced by the page's live region. */
const ReportSkeleton = () => (
  <>
    {SECTION_IDS.map(id => (
      <ReportSection key={id} id={id} busy plainTitle={id === 'overview'}>
        <div style={{ display: 'grid', gap: '0.9rem' }} aria-hidden="true">
          {SHAPES[id].map((shape, index) => (
            <Skeleton key={index} $height={shape.height} $width={shape.width} />
          ))}
        </div>
      </ReportSection>
    ))}
  </>
);

export default ReportSkeleton;
