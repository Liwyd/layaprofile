// Legacy route: /user?id=<username> now lives at /user/<username>.
const LegacyUserRoute = () => null;

export const getServerSideProps = async ({ query }) => {
  const { id } = query;
  const destination = typeof id === 'string' && id ? `/user/${encodeURIComponent(id)}` : '/';
  return { redirect: { destination, permanent: false } };
};

export default LegacyUserRoute;
