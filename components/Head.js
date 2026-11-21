import React from 'react';
import NextHead from 'next/head';
import PropTypes from 'prop-types';

const defaultTitle = 'LayaProfile';
const defaultDescription = 'Local intelligence for GitHub profiles and repositories.';

// Social crawlers need an absolute image address. The site address is only known to whoever
// deploys the app, so it is optional and read at build time: without NEXT_PUBLIC_SITE_URL the
// image address is relative and crawlers that require an absolute one will not show it.
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/+$/, '');
const ogImage = `${siteUrl}/og.png`;
const ogImageAlt = 'LayaProfile: local intelligence for GitHub profiles and repositories.';

const Head = props => {
  const title = props.title || defaultTitle;
  const description = props.description || defaultDescription;
  return (
    <NextHead>
      <meta charSet="UTF-8" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="icon" href="/favicon.ico" sizes="32x32" />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f4f1ea" />
      <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#141412" />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="LayaProfile" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:type" content="image/png" />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={ogImageAlt} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={ogImageAlt} />
    </NextHead>
  );
};

Head.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
};

export default Head;
