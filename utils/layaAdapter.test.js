const { laya } = require('./layaAdapter');

async function runTests() {
  console.log('Running Laya Adapter tests...');
  const cat = await laya.classifyRepository({ topics: ['cli', 'tool'], language: 'JavaScript' });
  console.log('Classification Test:', cat.category === 'CLI tool' ? 'PASS' : 'FAIL', cat);

  const doc = await laya.assessDocumentation('# My Project\n\nInstall with npm install foo\n\n## Usage\nnode index.js');
  console.log('Doc Assessment Test:', doc.score === 100 ? 'PASS' : 'FAIL', doc);
  console.log('All Laya adapter tests completed.');
}

runTests();
