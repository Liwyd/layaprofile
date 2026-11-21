import { describe, expect, it } from 'vitest';
import {
  COMPARE_SECTIONS,
  COMPARE_SECTION_IDS,
  SECTIONS,
  SECTION_IDS,
  sectionById,
} from './sections';

describe('sections', () => {
  it('numbers the report sections 01 to 07 in order with unique ids', () => {
    expect(SECTIONS.map(section => section.number)).toEqual([
      '01',
      '02',
      '03',
      '04',
      '05',
      '06',
      '07',
    ]);
    expect(new Set(SECTION_IDS).size).toBe(SECTIONS.length);
    expect(SECTION_IDS.at(-1)).toBe('share');
  });

  it('numbers the comparison sections 01 to 06 in order with unique ids', () => {
    expect(COMPARE_SECTIONS.map(section => section.number)).toEqual([
      '01',
      '02',
      '03',
      '04',
      '05',
      '06',
    ]);
    expect(new Set(COMPARE_SECTION_IDS).size).toBe(COMPARE_SECTIONS.length);
  });

  it('shares no id between the report and the comparison', () => {
    const all = [...SECTION_IDS, ...COMPARE_SECTION_IDS];
    expect(new Set(all).size).toBe(all.length);
  });

  it('looks sections up by id and fails loudly for an unknown id', () => {
    expect(sectionById('repositories').number).toBe('04');
    expect(sectionById('metrics').title).toBe('Metrics');
    expect(() => sectionById('nope')).toThrow(RangeError);
  });
});
