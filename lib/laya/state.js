// Builds the input states sent to Laya. Everything that comes from a repository (README text,
// description, topics, file names) is untrusted data: it is cleaned and bounded here, sent as
// the *state*, and never concatenated into a question's instructions.

import { detectScript } from '../analysis/readmeChecks.js';

export const MAX_README_CHARS = 6000;
export const MAX_EXCERPT_CHARS = 1500;
export const MAX_TOP_LEVEL_FILES = 40;
const MAX_DESCRIPTION_CHARS = 300;
const MAX_TOPICS = 20;
const MAX_TOPIC_CHARS = 50;
const MAX_FILE_NAME_CHARS = 100;

// Bounded quantifiers: hostile input must not cause runaway matching.
const IMAGE_MARKDOWN = /!\[[^\]\n]{0,300}\](?:\([^)\n]{0,500}\)|\[[^\]\n]{0,100}\])/g;
// Only known HTML tags are removed: placeholders such as `git clone <repo-url>` are content.
const HTML_TAG =
  /<\/?(?:a|abbr|b|big|blockquote|br|center|code|details|div|em|figcaption|figure|font|h[1-6]|hr|i|iframe|img|kbd|li|ol|p|picture|pre|small|source|span|strong|sub|summary|sup|svg|table|tbody|td|th|thead|tr|u|ul|video)\b[^>\n]{0,500}>/gi;
// Control characters other than tab and newline.
const CONTROL_CHARACTERS = /(?![\t\n])\p{Cc}/gu;
const HIGH_SURROGATE_AT_END = /[\uD800-\uDBFF]$/;

// Removes `<!-- ... -->` with indexOf, so the cost stays linear. An unclosed comment hides the
// rest of the document, as it does when GitHub renders the README.
const stripHtmlComments = text => {
  let out = '';
  let position = 0;
  for (;;) {
    const start = text.indexOf('<!--', position);
    if (start === -1) return out + text.slice(position);
    out += text.slice(position, start);
    const end = text.indexOf('-->', start + 4);
    if (end === -1) return out;
    position = end + 3;
  }
};

const cutToLength = (text, max) => {
  if (text.length <= max) return text;
  let cut = text.slice(0, max);
  // Never end on half of a surrogate pair: the server refuses a lone surrogate.
  if (HIGH_SURROGATE_AT_END.test(cut)) cut = cut.slice(0, -1);
  return cut;
};

const wellFormed = text => (typeof text.toWellFormed === 'function' ? text.toWellFormed() : text);

/**
 * Cleans README text for the model: HTML comments, tags and images are removed, whitespace is
 * collapsed (line breaks are kept, because headings carry structure) and the result is cut to
 * `maxChars`. Returns `{ text, truncated }`; `truncated` is true when the cut dropped text.
 */
export const cleanReadme = (raw, maxChars = MAX_README_CHARS) => {
  const source = typeof raw === 'string' ? raw : '';
  const cleaned = wellFormed(stripHtmlComments(source.replace(/\r\n?/g, '\n')))
    .replace(IMAGE_MARKDOWN, ' ')
    .replace(HTML_TAG, ' ')
    .replace(CONTROL_CHARACTERS, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const text = cutToLength(cleaned, maxChars).trim();
  return { text, truncated: text.length < cleaned.length };
};

/** The state for README questions. It is data only. */
export const buildReadmeState = raw => {
  const { text, truncated } = cleanReadme(raw);
  return { state: { readme: text }, truncated };
};

const shortText = (value, max) =>
  typeof value === 'string'
    ? cutToLength(wellFormed(value.replace(CONTROL_CHARACTERS, ' ')).trim(), max)
    : '';

/**
 * The state for repository questions: metadata, the top-level file names and the start of the
 * README. `tree` is the top-level listing (`[{ path, type }]`) or null; `readmeText` is raw
 * README text or null.
 */
export const buildRepoSummary = ({ repo = {}, tree = null, readmeText = null } = {}) => {
  const topLevelFiles = Array.isArray(tree)
    ? tree
        .filter(entry => entry && typeof entry.path === 'string')
        .slice(0, MAX_TOP_LEVEL_FILES)
        .map(entry =>
          shortText(entry.type === 'tree' ? `${entry.path}/` : entry.path, MAX_FILE_NAME_CHARS),
        )
    : [];
  return {
    name: shortText(repo.name, MAX_FILE_NAME_CHARS),
    description: shortText(repo.description, MAX_DESCRIPTION_CHARS),
    topics: (Array.isArray(repo.topics) ? repo.topics : [])
      .slice(0, MAX_TOPICS)
      .map(topic => shortText(topic, MAX_TOPIC_CHARS)),
    primaryLanguage: shortText(repo.language, MAX_TOPIC_CHARS) || null,
    topLevelFiles,
    readmeExcerpt: cleanReadme(readmeText, MAX_EXCERPT_CHARS).text,
  };
};

// Fenced code blocks hold commands and identifiers in Latin letters even in a Persian README,
// so the language is judged on the prose around them.
const withoutFencedCode = text => {
  const kept = [];
  let fence = null;
  text.split('\n').forEach(line => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (marker && marker[1][0] === fence) fence = null;
      return;
    }
    if (marker) {
      fence = marker[1][0];
      return;
    }
    kept.push(line);
  });
  return kept.join('\n');
};

/**
 * The checkpoint to ask: 'english' for Latin-script text, 'multilingual' for everything else
 * (Persian, other scripts and text without letters). The decision is made per text, so a batch
 * is sent once per model.
 */
export const pickModel = text => {
  const prose = withoutFencedCode(typeof text === 'string' ? text : '');
  return detectScript(prose) === 'latin' ? 'english' : 'multilingual';
};
