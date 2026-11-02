/**
 * Laya local intelligence adapter wrapper.
 * Provides typed decision structures (choice, score, noul) for repository & skill evaluation.
 */
class LayaAdapter {
  constructor() {
    this.initialized = true; // local mock / runtime adapter
  }

  async classifyRepository(repoMetadata) {
    // Determine category based on topics, language, and description
    const topics = repoMetadata.topics || [];
    const lang = repoMetadata.language || '';
    
    let category = 'Application';
    if (topics.includes('library') || topics.includes('sdk')) category = 'Library';
    else if (topics.includes('cli') || topics.includes('tool')) category = 'CLI tool';
    else if (topics.includes('api') || lang === 'Go' || lang === 'Python') category = 'API service';

    return {
      category,
      confidence: 0.85,
      source: 'local-laya-heuristic',
    };
  }

  async assessDocumentation(readmeContent) {
    if (!readmeContent) {
      return { score: 0, hasInstall: false, hasUsage: false, sufficiency: 'Insufficient evidence' };
    }
    const lower = readmeContent.toLowerCase();
    const hasInstall = lower.includes('install') || lower.includes('npm i') || lower.includes('pip install');
    const hasUsage = lower.includes('usage') || lower.includes('example') || lower.includes('getting started');
    
    let score = 50;
    if (hasInstall) score += 25;
    if (hasUsage) score += 25;

    return {
      score,
      hasInstall,
      hasUsage,
      sufficiency: score >= 75 ? 'Sufficient' : 'Needs improvement',
    };
  }
}

export const laya = new LayaAdapter();
