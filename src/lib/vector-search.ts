/**
 * Pure JS cosine similarity and vector search.
 * Loads all embeddings into memory (fine for <10K entities).
 */

import type { CompatDatabase } from "./memory-db.js";

export interface EmbeddingRow {
  target_type: string;
  target_id: string;
  embedding: string; // JSON float array
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

let _cache: EmbeddingRow[] | null = null;
let _cacheVersion = 0;
let _currentVersion = 0;

/** Invalidate the embeddings cache (call after writes). */
export function invalidateEmbeddingCache(): void {
  _currentVersion++;
}

function loadCache(db: CompatDatabase): EmbeddingRow[] {
  if (_cache && _cacheVersion === _currentVersion) return _cache;
  _cache = db
    .prepare("SELECT target_type, target_id, embedding FROM embeddings")
    .all() as unknown as EmbeddingRow[];
  _cacheVersion = _currentVersion;
  return _cache;
}

export interface SimilarityResult {
  target_type: string;
  target_id: string;
  score: number;
}

/**
 * Find the top-k most similar embeddings to a query vector.
 */
export function findSimilar(
  db: CompatDatabase,
  queryEmbedding: number[],
  opts: { limit?: number; targetType?: string; minScore?: number } = {}
): SimilarityResult[] {
  const { limit = 20, targetType, minScore = 0.3 } = opts;
  const rows = loadCache(db);

  const results: SimilarityResult[] = [];
  for (const row of rows) {
    if (targetType && row.target_type !== targetType) continue;

    let parsed: number[];
    try {
      parsed = JSON.parse(row.embedding);
    } catch {
      continue;
    }

    const score = cosineSimilarity(queryEmbedding, parsed);
    if (score >= minScore) {
      results.push({
        target_type: row.target_type,
        target_id: row.target_id,
        score,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

/**
 * Store an embedding in the database.
 */
export function storeEmbedding(
  db: CompatDatabase,
  targetType: string,
  targetId: string,
  embedding: number[],
  model: string
): void {
  db.prepare(
    "INSERT OR REPLACE INTO embeddings (target_type, target_id, embedding, model) VALUES (?, ?, ?, ?)"
  ).run(targetType, targetId, JSON.stringify(embedding), model);
  invalidateEmbeddingCache();
}
