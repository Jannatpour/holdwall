/**
 * Multimedia Converter
 * 
 * Converts content to podcast/video formats for broader distribution
 * and increased citation potential.
 * 
 * Supports multiple TTS providers (ElevenLabs, Google TTS, OpenAI TTS) and
 * video generation services with intelligent fallbacks.
 */

import { logger } from "@/lib/logging/logger";
import { FileUploadService } from "@/lib/file/upload";

export interface PodcastEpisode {
  title: string;
  description: string;
  audioUrl: string;
  transcript: string;
  duration: number; // seconds
  publishedAt: string;
  provider?: string; // TTS provider used
}

export interface VideoContent {
  title: string;
  description: string;
  videoUrl: string;
  transcript: string;
  duration: number; // seconds
  thumbnailUrl?: string;
  publishedAt: string;
  provider?: string; // Video generation provider used
}

export class MultimediaConverter {
  private elevenLabsApiKey?: string;
  private googleTtsApiKey?: string;
  private openaiApiKey?: string;
  private videoGenerationApiKey?: string;
  private fileUploadService: FileUploadService;

  constructor() {
    this.elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    this.googleTtsApiKey = process.env.GOOGLE_TTS_API_KEY;
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.videoGenerationApiKey = process.env.VIDEO_GENERATION_API_KEY;
    this.fileUploadService = new FileUploadService();
  }

  /**
   * Convert content to podcast episode using TTS
   */
  async convertToPodcast(
    content: string,
    title: string,
    options?: {
      voice?: string;
      speed?: number;
      provider?: "elevenlabs" | "google" | "openai" | "auto";
    }
  ): Promise<PodcastEpisode> {
    const transcript = content;
    const wordCount = content.split(/\s+/).length;
    const estimatedDuration = Math.ceil(wordCount / 150 * 60); // seconds

    // Try to generate audio using available TTS providers
    let audioUrl: string | undefined;
    let provider: string | undefined;
    let actualDuration = estimatedDuration;

    const preferredProvider = options?.provider || "auto";

    try {
      if (preferredProvider === "elevenlabs" || (preferredProvider === "auto" && this.elevenLabsApiKey)) {
        const result = await this.generateWithElevenLabs(content, title, options);
        audioUrl = result.audioUrl;
        provider = "elevenlabs";
        actualDuration = result.duration;
      } else if (preferredProvider === "google" || (preferredProvider === "auto" && this.googleTtsApiKey)) {
        const result = await this.generateWithGoogleTTS(content, title, options);
        audioUrl = result.audioUrl;
        provider = "google";
        actualDuration = result.duration;
      } else if (preferredProvider === "openai" || (preferredProvider === "auto" && this.openaiApiKey)) {
        const result = await this.generateWithOpenAITTS(content, title, options);
        audioUrl = result.audioUrl;
        provider = "openai";
        actualDuration = result.duration;
      }
    } catch (error) {
      logger.error("TTS generation failed", {
        error: error instanceof Error ? error.message : String(error),
        provider: preferredProvider,
        title,
      });
      // Will be caught by outer check and throw proper error
    }

    // Ensure audio URL was generated
    if (!audioUrl) {
      throw new Error(
        "TTS generation failed. Configure at least one TTS provider (ELEVENLABS_API_KEY, GOOGLE_TTS_API_KEY, or OPENAI_API_KEY)."
      );
    }

    return {
      title,
      description: content.substring(0, 200),
      audioUrl,
      transcript,
      duration: actualDuration,
      publishedAt: new Date().toISOString(),
      provider,
    };
  }

