import { describe, expect, it } from 'vitest';
import {
  CATEGORIES,
  CATEGORY_IDS,
  SOURCE_ORDER,
  TECHNOLOGIES,
  TECHNOLOGY_BY_ID,
  detectTechnologies,
} from './technologies';

const detect = (repo, files) => detectTechnologies(repo, files);
const ids = hits => hits.map(hit => hit.technology);
const hitFor = (hits, id) => hits.find(hit => hit.technology === id);

describe('the technology table', () => {
  it('has the eight categories', () => {
    expect(CATEGORY_IDS).toEqual([
      'backend',
      'frontend',
      'systems',
      'devops-infrastructure',
      'data-engineering',
      'mobile',
      'embedded',
      'machine-learning',
    ]);
    expect(CATEGORIES.every(category => category.label.length > 0)).toBe(true);
  });

  it('stays small and curated', () => {
    expect(TECHNOLOGIES.length).toBeGreaterThanOrEqual(40);
    expect(TECHNOLOGIES.length).toBeLessThanOrEqual(60);
  });

  it('has unique ids and valid categories', () => {
    expect(new Set(TECHNOLOGIES.map(item => item.id)).size).toBe(TECHNOLOGIES.length);
    TECHNOLOGIES.forEach(item => {
      expect(CATEGORY_IDS).toContain(item.category);
      item.alsoCategories.forEach(category => expect(CATEGORY_IDS).toContain(category));
      expect(item.alsoCategories).not.toContain(item.category);
      expect(item.name.length).toBeGreaterThan(0);
    });
    expect(TECHNOLOGY_BY_ID.react.name).toBe('React');
  });

  it('treats every multi-category technology as broad', () => {
    TECHNOLOGIES.filter(item => item.alsoCategories.length > 0).forEach(item => {
      expect(item.broad).toBe(true);
    });
  });

  it('maps the languages named in the design', () => {
    const categoriesOf = id => [
      TECHNOLOGY_BY_ID[id].category,
      ...TECHNOLOGY_BY_ID[id].alsoCategories,
    ];
    expect(categoriesOf('go')).toEqual(['backend', 'systems']);
    expect(categoriesOf('rust')).toEqual(['systems']);
    expect(categoriesOf('typescript')).toEqual(['frontend', 'backend']);
    expect(categoriesOf('javascript')).toEqual(['frontend', 'backend']);
    expect(categoriesOf('python')).toEqual(['backend', 'data-engineering', 'machine-learning']);
    ['kotlin', 'swift', 'dart'].forEach(id => expect(categoriesOf(id)).toEqual(['mobile']));
    expect(categoriesOf('c')).toEqual(['systems', 'embedded']);
    expect(categoriesOf('cpp')).toEqual(['systems', 'embedded']);
    expect(categoriesOf('terraform')).toEqual(['devops-infrastructure']);
    expect(categoriesOf('jupyter')).toEqual(['data-engineering', 'machine-learning']);
    expect(categoriesOf('shell')).toEqual(['devops-infrastructure']);
    expect(TECHNOLOGY_BY_ID.shell.broad).toBe(true);
    expect(TECHNOLOGY_BY_ID.rust.broad).toBe(false);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(TECHNOLOGIES)).toBe(true);
    expect(Object.isFrozen(TECHNOLOGIES[0])).toBe(true);
    expect(Object.isFrozen(TECHNOLOGIES[0].topics)).toBe(true);
    expect(Object.isFrozen(CATEGORIES)).toBe(true);
  });

  it('lists topics as lower-case slugs', () => {
    TECHNOLOGIES.forEach(item =>
      item.topics.forEach(topic => expect(topic).toBe(topic.toLowerCase())),
    );
  });
});

