/**
 * AG-UI (Agent-User Interaction Protocol)
 * 
 * Defines standards for how AI agents interact with human users,
 * handling input, output, and conversational flow.
 */

import { logger } from "@/lib/logging/logger";
import { metrics } from "@/lib/observability/metrics";
import { db } from "@/lib/db/client";
import { DatabaseEvidenceVault } from "@/lib/evidence/vault-db";
import { AIOrchestrator } from "@/lib/ai/orchestrator";
import { getProtocolSecurity } from "@/lib/security/protocol-security";

export type InteractionMode = "text" | "voice" | "multimodal" | "structured";

export type UserIntent = 
  | "question"
  | "command"
  | "clarification"
  | "feedback"
  | "correction"
  | "navigation";

export interface UserInput {
  inputId: string;
  userId: string;
  sessionId: string;
  mode: InteractionMode;
  content: string | Blob | unknown; // Text, audio, image, structured data
  intent?: UserIntent;
  context?: {
    previousMessages?: Array<{ role: "user" | "agent"; content: string }>;
    userPreferences?: Record<string, unknown>;
    sessionState?: Record<string, unknown>;
  };
  metadata?: {
    timestamp?: Date;
    deviceInfo?: string;
    location?: string;
    language?: string;
  };
}

export interface AgentOutput {
  outputId: string;
  inputId: string;
  sessionId: string;
  mode: InteractionMode;
  content: string | Blob | unknown;
  citations?: string[];
  confidence?: number;
  suggestedActions?: Array<{
    action: string;
    label: string;
    parameters?: Record<string, unknown>;
  }>;
  metadata?: {
    model?: string;
    latency?: number;
    tokens?: number;
    cost?: number;
  };
}

export interface ConversationSession {
  sessionId: string;
  userId: string;
  agentId: string;
  startedAt: Date;
  lastActivity: Date;
  messages: Array<{
    role: "user" | "agent";
    inputId?: string;
    outputId?: string;
    content: string;
    timestamp: Date;
  }>;
  state: {
    currentTopic?: string;
    pendingClarifications?: string[];
    userPreferences?: Record<string, unknown>;
  };
}

export interface InteractionFlow {
  flowId: string;
  name: string;
  steps: Array<{
    stepId: string;
    type: "input" | "processing" | "output" | "decision";
    handler: string; // Function name or endpoint
    conditions?: Array<{
      condition: string;
      nextStep?: string;
    }>;
  }>;
}

export interface AGUIStreamEvent {
  type:
    | "RUN_STARTED"
    | "RUN_FINISHED"
    | "RUN_ERROR"
    | "HEARTBEAT"
    | "TEXT_MESSAGE_CONTENT"
    | "TOOL_CALL_START"
    | "TOOL_CALL_END";
  run_id: string;
  session_id: string;
  user_id: string;
  tenant_id: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

/**
 * AG-UI Protocol Implementation
 */
export class AGUIProtocol {
  private sessions: Map<string, ConversationSession> = new Map();
  private flows: Map<string, InteractionFlow> = new Map();
  private aiOrchestrator = new AIOrchestrator(new DatabaseEvidenceVault());

  constructor() {
    this.initializeDefaultFlows();
    this.startSessionCleanup();
  }

  /**
   * Start conversation session with security verification
   */
  async startSession(
    userId: string,
    agentId: string
  ): Promise<ConversationSession> {
    // Security verification
    const protocolSecurity = getProtocolSecurity();
    
    // Verify agent identity if agentId is provided
    if (agentId) {
      const securityContext = await protocolSecurity.verifyAgentIdentity(agentId);
      if (!securityContext || !securityContext.identityVerified) {
        throw new Error(`Agent identity verification failed: ${agentId}`);
      }

      const hasPermission = await protocolSecurity.checkProtocolPermission(
        agentId,
        "ag-ui",
        "start_session"
      );

      if (!hasPermission) {
        throw new Error(`Agent ${agentId} does not have permission to start AG-UI sessions`);
      }
    }

    const sessionId = crypto.randomUUID();
    const session: ConversationSession = {
      sessionId,
      userId,
      agentId,
      startedAt: new Date(),
      lastActivity: new Date(),
      messages: [],
      state: {},
    };

    this.sessions.set(sessionId, session);

    // Store in database (Prisma model: ConversationSession)
    try {
      await db.conversationSession.create({
        data: {
          sessionId,
          userId,
          agentId,
          startedAt: session.startedAt,
          lastActivity: session.lastActivity,
          messages: session.messages as any,
          state: session.state as any,
        },
      });
    } catch (error) {
      logger.warn("Failed to persist session to database", {
        error: error instanceof Error ? error.message : String(error),
        sessionId,
      });
    }

    metrics.increment("ag_ui_sessions_started_total", {
      user_id: userId,
      agent_id: agentId,
    });

    logger.info("Conversation session started", {
      sessionId,
      userId,
      agentId,
    });

    return session;
  }

