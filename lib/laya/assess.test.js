import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeEvidence, noReadme } from '../analysis/testHelpers';
import { assessRepository } from './assess';
import { createAssessmentCache, assessRepositoryCached } from './assessCache';
import { createLayaClient } from './client';
import { README_QUESTION_IDS } from './questions';
import {
  BASE_URL,
  archetypeAnswers,
  batchResponse,
  choiceAnswer,
  readmeAnswers,
  requestBody,
} from './testHelpers';

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

const PERSIAN_README = `# ابزار مدیریت وظایف

این پروژه یک ابزار ساده برای مدیریت وظایف روزانه است که با پایتون نوشته شده است.

## نصب

\`\`\`bash
pip install todo-cli
\`\`\`
`;

const confident = (value, model = 'english') => ({
  state: 'confident',
  value,
  label: String(value),
  answerConfidence: 0.9,
  threshold: 0.8,
  model,
});

const readmeDecisions = () => ({
  readme_sufficient: confident(true),
  install_clarity: confident(2),
  usage_examples: confident(true),
  docs_completeness: confident(1),
});

// A scripted client: each call to `decide` takes the next outcome.
const fakeClient = (...outcomes) => {
  const decide = vi.fn(async () => outcomes.shift());
  return { enabled: true, decide };
};

const ok = (results, model = 'english') => ({ status: 'ok', model, results: [results] });
const down = code => ({ status: 'unavailable', error: { code, message: `Laya ${code}` } });

