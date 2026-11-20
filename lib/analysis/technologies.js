// A small, curated table of technologies and the public signals that point at them. It is data,
// not a model: every detection can be traced to a field GitHub reported (primary language, topic,
// description text) or to a file name found at the repository root. See docs/SKILLS.md.
//
// A technology belongs to one primary `category` and, for technologies that serve several areas
// (a general-purpose language such as Python), to `alsoCategories` too. A `broad` technology is
// one whose presence does not say which area the code is for (Python, JavaScript, Node.js, ...):
// it is still reported as an observed technology, but it only ever gives *weak* evidence for its
// categories (see skills.js). Every technology with `alsoCategories` is broad.

import { hasText } from './signals';

export const CATEGORIES = Object.freeze(
  [
    { id: 'backend', label: 'Backend development' },
    { id: 'frontend', label: 'Frontend development' },
    { id: 'systems', label: 'Systems programming' },
    { id: 'devops-infrastructure', label: 'DevOps and infrastructure' },
    { id: 'data-engineering', label: 'Data engineering' },
    { id: 'mobile', label: 'Mobile development' },
    { id: 'embedded', label: 'Embedded development' },
    { id: 'machine-learning', label: 'Machine learning' },
  ].map(category => Object.freeze(category)),
);

export const CATEGORY_IDS = Object.freeze(CATEGORIES.map(category => category.id));

/** Strength of the source of one piece of evidence, strongest first. */
export const SOURCE_ORDER = Object.freeze(['manifest', 'topic', 'language', 'description']);

// How a table entry is declared:
// - `languages`: the primary language names GitHub reports (exact match).
// - `topics`: exact topic slugs (lower case).
// - `keywords`: phrases looked up in the repository description (word boundaries, ignoring case).
//   They default to the topic slugs written as words; pass `[]` where a word is too common in
//   ordinary prose (go, swift, c) to be trusted in a description.
// - `files`: names of top-level entries (lower case): an exact name, `*suffix` or `prefix*`.
const tech = (id, name, category, options = {}) => {
  const { also = [], broad = also.length > 0, languages = [], files = [] } = options;
  const topics = options.topics ?? [id];
  const keywords = options.keywords ?? topics.map(slug => slug.replace(/-/g, ' '));
  return Object.freeze({
    id,
    name,
    category,
    alsoCategories: Object.freeze([...also]),
    broad,
    languages: Object.freeze([...languages]),
    topics: Object.freeze([...topics]),
    keywords: Object.freeze([...keywords]),
    files: Object.freeze([...files]),
  });
};