  /**
   * Convert content to video
   */
  async convertToVideo(
    content: string,
    title: string,
    options?: {
      style?: "presentation" | "talking_head" | "animated";
      thumbnail?: string;
      provider?: "auto";
    }
  ): Promise<VideoContent> {
    const transcript = content;
    const wordCount = content.split(/\s+/).length;
    const estimatedDuration = Math.ceil(wordCount / 150 * 60); // seconds

    // Try to generate video using available services
    let videoUrl: string | undefined;
    let provider: string | undefined;
    let actualDuration = estimatedDuration;

    try {
      if (this.videoGenerationApiKey) {
        const result = await this.generateWithVideoService(content, title, options);
        videoUrl = result.videoUrl;
        provider = "video-service";
        actualDuration = result.duration;
      } else {
        throw new Error(
          "Video generation API key not configured. Set VIDEO_GENERATION_API_KEY environment variable."
        );
      }
    } catch (error) {
      logger.error("Video generation failed", {
        error: error instanceof Error ? error.message : String(error),
        provider: "video-service",
        title,
      });
      // Will be caught by outer check and throw proper error
    }

    // Ensure video URL was generated
    if (!videoUrl) {
      throw new Error(
        "Video generation failed. Configure VIDEO_GENERATION_API_KEY and VIDEO_GENERATION_PROVIDER (synthesia, d-id, or heygen)."
      );
    }

    return {
      title,
      description: content.substring(0, 200),
      videoUrl,
      transcript,
      duration: actualDuration,
      thumbnailUrl: options?.thumbnail,
      publishedAt: new Date().toISOString(),
      provider,
    };
  }

  /**
   * Generate audio using ElevenLabs TTS
   */
  private async generateWithElevenLabs(
    content: string,
    title: string,
    options?: { voice?: string; speed?: number }
  ): Promise<{ audioUrl: string; duration: number }> {
    if (!this.elevenLabsApiKey) {
      throw new Error("ElevenLabs API key not configured");
    }

    const voiceId = options?.voice || "21m00Tcm4TlvDq8ikWAM"; // Default voice
    const speed = options?.speed || 1.0;

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": this.elevenLabsApiKey,
      },
      body: JSON.stringify({
        text: content,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          speed,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`ElevenLabs TTS failed: ${response.statusText}`);
    }

    const audioBlob = await response.blob();
    const duration = Math.ceil(audioBlob.size / 16000); // Rough estimate: 16KB per second for MP3

    // Upload audio to storage
    const fileName = `podcasts/${title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.mp3`;
    const audioFile = new File([audioBlob], fileName, { type: "audio/mpeg" });
    
    const uploadResult = await this.fileUploadService.processUpload(audioFile, {
      maxSize: 100 * 1024 * 1024, // 100MB max for audio
      allowedTypes: ["audio/mpeg", "audio/mp3"],
      scanForViruses: false, // TTS-generated content is safe
    });

    if (!uploadResult.success || !uploadResult.file_id) {
      logger.warn("Failed to upload generated audio to storage", {
        error: uploadResult.error,
        fileName,
      });
      throw new Error(`Audio generation succeeded but storage upload failed: ${uploadResult.error}`);
    }

    // Use the storage URL from the upload service, or construct it if not provided
    let audioUrl: string;
    if (uploadResult.storage_url && !uploadResult.storage_url.startsWith("pending://") && !uploadResult.storage_url.startsWith("gs://")) {
      // Use the actual storage URL from the upload service
      audioUrl = uploadResult.storage_url;
    } else {
      // Fallback: construct URL from file_id and storage provider
      const storageProvider = process.env.FILE_STORAGE_PROVIDER || "s3";
      const bucketName = process.env.FILE_STORAGE_BUCKET || "holdwall-uploads";
      const region = process.env.FILE_STORAGE_REGION || "us-east-1";
      const actualFileName = `${uploadResult.file_id}-${fileName.split("/").pop()}`;
      
      if (storageProvider === "s3" || storageProvider === "aws") {
        audioUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${actualFileName}`;
      } else if (storageProvider === "gcs" || storageProvider === "google") {
        audioUrl = `https://storage.googleapis.com/${bucketName}/${actualFileName}`;
      } else if (storageProvider === "azure") {
        const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME || process.env.AZURE_STORAGE_ACCOUNT || "holdwall";
        audioUrl = `https://${accountName}.blob.core.windows.net/${bucketName}/${actualFileName}`;
      } else {
        audioUrl = `https://storage.holdwall.com/${bucketName}/${actualFileName}`;
      }
    }