describe('assessRepository', () => {
  it('asks the README questions about the README and the archetype about the summary', async () => {
    const client = fakeClient(ok(readmeDecisions()), ok({ archetype: confident('cli-tool') }));
    const result = await assessRepository(client, makeEvidence());

    expect(result.status).toBe('ok');
    expect(result.model).toBe('english');
    expect(Object.keys(result.answers)).toEqual([...README_QUESTION_IDS, 'archetype']);
    expect(result).not.toHaveProperty('error');

    expect(client.decide).toHaveBeenCalledTimes(2);
    const [readmeStates, readmeIds, readmeOptions] = client.decide.mock.calls[0];
    expect(readmeIds).toEqual(README_QUESTION_IDS);
    expect(readmeOptions).toEqual({ model: 'english' });
    expect(Object.keys(readmeStates[0])).toEqual(['readme']);
    expect(readmeStates[0].readme).toContain('## Installation');

    const [summaryStates, summaryIds] = client.decide.mock.calls[1];
    expect(summaryIds).toEqual(['archetype']);
    expect(Object.keys(summaryStates[0])).toEqual([
      'name',
      'description',
      'topics',
      'primaryLanguage',
      'topLevelFiles',
      'readmeExcerpt',
    ]);
    expect(summaryStates[0]).toMatchObject({
      name: 'hello',
      primaryLanguage: 'JavaScript',
      topics: ['cli', 'tool', 'example'],
    });
    expect(summaryStates[0].topLevelFiles).toContain('src/');
  });

  it('sends a Persian README to the multilingual checkpoint', async () => {
    const client = fakeClient(
      ok(readmeDecisions(), 'multilingual'),
      ok({ archetype: confident('cli-tool', 'multilingual') }, 'multilingual'),
    );
    const evidence = makeEvidence({
      repo: { description: 'ابزار مدیریت وظایف' },
      readme: { text: PERSIAN_README, truncated: false, available: true },
    });
    const result = await assessRepository(client, evidence);
    expect(client.decide.mock.calls.map(call => call[2].model)).toEqual([
      'multilingual',
      'multilingual',
    ]);
    expect(result.model).toBe('multilingual');
  });

  it('asks only the archetype when there is no README', async () => {
    const client = fakeClient(ok({ archetype: confident('library') }));
    const result = await assessRepository(client, makeEvidence({ readme: noReadme }));
    expect(client.decide).toHaveBeenCalledTimes(1);
    expect(client.decide.mock.calls[0][1]).toEqual(['archetype']);
    expect(result.status).toBe('ok');
    expect(Object.keys(result.answers)).toEqual(['archetype']);
  });

  it('does not ask README questions when the README holds no text after cleaning', async () => {
    const client = fakeClient(ok({ archetype: confident('library') }));
    const readme = { text: '<!-- nothing -->\n![logo](x.png)', truncated: false, available: true };
    await assessRepository(client, makeEvidence({ readme }));
    expect(client.decide).toHaveBeenCalledTimes(1);
  });

  it('skips forks without asking anything', async () => {
    const client = fakeClient();
    const result = await assessRepository(client, makeEvidence({ repo: { fork: true } }));
    expect(result).toEqual({ status: 'skipped', model: null, answers: {}, reason: 'fork' });
    expect(client.decide).not.toHaveBeenCalled();
  });

  it('reports a disabled client without building anything', async () => {
    const client = createLayaClient({ baseUrl: '', fetchImpl: vi.fn() });
    expect(await assessRepository(client, makeEvidence())).toEqual({
      status: 'disabled',
      model: null,
      answers: {},
    });
    expect(await assessRepository(undefined, makeEvidence())).toMatchObject({ status: 'disabled' });
  });

  it('does not ask again when the server is down', async () => {
    const client = fakeClient(down('TIMEOUT'));
    const result = await assessRepository(client, makeEvidence());
    expect(client.decide).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'unavailable',
      model: null,
      answers: {},
      error: { code: 'TIMEOUT', message: 'Laya TIMEOUT' },
    });
  });

  it('returns partial results when only one request fails', async () => {
    const client = fakeClient(down('BAD_RESPONSE'), ok({ archetype: confident('library') }));
    const result = await assessRepository(client, makeEvidence());
    expect(client.decide).toHaveBeenCalledTimes(2);
    expect(result.status).toBe('partial');
    expect(result.error.code).toBe('BAD_RESPONSE');
    expect(Object.keys(result.answers)).toEqual(['archetype']);

    const reverse = fakeClient(ok(readmeDecisions()), down('REJECTED'));
    const second = await assessRepository(reverse, makeEvidence());
    expect(second.status).toBe('partial');
    expect(Object.keys(second.answers)).toEqual(README_QUESTION_IDS);
  });

  it('never throws', async () => {
    const client = { enabled: true, decide: vi.fn().mockRejectedValue(new Error('boom SECRET')) };
    const result = await assessRepository(client, makeEvidence());
    expect(result).toMatchObject({
      status: 'unavailable',
      answers: {},
      error: { code: 'INTERNAL' },
    });
    expect(JSON.stringify(result)).not.toContain('SECRET');
    await expect(assessRepository(client, null)).resolves.toMatchObject({ status: 'unavailable' });
  });

  it('keeps uncertain answers uncertain and carries no README text', async () => {
    const uncertain = {
      state: 'uncertain',
      value: null,
      label: null,
      reason: 'below-threshold',
      answerConfidence: 0.62,
      threshold: 0.8,
      model: 'english',
    };
    const client = fakeClient(
      ok({ ...readmeDecisions(), readme_sufficient: uncertain }),
      ok({ archetype: confident('library') }),
    );
    const evidence = makeEvidence({
      readme: { text: '# Hi\n\nPRIVATE-README-MARKER', truncated: false, available: true },
    });
    const result = await assessRepository(client, evidence);
    expect(result.answers.readme_sufficient).toEqual(uncertain);
    expect(JSON.stringify(result)).not.toContain('PRIVATE-README-MARKER');
  });
});

