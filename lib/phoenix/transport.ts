/**
 * LMOS (Language Model Operating System) Transport Abstraction
 * 
 * Transport-agnostic meta-protocol that allows agents to switch communication
 * standards (HTTP, SSE, WebSocket, MQTT) without changing application logic.
 * Inspired by Eclipse LMOS and Phoenix Mesh patterns.
 * 
 * Phase A (MVP): Resilient online comms via WebSocket + offline-first local cache
 * Phase B: Peer-assisted continuity via WebRTC data channels (opt-in)
 * Phase C: Pluggable gateway for constrained networks (enterprise/on-prem)
 * Phase D: MQTT support for IoT and edge deployments
 * 
 * Keeps ACP envelope unchanged across all transport protocols
 */

import type { ACPMessageEnvelope, ACPTransport } from "@/lib/acp/types";
import { HTTPACPTransport } from "@/lib/acp/client";
import { logger } from "@/lib/logging/logger";

/**
 * Offline-first local cache
 */
export interface MessageCache {
  store(envelope: ACPMessageEnvelope): Promise<void>;
  retrieve(message_id: string): Promise<ACPMessageEnvelope | null>;
  listPending(): Promise<ACPMessageEnvelope[]>;
  markSent(message_id: string): Promise<void>;
  clear(): Promise<void>;
}