export const TECHNOLOGIES = Object.freeze([
  // Languages. Broad ones say little about the area; specific ones (Rust, Kotlin, ...) say more.
  tech('go', 'Go', 'backend', {
    also: ['systems'],
    languages: ['Go'],
    topics: ['go', 'golang'],
    keywords: ['golang'],
    files: ['go.mod'],
  }),
  tech('rust', 'Rust', 'systems', {
    languages: ['Rust'],
    files: ['cargo.toml'],
  }),
  tech('typescript', 'TypeScript', 'frontend', {
    also: ['backend'],
    languages: ['TypeScript'],
  }),
  tech('javascript', 'JavaScript', 'frontend', {
    also: ['backend'],
    languages: ['JavaScript'],
  }),
  tech('python', 'Python', 'backend', {
    also: ['data-engineering', 'machine-learning'],
    languages: ['Python'],
    files: ['pyproject.toml', 'requirements.txt', 'setup.py'],
  }),
  tech('java', 'Java', 'backend', { broad: true, languages: ['Java'], files: ['pom.xml'] }),
  tech('csharp', 'C#', 'backend', {
    broad: true,
    languages: ['C#'],
    topics: ['csharp', 'c-sharp'],
    keywords: ['c#', 'csharp'],
  }),
  tech('ruby', 'Ruby', 'backend', { broad: true, languages: ['Ruby'], files: ['gemfile'] }),
  tech('php', 'PHP', 'backend', { broad: true, languages: ['PHP'], files: ['composer.json'] }),
  tech('kotlin', 'Kotlin', 'mobile', { languages: ['Kotlin'] }),
  tech('swift', 'Swift', 'mobile', { languages: ['Swift'], keywords: [] }),
  tech('dart', 'Dart', 'mobile', { languages: ['Dart'], keywords: [] }),
  tech('c', 'C', 'systems', { also: ['embedded'], languages: ['C'], keywords: [] }),
  tech('cpp', 'C++', 'systems', {
    also: ['embedded'],
    languages: ['C++'],
    topics: ['cpp', 'c-plus-plus', 'cplusplus'],
    keywords: ['c++', 'cpp'],
  }),
  tech('shell', 'Shell scripting', 'devops-infrastructure', {
    broad: true,
    languages: ['Shell'],
    topics: ['shell', 'bash', 'shell-script', 'zsh'],
    keywords: ['bash', 'shell script', 'shell scripts'],
  }),
  tech('jupyter', 'Jupyter notebooks', 'data-engineering', {
    also: ['machine-learning'],
    languages: ['Jupyter Notebook'],
    topics: ['jupyter-notebook', 'jupyter'],
    keywords: ['jupyter'],
  }),

  // DevOps and infrastructure
  tech('terraform', 'Terraform', 'devops-infrastructure', { languages: ['HCL'], files: ['*.tf'] }),
  tech('docker', 'Docker', 'devops-infrastructure', {
    topics: ['docker', 'dockerfile', 'docker-compose'],
    keywords: ['docker', 'dockerfile', 'docker compose'],
    files: ['dockerfile*', 'docker-compose*', 'compose.yml', 'compose.yaml', '.dockerignore'],
  }),
  tech('kubernetes', 'Kubernetes', 'devops-infrastructure', {
    topics: ['kubernetes', 'k8s', 'helm'],
    keywords: ['kubernetes', 'k8s', 'helm chart'],
    files: [
      'chart.yaml',
      'chart.yml',
      'kustomization.yaml',
      'kustomization.yml',
      'k8s',
      'kubernetes',
      'helm',
    ],
  }),
  tech('ansible', 'Ansible', 'devops-infrastructure', {
    files: ['playbook.yml', 'playbook.yaml', 'playbooks', 'ansible'],
  }),

  // Frontend
  tech('react', 'React', 'frontend', {
    topics: ['react', 'reactjs'],
    keywords: ['react', 'reactjs', 'react.js'],
  }),
  tech('nextjs', 'Next.js', 'frontend', {
    topics: ['nextjs', 'next-js'],
    keywords: ['next.js', 'nextjs'],
  }),
  tech('vue', 'Vue', 'frontend', {
    topics: ['vue', 'vuejs', 'vue3'],
    keywords: ['vue', 'vue.js', 'vuejs'],
  }),
  tech('angular', 'Angular', 'frontend', { topics: ['angular', 'angularjs'] }),
  tech('svelte', 'Svelte', 'frontend', {
    topics: ['svelte', 'sveltekit'],
    keywords: ['svelte', 'sveltekit'],
  }),

  // Backend
  tech('django', 'Django', 'backend'),
  tech('flask', 'Flask', 'backend'),
  tech('fastapi', 'FastAPI', 'backend'),
  tech('express', 'Express', 'backend', {
    topics: ['express', 'expressjs'],
    keywords: ['express.js', 'expressjs'],
  }),
  tech('spring-boot', 'Spring Boot', 'backend', {
    topics: ['spring-boot', 'springboot', 'spring'],
    keywords: ['spring boot', 'springboot'],
  }),
  tech('nodejs', 'Node.js', 'backend', {
    broad: true,
    topics: ['nodejs', 'node-js', 'node'],
    keywords: ['node.js', 'nodejs'],
    files: ['package.json'],
  }),
  tech('graphql', 'GraphQL', 'backend'),
  tech('rest-api', 'REST APIs', 'backend', {
    topics: ['rest-api', 'restful-api', 'rest', 'restful'],
    keywords: ['rest api', 'restful api', 'restful'],
  }),
  tech('postgresql', 'PostgreSQL', 'backend', {
    topics: ['postgresql', 'postgres'],
    keywords: ['postgresql', 'postgres'],
  }),
  tech('redis', 'Redis', 'backend'),

  // Data engineering
  tech('pandas', 'pandas', 'data-engineering'),
  tech('spark', 'Apache Spark', 'data-engineering', {
    topics: ['spark', 'apache-spark', 'pyspark'],
    keywords: ['apache spark', 'pyspark'],
  }),
  tech('airflow', 'Apache Airflow', 'data-engineering', {
    topics: ['airflow', 'apache-airflow'],
    keywords: ['airflow'],
  }),
  tech('kafka', 'Apache Kafka', 'data-engineering', {
    topics: ['kafka', 'apache-kafka'],
    keywords: ['kafka'],
  }),
  tech('etl', 'Data pipelines (ETL)', 'data-engineering', {
    topics: ['etl', 'data-pipeline', 'data-pipelines', 'data-engineering'],
    keywords: ['etl', 'data pipeline', 'data pipelines'],
  }),

  // Machine learning
  tech('machine-learning', 'Machine learning', 'machine-learning', {
    topics: ['machine-learning', 'deep-learning', 'neural-network', 'neural-networks'],
    keywords: ['machine learning', 'deep learning', 'neural network', 'neural networks'],
  }),
  tech('pytorch', 'PyTorch', 'machine-learning'),
  tech('tensorflow', 'TensorFlow', 'machine-learning', {
    topics: ['tensorflow', 'keras'],
    keywords: ['tensorflow', 'keras'],
  }),
  tech('scikit-learn', 'scikit-learn', 'machine-learning', {
    topics: ['scikit-learn', 'sklearn'],
    keywords: ['scikit-learn', 'scikit learn', 'sklearn'],
  }),

  // Mobile
  tech('android', 'Android', 'mobile', {
    topics: ['android', 'android-app'],
    keywords: ['android'],
  }),
  tech('ios', 'iOS', 'mobile', { topics: ['ios', 'ios-app'], keywords: ['ios'] }),
  tech('flutter', 'Flutter', 'mobile', { files: ['pubspec.yaml'] }),
  tech('react-native', 'React Native', 'mobile', { keywords: ['react native'] }),

  // Embedded
  tech('arduino', 'Arduino', 'embedded'),
  tech('esp32', 'ESP32 / ESP8266', 'embedded', {
    topics: ['esp32', 'esp8266'],
    keywords: ['esp32', 'esp8266'],
  }),
  tech('raspberry-pi', 'Raspberry Pi', 'embedded', {
    topics: ['raspberry-pi', 'raspberrypi'],
    keywords: ['raspberry pi'],
  }),
  tech('rtos', 'RTOS', 'embedded', {
    topics: ['rtos', 'freertos', 'zephyr'],
    keywords: ['rtos', 'freertos'],
  }),
  tech('embedded', 'Embedded systems', 'embedded', {
    topics: ['embedded', 'embedded-systems', 'firmware', 'microcontroller', 'microcontrollers'],
    keywords: ['embedded systems', 'firmware', 'microcontroller', 'microcontrollers'],
  }),

  // Systems
  tech('linux-kernel', 'Linux kernel', 'systems', {
    topics: ['linux-kernel', 'kernel'],
    keywords: ['linux kernel'],
  }),
  tech('operating-system', 'Operating systems', 'systems', {
    topics: ['operating-system', 'os-development', 'osdev'],
    keywords: ['operating system', 'osdev'],
  }),
  tech('compiler', 'Compilers and interpreters', 'systems', {
    topics: ['compiler', 'compilers', 'interpreter'],
    keywords: ['compiler', 'compilers', 'interpreter'],
  }),
]);

