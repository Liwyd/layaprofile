import PropTypes from 'prop-types';
import Link from 'next/link';
import styled from 'styled-components';
import { theme, mixins } from '../../style';
import CompareForm from '../ui/CompareForm';
import Disclosure from '../ui/Disclosure';
import { comparePath } from '../../lib/ui/compare';
const { colors } = theme;

const Header = styled.header`
  padding: clamp(0.5rem, 3vw, 2rem) 0 clamp(1.5rem, 4vw, 2.5rem);

  .kicker {
    ${mixins.monoLabel};
    margin-bottom: 0.9rem;
    color: ${colors.accentText};
  }

  h1 {
    font-size: clamp(2rem, 6vw, 4rem);
    font-weight: 700;
    letter-spacing: -0.035em;
    line-height: 1.05;
    overflow-wrap: anywhere;
  }

  .vs {
    margin: 0 0.15em;
    color: ${colors.muted};
    font-weight: 400;
  }

  .lede {
    max-width: 60ch;
    margin-top: 1.1rem;
    color: ${colors.muted};
    font-size: 1rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.75rem 1.75rem;
    margin-top: 1.5rem;
  }

  .actions > a,
  .actions summary {
    ${mixins.monoLabel};
    color: ${colors.ink};
  }

  .edit {
    flex: 1 1 100%;
  }

  .edit form {
    margin-top: 1rem;
  }
`;

/**
 * The page title for a comparison (the h1), a link that swaps the two sides, and an inline form
 * to edit the pair. The form is keyed by the pair so that a swap resets its inputs.
 */
const CompareHeader = ({ a, b }) => (
  <Header>
    <p className="kicker">Comparison</p>
    <h1>
      {a}
      <span className="vs"> vs </span>
      {b}
    </h1>
    <p className="lede">
      This view shows where two public profiles differ. It does not rank developers: counts,
      checklists and evidence come from public GitHub data only.
    </p>
    <div className="actions">
      <Link href={comparePath(b, a)}>Swap sides</Link>
      <Disclosure className="edit">
        <summary>Edit comparison</summary>
        <CompareForm key={`${a}/${b}`} initialA={a} initialB={b} />
      </Disclosure>
    </div>
  </Header>
);

CompareHeader.propTypes = {
  a: PropTypes.string.isRequired,
  b: PropTypes.string.isRequired,
};

export default CompareHeader;
