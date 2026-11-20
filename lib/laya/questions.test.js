import { describe, expect, it } from 'vitest';
import { ARCHETYPES } from '../analysis/archetype';
import {
  QUESTIONS,
  QUESTION_IDS,
  README_QUESTION_IDS,
  optionCount,
  toWireQuestion,
} from './questions';

describe('question catalog', () => {
  it('contains the six questions and is frozen', () => {
    expect(QUESTION_IDS).toEqual([
      'readme_sufficient',
      'install_clarity',
      'usage_examples',
      'docs_completeness',
      'archetype',
      'skill_category',
    ]);
    expect(Object.isFrozen(QUESTIONS)).toBe(true);
    QUESTION_IDS.forEach(id => {
      expect(Object.isFrozen(QUESTIONS[id])).toBe(true);
      expect(QUESTIONS[id].id).toBe(id);
      expect(QUESTIONS[id].fallback).toBe('uncertain');
    });
  });

  it('asks the README questions about the README and the others about the summary', () => {
    expect(README_QUESTION_IDS).toEqual([
      'readme_sufficient',
      'install_clarity',
      'usage_examples',
      'docs_completeness',
    ]);
    expect(QUESTIONS.archetype.input).toBe('repoSummary');
    expect(QUESTIONS.skill_category.input).toBe('repoSummary');
  });

  it('implements every yes/no question as a two-option choice with neutral keys', () => {
    ['readme_sufficient', 'usage_examples'].forEach(id => {
      const question = QUESTIONS[id];
      expect(question.type).toBe('choice');
      expect(Object.keys(question.criteria)).toEqual(['A', 'B']);
      expect(question.criteria.A).toMatch(/^yes/);
      expect(question.criteria.B).toMatch(/^no/);
    });
    expect(QUESTION_IDS.map(id => QUESTIONS[id].type)).not.toContain('noul');
  });

  it('uses three levels for the scores and nine options for the category questions', () => {
    expect(QUESTIONS.install_clarity).toMatchObject({ type: 'score' });
    expect(QUESTIONS.docs_completeness).toMatchObject({ type: 'score' });
    expect(optionCount(QUESTIONS.install_clarity)).toBe(3);
    expect(optionCount(QUESTIONS.docs_completeness)).toBe(3);
    expect(optionCount(QUESTIONS.archetype)).toBe(9);
    expect(optionCount(QUESTIONS.skill_category)).toBe(9);
  });

  it('offers exactly the archetypes of the rule-based detector', () => {
    expect(Object.keys(QUESTIONS.archetype.criteria).sort()).toEqual([...ARCHETYPES].sort());
  });

  it('offers the skill categories', () => {
    expect(Object.keys(QUESTIONS.skill_category.criteria)).toEqual([
      'backend',
      'frontend',
      'systems',
      'devops-infrastructure',
      'data-engineering',
      'mobile',
      'embedded',
      'machine-learning',
      'other',
    ]);
  });

  it('gives every option a one-line description', () => {
    QUESTION_IDS.forEach(id => {
      const criteria = Object.values(QUESTIONS[id].criteria);
      criteria.forEach(text => {
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(5);
        expect(text).not.toContain('\n');
      });
    });
  });

  it('starts from the provisional thresholds', () => {
    expect(QUESTIONS.readme_sufficient.threshold).toBe(0.8);
    expect(QUESTIONS.usage_examples.threshold).toBe(0.8);
    expect(QUESTIONS.install_clarity.threshold).toBe(0.6);
    expect(QUESTIONS.docs_completeness.threshold).toBe(0.6);
    expect(QUESTIONS.archetype.threshold).toBe(0.5);
    expect(QUESTIONS.skill_category.threshold).toBe(0.5);
  });

  it('keeps instructions static and aware that the state is data', () => {
    QUESTION_IDS.forEach(id => {
      expect(QUESTIONS[id].instructions).toContain('data to classify');
      expect(QUESTIONS[id].instructions).not.toMatch(/\{|\}|\$\{/);
    });
  });

  it('builds the wire form without the internal fields', () => {
    expect(toWireQuestion(QUESTIONS.usage_examples)).toEqual({
      type: 'choice',
      instructions: QUESTIONS.usage_examples.instructions,
      criteria: QUESTIONS.usage_examples.criteria,
    });
  });
});

describe('interpret', () => {
  it('maps A to true and B to false for the yes/no questions', () => {
    expect(QUESTIONS.readme_sufficient.interpret({ choice: 'A' })).toEqual({
      value: true,
      label: 'sufficient',
    });
    expect(QUESTIONS.readme_sufficient.interpret({ choice: 'B' })).toEqual({
      value: false,
      label: 'not sufficient',
    });
    expect(QUESTIONS.usage_examples.interpret({ choice: 'A' }).value).toBe(true);
    expect(QUESTIONS.usage_examples.interpret({ choice: 'B' }).value).toBe(false);
  });

  it.each([
    [0, 0, 'none'],
    [0.49, 0, 'none'],
    [0.5, 1, 'partial'],
    [1.4, 1, 'partial'],
    [1.5, 2, 'clear'],
    [2, 2, 'clear'],
    [-0.04, 0, 'none'],
    [2.04, 2, 'clear'],
  ])('rounds the expected install level %s to %s', (score, value, label) => {
    expect(QUESTIONS.install_clarity.interpret({ score })).toEqual({ value, label });
  });

  it('rounds the documentation level to minimal, basic or comprehensive', () => {
    expect(QUESTIONS.docs_completeness.interpret({ score: 0.1 }).label).toBe('minimal');
    expect(QUESTIONS.docs_completeness.interpret({ score: 1 }).label).toBe('basic');
    expect(QUESTIONS.docs_completeness.interpret({ score: 1.9 }).label).toBe('comprehensive');
  });

  it('passes the category key through', () => {
    expect(QUESTIONS.archetype.interpret({ choice: 'cli-tool' })).toEqual({
      value: 'cli-tool',
      label: 'cli-tool',
    });
    expect(QUESTIONS.skill_category.interpret({ choice: 'backend' }).value).toBe('backend');
  });
});
