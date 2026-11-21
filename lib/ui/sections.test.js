import { describe, expect, it } from 'vitest';
import { SECTIONS, SECTION_IDS, sectionById } from './sections';

describe('sections', () => {
  it('numbers the sections 01 to 06 in order with unique ids', () => {
    expect(SECTIONS.map(section => section.number)).toEqual(['01', '02', '03', '04', '05', '06']);
    expect(new Set(SECTION_IDS).size).toBe(SECTIONS.length);
  });

  it('looks sections up by id and fails loudly for an unknown id', () => {
    expect(sectionById('repositories').number).toBe('04');
    expect(() => sectionById('nope')).toThrow(RangeError);
  });
});
