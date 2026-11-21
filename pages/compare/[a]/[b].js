import PropTypes from 'prop-types';
import Head from '../../../components/Head';
import Layout from '../../../components/ui/Layout';
import Container from '../../../components/ui/Container';
import CompareForm from '../../../components/ui/CompareForm';
import LiveRegion from '../../../components/ui/LiveRegion';
import Compare from '../../../components/compare/Compare';
import CompareHeader from '../../../components/compare/CompareHeader';
import CompareSkeleton from '../../../components/compare/CompareSkeleton';
import ErrorState from '../../../components/report/ErrorState';
import Notices from '../../../components/report/Notices';
import SectionNav from '../../../components/report/SectionNav';
import { useCompare } from '../../../components/report/hooks';
import { describeError } from '../../../lib/ui/api';
import { pairProblemMessage, parseComparePair } from '../../../lib/ui/compare';
import { COMPARE_SECTIONS } from '../../../lib/ui/sections';

const SIDE_WORDS = { a: 'first', b: 'second' };

// The error page wording for a failed comparison: it names which username GitHub does not know.
const failureCopy = (info, names) => {
  if (info.kind !== 'not-found') return undefined;
  const name = info.which ? names[info.which] : null;
  return {
    kicker: '404 — Not found',
    title: 'User not found',
    message: name
      ? `GitHub has no public user named "${name}" (the ${SIDE_WORDS[info.which]} username). Check the spelling and try again.`
      : 'GitHub has no public user for one of these names. Check the spelling and try again.',
  };
};

// The oldest cache time among the sides that are served stale, or null when both are fresh.
const staleSides = ({ a, b }) =>
  [a, b]
    .filter(side => side.stale === true)
    .sort((x, y) => String(x.fetchedAt).localeCompare(String(y.fetchedAt)));

const announcement = ({ status, a, b, error }) => {
  if (status === 'loading') return `Comparing ${a} and ${b}`;
  if (status === 'ready') return `Comparison of ${a} and ${b} loaded`;
  return error.message;
};

const ComparePage = ({ a, b, problem }) => {
  const valid = problem === null;
  const { status, data, error, retry } = useCompare(valid ? a : null, valid ? b : null);

  // A pair that can never be compared is explained without any request being made.
  if (!valid) {
    return (
      <Layout>
        <Head title="Compare | LayaProfile" />
        <ErrorState
          error={{ kind: 'invalid' }}
          copy={{
            kicker: problem === 'same' ? '400 — Same account' : '404 — Not found',
            title: problem === 'same' ? 'Choose two different users' : 'Not a GitHub username',
            message: pairProblemMessage({ problem, a, b }),
          }}>
          <CompareForm initialA={a} initialB={b} />
        </ErrorState>
      </Layout>
    );
  }

  if (status === 'error') {
    const info = describeError(error);
    return (
      <Layout>
        <Head title={`${a} vs ${b} | LayaProfile`} />
        <LiveRegion message={info.message} />
        <ErrorState
          error={info}
          onRetry={retry}
          copy={failureCopy(info, { a, b })}
          username={info.which ? { a, b }[info.which] : undefined}>
          <CompareForm key={`${a}/${b}`} initialA={a} initialB={b} />
        </ErrorState>
      </Layout>
    );
  }

  const ready = status === 'ready';
  const stale = ready ? staleSides(data) : [];
  return (
    <Layout
      nav={
        <SectionNav sections={COMPARE_SECTIONS} label="Comparison sections" refreshKey={status} />
      }>
      <Head
        title={`${a} vs ${b} | LayaProfile`}
        description={`Where the public GitHub profiles of ${a} and ${b} differ.`}
      />
      <LiveRegion message={announcement({ status, a, b, error })} />
      {stale.length > 0 && (
        <Notices
          stale
          fetchedAt={stale[0].fetchedAt}
          subject={`the data for ${stale.map(side => side.user.login).join(' and ')}`}
        />
      )}
      <Container>
        <CompareHeader a={ready ? data.a.user.login : a} b={ready ? data.b.user.login : b} />
        {ready ? <Compare data={data} /> : <CompareSkeleton />}
      </Container>
    </Layout>
  );
};

ComparePage.propTypes = {
  a: PropTypes.string.isRequired,
  b: PropTypes.string.isRequired,
  problem: PropTypes.oneOf(['invalid-a', 'invalid-b', 'same']),
};

export const getServerSideProps = async ({ params, res }) => {
  const pair = parseComparePair(params.a, params.b);
  if (!pair.ok) {
    res.statusCode = pair.problem === 'same' ? 400 : 404;
    return { props: { a: pair.a, b: pair.b, problem: pair.problem } };
  }
  return { props: { a: pair.a, b: pair.b, problem: null } };
};

export default ComparePage;
