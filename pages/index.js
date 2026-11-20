import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { Head } from '../components';
import { MarkGithubIcon } from '../components/icons';
import styled from 'styled-components';
import { theme, mixins } from '../style';
import { isValidUsername } from '../lib/validation';
const { colors, fonts } = theme;

const StyledContainer = styled.div`
  ${mixins.flexCenter};
  background-color: ${colors.black};
  background-image: linear-gradient(${colors.black} 0%, ${colors.darkGrey} 100%);
  color: ${colors.offWhite};
  height: 100vh;

  form {
    background-color: transparent;
    border-radius: 5px;
    padding: 2rem;
    margin-bottom: 20vh;
    max-width: 600px;
    text-align: center;
    svg {
      color: ${colors.blue};
    }
    label {
      display: block;
      font-size: 2.5rem;
      font-weight: 500;
      margin: 2rem;
    }
    input {
      background-color: #26303c;
      outline: 0;
      border: 0;
      border-radius: 0.25rem;
      width: 100%;
      max-width: 500px;
      margin: 0 auto;
      padding: 1rem;
      color: ${colors.lightblue};
      font-family: ${fonts.mono};
      font-size: 2rem;
      font-weight: 400;
      text-align: center;
    }

    .form-error {
      margin: 1rem 0 0;
      color: ${colors.orange};
      font-size: 1rem;
    }

    .submit {
      ${mixins.blueButton};
      margin-top: 3rem;
      filter: none;
    }
  }
`;

const Home = () => {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [invalid, setInvalid] = useState(false);

  const handleChange = e => {
    setUsername(e.target.value);
    setInvalid(false);
  };

  const handleSubmit = e => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!isValidUsername(trimmed)) {
      setInvalid(true);
      return;
    }
    router.push(`/user/${trimmed}`);
  };

  return (
    <main>
      <Head title="OctoProfile" />

      <StyledContainer>
        <form onSubmit={handleSubmit} noValidate>
          <MarkGithubIcon size={32} />
          <label htmlFor="username">Find Your OctoProfile</label>
          <input
            id="username"
            name="username"
            type="text"
            value={username}
            onChange={handleChange}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={invalid}
            aria-describedby={invalid ? 'username-error' : undefined}
          />
          {invalid && (
            <p id="username-error" className="form-error" role="alert">
              Enter a valid GitHub username.
            </p>
          )}
        </form>
      </StyledContainer>
    </main>
  );
};

export default Home;