export const TECHNOLOGY_BY_ID = Object.freeze(
  Object.fromEntries(TECHNOLOGIES.map(technology => [technology.id, technology])),
);

// ---------------------------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------------------------

const WORD_CHARACTERS = '\\p{L}\\p{N}_';
const escapePattern = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "next.js" matches "Next.js" but "react" does not match "reaction": a phrase only matches when
// no letter, digit or underscore touches it. Spaces and hyphens inside a phrase are
// interchangeable ("react native", "react-native").
const phrasePattern = phrase =>
  phrase
    .trim()
    .split(/[\s-]+/)
    .map(escapePattern)
    .join('[\\s_-]+');

const buildKeywordRegex = keywords => {
  if (keywords.length === 0) return null;
  const alternatives = [...keywords].sort((a, b) => b.length - a.length).map(phrasePattern);
  return new RegExp(
    `(?<![${WORD_CHARACTERS}])(?:${alternatives.join('|')})(?![${WORD_CHARACTERS}])`,
    'iu',
  );
};

const KEYWORD_REGEX = new Map(
  TECHNOLOGIES.map(technology => [technology.id, buildKeywordRegex(technology.keywords)]),
);

const matchesFile = (pattern, name) => {
  if (pattern.startsWith('*')) return name.endsWith(pattern.slice(1));
  if (pattern.endsWith('*')) return name.startsWith(pattern.slice(0, -1));
  return name === pattern;
};

/**
 * Finds every signal in one repository that points at a technology. A technology can be hit
 * several times (a topic and the language, say); deduplicating to the strongest source per
 * repository is the caller's job (see skills.js).
 *
 * @param {object} repo  `{ language, topics, description }` as in the GitHub repository payload
 * @param {string[]} [fileNames]  top-level entry names from the repository analysis, if any
 * @returns {Array<{technology: string, source: 'manifest'|'topic'|'language'|'description', detail: string}>}
 */
export const detectTechnologies = (repo, fileNames = []) => {
  const language = hasText(repo?.language) ? repo.language : null;
  const topics = Array.isArray(repo?.topics)
    ? repo.topics.filter(topic => typeof topic === 'string').map(topic => topic.toLowerCase())
    : [];
  const description = hasText(repo?.description) ? repo.description : '';
  const names = fileNames.filter(name => typeof name === 'string' && name.length > 0);

  const hits = [];
  TECHNOLOGIES.forEach(technology => {
    const add = (source, detail) => hits.push({ technology: technology.id, source, detail });

    const file = names.find(name =>
      technology.files.some(pattern => matchesFile(pattern, name.toLowerCase())),
    );
    if (file) add('manifest', `found ${file} at the repository root`);

    const topic = technology.topics.find(slug => topics.includes(slug));
    if (topic) add('topic', `topic "${topic}"`);

    if (language && technology.languages.includes(language)) {
      add('language', `primary language ${language}`);
    }

    const regex = KEYWORD_REGEX.get(technology.id);
    const match = regex && description ? description.match(regex) : null;
    if (match) add('description', `description mentions "${match[0]}"`);
  });
  return hits;
};
