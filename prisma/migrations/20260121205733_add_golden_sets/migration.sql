-- CreateTable
CREATE TABLE "GoldenSet" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "examples" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoldenSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRegistry" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "capabilities" JSONB NOT NULL,
    "endpoint" TEXT NOT NULL,
    "publicKey" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentConnection" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "peerAgentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "establishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastHeartbeat" TIMESTAMP(3),
    "capabilities" JSONB NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentNetwork" (
    "id" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "agents" JSONB NOT NULL,
    "topology" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentNetwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationSession" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "messages" JSONB NOT NULL,
    "state" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GoldenSet_domain_idx" ON "GoldenSet"("domain");

-- CreateIndex
CREATE INDEX "GoldenSet_name_idx" ON "GoldenSet"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GoldenSet_domain_name_version_key" ON "GoldenSet"("domain", "name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRegistry_agentId_key" ON "AgentRegistry"("agentId");

-- CreateIndex
CREATE INDEX "AgentRegistry_agentId_idx" ON "AgentRegistry"("agentId");

-- CreateIndex
CREATE INDEX "AgentRegistry_name_idx" ON "AgentRegistry"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AgentConnection_connectionId_key" ON "AgentConnection"("connectionId");

-- CreateIndex
CREATE INDEX "AgentConnection_agentId_idx" ON "AgentConnection"("agentId");

-- CreateIndex
CREATE INDEX "AgentConnection_peerAgentId_idx" ON "AgentConnection"("peerAgentId");

-- CreateIndex
CREATE INDEX "AgentConnection_status_idx" ON "AgentConnection"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AgentNetwork_networkId_key" ON "AgentNetwork"("networkId");

-- CreateIndex
CREATE INDEX "AgentNetwork_networkId_idx" ON "AgentNetwork"("networkId");

-- CreateIndex
CREATE INDEX "AgentNetwork_topology_idx" ON "AgentNetwork"("topology");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationSession_sessionId_key" ON "ConversationSession"("sessionId");

-- CreateIndex
CREATE INDEX "ConversationSession_sessionId_idx" ON "ConversationSession"("sessionId");

-- CreateIndex
CREATE INDEX "ConversationSession_userId_idx" ON "ConversationSession"("userId");

-- CreateIndex
CREATE INDEX "ConversationSession_agentId_idx" ON "ConversationSession"("agentId");

-- CreateIndex
CREATE INDEX "ConversationSession_lastActivity_idx" ON "ConversationSession"("lastActivity");
