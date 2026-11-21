// The numbered sections of the profile report and of the comparison page, in page order. Shared by
// the section frames and the in-page navigation so the two can never disagree. `navLabel` is the
// short form for the nav. Ids are unique across both lists, because `sectionById` serves both.
export const SECTIONS = Object.freeze([
  { id: 'overview', number: '01', title: 'Overview', navLabel: 'Overview' },
  { id: 'activity', number: '02', title: 'Activity & languages', navLabel: 'Activity' },
  { id: 'quality', number: '03', title: 'Profile quality', navLabel: 'Quality' },
  { id: 'repositories', number: '04', title: 'Repositories', navLabel: 'Repos' },
  { id: 'skills', number: '05', title: 'Skill evidence', navLabel: 'Skills' },
  { id: 'learning', number: '06', title: 'Learning path', navLabel: 'Learning' },
  { id: 'share', number: '07', title: 'Share card', navLabel: 'Share' },
]);

export const COMPARE_SECTIONS = Object.freeze([
  { id: 'profiles', number: '01', title: 'Profiles', navLabel: 'Profiles' },
  { id: 'metrics', number: '02', title: 'Metrics', navLabel: 'Metrics' },
  { id: 'languages', number: '03', title: 'Languages', navLabel: 'Languages' },
  { id: 'skill-overlap', number: '04', title: 'Skill evidence', navLabel: 'Skills' },
  { id: 'year-activity', number: '05', title: 'Activity', navLabel: 'Activity' },
  { id: 'differences', number: '06', title: 'Differences', navLabel: 'Differences' },
]);

export const SECTION_IDS = Object.freeze(SECTIONS.map(section => section.id));
export const COMPARE_SECTION_IDS = Object.freeze(COMPARE_SECTIONS.map(section => section.id));

const BY_ID = new Map([...SECTIONS, ...COMPARE_SECTIONS].map(section => [section.id, section]));

/** The section definition for an id; throws for an unknown id so a typo fails loudly. */
export const sectionById = id => {
  const section = BY_ID.get(id);
  if (!section) throw new RangeError(`Unknown report section: ${String(id)}`);
  return section;
};
