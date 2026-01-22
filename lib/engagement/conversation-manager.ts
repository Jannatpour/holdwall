/**
 * Conversation Manager
 * 
 * Handles multi-turn conversations intelligently to maintain
 * context and provide coherent responses.
 */

import { ContextUnderstander, ConversationContext } from "./context-understander";
import { ResponseGenerator } from "./response-generator";

export interface Conversation {
  id: string;
  platform: string;
  messages: Array<{
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: string;
  }>;
  context: ConversationContext;
  status: "active" | "resolved" | "escalated";
}

export class ConversationManager {
  private conversations: Map<string, Conversation> = new Map();
  private contextUnderstander: ContextUnderstander;
  private responseGenerator: ResponseGenerator;

  constructor() {
    this.contextUnderstander = new ContextUnderstander();
    this.responseGenerator = new ResponseGenerator();
  }

  /**
   * Start or continue conversation
   */
  async handleMessage(
    conversationId: string | null,
    platform: string,
    userMessage: string,
    previousMessages?: Array<{ role: string; content: string; timestamp?: string }>
  ): Promise<{ conversation: Conversation; response: string }> {
    // Get or create conversation
    let conversation: Conversation;

    if (conversationId && this.conversations.has(conversationId)) {
      conversation = this.conversations.get(conversationId)!;
    } else {
      // Map previous messages to correct type
      const mappedMessages: Conversation["messages"] = (previousMessages || []).map(msg => ({
        role: (msg.role === "user" || msg.role === "assistant" || msg.role === "system") 
          ? msg.role 
          : "user" as const,
        content: msg.content,
        timestamp: msg.timestamp || new Date().toISOString(),
      }));

      conversation = {
        id: conversationId || crypto.randomUUID(),
        platform,
        messages: mappedMessages,
        context: {
          messages: [],
          intent: "other",
          sentiment: "neutral",
          topics: [],
          requiresResponse: true,
        },
        status: "active",
      };
    }

    // Add user message
    conversation.messages.push({
      role: "user",
      content: userMessage,
      timestamp: new Date().toISOString(),
    });

    // Understand context
    conversation.context = this.contextUnderstander.understand(conversation.messages);

    // Generate response
    const strategy = this.contextUnderstander.getResponseStrategy(conversation.context);
    const response = await this.responseGenerator.generate({
      context: userMessage,
      intent: conversation.context.intent === "question" ? "inform" :
              conversation.context.intent === "complaint" ? "defend" : "engage",
      tone: strategy.tone as any,
      includeEvidence: strategy.includeEvidence,
      maxLength: strategy.length === "short" ? 200 :
                 strategy.length === "long" ? 1000 : 500,
      platform: platform as any,
    });

    // Add assistant response
    conversation.messages.push({
      role: "assistant",
      content: response.response,
      timestamp: new Date().toISOString(),
    });

    // Update conversation status
    if (conversation.context.intent === "complaint" && conversation.context.sentiment === "negative") {
      conversation.status = "escalated";
    } else if (conversation.messages.length > 6) {
      conversation.status = "resolved";
    }

    // Store conversation
    this.conversations.set(conversation.id, conversation);

    return {
      conversation,
      response: response.response,
    };
  }

  /**
   * Get conversation
   */
  getConversation(conversationId: string): Conversation | null {
    return this.conversations.get(conversationId) || null;
  }

  /**
   * Get active conversations
   */
  getActiveConversations(): Conversation[] {
    return Array.from(this.conversations.values())
      .filter(c => c.status === "active")
      .sort((a, b) => {
        const aTime = new Date(a.messages[a.messages.length - 1]?.timestamp || 0).getTime();
        const bTime = new Date(b.messages[b.messages.length - 1]?.timestamp || 0).getTime();
        return bTime - aTime;
      });
  }
}