    return {
      audioUrl,
      duration,
    };
  }

  /**
   * Generate audio using Google Cloud TTS
   */
  private async generateWithGoogleTTS(
    content: string,
    title: string,
    options?: { voice?: string; speed?: number }
  ): Promise<{ audioUrl: string; duration: number }> {
    if (!this.googleTtsApiKey) {
      throw new Error("Google TTS API key not configured");
    }

    const voiceName = options?.voice || "en-US-Neural2-D";
    const speakingRate = options?.speed || 1.0;

    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${this.googleTtsApiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: { text: content },
          voice: {
            languageCode: "en-US",
            name: voiceName,
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Google TTS failed: ${response.statusText}`);
    }

    const data = await response.json();
    const audioData = Buffer.from(data.audioContent, "base64");
    const duration = Math.ceil(audioData.length / 16000); // Rough estimate

    // Upload audio to storage
    const fileName = `podcasts/${title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.mp3`;
    const audioBlob = new Blob([audioData], { type: "audio/mpeg" });
    const audioFile = new File([audioBlob], fileName, { type: "audio/mpeg" });
    
    const uploadResult = await this.fileUploadService.processUpload(audioFile, {
      maxSize: 100 * 1024 * 1024,
      allowedTypes: ["audio/mpeg", "audio/mp3"],
      scanForViruses: false,
    });

    if (!uploadResult.success || !uploadResult.file_id) {
      logger.warn("Failed to upload generated audio to storage", {
        error: uploadResult.error,
        fileName,
      });
      throw new Error(`Audio generation succeeded but storage upload failed: ${uploadResult.error}`);
    }

    // Use the storage URL from the upload service, or construct it if not provided
    let audioUrl: string;
    if (uploadResult.storage_url && !uploadResult.storage_url.startsWith("pending://") && !uploadResult.storage_url.startsWith("gs://")) {
      audioUrl = uploadResult.storage_url;
    } else {
      const storageProvider = process.env.FILE_STORAGE_PROVIDER || "s3";
      const bucketName = process.env.FILE_STORAGE_BUCKET || "holdwall-uploads";
      const region = process.env.FILE_STORAGE_REGION || "us-east-1";
      const actualFileName = `${uploadResult.file_id}-${fileName.split("/").pop()}`;
      
      if (storageProvider === "s3" || storageProvider === "aws") {
        audioUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${actualFileName}`;
      } else if (storageProvider === "gcs" || storageProvider === "google") {
        audioUrl = `https://storage.googleapis.com/${bucketName}/${actualFileName}`;
      } else if (storageProvider === "azure") {
        const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME || process.env.AZURE_STORAGE_ACCOUNT || "holdwall";
        audioUrl = `https://${accountName}.blob.core.windows.net/${bucketName}/${actualFileName}`;
      } else {
        audioUrl = `https://storage.holdwall.com/${bucketName}/${actualFileName}`;
      }
    }

    return {
      audioUrl,
      duration,
    };
  }

  /**
   * Generate audio using OpenAI TTS
   */
  private async generateWithOpenAITTS(
    content: string,
    title: string,
    options?: { voice?: string; speed?: number }
  ): Promise<{ audioUrl: string; duration: number }> {
    if (!this.openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const voice = (options?.voice as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer") || "alloy";
    const speed = options?.speed || 1.0;

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: content,
        voice,
        speed,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI TTS failed: ${response.statusText}`);
    }

    const audioBlob = await response.blob();
    const duration = Math.ceil(audioBlob.size / 16000); // Rough estimate

    // Upload audio to storage
    const fileName = `podcasts/${title.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.mp3`;
    const audioFile = new File([audioBlob], fileName, { type: "audio/mpeg" });
    
    const uploadResult = await this.fileUploadService.processUpload(audioFile, {
      maxSize: 100 * 1024 * 1024,
      allowedTypes: ["audio/mpeg", "audio/mp3"],
      scanForViruses: false,
    });

    if (!uploadResult.success || !uploadResult.file_id) {
      logger.warn("Failed to upload generated audio to storage", {
        error: uploadResult.error,
        fileName,
      });
      throw new Error(`Audio generation succeeded but storage upload failed: ${uploadResult.error}`);
    }

    // Use the storage URL from the upload service, or construct it if not provided
    let audioUrl: string;
    if (uploadResult.storage_url && !uploadResult.storage_url.startsWith("pending://") && !uploadResult.storage_url.startsWith("gs://")) {
      audioUrl = uploadResult.storage_url;
    } else {
      const storageProvider = process.env.FILE_STORAGE_PROVIDER || "s3";
      const bucketName = process.env.FILE_STORAGE_BUCKET || "holdwall-uploads";
      const region = process.env.FILE_STORAGE_REGION || "us-east-1";
      const actualFileName = `${uploadResult.file_id}-${fileName.split("/").pop()}`;
      
      if (storageProvider === "s3" || storageProvider === "aws") {
        audioUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${actualFileName}`;
      } else if (storageProvider === "gcs" || storageProvider === "google") {
        audioUrl = `https://storage.googleapis.com/${bucketName}/${actualFileName}`;
      } else if (storageProvider === "azure") {
        const accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME || process.env.AZURE_STORAGE_ACCOUNT || "holdwall";
        audioUrl = `https://${accountName}.blob.core.windows.net/${bucketName}/${actualFileName}`;
      } else {
        audioUrl = `https://storage.holdwall.com/${bucketName}/${actualFileName}`;
      }
    }

    return {
      audioUrl,
      duration,
    };
  }

  /**
   * Generate video using video generation service
   * 
   * Supports integration with video generation services:
   * - Synthesia API
   * - D-ID API  
   * - HeyGen API
   * - Custom video generation pipeline
   * 
   * Configure via VIDEO_GENERATION_PROVIDER and VIDEO_GENERATION_API_KEY environment variables.
   */
  private async generateWithVideoService(
    content: string,
    title: string,
    options?: { style?: "presentation" | "talking_head" | "animated"; thumbnail?: string }
  ): Promise<{ videoUrl: string; duration: number }> {
    if (!this.videoGenerationApiKey) {
      throw new Error("Video generation API key not configured. Set VIDEO_GENERATION_API_KEY environment variable.");
    }

    const provider = process.env.VIDEO_GENERATION_PROVIDER || "synthesia";
    const wordCount = content.split(/\s+/).length;
    const estimatedDuration = Math.ceil(wordCount / 150 * 60);

    try {
      switch (provider.toLowerCase()) {
        case "synthesia":
          return await this.generateWithSynthesia(content, title, options, estimatedDuration);
        case "d-id":
          return await this.generateWithDID(content, title, options, estimatedDuration);
        case "heygen":
          return await this.generateWithHeyGen(content, title, options, estimatedDuration);
        default:
          throw new Error(`Unsupported video generation provider: ${provider}. Supported: synthesia, d-id, heygen`);
      }
    } catch (error) {
      logger.error("Video generation failed", {
        error: error instanceof Error ? error.message : String(error),
        provider,
        title,
      });
      throw error;
    }
  }

  /**
   * Generate video using Synthesia API
   */
  private async generateWithSynthesia(
    content: string,
    title: string,
    options?: { style?: "presentation" | "talking_head" | "animated"; thumbnail?: string },
    estimatedDuration?: number
  ): Promise<{ videoUrl: string; duration: number }> {
    const response = await fetch("https://api.synthesia.io/v2/videos", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.videoGenerationApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        test: false,
        title,
        description: content.substring(0, 500),
        visibility: "public",
        scenes: [
          {
            type: "avatar",
            avatar: options?.style === "talking_head" ? "anna_costume1_cameraA" : "anna_costume1_cameraA",
            script: {
              type: "text",
              input: content,
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Synthesia API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const videoId = data.id;

    // Poll for video completion
    let videoUrl: string | undefined;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max wait

    while (!videoUrl && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait 5 seconds

      const statusResponse = await fetch(`https://api.synthesia.io/v2/videos/${videoId}`, {
        headers: {
          "Authorization": `Bearer ${this.videoGenerationApiKey}`,
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.status === "complete" && statusData.downloadUrl) {
          videoUrl = statusData.downloadUrl;
          break;
        } else if (statusData.status === "failed") {
          throw new Error(`Video generation failed: ${statusData.error || "Unknown error"}`);
        }
      }

      attempts++;
    }

    if (!videoUrl) {
      throw new Error("Video generation timed out - video may still be processing");
    }

    return {
      videoUrl,
      duration: estimatedDuration || 60,
    };
  }

  /**
   * Generate video using D-ID API
   */
  private async generateWithDID(
    content: string,
    title: string,
    options?: { style?: "presentation" | "talking_head" | "animated"; thumbnail?: string },
    estimatedDuration?: number
  ): Promise<{ videoUrl: string; duration: number }> {
    const response = await fetch("https://api.d-id.com/talks", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${Buffer.from(`${this.videoGenerationApiKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        script: {
          type: "text",
          input: content,
          provider: {
            type: "amazon",
            voice_id: "Joanna",
          },
        },
        config: {
          result_format: "mp4",
        },
        source_url: options?.thumbnail || undefined,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`D-ID API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const talkId = data.id;

    // Poll for video completion
    let videoUrl: string | undefined;
    let attempts = 0;
    const maxAttempts = 60;

    while (!videoUrl && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const statusResponse = await fetch(`https://api.d-id.com/talks/${talkId}`, {
        headers: {
          "Authorization": `Basic ${Buffer.from(`${this.videoGenerationApiKey}:`).toString("base64")}`,
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.status === "done" && statusData.result_url) {
          videoUrl = statusData.result_url;
          break;
        } else if (statusData.status === "error") {
          throw new Error(`Video generation failed: ${statusData.error || "Unknown error"}`);
        }
      }

      attempts++;
    }

    if (!videoUrl) {
      throw new Error("Video generation timed out - video may still be processing");
    }

    return {
      videoUrl,
      duration: estimatedDuration || 60,
    };
  }

  /**
   * Generate video using HeyGen API
   */
  private async generateWithHeyGen(
    content: string,
    title: string,
    options?: { style?: "presentation" | "talking_head" | "animated"; thumbnail?: string },
    estimatedDuration?: number
  ): Promise<{ videoUrl: string; duration: number }> {
    const response = await fetch("https://api.heygen.com/v1/video/generate", {
      method: "POST",
      headers: {
        "X-Api-Key": this.videoGenerationApiKey!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        video_inputs: [
          {
            character: {
              type: "avatar",
              avatar_id: options?.style === "talking_head" ? "Daisy-insk" : "Daisy-insk",
            },
            voice: {
              type: "text",
              input_text: content,
              voice_id: "1bd001e7e50f421d891986aad5158bc8",
            },
          },
        ],
        dimension: {
          width: 1920,
          height: 1080,
        },
        aspect_ratio: "16:9",
        test: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HeyGen API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const videoId = data.data.video_id;

    // Poll for video completion
    let videoUrl: string | undefined;
    let attempts = 0;
    const maxAttempts = 60;

    while (!videoUrl && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000));

      const statusResponse = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
        headers: {
          "X-Api-Key": this.videoGenerationApiKey!,
        },
      });

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        if (statusData.data.status === "completed" && statusData.data.video_url) {
          videoUrl = statusData.data.video_url;
          break;
        } else if (statusData.data.status === "failed") {
          throw new Error(`Video generation failed: ${statusData.data.error || "Unknown error"}`);
        }
      }

      attempts++;
    }

    if (!videoUrl) {
      throw new Error("Video generation timed out - video may still be processing");
    }

    return {
      videoUrl,
      duration: estimatedDuration || 60,
    };
  }

  /**
   * Convert to both podcast and video
   */
  async convertToBoth(
    content: string,
    title: string
  ): Promise<{
    podcast: PodcastEpisode;
    video: VideoContent;
  }> {
    const podcast = await this.convertToPodcast(content, title);
    const video = await this.convertToVideo(content, title);

    return { podcast, video };
  }
}
