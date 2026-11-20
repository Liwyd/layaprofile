// Deterministic README parsing. README text is untrusted data: it is only ever scanned with
// regular expressions and counted, never evaluated, executed or followed as instructions.
// Every quantifier that spans text is bounded so hostile input cannot cause runaway matching.

const MAX_LINE_LENGTH = 1000;
const MAX_HEADINGS = 40;
const MAX_LABEL_LENGTH = 30;
const MAX_LABEL_WORDS = 3;

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;
const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/;
const HTML_HEADING = /<h([1-6])\b[^>]{0,200}>(.{0,300}?)<\/h\1>/i;
const UNDERLINE = /^([=\-~^"*+#`])\1{2,}[ \t]*$/;
const LIST_OR_QUOTE = /^\s*(?:[-*+>|]|\d+[.)])/;

// Section keywords (matched against heading text and short label lines).
const SECTION_PATTERNS = {
  install:
    /\b(?:install(?:ation|ing)?|getting started|set[ -]?up|quick[ -]?start)\b|نصب|راه\s?اندازی/i,
  usage: /\b(?:usage|examples?|how to use|quick[ -]?start)\b|استفاده|نمونه|مثال/i,
  config:
    /\b(?:config(?:uration|uring|ure)?|environment(?: variables?)?|env|options|settings)\b|\.env\b|پیکربندی|تنظیمات|کانفیگ/i,
  api: /\b(?:api|references?|documentation|docs)\b|مستندات/i,
  contributing: /\bcontribut(?:e|ing|ion|ions)\b|مشارکت/i,
  license: /\blicen[sc]e\b|مجوز|لایسنس/i,
};

// Commands in code blocks that usually mean "this is how to install or build it".
const INSTALL_COMMAND =
  /\b(?:npm\s+(?:i|install|ci)|yarn\s+(?:add|install)|pnpm\s+(?:add|i|install)|pip3?\s+install|python3?\s+-m\s+pip\s+install|poetry\s+(?:add|install)|conda\s+install|cargo\s+(?:add|install)|go\s+(?:get|install)|docker\s+(?:run|pull|compose)|brew\s+install|apt(?:-get)?\s+install|gem\s+install|composer\s+require|dotnet\s+add|git\s+clone)\b|(?:^|\s)make(?:\s|$)/im;

const DOCS_LINK =
  /(?:^|[/.#-])(?:docs?|documentation|wiki|readthedocs|gitbook|swagger|openapi)(?:[/.#?-]|$)/i;
const CONTRIBUTING_LINK = /contributing/i;

const IMAGE_MARKDOWN = /!\[[^\]\n]{0,300}\](?:\([^)\n]{0,500}\)|\[[^\]\n]{0,100}\])/g;
const IMAGE_HTML = /<img\b[^>\n]{0,500}>/gi;
const INLINE_LINK = /\[([^\]\n]{0,300})\]\(\s*<?([^)\s>]{0,500})>?(?:\s[^)\n]{0,200})?\)/g;
const REFERENCE_DEFINITION = /^[ \t]{0,3}\[[^\]\n]{1,100}\]:[ \t]*(\S{1,500})[^\n]*$/gm;
const ANCHOR_TAG = /<a\b([^>\n]{0,500})>/gi;
const HREF = /\bhref\s*=\s*["']([^"'\n]{0,500})["']/i;
const BARE_URL = /https?:\/\/[^\s<>()[\]"']{1,500}/gi;
const ANY_TAG = /<\/?[A-Za-z][^>\n]{0,500}>/g;

const CJK_CHARACTER = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu;

const count = (text, pattern) => (text.match(pattern) ?? []).length;

/**
 * Dominant script of the letters in `text`:
 * 'latin' | 'arabic-persian' | 'cjk' | 'cyrillic' | 'other' ('other' also when there are no letters).
 */
export const detectScript = text => {
  const source = typeof text === 'string' ? text : '';
  const counts = {
    latin: count(source, /\p{Script=Latin}/gu),
    'arabic-persian': count(source, /\p{Script=Arabic}/gu),
    cjk: count(source, CJK_CHARACTER),
    cyrillic: count(source, /\p{Script=Cyrillic}/gu),
  };
  const letters = count(source, /\p{L}/gu);
  counts.other = Math.max(
    0,
    letters - counts.latin - counts['arabic-persian'] - counts.cjk - counts.cyrillic,
  );
  if (letters === 0) return 'other';

  let best = 'latin';
  Object.keys(counts).forEach(script => {
    if (counts[script] > counts[best]) best = script;
  });
  return best;
};

// Persian text varies in how the same word is typed; unify the common differences.
const normalizeForMatching = text =>
  text.replace(/‌/g, '').replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[ً-ٟ]/g, '');