export class IndexedDBMessageCache implements MessageCache {
  private dbName = "holdwall_acp_cache";
  private storeName = "messages";

  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: "message_id" });
        }
      };
    });
  }

  async store(envelope: ACPMessageEnvelope): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const request = store.put({ ...envelope, cached_at: new Date().toISOString() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async retrieve(message_id: string): Promise<ACPMessageEnvelope | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const request = store.get(message_id);
      request.onsuccess = () => resolve((request.result as ACPMessageEnvelope) || null);
      request.onerror = () => reject(request.error);
    });
  }

  async listPending(): Promise<ACPMessageEnvelope[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readonly");
      const store = tx.objectStore(this.storeName);
      const request = store.getAll();
      request.onsuccess = () => {
        const all = request.result as ACPMessageEnvelope[];
        // Filter out sent messages (in production, add sent flag)
        resolve(all);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markSent(message_id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, "readwrite");
      const store = tx.objectStore(this.storeName);
      const getRequest = store.get(message_id);
      getRequest.onsuccess = () => {
        const message = getRequest.result as ACPMessageEnvelope & { sent?: boolean };
        if (message) {
          message.sent = true;
          const putRequest = store.put(message);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    const tx = db.transaction(this.storeName, "readwrite");
    const store = tx.objectStore(this.storeName);
    await store.clear();
  }
}

/**
 * WebSocket ACP Transport (Phase A)
 */
export class WebSocketACPTransport implements ACPTransport {
  private ws: WebSocket | null = null;
  private cache: MessageCache;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private handlers: Array<(envelope: ACPMessageEnvelope) => Promise<void>> = [];

  constructor(
    private url: string,
    cache?: MessageCache
  ) {
    this.cache = cache || new IndexedDBMessageCache();
    this.connect();
  }

  private connect(): void {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        logger.info("WebSocket connected", { url: this.url });
        this.reconnectAttempts = 0;
        this.flushPending();
      };

      this.ws.onmessage = async (event) => {
        try {
          const envelope: ACPMessageEnvelope = JSON.parse(event.data);
          for (const handler of this.handlers) {
            await handler(envelope);
          }
        } catch (error) {
          logger.error("Error handling WebSocket message", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            url: this.url,
          });
        }
      };

      this.ws.onerror = (error) => {
        logger.error("WebSocket error", {
          error: error instanceof Error ? error.message : String(error),
          url: this.url,
        });
      };

      this.ws.onclose = () => {
        logger.info("WebSocket closed, attempting reconnect", {
          url: this.url,
          reconnectAttempts: this.reconnectAttempts,
        });
        this.reconnect();
      };
    } catch (error) {
      logger.error("Error connecting WebSocket", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        url: this.url,
      });
      this.reconnect();
    }
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error("Max reconnect attempts reached", {
        url: this.url,
        maxAttempts: this.maxReconnectAttempts,
      });
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  private async flushPending(): Promise<void> {
    const pending = await this.cache.listPending();
    for (const envelope of pending) {
      await this.send(envelope);
    }
  }

  async send(envelope: ACPMessageEnvelope): Promise<void> {
    // Always cache first (offline-first)
    await this.cache.store(envelope);

    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(envelope));
        await this.cache.markSent(envelope.message_id);
      } catch (error) {
        logger.error("Error sending message", {
          error: error instanceof Error ? error.message : String(error),
          messageId: envelope.message_id,
          url: this.url,
        });
        // Message remains in cache for retry
      }
    } else {
      logger.debug("WebSocket not connected, message cached for later", {
        messageId: envelope.message_id,
        url: this.url,
      });
      // Message will be sent when connection is restored
    }
  }

  async receive(
    handler: (envelope: ACPMessageEnvelope) => Promise<void>
  ): Promise<void> {
    this.handlers.push(handler);
  }

  async close(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

/**
 * Phase B: WebRTC Peer Transport
 * 
 * Production implementation for peer-to-peer agent communication using WebRTC.
 * Uses WebSocket server for signaling, with STUN/TURN server support.
 */
export class WebRTCPeerTransport implements ACPTransport {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private signalingWs: WebSocket | null = null;
  private handlers: Array<(envelope: ACPMessageEnvelope) => Promise<void>> = [];
  private signalingUrl: string;
  private stunServers: RTCIceServer[];
  private turnServers: RTCIceServer[];

  constructor(
    signalingUrl?: string,
    stunServers?: string[],
    turnServers?: Array<{ urls: string; username?: string; credential?: string }>
  ) {
    this.signalingUrl = signalingUrl || (typeof window !== "undefined" 
      ? `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/api/ws`
      : "ws://localhost:3000/api/ws");
    
    // Default STUN servers
    this.stunServers = (stunServers || [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
    ]).map(url => ({ urls: url }));

    // TURN servers from environment or default
    this.turnServers = (turnServers || process.env.TURN_SERVERS 
      ? JSON.parse(process.env.TURN_SERVERS || "[]")
      : []).map((config: any) => ({
        urls: config.urls,
        username: config.username,
        credential: config.credential,
      }));

    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (typeof window === "undefined") {
      // Server-side: WebRTC not available, fallback to WebSocket
      logger.warn("WebRTC not available on server, using WebSocket fallback");
      return;
    }

    try {
      // Initialize signaling WebSocket
      this.signalingWs = new WebSocket(this.signalingUrl);
      
      this.signalingWs.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === "offer") {
            await this.handleOffer(message.offer);
          } else if (message.type === "answer") {
            await this.handleAnswer(message.answer);
          } else if (message.type === "ice-candidate") {
            await this.handleIceCandidate(message.candidate);
          } else if (message.type === "acp-message") {
            // Direct ACP message via signaling (fallback)
            const envelope: ACPMessageEnvelope = message.envelope;
            for (const handler of this.handlers) {
              await handler(envelope);
            }
          }
        } catch (error) {
          logger.error("Error handling signaling message", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            signalingUrl: this.signalingUrl,
          });
        }
      };

      this.signalingWs.onerror = (error) => {
        logger.error("Signaling WebSocket error", {
          error: error instanceof Error ? error.message : String(error),
          signalingUrl: this.signalingUrl,
        });
      };

      // Initialize peer connection
      this.peerConnection = new RTCPeerConnection({
        iceServers: [...this.stunServers, ...this.turnServers],
      });

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.signalingWs?.readyState === WebSocket.OPEN) {
          this.signalingWs.send(JSON.stringify({
            type: "ice-candidate",
            candidate: event.candidate,
          }));
        }
      };

      // Handle data channel
      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.dataChannel.onmessage = async (event) => {
          try {
            const envelope: ACPMessageEnvelope = JSON.parse(event.data);
            for (const handler of this.handlers) {
              await handler(envelope);
            }
          } catch (error) {
            logger.error("Error handling data channel message", {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            });
          }
        };
      };

      // Create data channel for sending
      this.dataChannel = this.peerConnection.createDataChannel("acp", {
        ordered: true,
      });

      this.dataChannel.onopen = () => {
        logger.info("WebRTC data channel opened", {
          signalingUrl: this.signalingUrl,
        });
      };

      this.dataChannel.onerror = (error) => {
        logger.error("Data channel error", {
          error: error instanceof Error ? error.message : String(error),
          signalingUrl: this.signalingUrl,
        });
      };

      // Create offer and send via signaling
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      if (this.signalingWs.readyState === WebSocket.OPEN) {
        this.signalingWs.send(JSON.stringify({
          type: "offer",
          offer: offer,
        }));
      }
    } catch (error) {
      logger.error("Error initializing WebRTC", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        signalingUrl: this.signalingUrl,
      });
      throw error;
    }
  }

  private async handleOffer(offer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;
    
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);
    
    if (this.signalingWs?.readyState === WebSocket.OPEN) {
      this.signalingWs.send(JSON.stringify({
        type: "answer",
        answer: answer,
      }));
    }
  }

  private async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    if (!this.peerConnection) return;
    await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  private async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;
    await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
  }

  async send(envelope: ACPMessageEnvelope): Promise<void> {
    if (this.dataChannel?.readyState === "open") {
      this.dataChannel.send(JSON.stringify(envelope));
    } else if (this.signalingWs?.readyState === WebSocket.OPEN) {
      // Fallback to signaling channel
      this.signalingWs.send(JSON.stringify({
        type: "acp-message",
        envelope: envelope,
      }));
    } else {
      throw new Error("WebRTC transport not connected");
    }
  }

  async receive(
    handler: (envelope: ACPMessageEnvelope) => Promise<void>
  ): Promise<void> {
    this.handlers.push(handler);
  }

  async close(): Promise<void> {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.signalingWs) {
      this.signalingWs.close();
      this.signalingWs = null;
    }
  }
}