describe('assessRepository with a real client and a mocked server', () => {
  it('turns the server answers into decisions', async () => {
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call += 1;
      return call === 1
        ? batchResponse(readmeAnswers({ usage_examples: choiceAnswer('B', 0.95) }))
        : batchResponse(archetypeAnswers({ archetype: choiceAnswer('cli-tool', 0.4) }));
    });
    const client = createLayaClient({ baseUrl: BASE_URL, fetchImpl });
    const result = await assessRepository(client, makeEvidence());

    expect(result.status).toBe('ok');
    expect(result.answers.readme_sufficient).toMatchObject({
      state: 'confident',
      value: true,
      model: 'english',
    });
    expect(result.answers.usage_examples).toMatchObject({ state: 'confident', value: false });
    expect(result.answers.install_clarity).toMatchObject({ state: 'confident', value: 2 });
    expect(result.answers.archetype).toMatchObject({ state: 'uncertain', value: null });
    expect(requestBody(fetchImpl, 1).states[0]).toHaveProperty('topLevelFiles');
  });

  it('survives an unreachable server', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    const client = createLayaClient({ baseUrl: BASE_URL, fetchImpl });
    const result = await assessRepository(client, makeEvidence());
    expect(result).toMatchObject({
      status: 'unavailable',
      error: { code: 'UNAVAILABLE' },
      answers: {},
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('assessRepositoryCached', () => {
  const evidenceAt = pushedAt => makeEvidence({ repo: { pushed_at: pushedAt } });
  const completeClient = () =>
    fakeClient(
      ok(readmeDecisions()),
      ok({ archetype: confident('library') }),
      ok(readmeDecisions()),
      ok({ archetype: confident('library') }),
      ok(readmeDecisions()),
      ok({ archetype: confident('library') }),
    );

  it('reuses a complete assessment of an unchanged repository', async () => {
    const cache = createAssessmentCache();
    const client = completeClient();
    const first = await assessRepositoryCached(client, evidenceAt('2024-05-01T00:00:00Z'), cache);
    const second = await assessRepositoryCached(client, evidenceAt('2024-05-01T00:00:00Z'), cache);
    expect(client.decide).toHaveBeenCalledTimes(2);
    expect(second).toBe(first);
  });

  it('assesses again after a push or a README change', async () => {
    const cache = createAssessmentCache();
    const client = completeClient();
    await assessRepositoryCached(client, evidenceAt('2024-05-01T00:00:00Z'), cache);
    await assessRepositoryCached(client, evidenceAt('2024-05-02T00:00:00Z'), cache);
    const changed = makeEvidence({
      repo: { pushed_at: '2024-05-02T00:00:00Z' },
      readme: { text: '# Different', truncated: false, available: true },
    });
    await assessRepositoryCached(client, changed, cache);
    expect(client.decide).toHaveBeenCalledTimes(6);
  });

  it('assesses again once the entry is older than an hour', async () => {
    let time = 0;
    const cache = createAssessmentCache({ now: () => time });
    const client = completeClient();
    await assessRepositoryCached(client, evidenceAt('2024-05-01T00:00:00Z'), cache);
    time = 60 * 60 * 1000 + 1;
    await assessRepositoryCached(client, evidenceAt('2024-05-01T00:00:00Z'), cache);
    expect(client.decide).toHaveBeenCalledTimes(4);
  });

  it('does not store failures, so recovery is immediate', async () => {
    const cache = createAssessmentCache();
    const client = fakeClient(
      down('UNAVAILABLE'),
      ok(readmeDecisions()),
      ok({ archetype: confident('library') }),
    );
    const evidence = evidenceAt('2024-05-01T00:00:00Z');
    expect((await assessRepositoryCached(client, evidence, cache)).status).toBe('unavailable');
    expect((await assessRepositoryCached(client, evidence, cache)).status).toBe('ok');
    expect(client.decide).toHaveBeenCalledTimes(3);
  });

  it('shares one in-flight assessment between concurrent requests', async () => {
    const cache = createAssessmentCache();
    const client = completeClient();
    const evidence = evidenceAt('2024-05-01T00:00:00Z');
    const [a, b] = await Promise.all([
      assessRepositoryCached(client, evidence, cache),
      assessRepositoryCached(client, evidence, cache),
    ]);
    expect(a).toBe(b);
    expect(client.decide).toHaveBeenCalledTimes(2);
  });

  it('passes a disabled client and forks straight through', async () => {
    const cache = createAssessmentCache();
    const disabled = createLayaClient({ baseUrl: '', fetchImpl: vi.fn() });
    expect((await assessRepositoryCached(disabled, makeEvidence(), cache)).status).toBe('disabled');
    const client = fakeClient();
    const fork = makeEvidence({ repo: { fork: true } });
    expect((await assessRepositoryCached(client, fork, cache)).status).toBe('skipped');
    expect(client.decide).not.toHaveBeenCalled();
  });
});
