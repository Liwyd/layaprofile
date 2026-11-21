// The profile share card: a 1200x630 summary image drawn on a <canvas> with the 2D API, no
// library. Everything that decides what is on the card and where it goes is a pure function
// (selection, text fitting, `layoutCard`) and is unit tested. `layoutCard` returns a flat list of
// drawing operations; `drawCard` and the loaders at the bottom are the only code that touches
// the browser.
//
// The card has a fixed light palette on purpose: it is an image people share, so it must not
// depend on the viewer's colour scheme. It shows only what the report shows (strength words, no
// percentages for skills) and never a ranking.

import { isValidUsername } from '../validation';
import { computeLanguageStats } from '../languageStats';
import { formatCoverage, formatDate, strengthLabel } from './format';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export const MAX_SKILLS = 3;
export const MAX_LANGUAGES = 5;

export const CARD_COLORS = Object.freeze({
  paper: '#f4f1ea',
  ink: '#1b1b18',
  muted: '#66655e',
  rule: '#d6d0c2',
  fill: '#eae5d9',
  accent: '#b4441c',
});

const SANS = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
const MONO = "'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
export const font = (weight, size, family) => `${weight} ${size}px ${family}`;

// The faces the card uses, so a caller can load them before measuring and drawing.
export const CARD_FONTS = Object.freeze([
  font(400, 18, SANS),
  font(600, 26, SANS),
  font(700, 56, SANS),
  font(500, 17, MONO),
  font(500, 148, MONO),
]);

const ELLIPSIS = '…';

// ---------------------------------------------------------------------------------------------
// Text fitting
// ---------------------------------------------------------------------------------------------

/**
 * Shortens `text` with an ellipsis until `measure(text)` fits `maxWidth`. Works on whole code
 * points, so an emoji is never cut in half. Returns the text unchanged when it fits, and an empty
 * string when not even the ellipsis fits.
 */
export const truncateToWidth = (text, maxWidth, measure) => {
  const value = String(text ?? '');
  if (measure(value) <= maxWidth) return value;
  const characters = Array.from(value);
  for (let length = characters.length - 1; length > 0; length -= 1) {
    const candidate = `${characters.slice(0, length).join('').trimEnd()}${ELLIPSIS}`;
    if (measure(candidate) <= maxWidth) return candidate;
  }
  return measure(ELLIPSIS) <= maxWidth ? ELLIPSIS : '';
};

/**
 * Greedy word wrap into at most `maxLines` lines that each fit `maxWidth`. A word wider than a
 * line is truncated; text that does not fit in `maxLines` ends with an ellipsis on the last line.
 */
export const wrapText = (text, maxWidth, measure, maxLines) => {
  const words = String(text ?? '')
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let index = 0;
  while (index < words.length && lines.length < maxLines) {
    const isLastLine = lines.length === maxLines - 1;
    if (isLastLine) {
      lines.push(truncateToWidth(words.slice(index).join(' '), maxWidth, measure));
      return lines;
    }
    let line = words[index];
    index += 1;
    while (index < words.length && measure(`${line} ${words[index]}`) <= maxWidth) {
      line = `${line} ${words[index]}`;
      index += 1;
    }
    lines.push(truncateToWidth(line, maxWidth, measure));
  }
  return lines;
};

/**
 * The first of `sizes` (largest first) at which `measureAt(size)` fits `maxWidth`, or the last,
 * smallest one when none fits. Lets a long label shrink before it is truncated.
 */
export const fitFontSize = (sizes, maxWidth, measureAt) =>
  sizes.find(size => measureAt(size) <= maxWidth) ?? sizes[sizes.length - 1];

/** One or two capital letters for the avatar fallback: the first letters of the first two words. */
export const initialsOf = name => {
  const words = String(name ?? '')
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (words.length === 0) return '?';
  const first = Array.from(words[0])[0];
  const second = words[1] ? Array.from(words[1])[0] : '';
  return `${first}${second}`.toUpperCase();
};

// ---------------------------------------------------------------------------------------------
// Selection
// ---------------------------------------------------------------------------------------------

const STRENGTH_RANK = { repeated: 3, observed: 2, weak: 1 };

/**
 * The strongest skill categories, at most `limit`, as `{ label, strength, strengthText }`. A
 * category with no public evidence is never listed, and neither is one that only a Laya
 * prediction supports: the card shows what was observed. Ties keep the report's order.
 */