/**
 * Phase C: Pluggable Gateway Transport
 * 
 * Production implementation for gateway-based agent communication.
 * Supports HTTP, WebSocket, and custom gateway protocols.
 */
export class GatewayTransport implements ACPTransport {
  private gatewayUrl: string;
  private protocol: "http" | "websocket" | "custom";
  private ws: WebSocket | null = null;
  private handlers: Array<(envelope: ACPMessageEnvelope) => Promise<void>> = [];
  private customGateway?: {
    send: (envelope: ACPMessageEnvelope) => Promise<void>;
    receive: (handler: (envelope: ACPMessageEnvelope) => Promise<void>) => Promise<void>;
    close: () => Promise<void>;
  };

  constructor(
    gatewayUrl: string,
    protocol: "http" | "websocket" | "custom" = "http",
    customGateway?: {
      send: (envelope: ACPMessageEnvelope) => Promise<void>;
      receive: (handler: (envelope: ACPMessageEnvelope) => Promise<void>) => Promise<void>;
      close: () => Promise<void>;
    }
  ) {
    this.gatewayUrl = gatewayUrl;
    this.protocol = protocol;
    this.customGateway = customGateway;

    if (protocol === "websocket") {
      this.initializeWebSocket();
    }
  }

  private initializeWebSocket(): void {
    try {
      this.ws = new WebSocket(this.gatewayUrl);

      this.ws.onopen = () => {
        logger.info("Gateway WebSocket connected", { gatewayUrl: this.gatewayUrl });
      };

      this.ws.onmessage = async (event) => {
        try {
          const envelope: ACPMessageEnvelope = JSON.parse(event.data);
          for (const handler of this.handlers) {
            await handler(envelope);
          }
        } catch (error) {
          logger.error("Error handling gateway message", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            gatewayUrl: this.gatewayUrl,
          });
        }
      };

      this.ws.onerror = (error) => {
        logger.error("Gateway WebSocket error", {
          error: error instanceof Error ? error.message : String(error),
          gatewayUrl: this.gatewayUrl,
        });
      };

      this.ws.onclose = () => {
        logger.info("Gateway WebSocket closed", { gatewayUrl: this.gatewayUrl });
        // Attempt reconnect after delay
        setTimeout(() => {
          if (this.ws?.readyState === WebSocket.CLOSED) {
            this.initializeWebSocket();
          }
        }, 5000);
      };
    } catch (error) {
      logger.error("Error initializing gateway WebSocket", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        gatewayUrl: this.gatewayUrl,
      });
    }
  }

  async send(envelope: ACPMessageEnvelope): Promise<void> {
    if (this.customGateway) {
      return await this.customGateway.send(envelope);
    }

    if (this.protocol === "websocket" && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(envelope));
    } else if (this.protocol === "http") {
      // HTTP POST to gateway
      const response = await fetch(`${this.gatewayUrl}/acp/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(envelope),
      });

      if (!response.ok) {
        throw new Error(`Gateway HTTP error: ${response.statusText}`);
      }
    } else {
      throw new Error(`Gateway transport not configured for protocol: ${this.protocol}`);
    }
  }

  async receive(
    handler: (envelope: ACPMessageEnvelope) => Promise<void>
  ): Promise<void> {
    if (this.customGateway) {
      return await this.customGateway.receive(handler);
    }

    this.handlers.push(handler);

    // For HTTP, use polling or SSE
    if (this.protocol === "http") {
      // Use Server-Sent Events if available
      const eventSource = new EventSource(`${this.gatewayUrl}/acp/messages/stream`);
      
      eventSource.onmessage = async (event) => {
        try {
          const envelope: ACPMessageEnvelope = JSON.parse(event.data);
          await handler(envelope);
        } catch (error) {
          logger.error("Error handling gateway SSE message", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            gatewayUrl: this.gatewayUrl,
          });
        }
      };

      eventSource.onerror = (error) => {
        logger.error("Gateway SSE error", {
          error: error instanceof Error ? error.message : String(error),
          gatewayUrl: this.gatewayUrl,
        });
        eventSource.close();
      };
    }
  }

  async close(): Promise<void> {
    if (this.customGateway) {
      return await this.customGateway.close();
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

/**
 * MQTT Transport (Phase D) - LMOS-compatible
 * 
 * MQTT transport for IoT and edge deployments
 * Requires mqtt library: npm install mqtt
 */
export class MQTTTransport implements ACPTransport {
  private mqttClient: any; // mqtt.MqttClient type
  private brokerUrl: string;
  private topic: string;
  private handlers: Array<(envelope: ACPMessageEnvelope) => Promise<void>> = [];

  constructor(brokerUrl: string, topic: string = "holdwall/acp") {
    this.brokerUrl = brokerUrl;
    this.topic = topic;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Dynamic import of mqtt
      const mqtt = await import("mqtt");
      
      if (!mqtt || typeof mqtt.connect !== "function") {
        throw new Error("MQTT module not available. Install with: npm install mqtt");
      }
      
      this.mqttClient = mqtt.connect(this.brokerUrl, {
        clientId: `holdwall-${Date.now()}`,
        clean: true,
        reconnectPeriod: 1000,
      });

      this.mqttClient.on("connect", () => {
        logger.info("MQTT transport connected", { topic: this.topic });
        this.mqttClient.subscribe(this.topic, (err: Error | null) => {
          if (err) {
            logger.error("MQTT subscription error", {
              error: err.message,
              topic: this.topic,
            });
          }
        });
      });

      this.mqttClient.on("message", async (topic: string, message: Buffer) => {
        try {
          const envelope: ACPMessageEnvelope = JSON.parse(message.toString());
          for (const handler of this.handlers) {
            await handler(envelope);
          }
        } catch (error) {
          logger.error("Error handling MQTT message", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            topic: this.topic,
          });
        }
      });

      this.mqttClient.on("error", (error: Error) => {
        logger.error("MQTT transport error", {
          error: error.message,
          stack: error.stack,
          topic: this.topic,
        });
      });
    } catch (error) {
      logger.warn("MQTT library not available, MQTT transport disabled", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async send(envelope: ACPMessageEnvelope): Promise<void> {
    if (!this.mqttClient || !this.mqttClient.connected) {
      throw new Error("MQTT transport not connected");
    }

    this.mqttClient.publish(this.topic, JSON.stringify(envelope), (error: Error | null) => {
      if (error) {
        logger.error("MQTT publish error", {
          error: error.message,
          messageId: envelope.message_id,
          topic: this.topic,
        });
        throw error;
      }
    });
  }

  async receive(
    handler: (envelope: ACPMessageEnvelope) => Promise<void>
  ): Promise<void> {
    this.handlers.push(handler);
  }

  async close(): Promise<void> {
    if (this.mqttClient) {
      this.mqttClient.end();
      this.mqttClient = null;
    }
  }
}

/**
 * LMOS Transport Factory
 * 
 * Creates transport-agnostic ACP transport that can switch between
 * HTTP, SSE, WebSocket, and MQTT without changing application logic
 */
export type LMOSTransportType = "http" | "sse" | "websocket" | "webrtc" | "mqtt" | "gateway";

export function createLMOSTransport(
  type: LMOSTransportType,
  config: {
    url?: string;
    brokerUrl?: string; // For MQTT
    topic?: string; // For MQTT
    cache?: MessageCache;
    protocol?: "http" | "websocket" | "custom"; // For gateway
  }
): ACPTransport {
  switch (type) {
    case "http":
    case "sse":
      if (!config.url) {
        throw new Error("URL required for HTTP/SSE transport");
      }
      // HTTP transport uses SSE for receive (LMOS abstraction)
      return new HTTPACPTransport(config.url);
    case "websocket":
      if (!config.url) {
        throw new Error("URL required for WebSocket transport");
      }
      return new WebSocketACPTransport(config.url, config.cache);
    case "webrtc":
      return new WebRTCPeerTransport(config.url);
    case "mqtt":
      if (!config.brokerUrl) {
        throw new Error("Broker URL required for MQTT transport");
      }
      return new MQTTTransport(config.brokerUrl, config.topic);
    case "gateway":
      if (!config.url) {
        throw new Error("URL required for Gateway transport");
      }
      return new GatewayTransport(config.url, config.protocol);
    default:
      throw new Error(`Unknown LMOS transport type: ${type}`);
  }
}

/**
 * Transport factory (legacy - use createLMOSTransport for new code)
 */
export function createACPTransport(
  phase: "a" | "b" | "c",
  url?: string,
  cache?: MessageCache
): ACPTransport {
  switch (phase) {
    case "a":
      if (!url) {
        throw new Error("WebSocket URL required for Phase A");
      }
      return new WebSocketACPTransport(url, cache);
    case "b":
      return new WebRTCPeerTransport(url);
    case "c":
      if (!url) {
        throw new Error("Gateway URL required for Phase C");
      }
      return new GatewayTransport(url);
    default:
      throw new Error(`Unknown phase: ${phase}`);
  }
}
