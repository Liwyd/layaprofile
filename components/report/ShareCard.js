import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import { theme, mixins } from '../../style';
import ReportSection from '../ui/ReportSection';
import Button from '../ui/Button';
import { Caption } from '../ui/Text';
import {
  CARD_HEIGHT,
  CARD_WIDTH,
  avatarSource,
  buildCardModel,
  canvasMeasure,
  canvasToBlob,
  cardFilename,
  describeCard,
  downloadBlob,
  drawCard,
  layoutCard,
  loadAvatar,
  loadCardFonts,
} from '../../lib/ui/shareCard';
const { colors } = theme;

// Pixels requested from GitHub for the 120 px avatar: twice that, so the card stays sharp.
const AVATAR_PIXELS = 240;

const Frame = styled.figure`
  max-width: 54rem;

  canvas {
    display: block;
    width: 100%;
    height: auto;
    border: 1px solid ${colors.rule};
    background: ${colors.fill};
  }

  @media print {
    canvas {
      border: 0;
    }
  }
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.6rem 0.75rem;
  margin-top: 1rem;

  .link {
    ${mixins.monoText};
    flex: 1 1 14rem;
    min-width: 0;
    padding: 0.4rem 0.6rem;
    border: 1px solid ${colors.rule};
    background: transparent;
    font-size: 0.8125rem;
  }

  @media print {
    display: none;
  }
`;

const Status = styled.p`
  min-height: 1.4em;
  margin-top: 0.6rem;
  color: ${colors.muted};
  font-size: 0.875rem;
`;

/**
 * The share card: a 1200x630 summary drawn on a canvas (the same canvas is the preview and the
 * PNG). It is drawn once the web fonts are ready, first with initials and then, if GitHub's CDN
 * delivers the avatar with CORS, with the avatar. If the avatar cannot be loaded the card keeps
 * the initials and stays exportable.
 */
const ShareCard = ({ profile, now }) => {
  const canvas = useRef(null);
  const model = useMemo(() => buildCardModel(profile, now), [profile, now]);
  const [drawn, setDrawn] = useState(false);
  const [avatar, setAvatar] = useState(model.avatarUrl ? 'loading' : 'none');
  const [link, setLink] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    setLink(`${window.location.origin}/user/${encodeURIComponent(model.login)}`);
  }, [model.login]);

  useEffect(() => {
    let cancelled = false;
    const context = canvas.current.getContext('2d');
    if (!context) {
      setMessage('This browser cannot draw the card.');
      return undefined;
    }
    const measure = canvasMeasure(context);
    const paint = image => drawCard(context, layoutCard(model, measure), { avatar: image });

    setDrawn(false);
    setAvatar(model.avatarUrl ? 'loading' : 'none');
    (async () => {
      await loadCardFonts();
      if (cancelled) return;
      paint(null);
      setDrawn(true);
      if (!model.avatarUrl) return;
      const image = await loadAvatar(avatarSource(model.avatarUrl, AVATAR_PIXELS));
      if (cancelled) return;
      if (image) paint(image);
      setAvatar(image ? 'loaded' : 'failed');
    })();

    return () => {
      cancelled = true;
    };
  }, [model]);

  const ready = drawn && avatar !== 'loading';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setMessage('Link copied.');
    } catch (err) {
      console.warn('Copying the report link failed:', err);
      setMessage('Could not copy automatically. Select the link and copy it.');
    }
  };

  const download = async () => {
    try {
      downloadBlob(await canvasToBlob(canvas.current), cardFilename(model.login));
      setMessage(
        avatar === 'failed'
          ? 'Image saved. The avatar could not be loaded, so initials are drawn instead.'
          : 'Image saved.',
      );
    } catch (err) {
      console.error('Exporting the share card failed:', err);
      setMessage('The image could not be created in this browser.');
    }
  };

  return (
    <ReportSection id="share">
      <Frame>
        <canvas
          ref={canvas}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          role="img"
          aria-label={describeCard(model)}
        />
        <figcaption>
          <Caption style={{ marginTop: '0.75rem' }}>
            A summary of this report as an image. It uses public GitHub data and the checklist
            results above; the score is a completeness checklist, not a ranking.
          </Caption>
        </figcaption>
      </Frame>
      <Actions>
        <Button onClick={copyLink} disabled={!link}>
          Copy link
        </Button>
        <Button $variant="ghost" onClick={download} disabled={!ready}>
          Download PNG
        </Button>
        <input
          className="link"
          type="text"
          readOnly
          value={link}
          aria-label="Link to this report"
          onFocus={event => event.target.select()}
        />
      </Actions>
      <Status role="status">{message}</Status>
    </ReportSection>
  );
};

ShareCard.propTypes = {
  profile: PropTypes.shape({
    user: PropTypes.object.isRequired,
    repos: PropTypes.array.isRequired,
    profileScore: PropTypes.object,
    skills: PropTypes.object,
  }).isRequired,
  now: PropTypes.number.isRequired,
};

export default ShareCard;