const matchingSections = text => {
  const normalized = normalizeForMatching(text);
  return Object.keys(SECTION_PATTERNS).filter(key => SECTION_PATTERNS[key].test(normalized));
};

const stripComments = line => {
  let out = '';
  let position = 0;
  for (;;) {
    const start = line.indexOf('<!--', position);
    if (start === -1) return { text: out + line.slice(position), open: false };
    out += line.slice(position, start);
    const end = line.indexOf('-->', start + 4);
    if (end === -1) return { text: out, open: true };
    position = end + 3;
  }
};

// Pass 1: separates fenced code blocks from prose lines and drops HTML comments.
// Comments and fences are tracked line by line so each hides the other's markers correctly.
const splitBlocks = text => {
  const blocks = [];
  let fence = null;
  let inComment = false;

  text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .forEach(raw => {
      if (fence) {
        const close = raw.match(FENCE_CLOSE);
        if (close && close[1][0] === fence.char && close[1].length >= fence.length) {
          blocks.push({ type: 'code', text: fence.lines.join('\n') });
          fence = null;
        } else {
          fence.lines.push(raw);
        }
        return;
      }

      let line = raw;
      if (inComment) {
        const end = line.indexOf('-->');
        if (end === -1) return;
        inComment = false;
        line = line.slice(end + 3);
      } else {
        const open = line.match(FENCE_OPEN);
        // A backtick fence's info string cannot contain a backtick (that would be inline code).
        if (open && !(open[1][0] === '`' && open[2].includes('`'))) {
          fence = { char: open[1][0], length: open[1].length, lines: [] };
          return;
        }
      }

      const stripped = stripComments(line);
      inComment = stripped.open;
      blocks.push({ type: 'line', text: stripped.text });
    });

  // An unclosed fence still counts as a code block.
  if (fence) blocks.push({ type: 'code', text: fence.lines.join('\n') });
  return blocks;
};

