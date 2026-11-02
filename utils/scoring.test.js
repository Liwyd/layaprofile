const { calculateProfileScore, calculateRepositoryScore } = require('./scoring');

console.log('Running scoring tests...');

const userRes = calculateProfileScore({
  bio: 'Developer',
  blog: 'https://example.com',
  company: 'Acme',
  location: 'Earth',
  public_repos: 10,
  followers: 20,
});
console.log('Profile Score Test:', userRes.score === 100 ? 'PASS' : 'FAIL', userRes);

const repoRes = calculateRepositoryScore({
  description: 'Test repo',
  license: { key: 'mit' },
  topics: ['react', 'nextjs'],
  archived: false,
});
console.log('Repo Score Test:', repoRes.score > 0 ? 'PASS' : 'FAIL', repoRes);

console.log('All tests completed.');