describe('detectTechnologies', () => {
  it('detects the primary language', () => {
    const hits = detect({ language: 'Go' });
    expect(hitFor(hits, 'go')).toEqual({
      technology: 'go',
      source: 'language',
      detail: 'primary language Go',
    });
    expect(ids(detect({ language: 'Jupyter Notebook' }))).toEqual(['jupyter']);
    expect(ids(detect({ language: 'HCL' }))).toEqual(['terraform']);
    expect(ids(detect({ language: 'C++' }))).toEqual(['cpp']);
    expect(detect({ language: 'Brainfuck' })).toEqual([]);
  });

  it('matches topics exactly, ignoring case', () => {
    const hits = detect({ topics: ['React', 'spring-boot', 'k8s', 'reactive'] });
    expect(ids(hits).sort()).toEqual(['kubernetes', 'react', 'spring-boot']);
    expect(hitFor(hits, 'react').source).toBe('topic');
    expect(hitFor(hits, 'react').detail).toBe('topic "react"');
  });

  it('matches description keywords on word boundaries', () => {
    expect(ids(detect({ description: 'A dashboard built with React and Redis' })).sort()).toEqual([
      'react',
      'redis',
    ]);
    expect(hitFor(detect({ description: 'Built with REACT' }), 'react').source).toBe('description');
    expect(hitFor(detect({ description: 'Built with REACT' }), 'react').detail).toBe(
      'description mentions "REACT"',
    );
  });

  it('does not match a keyword inside another word', () => {
    expect(ids(detect({ description: 'A reaction time game' }))).not.toContain('react');
    expect(ids(detect({ description: 'Reactive streams' }))).not.toContain('react');
    expect(ids(detect({ description: 'dockerize everything' }))).not.toContain('docker');
    expect(ids(detect({ description: 'Javascript toolkit' }))).toContain('javascript');
    expect(ids(detect({ description: 'JavaScript toolkit' }))).not.toContain('java');
    expect(ids(detect({ description: 'a_react_app' }))).not.toContain('react');
  });

  it('matches phrases with spaces, hyphens and symbols', () => {
    expect(ids(detect({ description: 'A React Native app' }))).toContain('react-native');
    expect(ids(detect({ description: 'a react-native starter' }))).toContain('react-native');
    expect(ids(detect({ description: 'Built on Next.js' }))).toContain('nextjs');
    expect(ids(detect({ description: 'Spring Boot microservice' }))).toContain('spring-boot');
    expect(ids(detect({ description: 'fast C++ code' }))).toContain('cpp');
    expect(ids(detect({ description: 'a C# library' }))).toContain('csharp');
    expect(ids(detect({ description: 'an Apache Spark job' }))).toContain('spark');
  });

  it('ignores common words that are also technology names', () => {
    expect(detect({ description: 'Express yourself, go swift, take a c step' })).toEqual([]);
    expect(ids(detect({ description: 'Express.js middleware' }))).toEqual(['express']);
  });

  it('detects manifest files by name', () => {
    const hits = detect({}, [
      'Dockerfile',
      'main.tf',
      'go.mod',
      'Cargo.toml',
      'pubspec.yaml',
      'package.json',
    ]);
    expect(ids(hits).sort()).toEqual(['docker', 'flutter', 'go', 'nodejs', 'rust', 'terraform']);
    expect(hitFor(hits, 'go')).toEqual({
      technology: 'go',
      source: 'manifest',
      detail: 'found go.mod at the repository root',
    });
  });

  it('supports prefix, suffix and exact file patterns', () => {
    expect(ids(detect({}, ['Dockerfile.dev']))).toEqual(['docker']);
    expect(ids(detect({}, ['docker-compose.prod.yml']))).toEqual(['docker']);
    expect(ids(detect({}, ['mydockerfile']))).toEqual([]);
    expect(ids(detect({}, ['network.tf']))).toEqual(['terraform']);
    expect(ids(detect({}, ['tf']))).toEqual([]);
    expect(ids(detect({}, ['Chart.yaml']))).toEqual(['kubernetes']);
  });

  it('reports every source of one technology', () => {
    const hits = detect({ language: 'Rust', topics: ['rust'], description: 'A Rust crate' }, [
      'Cargo.toml',
    ]);
    const sources = hits.filter(hit => hit.technology === 'rust').map(hit => hit.source);
    expect(sources.sort()).toEqual([...SOURCE_ORDER].sort());
  });

  it('copes with missing and malformed fields', () => {
    expect(detect({})).toEqual([]);
    expect(detect(null)).toEqual([]);
    expect(detect({ language: null, topics: null, description: null })).toEqual([]);
    expect(detect({ topics: [1, null, 'react'], description: 42 }, [null, 7])).toHaveLength(1);
  });
});
