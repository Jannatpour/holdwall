"use strict";
/**
 * Multimodal Extractor
 *
 * Extracts text from images and video transcripts for comprehensive content analysis.
 * Supports both browser and Node.js environments.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultimodalExtractor = void 0;
class MultimodalExtractor {
    constructor() {
        this.tesseract = null;
        this.openaiApiKey = null;
        // Try to load Tesseract for OCR
        try {
            this.tesseract = require("tesseract.js");
        }
        catch {
            // Tesseract not available
        }
        // Load OpenAI API key for video transcription
        this.openaiApiKey = process.env.OPENAI_API_KEY || null;
    }
    /**
     * Extract text from image using OCR
     */
    async extractTextFromImage(imageUrl, options) {
        if (!this.tesseract) {
            throw new Error("Tesseract.js not available. Install with: npm install tesseract.js");
        }
        try {
            const { data } = await this.tesseract.recognize(imageUrl, options?.language || "eng", {
                logger: () => { }, // Suppress logs
            });
            return {
                text: data.text.trim(),
                confidence: data.confidence / 100, // Normalize to 0-1
                language: data.language,
            };
        }
        catch (error) {
            throw new Error(`OCR extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    /**
     * Extract text from image using OpenAI Vision API (fallback)
     */
    async extractTextFromImageWithOpenAI(imageUrl, options) {
        if (!this.openaiApiKey) {
            throw new Error("OpenAI API key not configured");
        }
        try {
            const response = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.openaiApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: options?.model || "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: "Extract all text from this image. Return only the extracted text, no explanations.",
                                },
                                {
                                    type: "image_url",
                                    image_url: { url: imageUrl },
                                },
                            ],
                        },
                    ],
                    max_tokens: 1000,
                }),
            });
            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.statusText}`);
            }
            const data = await response.json();
            const text = data.choices[0]?.message?.content || "";
            return {
                text: text.trim(),
                confidence: 0.9, // OpenAI Vision is generally reliable
            };
        }
        catch (error) {
            throw new Error(`OpenAI Vision extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    /**
     * Extract transcript from video using OpenAI Whisper
     */
    async extractTranscriptFromVideo(videoUrl, options) {
        if (!this.openaiApiKey) {
            throw new Error("OpenAI API key not configured");
        }
        try {
            // For URL, we need to download first or use direct URL
            let file;
            if (typeof videoUrl === "string") {
                // Download video
                const response = await fetch(videoUrl);
                if (!response.ok) {
                    throw new Error(`Failed to download video: ${response.statusText}`);
                }
                file = await response.blob();
            }
            else {
                file = new Blob([videoUrl]);
            }
            // Create form data
            const formData = new FormData();
            formData.append("file", file, "video.mp4");
            formData.append("model", "whisper-1");
            if (options?.language) {
                formData.append("language", options.language);
            }
            if (options?.responseFormat) {
                formData.append("response_format", options.responseFormat);
            }
            const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${this.openaiApiKey}`,
                },
                body: formData,
            });
            if (!response.ok) {
                throw new Error(`OpenAI Whisper API error: ${response.statusText}`);
            }
            const data = await response.json();
            // Parse response based on format
            let transcript = "";
            let segments = undefined;
            if (options?.responseFormat === "verbose_json" && typeof data === "object") {
                transcript = data.text || "";
                segments = data.segments?.map((seg) => ({
                    start: seg.start,
                    end: seg.end,
                    text: seg.text,
                }));
            }
            else if (typeof data === "string") {
                transcript = data;
            }
            else if (data.text) {
                transcript = data.text;
            }
            return {
                transcript: transcript.trim(),
                duration: segments ? segments[segments.length - 1]?.end || 0 : 0,
                segments,
            };
        }
        catch (error) {
            throw new Error(`Video transcription failed: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
    }
    /**
     * Extract text from multiple images
     */
    async extractTextFromImages(imageUrls, options) {
        const results = [];
        for (const imageUrl of imageUrls) {
            try {
                let result;
                if (options?.useOpenAI && typeof imageUrl === "string") {
                    result = await this.extractTextFromImageWithOpenAI(imageUrl, {
                        model: "gpt-4o",
                    });
                }
                else {
                    result = await this.extractTextFromImage(imageUrl, {
                        language: options?.language,
                    });
                }
                results.push(result);
            }
            catch (error) {
                console.warn(`Failed to extract text from image:`, error);
                results.push({
                    text: "",
                    confidence: 0,
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        }
        return results;
    }
    /**
     * Check if OCR is available
     */
    isOCRAvailable() {
        return this.tesseract !== null;
    }
    /**
     * Check if OpenAI Vision is available
     */
    isOpenAIAvailable() {
        return this.openaiApiKey !== null;
    }
    /**
     * Extract image metadata (dimensions, format, quality, etc.)
     */
    async extractImageMetadata(url, file) {
        try {
            if (file) {
                // Extract from Blob if available
                const imageBitmap = await createImageBitmap(file);
                return {
                    width: imageBitmap.width,
                    height: imageBitmap.height,
                    size: file.size,
                };
            }
            else if (url) {
                // Fetch image and extract metadata
                const response = await fetch(url, { method: "HEAD" });
                const contentType = response.headers.get("content-type") || "";
                const contentLength = response.headers.get("content-length");
                // Load image to get dimensions using Image element
                const img = document.createElement("img");
                await new Promise((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = () => reject(new Error("Failed to load image"));
                    img.src = url;
                });
                // Try to extract quality/color space from image data if possible
                const canvas = document.createElement("canvas");
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext("2d");
                let colorSpace;
                if (ctx) {
                    try {
                        ctx.drawImage(img, 0, 0);
                        const imageData = ctx.getImageData(0, 0, img.width, img.height);
                        // Check if image has alpha channel
                        const hasAlpha = imageData.data.length === img.width * img.height * 4;
                        colorSpace = hasAlpha ? "RGBA" : "RGB";
                    }
                    catch {
                        // Canvas operations may fail due to CORS
                    }
                }
                return {
                    width: img.width,
                    height: img.height,
                    format: contentType.split("/")[1] || "unknown",
                    size: contentLength ? parseInt(contentLength, 10) : undefined,
                    colorSpace,
                };
            }
        }
        catch (error) {
            console.warn("Image metadata extraction failed:", error);
        }
        return {};
    }
    /**
     * Extract video metadata (duration, resolution, frame rate, etc.)
     */
    async extractVideoMetadata(url, file) {
        try {
            if (file) {
                // Extract from Blob
                if (typeof window !== "undefined" && typeof URL !== "undefined") {
                    // Browser environment - use video element
                    const videoUrl = URL.createObjectURL(file);
                    try {
                        const metadata = await this.extractVideoMetadataFromElement(videoUrl);
                        URL.revokeObjectURL(videoUrl);
                        return {
                            ...metadata,
                            size: file.size,
                            format: file.type.split("/")[1] || "unknown",
                        };
                    }
                    catch {
                        URL.revokeObjectURL(videoUrl);
                        return {
                            size: file.size,
                            format: file.type.split("/")[1] || "unknown",
                        };
                    }
                }
                else {
                    // Node.js environment - return basic info
                    // For full metadata extraction, use ffmpeg or similar
                    return {
                        size: file.size,
                        format: file.type.split("/")[1] || "unknown",
                    };
                }
            }
            else if (url) {
                // Extract from URL using video element
                const metadata = await this.extractVideoMetadataFromElement(url);
                const response = await fetch(url, { method: "HEAD" });
                const contentType = response.headers.get("content-type") || "";
                const contentLength = response.headers.get("content-length");
                return {
                    ...metadata,
                    format: contentType.split("/")[1] || "unknown",
                    size: contentLength ? parseInt(contentLength, 10) : undefined,
                };
            }
        }
        catch (error) {
            console.warn("Video metadata extraction failed:", error);
        }
        return {};
    }
    /**
     * Extract video metadata using HTML5 video element (browser only)
     */
    async extractVideoMetadataFromElement(url) {
        if (typeof window === "undefined" || typeof document === "undefined") {
            // Node.js environment - cannot use video element
            return {};
        }
        return new Promise((resolve) => {
            const video = document.createElement("video");
            video.preload = "metadata";
            video.onloadedmetadata = () => {
                resolve({
                    duration: video.duration || undefined,
                    width: video.videoWidth || undefined,
                    height: video.videoHeight || undefined,
                });
                video.src = "";
            };
            video.onerror = () => {
                resolve({});
                video.src = "";
            };
            video.src = url;
        });
    }
    /**
     * Extract audio metadata (duration, sample rate, channels, etc.)
     *
     * Supports multiple extraction methods:
     * - FFmpeg/FFprobe (if available via API or local installation)
     * - HTML5 Audio API (for browser environments)
     * - HTTP HEAD request (basic metadata)
     * - File size and MIME type (fallback)
     */
    async extractAudioMetadata(url, file) {
        try {
            // Method 1: Try FFprobe API endpoint (if available)
            const ffprobeUrl = process.env.FFPROBE_API_URL;
            if (ffprobeUrl && url) {
                try {
                    const response = await fetch(`${ffprobeUrl}/probe`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ url }),
                    });
                    if (response.ok) {
                        const data = await response.json();
                        if (data.format && data.streams && data.streams[0]) {
                            const stream = data.streams[0];
                            return {
                                duration: data.format.duration ? parseFloat(data.format.duration) : undefined,
                                sampleRate: stream.sample_rate ? parseInt(stream.sample_rate, 10) : undefined,
                                channels: stream.channels ? parseInt(stream.channels, 10) : undefined,
                                format: stream.codec_name || data.format.format_name?.split(",")[0],
                                bitrate: data.format.bit_rate ? parseInt(data.format.bit_rate, 10) : undefined,
                                size: data.format.size ? parseInt(data.format.size, 10) : undefined,
                            };
                        }
                    }
                }
                catch (ffprobeError) {
                    // Continue to next method
                }
            }
            // Method 2: For Blob files, try to extract using HTML5 Audio API (browser only)
            if (file && typeof window !== "undefined") {
                try {
                    const audioUrl = URL.createObjectURL(file);
                    const audio = new Audio(audioUrl);
                    return new Promise((resolve) => {
                        audio.addEventListener("loadedmetadata", () => {
                            URL.revokeObjectURL(audioUrl);
                            resolve({
                                duration: audio.duration || undefined,
                                format: file.type.split("/")[1] || "unknown",
                                size: file.size,
                            });
                        });
                        audio.addEventListener("error", () => {
                            URL.revokeObjectURL(audioUrl);
                            // Fallback to basic info
                            resolve({
                                size: file.size,
                                format: file.type.split("/")[1] || "unknown",
                            });
                        });
                        // Timeout after 5 seconds
                        setTimeout(() => {
                            URL.revokeObjectURL(audioUrl);
                            resolve({
                                size: file.size,
                                format: file.type.split("/")[1] || "unknown",
                            });
                        }, 5000);
                    });
                }
                catch (audioError) {
                    // Fallback to basic info
                }
            }
            // Method 3: Fetch HTTP headers for basic metadata
            if (url) {
                try {
                    const response = await fetch(url, { method: "HEAD" });
                    const contentType = response.headers.get("content-type") || "";
                    const contentLength = response.headers.get("content-length");
                    const acceptRanges = response.headers.get("accept-ranges");
                    // Try to get duration from Content-Range header if available
                    const contentRange = response.headers.get("content-range");
                    let duration;
                    if (contentRange) {
                        const match = contentRange.match(/bytes \d+-\d+\/(\d+)/);
                        if (match) {
                            // Estimate duration from file size (rough approximation)
                            const size = parseInt(match[1], 10);
                            // Rough estimate: assume 128kbps for MP3, adjust for other formats
                            const estimatedBitrate = contentType.includes("mp3") ? 128000 : 192000;
                            duration = size / (estimatedBitrate / 8);
                        }
                    }
                    return {
                        duration,
                        format: contentType.split("/")[1]?.split(";")[0] || "unknown",
                        size: contentLength ? parseInt(contentLength, 10) : undefined,
                    };
                }
                catch (fetchError) {
                    // Continue to fallback
                }
            }
            // Method 4: Fallback - return basic info from file
            if (file) {
                return {
                    size: file.size,
                    format: file.type.split("/")[1] || "unknown",
                };
            }
        }
        catch (error) {
            console.warn("Audio metadata extraction failed:", error);
        }
        return {};
    }
}
exports.MultimodalExtractor = MultimodalExtractor;