export const selectTopSkills = (skills, limit = MAX_SKILLS) => {
  const categories = Array.isArray(skills?.categories) ? skills.categories : [];
  return categories
    .map((category, index) => ({ category, index }))
    .filter(
      ({ category }) =>
        Object.hasOwn(STRENGTH_RANK, category?.strength) && category.source !== 'model-inferred',
    )
    .sort(
      (x, y) =>
        STRENGTH_RANK[y.category.strength] - STRENGTH_RANK[x.category.strength] ||
        (y.category.repoCount ?? 0) - (x.category.repoCount ?? 0) ||
        x.index - y.index,
    )
    .slice(0, limit)
    .map(({ category }) => ({
      label: String(category.label),
      strength: category.strength,
      strengthText: strengthLabel(category.strength),
    }));
};

/** The most used primary languages by repository count, at most `limit`, as `{ name, count }`. */
export const selectTopLanguages = (repos, limit = MAX_LANGUAGES) =>
  computeLanguageStats(repos, Infinity)
    .slice(0, limit)
    .map(({ label, value }) => ({ name: label, count: value }));

/** Only GitHub's avatar CDN is drawn, so the canvas is never fed an arbitrary address. */
export const isAvatarUrl = value => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'avatars.githubusercontent.com';
  } catch {
    // Not a URL: there is no avatar to draw.
    return false;
  }
};

/** The avatar address asking GitHub for an image of about `size` pixels. */
export const avatarSource = (value, size) => {
  const url = new URL(value);
  url.searchParams.set('s', String(size));
  return url.href;
};

/** File name of the downloaded image. The login is validated, so the name is always safe. */
export const cardFilename = login =>
  `layaprofile-${isValidUsername(login) ? login.toLowerCase() : 'profile'}.png`;

/**
 * Everything the card shows, from a loaded profile (`{ user, repos, profileScore, skills }`) and
 * the clock. A missing score stays null (a dash on the card), never 0.
 */
export const buildCardModel = (profile, now) => {
  const { user, profileScore } = profile;
  const name = String(user.name ?? '').trim() || user.login;
  // `formatDate` reads timestamps, so the clock (milliseconds) is converted first.
  const date = Number.isFinite(now) ? formatDate(new Date(now).toISOString()) : null;
  return {
    name,
    login: user.login,
    initials: initialsOf(name),
    avatarUrl: isAvatarUrl(user.avatar_url) ? user.avatar_url : null,
    score: Number.isFinite(profileScore?.score) ? profileScore.score : null,
    label: profileScore?.label ?? 'Not assessed',
    coverage: Number.isFinite(profileScore?.coverage) ? profileScore.coverage : null,
    skills: selectTopSkills(profile.skills),
    languages: selectTopLanguages(profile.repos),
    footer: ['LayaProfile', date, 'public GitHub data'].filter(Boolean).join(' · '),
  };
};

/** The card as plain text, for the accessible name of the image. */
export const describeCard = model => {
  const score =
    model.score === null
      ? `Profile checklist score not available: ${model.label}.`
      : `Profile checklist score ${model.score} of 100, ${model.label}${
          model.coverage === null ? '' : `, evidence coverage ${formatCoverage(model.coverage)}`
        }.`;
  const skills =
    model.skills.length > 0
      ? `Skill evidence: ${model.skills.map(skill => `${skill.label} (${skill.strengthText})`).join(', ')}.`
      : 'No skill evidence found in public repositories.';
  const languages =
    model.languages.length > 0
      ? `Languages by repository count: ${model.languages.map(l => `${l.name} (${l.count})`).join(', ')}.`
      : 'No primary language reported.';
  return `Summary card of ${model.name}, @${model.login}. ${score} ${skills} ${languages} ${model.footer}.`;
};

// ---------------------------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------------------------

const MARGIN = 64;
const RIGHT = CARD_WIDTH - MARGIN;
const DIVIDER_X = 784;
const LEFT_RIGHT = 744;
const SCORE_X = 824;
const SCORE_WIDTH = RIGHT - SCORE_X;
const AVATAR_SIZE = 120;
const SKILLS_X = MARGIN;
const SKILLS_WIDTH = 360;
const LANGUAGES_X = 472;
const LANGUAGES_WIDTH = LEFT_RIGHT - LANGUAGES_X;

const LABEL_SIZES = [36, 32, 28, 24];

const NOTE = 'A checklist of public profile data, not a ranking of developers.';
const NOTE_NO_SCORE = 'Not enough public data to assign a score.';

/**
 * Turns the card model into drawing operations in 1200x630 pixel space. `measure(text, font)`
 * returns the width of `text` in the given CSS font, so text can be fitted without a browser in
 * the tests. Operations: `rect`, `text` (left or right aligned, alphabetic baseline) and
 * `avatar` (drawn as an image or, without one, as initials).
 */
