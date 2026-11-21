import PropTypes from 'prop-types';
import { Section, SectionLabel, SectionBody } from '../../style';
import { sectionById } from '../../lib/ui/sections';

/**
 * One numbered section of the report. The label column carries the section number and title;
 * `busy` marks the region as updating for assistive technology while its data loads. With
 * `plainTitle` the title is not a heading, for the section whose own content starts with the
 * page's h1 (the overview), so the heading outline begins with the h1.
 */
const ReportSection = ({ id, busy = false, plainTitle = false, children }) => {
  const { number, title } = sectionById(id);
  const Title = plainTitle ? 'p' : 'h2';
  return (
    <Section id={id} aria-labelledby={`${id}-title`} aria-busy={busy}>
      <SectionLabel>
        <span className="number" aria-hidden="true">
          {number}
        </span>
        <Title id={`${id}-title`} className="title">
          {title}
        </Title>
      </SectionLabel>
      <SectionBody>{children}</SectionBody>
    </Section>
  );
};

ReportSection.propTypes = {
  id: PropTypes.string.isRequired,
  busy: PropTypes.bool,
  plainTitle: PropTypes.bool,
  children: PropTypes.node,
};

export default ReportSection;
