import { repoFacts } from './facts';
import { hasText } from './signals';

// Transparent signal rules. Each archetype collects the signals that matched; the archetype
// with the most signals wins. This is a heuristic hint: Laya refines it in a later milestone.

const KEYWORDS = {
  cli: /\b(?:cli|command[- ]line|terminal)\b/i,
  api: /\b(?:api|server|rest(?:ful)?|graphql|backend|microservices?)\b/i,
  infra:
    /\b(?:terraform|helm|k8s|kubernetes|ansible|pulumi|cloudformation|infrastructure|iac|devops)\b/i,
  learning:
    /\b(?:tutorials?|learn(?:ing)?|courses?|exercises?|homework|practice|100[- ]?days?(?:[- ]?of[- ]?code)?|bootcamp|study|assignments?|kata|playground)\b/i,
  docs: /\b(?:docs|documentation|awesome|wiki|handbook|cheat[- ]?sheet|notes|book|guide|resources)\b/i,
  dotfiles: /\b(?:dotfiles?|rice)\b/i,
  framework: /\bframework\b/i,
  library: /\b(?:library|libraries|lib|sdk|package|module|wrapper|bindings)\b/i,
  app: /\b(?:apps?|applications?|website|web[- ]?app|dashboard|game|portfolio)\b/i,
};

// "machine learning", "deep learning" and similar are fields of work, not study projects.
const NOT_LEARNING = /\b(?:machine|deep|reinforcement|transfer|federated)[- ]learning\b/gi;

const README_CLI_HEADING = /\b(?:commands?|cli|command[- ]line)\b/i;
const README_API_HEADING = /\b(?:endpoints?|routes|rest api|api reference)\b/i;

/** Priority order, used only to break exact ties (which are reported as weak). */
export const ARCHETYPES = [
  'cli-tool',
  'api-service',
  'infrastructure',
  'learning-project',
  'documentation',
  'config-dotfiles',
  'framework',
  'library',
  'application',
];

const found = list => Array.isArray(list) && list.length > 0;

/**
 * Infers the most likely project archetype from metadata, README structure and top-level files.
 * Returns `{ archetype, confidence: 'strong'|'weak'|'none', signals, scores }`:
 * strong = at least two matched signals and a lead of at least one over the runner-up,
 * weak = anything else with at least one signal, none = no signal ('unknown').
 *
 * `facts` can be passed when the caller already derived them from `evidence`.
 */
export const detectArchetype = (evidence, facts = repoFacts(evidence)) => {
  const repo = evidence.repo ?? {};
  const topics = Array.isArray(repo.topics) ? repo.topics.join(' ') : '';
  const label = [repo.name, hasText(repo.description) ? repo.description : '']
    .join(' ')
    .replace(/[_./]/g, ' ');
  const topicText = topics.replace(NOT_LEARNING, ' ');
  const labelText = label.replace(NOT_LEARNING, ' ');
  const tree = facts.structure;
  const headings = facts.readme?.headings.map(heading => heading.text) ?? [];

  const signals = [];
  const add = (archetype, id, detail) => signals.push({ archetype, id, detail });

  // A keyword in the topics and/or in the name and description. Returns whether any matched.
  const keyword = (archetype, pattern, noun) => {
    const inTopics = pattern.test(topicText);
    const inLabel = pattern.test(labelText);
    if (inTopics) add(archetype, 'topic', `a topic mentions ${noun}`);
    if (inLabel) add(archetype, 'name-or-description', `name or description mentions ${noun}`);
    return inTopics || inLabel;
  };

  const readmeHeading = (archetype, pattern, detail) => {
    const matched = headings.some(text => pattern.test(text));
    if (matched) add(archetype, 'readme-headings', detail);
    return matched;
  };

  // Supporting file evidence counts only when the metadata already points the same way.
  const supporting = (archetype, applies, id, names, suffix = '') => {
    if (applies) add(archetype, id, `found ${names.join(', ')}${suffix}`);
  };

  const cli =
    keyword('cli-tool', KEYWORDS.cli, 'a command-line tool') ||
    readmeHeading('cli-tool', README_CLI_HEADING, 'README has a command or CLI heading');
  supporting('cli-tool', cli && found(tree?.binDir), 'bin-directory', tree?.binDir ?? []);

  const api =
    keyword('api-service', KEYWORDS.api, 'an API or server') ||
    readmeHeading('api-service', README_API_HEADING, 'README has an endpoints or API heading');
  supporting('api-service', api && found(tree?.docker), 'container-file', tree?.docker ?? []);
  supporting('api-service', found(tree?.apiSpec), 'api-spec', tree?.apiSpec ?? []);

  keyword('infrastructure', KEYWORDS.infra, 'infrastructure tooling');
  supporting('infrastructure', found(tree?.infra), 'infra-files', tree?.infra ?? []);

  keyword('learning-project', KEYWORDS.learning, 'learning or practice');

  const docs = keyword('documentation', KEYWORDS.docs, 'documentation or a curated list');
  const noCode =
    tree && !found(tree.sourceDir) && !found(tree.sourceFiles) && !found(tree.manifests);
  if (docs && noCode) add('documentation', 'no-code', 'no source files or manifests at the root');

  keyword('config-dotfiles', KEYWORDS.dotfiles, 'dotfiles');
  supporting('config-dotfiles', found(tree?.dotfiles), 'dotfile-entries', tree?.dotfiles ?? []);

  keyword('framework', KEYWORDS.framework, 'a framework');

  const appFiles = found(tree?.webApp);
  const library = keyword('library', KEYWORDS.library, 'a library or package');
  supporting(
    'library',
    library && found(tree?.manifests) && !appFiles,
    'manifest',
    tree?.manifests ?? [],
    ' and no application files',
  );

  keyword('application', KEYWORDS.app, 'an application');
  supporting('application', appFiles, 'app-files', tree?.webApp ?? []);

  const scores = Object.fromEntries(ARCHETYPES.map(name => [name, 0]));
  signals.forEach(signal => {
    scores[signal.archetype] += 1;
  });

  const ranked = [...ARCHETYPES].sort((a, b) => scores[b] - scores[a]);
  const [top, second] = ranked;
  if (scores[top] === 0) return { archetype: 'unknown', confidence: 'none', signals: [], scores };

  const strong = scores[top] >= 2 && scores[top] - scores[second] >= 1;
  return { archetype: top, confidence: strong ? 'strong' : 'weak', signals, scores };
};