const cleanHeadingText = text =>
  text
    .replace(IMAGE_MARKDOWN, ' ')
    .replace(INLINE_LINK, '$1')
    .replace(ANY_TAG, ' ')
    .replace(/[`*_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const headingFromLine = line => {
  if (line.length > MAX_LINE_LENGTH) return null;
  const atx = line.match(ATX_HEADING);
  if (atx) {
    const text = cleanHeadingText(
      (atx[2] ?? '').replace(/[ \t]+#+[ \t]*$/, '').replace(/^#+$/, ''),
    );
    return text ? { level: atx[1].length, text } : null;
  }
  const html = line.match(HTML_HEADING);
  if (html) {
    const text = cleanHeadingText(html[2]);
    return text ? { level: Number(html[1]), text } : null;
  }
  return null;
};

const UNDERLINE_LEVELS = { '=': 1, '-': 2 };

const underlineHeading = (titleLine, underline) => {
  if (!UNDERLINE.test(underline)) return null;
  const title = titleLine.trim();
  if (
    !title ||
    title.length > 100 ||
    UNDERLINE.test(title) ||
    LIST_OR_QUOTE.test(title) ||
    ATX_HEADING.test(title)
  ) {
    return null;
  }
  const text = cleanHeadingText(title);
  return text ? { level: UNDERLINE_LEVELS[underline[0]] ?? 3, text } : null;
};

// A short standalone line such as "Installation:" acts as a section label in plain-text READMEs.
const labelFromLine = line => {
  if (LIST_OR_QUOTE.test(line)) return null;
  const text = cleanHeadingText(line).replace(/:$/, '').trim();
  if (!text || text.length > MAX_LABEL_LENGTH || text.split(' ').length > MAX_LABEL_WORDS) {
    return null;
  }
  if (/[.!?,;]$/.test(text)) return null;
  return text;
};

const describeMatch = (kind, text) =>
  `${kind} "${text.length > 60 ? `${text.slice(0, 57)}...` : text}"`;

/**
 * Deterministic facts about a README. Understands Markdown, with a lenient pass for
 * reStructuredText-style underlined headings and plain-text section labels.
 * The text is only ever counted and pattern-matched.
 */
export const analyzeReadme = text => {
  const source = typeof text === 'string' ? text : '';
  const blocks = splitBlocks(source);

  const headings = [];
  const sectionLabels = [];
  const matches = {
    install: null,
    usage: null,
    config: null,
    api: null,
    contributing: null,
    license: null,
  };
  const proseLines = [];
  const codeBlocks = [];
  let currentSection = [];
  let currentLevel = 0;

  // A sub-heading that matches no keyword stays inside the section above it, so code under
  // "## Usage" / "### Advanced" still counts as usage code.
  const registerSection = (kind, sectionText, level) => {
    const matched = matchingSections(sectionText);
    if (matched.length === 0 && currentSection.length > 0 && level > currentLevel) return;
    currentSection = matched;
    currentLevel = level;
    matched.forEach(key => {
      matches[key] ??= describeMatch(kind, sectionText);
    });
  };

  blocks.forEach((block, index) => {
    if (block.type === 'code') {
      codeBlocks.push({ text: block.text, sections: currentSection });
      return;
    }
    proseLines.push(block.text);

    const next = blocks[index + 1];
    let heading = headingFromLine(block.text);
    if (!heading && next?.type === 'line' && next.text.length <= MAX_LINE_LENGTH) {
      heading = underlineHeading(block.text, next.text);
    }
    if (heading) {
      headings.push(heading);
      registerSection('heading', heading.text, heading.level);
      return;
    }
    if (block.text.length <= MAX_LINE_LENGTH && !UNDERLINE.test(block.text)) {
      const label = labelFromLine(block.text);
      if (label && matchingSections(label).length > 0) {
        sectionLabels.push(label);
        registerSection('label', label, 1);
      }
    }
  });

  // Links, images and words are read from the prose only (code blocks are excluded).
  let imageCount = 0;
  const urls = [];
  const prose = proseLines
    .join('\n')
    .replace(IMAGE_MARKDOWN, () => {
      imageCount += 1;
      return ' ';
    })
    .replace(IMAGE_HTML, () => {
      imageCount += 1;
      return ' ';
    })
    .replace(INLINE_LINK, (_match, linkText, url) => {
      urls.push(url);
      return linkText;
    })
    .replace(REFERENCE_DEFINITION, (_match, url) => {
      urls.push(url);
      return '';
    })
    .replace(ANCHOR_TAG, (_match, attributes) => {
      const href = attributes.match(HREF);
      if (href) urls.push(href[1]);
      return ' ';
    })
    .replace(BARE_URL, url => {
      urls.push(url);
      return ' ';
    })
    .replace(ANY_TAG, ' ');

  let cjkCharacters = 0;
  const words = prose.replace(CJK_CHARACTER, () => {
    cjkCharacters += 1;
    return ' ';
  });
  const wordCount = count(words, WORD) + Math.ceil(cjkCharacters / 2);

  const docsLink = urls.find(url => DOCS_LINK.test(url));
  if (docsLink) matches.api ??= describeMatch('link', docsLink);
  const contributingLink = urls.find(url => CONTRIBUTING_LINK.test(url));
  if (contributingLink) matches.contributing ??= describeMatch('link', contributingLink);

  const installCodeBlock = codeBlocks.find(block => INSTALL_COMMAND.test(block.text));
  const installCommand = installCodeBlock?.text.match(INSTALL_COMMAND)?.[0].trim();
  if (installCommand) matches.install ??= describeMatch('command', installCommand);

  const normalizedProse = normalizeForMatching(prose);
  const codeText = codeBlocks.map(block => block.text).join('\n');
  if (/\.env\b/.test(normalizedProse) || /\.env\b/.test(codeText)) {
    matches.config ??= '".env" mentioned';
  }

  const usageCodeBlocks = codeBlocks.filter(block => block.sections.includes('usage')).length;

  return {
    wordCount,
    headingCount: headings.length,
    headings: headings.slice(0, MAX_HEADINGS),
    hasTitle: headings.some(heading => heading.level === 1),
    hasInstallSection: matches.install !== null,
    hasInstallCommand: Boolean(installCommand),
    installCommand: installCommand ?? null,
    hasUsageSection: matches.usage !== null,
    usageCodeBlocks,
    hasConfigSection: matches.config !== null,
    hasApiDocs: matches.api !== null,
    hasContributing: matches.contributing !== null,
    hasLicenseSection: matches.license !== null,
    codeBlockCount: codeBlocks.length,
    linkCount: urls.length,
    imageCount,
    script: detectScript(prose),
    matches,
  };
};
