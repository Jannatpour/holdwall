"use strict";
/**
 * Semantic Chunking
 *
 * Advanced chunking strategies preserving context better
 * than fixed-size methods.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticChunking = void 0;
class SemanticChunking {
    /**
     * Chunk text using semantic strategy
     */
    chunk(text, options = { strategy: "semantic" }) {
        switch (options.strategy) {
            case "semantic":
                return this.semanticChunk(text, options);
            case "sentence":
                return this.sentenceChunk(text, options);
            case "paragraph":
                return this.paragraphChunk(text, options);
            case "topic":
                return this.topicChunk(text, options);
            default:
                return this.semanticChunk(text, options);
        }
    }
    /**
     * Semantic chunking (preserves meaning)
     */
    semanticChunk(text, options) {
        const maxSize = options.maxChunkSize || 500;
        const overlap = options.overlap || 50;
        const chunks = [];
        const sentences = this.splitIntoSentences(text);
        let currentChunk = "";
        let startIndex = 0;
        let chunkId = 0;
        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            const potentialChunk = currentChunk + (currentChunk ? " " : "") + sentence;
            if (potentialChunk.length > maxSize && currentChunk) {
                // Save current chunk
                chunks.push({
                    id: `chunk-${chunkId++}`,
                    text: currentChunk.trim(),
                    startIndex,
                    endIndex: startIndex + currentChunk.length,
                    metadata: {
                        topic: this.extractTopic(currentChunk),
                        importance: this.calculateImportance(currentChunk),
                    },
                });
                // Start new chunk with overlap
                const overlapText = this.getOverlap(currentChunk, overlap);
                currentChunk = overlapText + " " + sentence;
                startIndex = startIndex + currentChunk.length - overlapText.length - sentence.length;
            }
            else {
                currentChunk = potentialChunk;
            }
        }
        // Add final chunk
        if (currentChunk) {
            chunks.push({
                id: `chunk-${chunkId++}`,
                text: currentChunk.trim(),
                startIndex,
                endIndex: startIndex + currentChunk.length,
                metadata: {
                    topic: this.extractTopic(currentChunk),
                    importance: this.calculateImportance(currentChunk),
                },
            });
        }
        return chunks;
    }
    /**
     * Sentence-based chunking
     */
    sentenceChunk(text, options) {
        const sentences = this.splitIntoSentences(text);
        const maxSentences = Math.ceil((options.maxChunkSize || 500) / 50); // ~50 chars per sentence
        const chunks = [];
        let startIndex = 0;
        for (let i = 0; i < sentences.length; i += maxSentences) {
            const chunkSentences = sentences.slice(i, i + maxSentences);
            const chunkText = chunkSentences.join(" ");
            chunks.push({
                id: `chunk-${i}`,
                text: chunkText,
                startIndex,
                endIndex: startIndex + chunkText.length,
            });
            startIndex += chunkText.length + 1;
        }
        return chunks;
    }
    /**
     * Paragraph-based chunking
     */
    paragraphChunk(text, options) {
        const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
        const chunks = [];
        let startIndex = 0;
        for (let i = 0; i < paragraphs.length; i++) {
            const paragraph = paragraphs[i].trim();
            chunks.push({
                id: `chunk-${i}`,
                text: paragraph,
                startIndex,
                endIndex: startIndex + paragraph.length,
            });
            startIndex += paragraph.length + 2; // +2 for \n\n
        }
        return chunks;
    }
    /**
     * Topic-based chunking
     */
    topicChunk(text, options) {
        // Split by topic shifts (simplified)
        const sentences = this.splitIntoSentences(text);
        const chunks = [];
        let currentTopic = "";
        let currentChunk = "";
        let startIndex = 0;
        let chunkId = 0;
        for (const sentence of sentences) {
            const sentenceTopic = this.extractTopic(sentence);
            if (currentTopic && sentenceTopic !== currentTopic && currentChunk) {
                // Topic shift - save chunk
                chunks.push({
                    id: `chunk-${chunkId++}`,
                    text: currentChunk.trim(),
                    startIndex,
                    endIndex: startIndex + currentChunk.length,
                    metadata: {
                        topic: currentTopic,
                    },
                });
                currentChunk = sentence;
                startIndex = startIndex + currentChunk.length;
            }
            else {
                currentChunk += (currentChunk ? " " : "") + sentence;
            }
            currentTopic = sentenceTopic;
        }
        // Add final chunk
        if (currentChunk) {
            chunks.push({
                id: `chunk-${chunkId++}`,
                text: currentChunk.trim(),
                startIndex,
                endIndex: startIndex + currentChunk.length,
                metadata: {
                    topic: currentTopic,
                },
            });
        }
        return chunks;
    }
    /**
     * Split into sentences
     */
    splitIntoSentences(text) {
        return text.split(/[.!?]+/).filter(s => s.trim().length > 0).map(s => s.trim());
    }
    /**
     * Extract topic from text
     */
    extractTopic(text) {
        // Simple extraction (in production, use NLP)
        const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 4);
        const frequencies = new Map();
        for (const word of words) {
            frequencies.set(word, (frequencies.get(word) || 0) + 1);
        }
        const topWord = Array.from(frequencies.entries())
            .sort((a, b) => b[1] - a[1])[0];
        return topWord?.[0] || "general";
    }
    /**
     * Calculate importance
     */
    calculateImportance(text) {
        // Simple heuristics (in production, use ML)
        let importance = 0.5;
        // Keywords boost
        const importantKeywords = ["important", "critical", "key", "essential", "significant"];
        const lower = text.toLowerCase();
        importance += importantKeywords.filter(kw => lower.includes(kw)).length * 0.1;
        // Length boost (longer = more important)
        importance += Math.min(0.2, text.length / 1000);
        return Math.min(1.0, importance);
    }
    /**
     * Get overlap text
     */
    getOverlap(text, overlapSize) {
        if (text.length <= overlapSize) {
            return text;
        }
        return text.substring(text.length - overlapSize);
    }
}
exports.SemanticChunking = SemanticChunking;
