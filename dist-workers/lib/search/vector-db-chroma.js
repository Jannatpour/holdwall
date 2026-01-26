"use strict";
/**
 * ChromaDB Vector Database Integration
 *
 * Open-source embedding database for local deployments.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChromaVectorDB = void 0;
class ChromaVectorDB {
    constructor(url = process.env.CHROMA_URL || "http://localhost:8000", collectionName = process.env.CHROMA_COLLECTION || "holdwall", options) {
        this.apiKey = null;
        this.url = url.replace(/\/$/, ""); // Remove trailing slash
        this.collectionName = collectionName;
        this.apiKey = options?.apiKey || process.env.CHROMA_API_KEY || null;
        this.timeout = options?.timeout || 30000; // 30 seconds
        this.maxRetries = options?.maxRetries || 3;
        this.retryDelay = options?.retryDelay || 1000; // 1 second
    }
    /**
     * Add records with retry logic and connection pooling
     */
    async add(records) {
        if (records.length === 0) {
            return;
        }
        // Batch large requests
        const batchSize = 100;
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            await this.addBatch(batch);
        }
    }
    /**
     * Add a batch of records with retry logic
     */
    async addBatch(records) {
        let lastError = null;
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);
                const headers = {
                    "Content-Type": "application/json",
                };
                if (this.apiKey) {
                    headers["Authorization"] = `Bearer ${this.apiKey}`;
                }
                const response = await fetch(`${this.url}/api/v1/collections/${this.collectionName}/add`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        ids: records.map(r => r.id),
                        embeddings: records.map(r => r.embedding),
                        metadatas: records.map(r => r.metadata || {}),
                    }),
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`ChromaDB API error (${response.status}): ${errorText}`);
                }
                return; // Success
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                // Don't retry on client errors (4xx)
                if (error instanceof Error && error.message.includes("4")) {
                    throw lastError;
                }
                // Wait before retrying
                if (attempt < this.maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
                }
            }
        }
        throw new Error(`ChromaDB add failed after ${this.maxRetries} attempts: ${lastError?.message || "Unknown error"}`);
    }
    /**
     * Query with retry logic and connection pooling
     */
    async query(queryEmbeddings, options) {
        const { nResults = 10, where, include } = options || {};
        let lastError = null;
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);
                const headers = {
                    "Content-Type": "application/json",
                };
                if (this.apiKey) {
                    headers["Authorization"] = `Bearer ${this.apiKey}`;
                }
                const response = await fetch(`${this.url}/api/v1/collections/${this.collectionName}/query`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        queryEmbeddings: [queryEmbeddings],
                        nResults,
                        where,
                        include: include || ["metadatas", "distances"],
                    }),
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`ChromaDB API error (${response.status}): ${errorText}`);
                }
                const data = await response.json();
                const results = [];
                if (data.ids && data.ids[0]) {
                    for (let i = 0; i < data.ids[0].length; i++) {
                        results.push({
                            id: data.ids[0][i],
                            distance: data.distances?.[0]?.[i] || 0,
                            metadata: data.metadatas?.[0]?.[i],
                        });
                    }
                }
                return results;
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                // Don't retry on client errors (4xx)
                if (error instanceof Error && error.message.includes("4")) {
                    throw lastError;
                }
                // Wait before retrying
                if (attempt < this.maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
                }
            }
        }
        throw new Error(`ChromaDB query failed after ${this.maxRetries} attempts: ${lastError?.message || "Unknown error"}`);
    }
    /**
     * Delete with retry logic
     */
    async delete(ids) {
        if (ids.length === 0) {
            return;
        }
        let lastError = null;
        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);
                const headers = {
                    "Content-Type": "application/json",
                };
                if (this.apiKey) {
                    headers["Authorization"] = `Bearer ${this.apiKey}`;
                }
                const response = await fetch(`${this.url}/api/v1/collections/${this.collectionName}/delete`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        ids,
                    }),
                    signal: controller.signal,
                });
                clearTimeout(timeoutId);
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`ChromaDB API error (${response.status}): ${errorText}`);
                }
                return; // Success
            }
            catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                // Don't retry on client errors (4xx)
                if (error instanceof Error && error.message.includes("4")) {
                    throw lastError;
                }
                // Wait before retrying
                if (attempt < this.maxRetries - 1) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
                }
            }
        }
        throw new Error(`ChromaDB delete failed after ${this.maxRetries} attempts: ${lastError?.message || "Unknown error"}`);
    }
}
exports.ChromaVectorDB = ChromaVectorDB;
