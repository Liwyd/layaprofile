import React from 'react';
import NextHead from 'next/head';
import PropTypes from 'prop-types';

const defaultTitle = 'LayaProfile';
const defaultDescription = 'Local intelligence for GitHub profiles and repositories.';

const Head = props => (
  <NextHead>
    <meta charSet="UTF-8" />
    <title>{props.title || defaultTitle}</title>
    <meta name="description" content={props.description || defaultDescription} />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f4f1ea" />
    <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#141412" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content={props.title || defaultTitle} />
    <meta property="og:description" content={props.description || defaultDescription} />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={props.title || defaultTitle} />
    <meta name="twitter:description" content={props.description || defaultDescription} />
  </NextHead>
);

Head.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
};

export default Head;