  /**
   * Process user input
   */
  async processInput(input: UserInput): Promise<AgentOutput> {
    const session = this.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session ${input.sessionId} not found`);
    }

    // Update session activity
    session.lastActivity = new Date();

    // Detect intent if not provided
    const intent = input.intent || this.detectIntent(input);

    // Add user message to session
    session.messages.push({
      role: "user",
      inputId: input.inputId,
      content: this.extractContent(input),
      timestamp: new Date(),
    });

    // Process based on mode and intent
    const output = await this.generateOutput(input, session, intent);

    // Add agent message to session
    session.messages.push({
      role: "agent",
      outputId: output.outputId,
      content: typeof output.content === "string" 
        ? output.content 
        : output.content instanceof Blob 
          ? "[blob]" 
          : JSON.stringify(output.content),
      timestamp: new Date(),
    });

    // Update session state
    this.updateSessionState(session, input, output);

    // Persist session
    await this.persistSession(session);

    metrics.increment("ag_ui_inputs_processed_total", {
      session_id: input.sessionId,
      mode: input.mode,
      intent: intent,
    });

    logger.debug("User input processed", {
      sessionId: input.sessionId,
      inputId: input.inputId,
      intent,
      mode: input.mode,
    });

    return output;
  }

  /**
   * Process user input with true streaming callbacks (AG-UI runtime events).
   */
  async processInputStream(params: {
    input: UserInput;
    signal: AbortSignal;
    send: (event: AGUIStreamEvent) => void;
  }): Promise<AgentOutput> {
    const input = params.input;
    const session = this.sessions.get(input.sessionId);
    if (!session) {
      throw new Error(`Session ${input.sessionId} not found`);
    }

    session.lastActivity = new Date();
    const intent = input.intent || this.detectIntent(input);
    const content = this.extractContent(input);

    // Tenant resolution
    const user = await db.user.findUnique({ where: { id: session.userId }, select: { tenantId: true } });
    const tenantId = user?.tenantId || "default";
    const runId = crypto.randomUUID();

    params.send({
      type: "RUN_STARTED",
      run_id: runId,
      session_id: session.sessionId,
      user_id: session.userId,
      tenant_id: tenantId,
      timestamp: new Date().toISOString(),
      payload: { intent, mode: input.mode },
    });

    // Persist the user message immediately
    session.messages.push({
      role: "user",
      inputId: input.inputId,
      content,
      timestamp: new Date(),
    });

    // Stream orchestration (RAG+KAG + true token streaming)
    let final: Awaited<ReturnType<AIOrchestrator["orchestrateStream"]>>;
    try {
      final = await this.aiOrchestrator.orchestrateStream(
        {
          query: `${intent === "command" ? "Command request" : "User question"}: ${content}`,
          tenant_id: tenantId,
          use_rag: true,
          use_kag: true,
        },
        {
          signal: params.signal,
          onDelta: (delta) => {
            params.send({
              type: "TEXT_MESSAGE_CONTENT",
              run_id: runId,
              session_id: session.sessionId,
              user_id: session.userId,
              tenant_id: tenantId,
              timestamp: new Date().toISOString(),
              payload: { delta },
            });
          },
          onStage: (stage) => {
            const callId = `${runId}:${stage.name}`;
            if (stage.status === "start") {
              params.send({
                type: "TOOL_CALL_START",
                run_id: runId,
                session_id: session.sessionId,
                user_id: session.userId,
                tenant_id: tenantId,
                timestamp: new Date().toISOString(),
                payload: { tool: stage.name, call_id: callId, metadata: stage.metadata || {} },
              });
            } else {
              params.send({
                type: "TOOL_CALL_END",
                run_id: runId,
                session_id: session.sessionId,
                user_id: session.userId,
                tenant_id: tenantId,
                timestamp: new Date().toISOString(),
                payload: { tool: stage.name, call_id: callId, metadata: stage.metadata || {}, success: true },
              });
            }
          },
        }
      );
    } catch (error) {
      params.send({
        type: "RUN_ERROR",
        run_id: runId,
        session_id: session.sessionId,
        user_id: session.userId,
        tenant_id: tenantId,
        timestamp: new Date().toISOString(),
        payload: { message: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }

    const output: AgentOutput = {
      outputId: crypto.randomUUID(),
      inputId: input.inputId,
      sessionId: input.sessionId,
      mode: input.mode,
      content: final.response,
      citations: final.citations.length ? final.citations : undefined,
      confidence: 0.85,
      metadata: {
        latency: final.metadata.latency_ms,
        model: final.metadata.model_used,
        tokens: final.metadata.tokens_used,
        cost: final.metadata.cost,
      },
    };

    // Persist the agent message
    session.messages.push({
      role: "agent",
      outputId: output.outputId,
      content: this.extractContent(output),
      timestamp: new Date(),
    });
    this.updateSessionState(session, input, output);
    await this.persistSession(session);

    params.send({
      type: "RUN_FINISHED",
      run_id: runId,
      session_id: session.sessionId,
      user_id: session.userId,
      tenant_id: tenantId,
      timestamp: new Date().toISOString(),
      payload: {
        output: output.content,
        citations: output.citations,
        model: output.metadata?.model,
        tokens: output.metadata?.tokens,
        cost: output.metadata?.cost,
        latency: output.metadata?.latency,
      },
    });

    return output;
  }

  /**
   * Generate agent output
   */
  private async generateOutput(
    input: UserInput,
    session: ConversationSession,
    intent: UserIntent
  ): Promise<AgentOutput> {
    const startTime = Date.now();

    // Extract content based on mode
    const content = this.extractContent(input);

    // Resolve tenant context (required for multi-tenant RAG/KAG)
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { tenantId: true },
    });
    const tenantId = user?.tenantId || "default";

    // Always produce a real, evidence-backed response via the existing AI orchestrator.
    // (Intent influences phrasing, but we never use placeholders.)
    const systemPrefix =
      intent === "command"
        ? "The user is giving an operational command. Respond with the safest actionable steps and (when possible) direct the user to the exact UI/API endpoint to execute it."
        : intent === "clarification"
          ? "The user needs clarification. Ask targeted follow-up questions if required, otherwise answer directly."
          : "Answer directly and concisely.";

    const result = await this.aiOrchestrator.orchestrate({
      query: `${systemPrefix}\n\nUser input: ${content}`,
      tenant_id: tenantId,
      use_rag: true,
      use_kag: true,
    });

    const outputContent = result.response;
    const citations = result.citations || [];
    const confidence = 0.85;
    const suggestedActions: AgentOutput["suggestedActions"] = [];

    const latency = Date.now() - startTime;

    const output: AgentOutput = {
      outputId: crypto.randomUUID(),
      inputId: input.inputId,
      sessionId: input.sessionId,
      mode: input.mode,
      content: outputContent,
      citations: citations.length > 0 ? citations : undefined,
      confidence,
      suggestedActions: suggestedActions.length > 0 ? suggestedActions : undefined,
      metadata: {
        latency,
        model: result.metadata?.model_used,
        tokens: result.metadata?.tokens_used,
        cost: result.metadata?.cost,
      },
    };

    return output;
  }

  /**
   * Detect user intent
   */
  private detectIntent(input: UserInput): UserIntent {
    const content = this.extractContent(input).toLowerCase();

    // Question patterns
    if (
      content.startsWith("what") ||
      content.startsWith("who") ||
      content.startsWith("where") ||
      content.startsWith("when") ||
      content.startsWith("why") ||
      content.startsWith("how") ||
      content.includes("?")
    ) {
      return "question";
    }

    // Command patterns
    if (
      content.startsWith("create") ||
      content.startsWith("delete") ||
      content.startsWith("update") ||
      content.startsWith("show") ||
      content.startsWith("list")
    ) {
      return "command";
    }

    // Clarification patterns
    if (content.includes("clarify") || content.includes("explain")) {
      return "clarification";
    }

    // Default to question
    return "question";
  }

  /**
   * Extract content from input/output payloads.
   */
  private extractContent(input: { content: string | Blob | unknown }): string {
    if (typeof input.content === "string") {
      return input.content;
    }
    if (input.content instanceof Blob) {
      throw new Error(
        "Blob content is not supported via this API. Upload media via the file upload endpoints and pass a reference."
      );
    }
    if (typeof input.content === "object") {
      return JSON.stringify(input.content);
    }
    return String(input.content);
  }

  /**
   * Update session state
   */
  private updateSessionState(
    session: ConversationSession,
    input: UserInput,
    output: AgentOutput
  ): void {
    // Update current topic
    if (input.intent === "question") {
      session.state.currentTopic = this.extractContent(input);
    }

    // Track pending clarifications
    if (output.suggestedActions?.some((a) => a.action === "provide_clarification")) {
      session.state.pendingClarifications = session.state.pendingClarifications || [];
      session.state.pendingClarifications.push(this.extractContent(input));
    }

    // Update user preferences from context
    if (input.context?.userPreferences) {
      session.state.userPreferences = {
        ...session.state.userPreferences,
        ...input.context.userPreferences,
      };
    }
  }

  /**
   * Persist session
   */
  private async persistSession(session: ConversationSession): Promise<void> {
    try {
      await db.conversationSession.update({
        where: { sessionId: session.sessionId },
        data: {
          lastActivity: session.lastActivity,
          messages: session.messages as any,
          state: session.state as any,
        },
      });
    } catch (error) {
      logger.warn("Failed to persist session update", {
        error: error instanceof Error ? error.message : String(error),
        sessionId: session.sessionId,
      });
    }
  }

  /**
   * Get session
   */
  getSession(sessionId: string): ConversationSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get session count (for health checks)
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * End session
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.sessions.delete(sessionId);

    // Mark as ended in database (Prisma model: ConversationSession)
    try {
      await db.conversationSession.update({
        where: { sessionId },
        data: {
          endedAt: new Date(),
        },
      });
    } catch (error) {
      logger.warn("Failed to mark session as ended", {
        error: error instanceof Error ? error.message : String(error),
        sessionId,
      });
    }

    logger.info("Conversation session ended", { sessionId });
  }

  /**
   * Register interaction flow
   */
  registerFlow(flow: InteractionFlow): void {
    this.flows.set(flow.flowId, flow);
    logger.info("Interaction flow registered", {
      flowId: flow.flowId,
      name: flow.name,
      steps: flow.steps.length,
    });
  }

  /**
   * Get flow
   */
  getFlow(flowId: string): InteractionFlow | null {
    return this.flows.get(flowId) || null;
  }

  /**
   * Initialize default flows
   */
  private initializeDefaultFlows(): void {
    // Default conversational flow
    this.registerFlow({
      flowId: "default-conversation",
      name: "Default Conversational Flow",
      steps: [
        {
          stepId: "receive-input",
          type: "input",
          handler: "processInput",
        },
        {
          stepId: "detect-intent",
          type: "processing",
          handler: "detectIntent",
        },
        {
          stepId: "generate-response",
          type: "processing",
          handler: "generateOutput",
        },
        {
          stepId: "send-output",
          type: "output",
          handler: "sendOutput",
        },
      ],
    });
  }

  /**
   * Start session cleanup (remove old sessions)
   */
  private startSessionCleanup(): void {
    if (process.env.NODE_ENV === "test") return;
    const timer = setInterval(() => {
      void this.cleanupOldSessions();
    }, 3600000); // Every hour
    // Don't keep the process alive just for cleanup.
    (timer as any).unref?.();
  }

  /**
   * Cleanup old sessions
   */
  private async cleanupOldSessions(): Promise<void> {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24); // 24 hours

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActivity < cutoff) {
        await this.endSession(sessionId);
      }
    }
  }
}

// Singleton instance
let aguiProtocolInstance: AGUIProtocol | null = null;

export function getAGUIProtocol(): AGUIProtocol {
  if (!aguiProtocolInstance) {
    aguiProtocolInstance = new AGUIProtocol();
  }
  return aguiProtocolInstance;
}
