import { useState } from 'react';
import { useRouter } from 'next/router';
import styled from 'styled-components';
import Head from '../components/Head';
import Layout from '../components/ui/Layout';
import Container from '../components/ui/Container';
import Button from '../components/ui/Button';
import CompareForm from '../components/ui/CompareForm';
import Field from '../components/ui/Field';
import { theme, mixins, media, Section, SectionLabel, SectionBody } from '../style';
import { isValidUsername } from '../lib/validation';
const { colors } = theme;

const Hero = styled.div`
  padding: clamp(1rem, 6vw, 4rem) 0 clamp(2.5rem, 7vw, 5rem);

  h1 {
    font-size: clamp(3rem, 11vw, 7.5rem);
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 0.95;
  }

  .tagline {
    max-width: 24ch;
    margin-top: 1.5rem;
    font-size: clamp(1.25rem, 2.6vw, 1.75rem);
    letter-spacing: -0.015em;
    line-height: 1.25;
  }

  form {
    max-width: 38rem;
    margin-top: clamp(2rem, 5vw, 3.25rem);
  }
`;

const Steps = styled.ol`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.5rem;

  ${media.bp900`
    grid-template-columns: minmax(0, 1fr);
    gap: 1.25rem;
  `};

  li {
    padding-top: 0.9rem;
    border-top: 1px solid ${colors.ink};
  }

  .n {
    ${mixins.monoLabel};
    display: block;
    margin-bottom: 0.5rem;
    color: ${colors.accentText};
  }

  /* The steps are a sequence: data, then rules, then model. */
  li:not(:last-child) .n::after {
    content: ' →';
  }

  h3 {
    ${mixins.monoText};
    font-size: 0.9375rem;
    font-weight: 600;
    letter-spacing: 0;
  }

  p {
    margin-top: 0.4rem;
    color: ${colors.muted};
    font-size: 0.9375rem;
  }
`;

const HOW_IT_WORKS = [
  {
    title: 'Public GitHub data',
    text: 'Only public profile and repository metadata, read through a short-lived server cache. No accounts, no database.',
  },
  {
    title: 'Transparent rules',
    text: 'Every score is a documented checklist. Missing data is marked unknown, never scored as zero.',
  },
  {
    title: 'Local Laya predictions',
    text: 'A small model on this server adds labelled predictions. Uncertain predictions are never used.',
  },
];

const Home = () => {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [searchInvalid, setSearchInvalid] = useState(false);

  const handleSearch = event => {
    event.preventDefault();
    const trimmed = username.trim();
    if (!isValidUsername(trimmed)) {
      setSearchInvalid(true);
      return;
    }
    router.push(`/user/${encodeURIComponent(trimmed)}`);
  };

  return (
    <Layout>
      <Head title="LayaProfile" />
      <Container>
        <Hero>
          <h1>LayaProfile</h1>
          <p className="tagline">Local intelligence for GitHub profiles and repositories.</p>

          <form onSubmit={handleSearch} noValidate>
            <Field>
              <label htmlFor="username">GitHub username</label>
              <div className="row">
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={username}
                  onChange={event => {
                    setUsername(event.target.value);
                    setSearchInvalid(false);
                  }}
                  placeholder="octocat"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-invalid={searchInvalid}
                  aria-describedby={searchInvalid ? 'username-error' : undefined}
                />
                <Button type="submit">Analyze profile</Button>
              </div>
              {searchInvalid && (
                <p id="username-error" className="error" role="alert">
                  Enter a valid GitHub username: letters, digits and single hyphens, up to 39
                  characters.
                </p>
              )}
            </Field>
          </form>
        </Hero>

        <Section aria-labelledby="compare-title">
          <SectionLabel>
            <span className="number" aria-hidden="true">
              A
            </span>
            <h2 id="compare-title" className="title">
              Compare two profiles
            </h2>
          </SectionLabel>
          <SectionBody>
            <CompareForm />
          </SectionBody>
        </Section>

        <Section aria-labelledby="how-title">
          <SectionLabel>
            <span className="number" aria-hidden="true">
              B
            </span>
            <h2 id="how-title" className="title">
              How it works
            </h2>
          </SectionLabel>
          <SectionBody>
            <Steps>
              {HOW_IT_WORKS.map((step, index) => (
                <li key={step.title}>
                  <span className="n">{String(index + 1).padStart(2, '0')}</span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </Steps>
          </SectionBody>
        </Section>
      </Container>
    </Layout>
  );
};

export default Home;
