/**
 * Batch Processor
 * 
 * Batch operations for embeddings, reranking, and other expensive operations
 * Reduces API calls and improves throughput
 */

export interface BatchItem<T> {
  id: string;
  data: T;
}

export interface BatchResult<TInput, TOutput> {
  id: string;
  input: TInput;
  output: TOutput;
  error?: Error;
}

/**
 * Process items in batches with concurrency control
 */
export async function processBatch<TInput, TOutput>(
  items: BatchItem<TInput>[],
  processor: (item: TInput) => Promise<TOutput>,
  options?: {
    batchSize?: number;
    concurrency?: number;
    retries?: number;
  }
): Promise<BatchResult<TInput, TOutput>[]> {
  const {
    batchSize = 10,
    concurrency = 3,
    retries = 2,
  } = options || {};

  const results: BatchResult<TInput, TOutput>[] = [];

  // Process in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    // Process batch with concurrency control
    const batchResults = await Promise.allSettled(
      batch.map(async (item) => {
        let lastError: Error | undefined;
        
        // Retry logic
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            const output = await processor(item.data);
            return {
              id: item.id,
              input: item.data,
              output,
            } as BatchResult<TInput, TOutput>;
          } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt < retries) {
              // Exponential backoff
              await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
            }
          }
        }

        return {
          id: item.id,
          input: item.data,
          output: undefined as any,
          error: lastError,
        } as BatchResult<TInput, TOutput>;
      })
    );

    // Collect results
    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({
          id: "unknown",
          input: null as any,
          output: undefined as any,
          error: result.reason instanceof Error ? result.reason : new Error(String(result.reason)),
        });
      }
    }

    // Respect concurrency limit
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between batches
    }
  }

  return results;
}

/**
 * Batch embeddings processing
 */
export async function batchEmbeddings(
  texts: string[],
  embedFn: (text: string) => Promise<{ vector: number[] }>,
  options?: {
    batchSize?: number;
    concurrency?: number;
  }
): Promise<Array<{ text: string; vector: number[]; error?: Error }>> {
  const items: BatchItem<string>[] = texts.map((text, idx) => ({
    id: `embed-${idx}`,
    data: text,
  }));

  const results = await processBatch(
    items,
    embedFn,
    {
      batchSize: options?.batchSize || 10,
      concurrency: options?.concurrency || 3,
    }
  );

  return results.map((result, idx) => ({
    text: texts[idx],
    vector: result.output?.vector || [],
    error: result.error,
  }));
}

/**
 * Batch reranking processing
 */
export async function batchReranking<T>(
  query: string,
  documents: Array<{ id: string; text: string }>,
  rerankFn: (query: string, docs: Array<{ id: string; text: string }>) => Promise<Array<{ id: string; score: number }>>,
  options?: {
    batchSize?: number;
  }
): Promise<Array<{ id: string; score: number; error?: Error }>> {
  const {
    batchSize = 20, // Reranking can handle larger batches
  } = options || {};

  // Process documents in batches
  const allResults: Array<{ id: string; score: number }> = [];

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    
    try {
      const batchResults = await rerankFn(query, batch);
      allResults.push(...batchResults);
    } catch (error) {
      // If batch fails, assign zero scores
      batch.forEach(doc => {
        allResults.push({
          id: doc.id,
          score: 0,
        });
      });
    }
  }

  return allResults.map(r => ({ ...r }));
}