export const layoutCard = (model, measure) => {
  const ops = [];
  const rect = (x, y, w, h, color) => ops.push({ type: 'rect', x, y, w, h, color });
  const text = (value, x, y, fontSpec, color, align = 'left') =>
    ops.push({ type: 'text', text: value, x, y, font: fontSpec, color, align });
  const fit = (value, maxWidth, fontSpec) =>
    truncateToWidth(value, maxWidth, string => measure(string, fontSpec));
  const { ink, muted, rule, accent } = CARD_COLORS;

  const wordmark = font(700, 26, SANS);
  const label = font(500, 17, MONO);
  const small = font(400, 18, SANS);

  // Header
  rect(MARGIN, 50, 16, 16, accent);
  text('LayaProfile', MARGIN + 28, 67, wordmark, ink);
  text('PROFILE SUMMARY', RIGHT, 65, label, muted, 'right');
  rect(MARGIN, 90, CARD_WIDTH - 2 * MARGIN, 2, ink);

  // Identity
  ops.push({
    type: 'avatar',
    x: MARGIN,
    y: 128,
    size: AVATAR_SIZE,
    initials: model.initials,
  });
  const identityX = MARGIN + AVATAR_SIZE + 32;
  const nameFont = font(700, 56, SANS);
  text(fit(model.name, LEFT_RIGHT - identityX, nameFont), identityX, 184, nameFont, ink);
  const loginFont = font(500, 24, MONO);
  text(fit(`@${model.login}`, LEFT_RIGHT - identityX, loginFont), identityX, 228, loginFont, muted);

  // Skills and languages, under a hairline
  rect(MARGIN, 276, LEFT_RIGHT - MARGIN, 1, rule);
  text('SKILL EVIDENCE', SKILLS_X, 314, label, muted);
  text('LANGUAGES (REPOS)', LANGUAGES_X, 314, label, muted);

  if (model.skills.length === 0) {
    const none = font(400, 20, SANS);
    text(
      fit('No skill evidence found in public repositories.', SKILLS_WIDTH, none),
      SKILLS_X,
      360,
      none,
      muted,
    );
  }
  model.skills.forEach((skill, index) => {
    const baseline = 360 + index * 62;
    const skillFont = font(600, 26, SANS);
    text(fit(skill.label, SKILLS_WIDTH, skillFont), SKILLS_X, baseline, skillFont, ink);
    // Three pips plus the word, as in the report: repeated 3, observed 2, weak 1.
    const filled = STRENGTH_RANK[skill.strength] ?? 0;
    for (let pip = 0; pip < 3; pip += 1) {
      const x = SKILLS_X + pip * 16;
      const y = baseline + 14;
      rect(x, y, 11, 11, ink);
      if (pip >= filled) rect(x + 1.5, y + 1.5, 8, 8, CARD_COLORS.paper);
    }
    text(skill.strengthText.toUpperCase(), SKILLS_X + 56, baseline + 25, label, muted);
  });

  if (model.languages.length === 0) {
    const none = font(400, 20, SANS);
    text(
      fit('No primary language reported.', LANGUAGES_WIDTH, none),
      LANGUAGES_X,
      360,
      none,
      muted,
    );
  }
  model.languages.forEach((language, index) => {
    const baseline = 360 + index * 38;
    const languageFont = font(500, 22, SANS);
    const count = String(language.count);
    const countWidth = measure(count, label);
    text(
      fit(language.name, LANGUAGES_WIDTH - countWidth - 16, languageFont),
      LANGUAGES_X,
      baseline,
      languageFont,
      ink,
    );
    text(count, LEFT_RIGHT, baseline, label, muted, 'right');
    rect(LANGUAGES_X, baseline + 12, LANGUAGES_WIDTH, 1, rule);
  });

  // Divider and score column
  rect(DIVIDER_X, 128, 1, 392, rule);
  text('PROFILE CHECKLIST SCORE', SCORE_X, 148, label, muted);
  const scoreFont = font(500, 148, MONO);
  const scoreText = model.score === null ? '—' : String(model.score);
  text(scoreText, SCORE_X, 282, scoreFont, ink);
  if (model.score !== null) {
    const scoreWidth = measure(scoreText, scoreFont);
    text(
      '/100',
      SCORE_X + Math.min(scoreWidth, SCORE_WIDTH - 90) + 10,
      282,
      font(500, 26, MONO),
      muted,
    );
  }
  // The label ("Insufficient evidence") shrinks to fit the column before it is cut.
  const labelSize = fitFontSize(LABEL_SIZES, SCORE_WIDTH, size =>
    measure(model.label, font(600, size, SANS)),
  );
  const labelFont = font(600, labelSize, SANS);
  text(fit(model.label, SCORE_WIDTH, labelFont), SCORE_X, 340, labelFont, ink);

  if (model.coverage !== null) {
    text('EVIDENCE COVERAGE', SCORE_X, 388, label, muted);
    text(formatCoverage(model.coverage), RIGHT, 388, label, ink, 'right');
    rect(SCORE_X, 400, SCORE_WIDTH, 8, CARD_COLORS.fill);
    rect(SCORE_X, 400, Math.round(SCORE_WIDTH * Math.min(1, Math.max(0, model.coverage))), 8, ink);
  }
  const noteLines = wrapText(
    model.score === null ? NOTE_NO_SCORE : NOTE,
    SCORE_WIDTH,
    string => measure(string, small),
    3,
  );
  noteLines.forEach((line, index) => text(line, SCORE_X, 450 + index * 26, small, muted));

  // Footer
  rect(MARGIN, 552, CARD_WIDTH - 2 * MARGIN, 1, ink);
  text(fit(model.footer, CARD_WIDTH - 2 * MARGIN, label), MARGIN, 592, label, muted);

  return { width: CARD_WIDTH, height: CARD_HEIGHT, ops };
};

