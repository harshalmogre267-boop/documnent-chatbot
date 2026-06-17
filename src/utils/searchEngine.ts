import type { DocumentChunk } from '../types';

// Common English stop words to filter out noise from search indexing
const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'arent',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'cant', 'cannot', 'could', 'couldnt', 'did', 'didnt', 'do', 'does', 'doesnt', 'doing', 'dont',
  'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadnt', 'has', 'hasnt', 'have',
  'havent', 'having', 'he', 'hed', 'hell', 'hes', 'her', 'here', 'heres', 'hers', 'herself', 'him',
  'himself', 'his', 'how', 'hows', 'i', 'id', 'ill', 'im', 'ive', 'if', 'in', 'into', 'is', 'isnt',
  'it', 'its', 'itself', 'lets', 'me', 'more', 'most', 'mustnt', 'my', 'myself', 'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over',
  'own', 'same', 'shant', 'she', 'shed', 'shell', 'shes', 'should', 'shouldnt', 'so', 'some', 'such',
  'than', 'that', 'thats', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'theres',
  'these', 'they', 'theyd', 'theyll', 'theyre', 'theyve', 'this', 'those', 'through', 'to', 'too',
  'under', 'until', 'up', 'very', 'was', 'wasnt', 'we', 'wed', 'well', 'were', 'weve', 'werent',
  'what', 'whats', 'when', 'whens', 'where', 'wheres', 'which', 'while', 'who', 'whos', 'whom',
  'why', 'whys', 'with', 'wont', 'would', 'wouldnt', 'you', 'youd', 'youll', 'youre', 'youve',
  'your', 'yours', 'yourself', 'yourselves'
]);

// Helper to tokenize text: lowercase, remove punctuation, split by spaces
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .split(/[\s_]+/)
    .filter(word => word.length > 0);
}

export class SearchEngine {
  private chunks: DocumentChunk[] = [];
  private docFrequencies: Map<string, number> = new Map();
  private termFrequenciesPerChunk: Map<string, Map<string, number>> = new Map();

  constructor(chunks: DocumentChunk[]) {
    this.chunks = chunks;
    this.buildIndex();
  }

  // Build the TF-IDF index for the loaded chunks
  private buildIndex() {
    this.docFrequencies.clear();
    this.termFrequenciesPerChunk.clear();

    if (this.chunks.length === 0) return;

    for (const chunk of this.chunks) {
      const tokens = tokenize(chunk.text);
      if (tokens.length === 0) continue;

      const chunkTermCounts = new Map<string, number>();
      const uniqueTerms = new Set<string>();

      // Count term occurrences in this chunk
      for (const token of tokens) {
        chunkTermCounts.set(token, (chunkTermCounts.get(token) || 0) + 1);
        uniqueTerms.add(token);
      }

      // Calculate term frequency (TF) = term count / total tokens
      const tfMap = new Map<string, number>();
      for (const [term, count] of chunkTermCounts.entries()) {
        tfMap.set(term, count / tokens.length);
      }
      this.termFrequenciesPerChunk.set(chunk.id, tfMap);

      // Increment document frequency (DF) for each term appearing in this chunk
      for (const term of uniqueTerms) {
        this.docFrequencies.set(term, (this.docFrequencies.get(term) || 0) + 1);
      }
    }
  }

  // Search for the top K matching chunks based on query
  public search(query: string, limit = 4): DocumentChunk[] {
    if (this.chunks.length === 0) return [];
    
    let queryTokens = tokenize(query).filter(token => !STOP_WORDS.has(token));
    
    // If filtering stop words leaves us empty-handed, use all query tokens
    if (queryTokens.length === 0) {
      queryTokens = tokenize(query);
    }
    
    if (queryTokens.length === 0) {
      return this.chunks.slice(0, limit);
    }

    return this.rankChunks(queryTokens, query, limit);
  }

  // Score and rank chunks
  private rankChunks(queryTokens: string[], originalQuery: string, limit: number): DocumentChunk[] {
    const scores = new Map<string, number>();
    const totalDocs = this.chunks.length;

    // Calculate Inverse Document Frequency (IDF) for query tokens
    const idfs = new Map<string, number>();
    for (const token of queryTokens) {
      const df = this.docFrequencies.get(token) || 0;
      // Smooth IDF formula: ln(1 + totalDocs / (df + 1))
      const idf = Math.log(1 + (totalDocs / (df + 1)));
      idfs.set(token, idf);
    }

    for (const chunk of this.chunks) {
      let score = 0;
      const tfMap = this.termFrequenciesPerChunk.get(chunk.id);
      if (!tfMap) continue;

      // Compute standard TF-IDF score
      for (const token of queryTokens) {
        const tf = tfMap.get(token) || 0;
        const idf = idfs.get(token) || 0;
        score += tf * idf;
      }

      // Bonus: Exact phrase match bonus
      const lowerChunkText = chunk.text.toLowerCase();
      const lowerQuery = originalQuery.toLowerCase().trim();
      
      if (lowerQuery.length > 2 && lowerChunkText.includes(lowerQuery)) {
        score += 1.5; // High weight for exact query phrase match
      }

      // Bonus: Match filename terms
      const lowerFileName = chunk.fileName.toLowerCase();
      for (const token of queryTokens) {
        if (lowerFileName.includes(token)) {
          score += 0.2; // Extra weight if search term appears in file name
        }
      }

      if (score > 0) {
        scores.set(chunk.id, score);
      }
    }

    // Sort matching chunks by score in descending order
    const matchedChunks = this.chunks
      .filter(chunk => (scores.get(chunk.id) || 0) > 0)
      .sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));

    // Fallback if no text matches: return first few chunks
    if (matchedChunks.length === 0) {
      return this.chunks.slice(0, limit);
    }

    return matchedChunks.slice(0, limit);
  }
}
