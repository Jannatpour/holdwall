/**
 * AG-UI Conversation Component
 * 
 * Interactive conversation interface for Agent-User Interaction Protocol
 */

"use client";

import { useState, useRef, useEffect } from "react";
import { useAGUIStream } from "@/lib/hooks/use-ag-ui-stream";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send, Mic, Square, MessageSquare, User, Bot } from "lucide-react";

interface ConversationMessage {
  role: "user" | "agent";
  content: string;
  timestamp: Date;
  citations?: string[];
  metadata?: Record<string, unknown>;
}

export function AGUIConversation({ agentId, userId }: { agentId: string; userId: string }) {
  const [inputMode, setInputMode] = useState<"text" | "voice" | "multimodal" | "structured">("text");
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    sessionId,
    isConnected,
    isStreaming,
    messages,
    currentDelta,
    error,
    startSession,
    sendMessage,
    cancel,
    endSession,
  } = useAGUIStream({
    agentId,
    onError: (err) => {
      toast.error(err.message);
    },
    onSessionStart: (id) => {
      toast.success("Conversation session started");
    },
    onSessionEnd: () => {
      toast.success("Conversation session ended");
    },
  });

  useEffect(() => {
    if (sessionId) {
      startSession();
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentDelta]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const message = inputValue.trim();
    setInputValue("");

    try {
      await sendMessage(message, inputMode);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send message");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const displayMessages: Array<ConversationMessage & { isStreaming?: boolean }> = [
    ...messages,
    ...(currentDelta && isStreaming
      ? [
          {
            role: "agent" as const,
            content: currentDelta,
            timestamp: new Date(),
            isStreaming: true,
          },
        ]
      : []),
  ];

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Agent Conversation
            </CardTitle>
            <CardDescription>
              {sessionId ? `Session: ${sessionId.slice(0, 8)}...` : "Not connected"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {sessionId ? (
              <>
                <Badge variant={isConnected ? "default" : "secondary"}>
                  {isConnected ? "Connected" : "Disconnected"}
                </Badge>
                <Button size="sm" variant="outline" onClick={endSession}>
                  End Session
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={startSession}>
                Start Session
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
          {displayMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Start a conversation with the agent</p>
                <p className="text-sm mt-2">Type a message and press Enter to send</p>
              </div>
            </div>
          ) : (
            displayMessages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "agent" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[70%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{message.content}</div>
                  {message.isStreaming && (
                    <Loader2 className="h-3 w-3 animate-spin mt-2" />
                  )}
                  {message.citations && message.citations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <div className="text-xs opacity-75">Citations:</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {message.citations.map((citation, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {citation}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="text-xs opacity-75 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
                {message.role === "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            {error.message}
          </div>
        )}

        {/* Input Area */}
        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center gap-2">
            <Select value={inputMode} onValueChange={(v) => setInputMode(v as typeof inputMode)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="voice">Voice</SelectItem>
                <SelectItem value="multimodal">Multimodal</SelectItem>
                <SelectItem value="structured">Structured</SelectItem>
              </SelectContent>
            </Select>
            {isStreaming && (
              <Button size="sm" variant="outline" onClick={cancel}>
                <Square className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                inputMode === "text"
                  ? "Type your message..."
                  : inputMode === "voice"
                  ? "Voice input (coming soon)..."
                  : inputMode === "multimodal"
                  ? "Multimodal input (coming soon)..."
                  : "Structured input (coming soon)..."
              }
              disabled={!isConnected || isStreaming}
              className="flex-1 min-h-[80px]"
            />
            <Button
              onClick={handleSend}
              disabled={!isConnected || !inputValue.trim() || isStreaming}
              size="icon"
              className="h-[80px] w-[80px]"
            >
              {isStreaming ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