// ---------------------------------------------------------------------------------------------
// Browser side: drawing, loading and saving (not unit tested; they need a canvas)
// ---------------------------------------------------------------------------------------------

/** A `measure(text, font)` backed by a 2D context. */
export const canvasMeasure = ctx => (value, fontSpec) => {
  ctx.font = fontSpec;
  return ctx.measureText(value).width;
};

/** Paints a laid-out card. `avatar` is a loaded image, or null to draw the initials instead. */
export const drawCard = (ctx, layout, { avatar = null } = {}) => {
  ctx.fillStyle = CARD_COLORS.paper;
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.textBaseline = 'alphabetic';

  layout.ops.forEach(op => {
    if (op.type === 'rect') {
      ctx.fillStyle = op.color;
      ctx.fillRect(op.x, op.y, op.w, op.h);
    } else if (op.type === 'text') {
      ctx.font = op.font;
      ctx.fillStyle = op.color;
      ctx.textAlign = op.align;
      ctx.fillText(op.text, op.x, op.y);
    } else if (op.type === 'avatar') {
      if (avatar) {
        ctx.drawImage(avatar, op.x, op.y, op.size, op.size);
      } else {
        ctx.fillStyle = CARD_COLORS.fill;
        ctx.fillRect(op.x, op.y, op.size, op.size);
        ctx.font = font(600, Math.round(op.size * 0.4), SANS);
        ctx.fillStyle = CARD_COLORS.ink;
        ctx.textAlign = 'center';
        ctx.fillText(op.initials, op.x + op.size / 2, op.y + op.size * 0.62);
      }
      ctx.strokeStyle = CARD_COLORS.rule;
      ctx.lineWidth = 1;
      ctx.strokeRect(op.x + 0.5, op.y + 0.5, op.size - 1, op.size - 1);
    }
  });
};

/** Loads the card's web fonts so measuring and drawing use them. Failure leaves the fallbacks. */
export const loadCardFonts = async () => {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  try {
    await Promise.all(CARD_FONTS.map(spec => document.fonts.load(spec)));
  } catch (err) {
    console.warn('Share card: the web fonts could not be loaded; using fallback fonts.', err);
  }
};

/**
 * Loads the avatar for the canvas. `crossOrigin='anonymous'` makes the request a CORS request
 * (GitHub's CDN answers with Access-Control-Allow-Origin), so drawing it does not taint the
 * canvas and the PNG can be exported. Resolves with null on failure or timeout: the caller draws
 * initials instead.
 */
export const loadAvatar = (url, timeoutMs = 6000) =>
  new Promise(resolve => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    const finish = result => {
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      console.warn('Share card: the avatar took too long to load; drawing initials instead.');
      finish(null);
    }, timeoutMs);
    image.onload = () => finish(image);
    image.onerror = () => {
      console.warn('Share card: the avatar could not be loaded; drawing initials instead.');
      finish(null);
    };
    image.src = url;
  });

/** Encodes the canvas as a PNG. Rejects if the canvas is tainted or cannot be encoded. */
export const canvasToBlob = canvas =>
  new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('The card could not be encoded as a PNG.'));
    }, 'image/png');
  });

/** Starts a browser download of `blob` under `filename`. */
export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
