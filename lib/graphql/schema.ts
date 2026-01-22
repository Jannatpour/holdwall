/**
 * GraphQL Schema
 * 
 * Federated GraphQL schema with type definitions for:
 * - Evidence and Claims
 * - Belief Graph
 * - Forecasts
 * - Events
 * - Artifacts
 * - Multi-tenant support
 */

export const typeDefs = `#graphql
  scalar DateTime
  scalar JSON

  # Federation directives
  directive @key(fields: String!) on OBJECT | INTERFACE
  directive @requires(fields: String!) on FIELD_DEFINITION
  directive @provides(fields: String!) on FIELD_DEFINITION
  directive @external on FIELD_DEFINITION
  directive @extends on OBJECT | INTERFACE

  type Query {
    # Evidence queries
    evidence(id: ID!): Evidence
    evidenceList(
      tenantId: ID!
      filters: EvidenceFilters
      pagination: Pagination
    ): EvidenceConnection!
    searchEvidence(
      tenantId: ID!
      query: String!
      options: SearchOptions
    ): EvidenceConnection!

    # Claim queries
    claim(id: ID!): Claim
    claimList(
      tenantId: ID!
      filters: ClaimFilters
      pagination: Pagination
    ): ClaimConnection!
    claimCluster(id: ID!): ClaimCluster

    # Belief Graph queries
    beliefNode(id: ID!): BeliefNode
    beliefNodes(
      tenantId: ID!
      filters: BeliefNodeFilters
      pagination: Pagination
    ): BeliefNodeConnection!
    beliefGraph(
      tenantId: ID!
      nodeId: ID
      depth: Int
    ): BeliefGraph!

    # Forecast queries
    forecast(id: ID!): Forecast
    forecasts(
      tenantId: ID!
      filters: ForecastFilters
      pagination: Pagination
    ): ForecastConnection!

    # Event queries
    event(id: ID!): Event
    events(
      tenantId: ID!
      filters: EventFilters
      pagination: Pagination
    ): EventConnection!

    # Artifact queries
    artifact(id: ID!): Artifact
    artifacts(
      tenantId: ID!
      filters: ArtifactFilters
      pagination: Pagination
    ): ArtifactConnection!

    # Agent Protocol queries
    agent(id: ID!): Agent
    agents(
      tenantId: ID!
      capabilities: [String!]
      filters: AgentFilters
      pagination: Pagination
    ): AgentConnection!
    hireAgent(input: HireAgentInput!): Agent
    agentNetwork(id: ID!): AgentNetwork
    agentNetworks(
      tenantId: ID!
      topology: NetworkTopology
      filters: NetworkFilters
      pagination: Pagination
    ): AgentNetworkConnection!
    networkHealth(networkId: ID!): NetworkHealthReport!
    agentHealth(agentId: ID!): AgentHealthStatus!

    # AP2 Payment Protocol queries
    paymentMandate(mandateId: ID!): PaymentMandate
    paymentMandates(filters: PaymentMandateFilters, limit: Int): [PaymentMandate!]!
    walletBalance(walletId: ID!, currency: String): WalletBalance!
    walletLedger(walletId: ID!, currency: String, limit: Int): WalletLedgerConnection!
    paymentAuditLogs(filters: PaymentAuditFilters, pagination: Pagination): PaymentAuditConnection!

    # POS (Perception Operating System) queries
    posMetrics(tenantId: ID!): POSMetrics!
    consensusSignals(tenantId: ID!, filters: ConsensusSignalFilters, pagination: Pagination): ConsensusSignalConnection!
    externalValidators(tenantId: ID!, filters: ValidatorFilters, pagination: Pagination): ExternalValidatorConnection!
    audits(tenantId: ID!, filters: AuditFilters, pagination: Pagination): AuditConnection!
    slas(tenantId: ID!, filters: SLAFilters, pagination: Pagination): SLAConnection!
    rebuttalDocuments(tenantId: ID!, filters: RebuttalDocumentFilters, pagination: Pagination): RebuttalDocumentConnection!
    incidentExplanations(tenantId: ID!, filters: IncidentExplanationFilters, pagination: Pagination): IncidentExplanationConnection!
    predictedComplaints(tenantId: ID!, filters: PredictedComplaintFilters, pagination: Pagination): PredictedComplaintConnection!
    decisionCheckpoints(tenantId: ID!, stage: DecisionStage, pagination: Pagination): DecisionCheckpointConnection!
  }

  type Mutation {
    # Evidence mutations
    createEvidence(input: CreateEvidenceInput!): Evidence!
    updateEvidence(id: ID!, input: UpdateEvidenceInput!): Evidence!
    deleteEvidence(id: ID!): Boolean!

    # Claim mutations
    createClaim(input: CreateClaimInput!): Claim!
    updateClaim(id: ID!, input: UpdateClaimInput!): Claim!
    deleteClaim(id: ID!): Boolean!
    clusterClaims(tenantId: ID!, input: ClusterClaimsInput!): ClaimCluster!

    # Belief Graph mutations
    createBeliefNode(input: CreateBeliefNodeInput!): BeliefNode!
    createBeliefEdge(input: CreateBeliefEdgeInput!): BeliefEdge!
    updateBeliefNode(id: ID!, input: UpdateBeliefNodeInput!): BeliefNode!
    deleteBeliefNode(id: ID!): Boolean!

    # Forecast mutations
    createForecast(input: CreateForecastInput!): Forecast!
    updateForecast(id: ID!, input: UpdateForecastInput!): Forecast!

    # Artifact mutations
    createArtifact(input: CreateArtifactInput!): Artifact!
    updateArtifact(id: ID!, input: UpdateArtifactInput!): Artifact!
    publishArtifact(id: ID!): Artifact!

    # Agent Protocol mutations
    registerAgent(input: RegisterAgentInput!): Agent!
    registerAgentWithProfile(input: RegisterAgentWithProfileInput!): Agent!

    # POS (Perception Operating System) mutations
    createConsensusSignal(input: CreateConsensusSignalInput!): ConsensusSignal!
    registerExternalValidator(input: RegisterExternalValidatorInput!): ExternalValidator!
    createAudit(input: CreateAuditInput!): Audit!
    completeAudit(input: CompleteAuditInput!): Audit!
    createSLA(input: CreateSLAInput!): SLA!
    updateSLAMetric(input: UpdateSLAMetricInput!): SLA!
    publishSLA(input: PublishSLAInput!): SLA!
    createRebuttalDocument(input: CreateRebuttalDocumentInput!): RebuttalDocument!
    publishRebuttal(input: PublishRebuttalInput!): RebuttalDocument!
    createIncidentExplanation(input: CreateIncidentExplanationInput!): IncidentExplanation!
    publishIncidentExplanation(input: PublishIncidentExplanationInput!): IncidentExplanation!
    createMetricsDashboard(input: CreateMetricsDashboardInput!): MetricsDashboard!
    publishMetricsDashboard(input: PublishMetricsDashboardInput!): MetricsDashboard!
    createPredictedComplaint(input: CreatePredictedComplaintInput!): PredictedComplaint!
    generatePreemptiveAction(predictionId: ID!): PreemptiveAction
    createDecisionCheckpoint(input: CreateDecisionCheckpointInput!): DecisionCheckpoint!
    setupCompleteFunnel(tenantId: ID!): [DecisionCheckpoint!]!
    executePOSCycle(tenantId: ID!): POSCycleResult!
  }

  # Evidence types
  type Evidence @key(fields: "id") {
    id: ID!
    tenantId: ID!
    type: EvidenceType!
    source: EvidenceSource!
    content: EvidenceContent!
    provenance: EvidenceProvenance!
    signature: EvidenceSignature
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
    claims: [Claim!]!
  }

  type EvidenceSource {
    type: String!
    id: String!
    url: String
    collectedAt: DateTime!
    collectedBy: String!
    method: CollectionMethod!
  }

  type EvidenceContent {
    raw: String
    normalized: String
    metadata: JSON
  }

  type EvidenceProvenance {
    collectionMethod: String!
    retentionPolicy: String!
    complianceFlags: [String!]!
  }

  type EvidenceSignature {
    algorithm: String!
    signature: String!
    signerId: String!
  }

  enum EvidenceType {
    SIGNAL
    DOCUMENT
    ARTIFACT
    METRIC
    EXTERNAL
  }

  enum CollectionMethod {
    API
    RSS
    EXPORT
    MANUAL
  }

  input EvidenceFilters {
    type: EvidenceType
    sourceType: String
    createdAfter: DateTime
    createdBefore: DateTime
  }

  input CreateEvidenceInput {
    tenantId: ID!
    type: EvidenceType!
    source: EvidenceSourceInput!
    content: EvidenceContentInput!
    provenance: EvidenceProvenanceInput!
    metadata: JSON
  }

  input UpdateEvidenceInput {
    content: EvidenceContentInput
    metadata: JSON
  }

  input EvidenceSourceInput {
    type: String!
    id: String!
    url: String
    collectedBy: String!
    method: CollectionMethod!
  }

  input EvidenceContentInput {
    raw: String
    normalized: String
    metadata: JSON
  }

  input EvidenceProvenanceInput {
    collectionMethod: String!
    retentionPolicy: String!
    complianceFlags: [String!]
  }

  # Claim types
  type Claim {
    id: ID!
    tenantId: ID!
    canonicalText: String!
    variants: [String!]!
    decisiveness: Float!
    clusterId: ID
    cluster: ClaimCluster
    evidence: [Evidence!]!
    createdAt: DateTime!
  }

  type ClaimCluster {
    id: ID!
    tenantId: ID!
    primaryClaimId: ID!
    primaryClaim: Claim!
    claims: [Claim!]!
    size: Int!
    decisiveness: Float!
    createdAt: DateTime!
  }

  input ClaimFilters {
    clusterId: ID
    minDecisiveness: Float
    createdAfter: DateTime
    createdBefore: DateTime
  }

  input CreateClaimInput {
    tenantId: ID!
    canonicalText: String!
    variants: [String!]
    evidenceIds: [ID!]
  }

  input UpdateClaimInput {
    canonicalText: String
    variants: [String!]
    evidenceIds: [ID!]
  }

  input ClusterClaimsInput {
    minDecisiveness: Float
    similarityThreshold: Float
  }

  # Belief Graph types
  type BeliefNode @key(fields: "id") {
    id: ID!
    tenantId: ID!
    type: NodeType!
    content: String!
    trustScore: Float!
    decisiveness: Float!
    actorWeights: JSON!
    decayFactor: Float!
    fromEdges: [BeliefEdge!]!
    toEdges: [BeliefEdge!]!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type BeliefEdge {
    id: ID!
    tenantId: ID!
    fromNodeId: ID!
    fromNode: BeliefNode!
    toNodeId: ID!
    toNode: BeliefNode!
    type: EdgeType!
    weight: Float!
    actorWeights: JSON!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type BeliefGraph {
    nodes: [BeliefNode!]!
    edges: [BeliefEdge!]!
    rootNode: BeliefNode
  }

  enum NodeType {
    CLAIM
    EMOTION
    PROOF_POINT
    NARRATIVE
  }

  enum EdgeType {
    REINFORCEMENT
    NEUTRALIZATION
    DECAY
  }

  input BeliefNodeFilters {
    type: NodeType
    minTrustScore: Float
    minDecisiveness: Float
  }

  input CreateBeliefNodeInput {
    tenantId: ID!
    type: NodeType!
    content: String!
    trustScore: Float
    decisiveness: Float
    actorWeights: JSON
  }

  input UpdateBeliefNodeInput {
    content: String
    trustScore: Float
    decisiveness: Float
    actorWeights: JSON
  }

  input CreateBeliefEdgeInput {
    tenantId: ID!
    fromNodeId: ID!
    toNodeId: ID!
    type: EdgeType!
    weight: Float!
    actorWeights: JSON
  }

  # Forecast types
  type Forecast {
    id: ID!
    tenantId: ID!
    type: ForecastType!
    targetMetric: String!
    value: Float!
    confidenceLower: Float!
    confidenceUpper: Float!
    confidenceLevel: Float!
    horizonDays: Int!
    model: String!
    evalScore: Float
    typeData: JSON
    createdAt: DateTime!
  }

  enum ForecastType {
    DRIFT
    ANOMALY
    OUTBREAK
    DIFFUSION
  }

  input ForecastFilters {
    type: ForecastType
    targetMetric: String
    minConfidence: Float
    createdAfter: DateTime
  }

  input CreateForecastInput {
    tenantId: ID!
    type: ForecastType!
    targetMetric: String!
    value: Float!
    confidenceLower: Float!
    confidenceUpper: Float!
    confidenceLevel: Float!
    horizonDays: Int!
    model: String!
    typeData: JSON
  }

  input UpdateForecastInput {
    value: Float
    confidenceLower: Float
    confidenceUpper: Float
    evalScore: Float
  }

  # Event types
  type Event {
    id: ID!
    tenantId: ID!
    actorId: String!
    type: String!
    occurredAt: DateTime!
    correlationId: String!
    causationId: String
    schemaVersion: String!
    payload: JSON!
    signatures: [JSON!]!
    metadata: JSON
    evidence: [Evidence!]!
    createdAt: DateTime!
  }

  input EventFilters {
    type: String
    actorId: String
    occurredAfter: DateTime
    occurredBefore: DateTime
  }

  # Artifact types
  type Artifact {
    id: ID!
    tenantId: ID!
    title: String!
    content: String!
    version: String!
    status: ArtifactStatus!
    approvers: [String!]!
    requiredApprovals: Int!
    policyChecks: JSON
    padlPublished: Boolean!
    padlUrl: String
    padlHash: String
    padlRobots: String
    evidence: [Evidence!]!
    approvals: [Approval!]!
    createdAt: DateTime!
    updatedAt: DateTime!
    publishedAt: DateTime
  }

  type Approval {
    id: ID!
    tenantId: ID!
    artifactId: ID!
    artifact: Artifact!
    approverId: String!
    status: ApprovalStatus!
    comment: String
    createdAt: DateTime!
  }

  enum ArtifactStatus {
    DRAFT
    PENDING_APPROVAL
    APPROVED
    PUBLISHED
  }

  enum ApprovalStatus {
    PENDING
    APPROVED
    REJECTED
  }

  input ArtifactFilters {
    status: ArtifactStatus
    createdAfter: DateTime
    createdBefore: DateTime
  }

  input CreateArtifactInput {
    tenantId: ID!
    title: String!
    content: String!
    version: String!
    evidenceIds: [ID!]
  }

  input UpdateArtifactInput {
    title: String
    content: String
    version: String
    evidenceIds: [ID!]
  }

  # Search options
  input SearchOptions {
    limit: Int
    minRelevance: Float
    useReranking: Boolean
    rerankingModel: String
    attributes: RankingAttributes
  }

  input RankingAttributes {
    relevance: Float
    recency: Float
    authority: Float
    popularity: Float
    diversity: Float
  }

  # Pagination
  input Pagination {
    limit: Int
    offset: Int
    cursor: String
  }

  # Connection types for pagination
  type EvidenceConnection {
    edges: [EvidenceEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type EvidenceEdge {
    node: Evidence!
    cursor: String!
  }

  type ClaimConnection {
    edges: [ClaimEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ClaimEdge {
    node: Claim!
    cursor: String!
  }

  type BeliefNodeConnection {
    edges: [BeliefNodeEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type BeliefNodeEdge {
    node: BeliefNode!
    cursor: String!
  }

  type ForecastConnection {
    edges: [ForecastEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ForecastEdge {
    node: Forecast!
    cursor: String!
  }

  type EventConnection {
    edges: [EventEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type EventEdge {
    node: Event!
    cursor: String!
  }

  type ArtifactConnection {
    edges: [ArtifactEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ArtifactEdge {
    node: Artifact!
    cursor: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    hasPreviousPage: Boolean!
    startCursor: String
    endCursor: String
  }

  # Agent Protocol types
  type Agent @key(fields: "id") {
    id: ID!
    name: String!
    version: String!
    capabilities: [String!]!
    endpoint: String!
    publicKey: String
    metadata: JSON
    profile: AgentProfile
    connections: [AgentConnectionType!]!
    health: AgentHealthStatus
    createdAt: DateTime!
  }

  type AgentConnectionType {
    connectionId: ID!
    agentId: ID!
    peerAgentId: ID!
    status: ConnectionStatus!
    establishedAt: DateTime!
    lastHeartbeat: DateTime
    capabilities: [String!]!
    metadata: JSON
  }

  enum ConnectionStatus {
    CONNECTING
    CONNECTED
    DISCONNECTED
    ERROR
  }

  type AgentNetwork {
    networkId: ID!
    name: String!
    description: String
    agents: [Agent!]!
    topology: NetworkTopology!
    metadata: JSON
    health: NetworkHealthReport
    createdAt: DateTime!
  }

  enum NetworkTopology {
    MESH
    STAR
    HIERARCHICAL
    RING
  }

  type NetworkHealthReport {
    networkId: ID!
    overallHealth: NetworkHealthStatus!
    agentCount: Int!
    healthyAgents: Int!
    degradedAgents: Int!
    unhealthyAgents: Int!
    averageLatency: Float!
    agentStatuses: [AgentHealthStatus!]!
    timestamp: DateTime!
  }

  enum NetworkHealthStatus {
    HEALTHY
    DEGRADED
    UNHEALTHY
  }

  type AgentHealthStatus {
    agentId: ID!
    status: AgentHealthState!
    lastHeartbeat: DateTime!
    latency: Float
    errorRate: Float
    capabilities: [String!]
    metadata: JSON
  }

  enum AgentHealthState {
    HEALTHY
    DEGRADED
    UNHEALTHY
    UNKNOWN
  }

  type NetworkRoutingResult {
    path: [String!]!
    hops: Int!
    estimatedLatency: Float!
    reliability: Float!
  }

  type NetworkJoinResponse {
    success: Boolean!
    network: AgentNetwork
    assignedRole: String
    error: String
  }

  type AgentConnectionPage {
    edges: [AgentEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type AgentEdge {
    node: Agent!
    cursor: String!
  }

  type AgentNetworkConnection {
    edges: [AgentNetworkEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type AgentNetworkEdge {
    node: AgentNetwork!
    cursor: String!
  }

  # Agent Protocol input types
  input AgentFilters {
    capabilities: [String!]
    version: String
    minUptime: Float
    maxCost: Float
    minReliability: Float
    requiredSkills: [String!]
    availableOnly: Boolean
    tags: [String!]
  }

  input NetworkFilters {
    topology: NetworkTopology
    minAgents: Int
    maxAgents: Int
    tags: [String!]
  }

  input RegisterAgentInput {
    agentId: ID!
    name: String!
    version: String!
    capabilities: [String!]!
    endpoint: String!
    publicKey: String
    metadata: JSON
  }

  input RegisterAgentWithProfileInput {
    agentId: ID!
    name: String!
    version: String!
    description: String
    capabilities: [String!]!
    skills: [AgentSkillInput!]!
    cost: AgentCostInput!
    reliability: AgentReliabilityInput!
    availability: AgentAvailabilityInput!
    metadata: AgentProfileMetadataInput
    endpoint: String!
    publicKey: String
  }

  input AgentSkillInput {
    skill: String!
    proficiency: Float!
    verified: Boolean!
  }

  input AgentCostInput {
    baseCost: Float!
    currency: String!
    pricingModel: PricingModel!
    tokenCost: Float
  }

  input AgentReliabilityInput {
    uptime: Float!
    successRate: Float!
    averageLatency: Float!
    lastVerified: DateTime!
  }

  input AgentAvailabilityInput {
    status: AvailabilityStatus!
    maxConcurrentTasks: Int!
    currentLoad: Int!
  }

  input AgentProfileMetadataInput {
    author: String
    tags: [String!]
    documentation: String
    license: String
    supportContact: String
  }

  input HireAgentInput {
    taskType: String!
    requiredCapabilities: [String!]!
    budget: Float
    maxLatency: Float
    requiredSkills: [String!]
  }

  input CreateAgentNetworkInput {
    networkId: ID!
    name: String!
    description: String
    agents: [ID!]!
    topology: NetworkTopology!
    metadata: JSON
  }

  input JoinNetworkInput {
    agentId: ID!
    networkId: ID!
    credentials: NetworkCredentials
  }

  input NetworkCredentials {
    token: String
    publicKey: String
  }

  input SendAgentMessageInput {
    fromAgentId: ID!
    toAgentId: ID!
    type: MessageType!
    payload: JSON!
    correlationId: String
    metadata: JSON
  }

  enum MessageType {
    REQUEST
    RESPONSE
    NOTIFICATION
    HEARTBEAT
  }

  input RouteMessageInput {
    networkId: ID!
    fromAgentId: ID!
    toAgentId: ID!
    preferLowLatency: Boolean
    preferHighReliability: Boolean
    maxHops: Int
  }

  input SelectAgentInput {
    networkId: ID!
    requiredCapabilities: [String!]
    preferLowLatency: Boolean
    preferHighReliability: Boolean
    excludeAgentIds: [ID!]
  }

  # AP2 Payment Protocol types
  type PaymentMandate {
    mandateId: ID!
    fromAgentId: ID!
    toAgentId: ID!
    type: PaymentMandateType!
    amount: Int!
    currency: String!
    description: String
    metadata: JSON
    expiresAt: DateTime
    status: PaymentMandateStatus!
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  enum PaymentMandateType {
    INTENT
    CART
    PAYMENT
  }

  enum PaymentMandateStatus {
    PENDING
    APPROVED
    REJECTED
    EXPIRED
    REVOKED
    COMPLETED
  }

  type PaymentSignature {
    signatureId: ID!
    mandateId: ID!
    agentId: ID!
    signature: String!
    publicKey: String!
    timestamp: DateTime!
  }

  type WalletBalance {
    walletId: ID!
    agentId: ID!
    currency: String!
    balance: Int!
    availableBalance: Int!
  }

  type WalletLedgerEntry {
    entryId: ID!
    walletId: ID!
    agentId: ID!
    type: LedgerEntryType!
    amount: Int!
    currency: String!
    mandateId: ID
    transactionId: ID
    description: String
    balance: Int!
    timestamp: DateTime!
  }

  enum LedgerEntryType {
    CREDIT
    DEBIT
  }

  type WalletLimit {
    walletId: ID!
    agentId: ID!
    limitType: LimitType!
    limitAmount: Int!
    currency: String!
    currentUsage: Int!
    resetAt: DateTime!
  }

  enum LimitType {
    DAILY
    WEEKLY
    MONTHLY
    TRANSACTION
    LIFETIME
  }

  type PaymentResult {
    success: Boolean!
    transactionId: ID
    fromBalance: Int!
    toBalance: Int!
    error: String
  }

  type PaymentAuditLog {
    auditId: ID!
    mandateId: ID
    transactionId: ID
    action: String!
    fromAgentId: ID
    toAgentId: ID
    amount: Int
    currency: String
    status: AuditStatus!
    error: String
    metadata: JSON
    timestamp: DateTime!
  }

  enum AuditStatus {
    SUCCESS
    FAILURE
  }

  type WalletLedgerConnection {
    edges: [WalletLedgerEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type WalletLedgerEdge {
    node: WalletLedgerEntry!
    cursor: String!
  }

  type PaymentAuditConnection {
    edges: [PaymentAuditEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type PaymentAuditEdge {
    node: PaymentAuditLog!
    cursor: String!
  }

  # AP2 Payment Protocol input types
  input CreatePaymentMandateInput {
    fromAgentId: ID!
    toAgentId: ID!
    type: PaymentMandateType!
    amount: Int!
    currency: String!
    description: String
    metadata: JSON
    expiresIn: Int
  }

  input ApprovePaymentMandateInput {
    mandateId: ID!
    agentId: ID!
    signature: String!
    publicKey: String!
  }

  input ExecutePaymentInput {
    mandateId: ID!
    fromAgentId: ID!
    toAgentId: ID!
    signature: String!
    publicKey: String!
  }

  input SetWalletLimitInput {
    walletId: ID!
    agentId: ID!
    limitType: LimitType!
    limitAmount: Int!
    currency: String!
  }

  input PaymentMandateFilters {
    fromAgentId: ID
    toAgentId: ID
    status: PaymentMandateStatus
  }

  input PaymentAuditFilters {
    mandateId: ID
    transactionId: ID
    fromAgentId: ID
    toAgentId: ID
    action: String
    status: AuditStatus
  }

  # POS (Perception Operating System) types
  type POSMetrics {
    bge: POSBGEMetrics!
    consensus: POSConsensusMetrics!
    aaal: POSAAALMetrics!
    npe: POSNPEMetrics!
    tsm: POSTSMMetrics!
    dfd: POSDFDMetrics!
    overall: POSOverallMetrics!
  }

  type POSBGEMetrics {
    weakNodesCount: Int!
    averageIrrelevance: Float!
  }

  type POSConsensusMetrics {
    totalSignals: Int!
    consensusStrength: Float!
  }

  type POSAAALMetrics {
    citationScore: Float!
    publishedContent: Int!
  }

  type POSNPEMetrics {
    activePredictions: Int!
    preemptiveActions: Int!
  }

  type POSTSMMetrics {
    trustScore: Float!
    validatorCount: Int!
  }

  type POSDFDMetrics {
    overallControl: Float!
    stageCoverage: Int!
  }

  type POSOverallMetrics {
    posScore: Float!
  }

  type POSCycleResult {
    success: Boolean!
    actions: [String!]!
    metrics: POSMetrics!
  }

  type ConsensusSignal {
    id: ID!
    tenantId: ID!
    type: ConsensusSignalType!
    title: String!
    content: String!
    source: String!
    sourceUrl: String
    author: String
    authorCredential: String
    publishedAt: DateTime!
    relevanceScore: Float!
    trustScore: Float!
    amplification: Float!
    evidenceRefs: [ID!]!
    relatedNodeIds: [ID!]!
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  enum ConsensusSignalType {
    THIRD_PARTY_ANALYSIS
    EXPERT_COMMENTARY
    COMPARATIVE_RESEARCH
    BALANCED_PERSPECTIVE
    INDEPENDENT_REVIEW
  }

  type ExternalValidator {
    id: ID!
    tenantId: ID!
    name: String!
    type: ValidatorType!
    description: String
    url: String
    publicKey: String
    trustLevel: Float!
    isActive: Boolean!
    lastValidated: DateTime
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  enum ValidatorType {
    INDEPENDENT_AUDIT
    CERTIFICATION_BODY
    EXPERT_PANEL
    RESEARCH_INSTITUTION
    STANDARDS_ORGANIZATION
  }

  type Audit {
    id: ID!
    tenantId: ID!
    type: AuditType!
    title: String!
    description: String
    auditorId: ID
    status: AuditStatus!
    findings: JSON
    recommendations: JSON
    publishedAt: DateTime
    publicUrl: String
    evidenceRefs: [ID!]!
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
    completedAt: DateTime
  }

  enum AuditType {
    SECURITY
    COMPLIANCE
    OPERATIONAL
    FINANCIAL
    QUALITY
  }

  enum AuditStatus {
    PLANNED
    IN_PROGRESS
    COMPLETED
    PUBLISHED
  }

  type SLA {
    id: ID!
    tenantId: ID!
    name: String!
    description: String
    metric: String!
    target: Float!
    actual: Float
    unit: String!
    period: SLAPeriod!
    publicUrl: String
    isPublic: Boolean!
    lastUpdated: DateTime!
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  enum SLAPeriod {
    HOURLY
    DAILY
    WEEKLY
    MONTHLY
    QUARTERLY
  }

  type RebuttalDocument {
    id: ID!
    tenantId: ID!
    title: String!
    content: String!
    targetClaimId: ID
    targetNodeId: ID
    evidenceRefs: [ID!]!
    structuredData: JSON
    publicUrl: String
    isPublished: Boolean!
    publishedAt: DateTime
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type IncidentExplanation {
    id: ID!
    tenantId: ID!
    incidentId: String!
    title: String!
    summary: String!
    explanation: String!
    rootCause: String
    resolution: String
    prevention: String
    evidenceRefs: [ID!]!
    publicUrl: String
    isPublished: Boolean!
    publishedAt: DateTime
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type MetricsDashboard {
    id: ID!
    tenantId: ID!
    name: String!
    description: String
    metrics: JSON!
    publicUrl: String
    isPublic: Boolean!
    refreshInterval: Int
    lastRefreshed: DateTime!
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type PredictedComplaint {
    id: ID!
    tenantId: ID!
    predictedTopic: String!
    predictedContent: String!
    probability: Float!
    confidence: Float!
    horizonDays: Int!
    triggers: JSON!
    preemptiveActionId: ID
    status: PredictionStatus!
    evidenceRefs: [ID!]!
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
    resolvedAt: DateTime
  }

  enum PredictionStatus {
    ACTIVE
    ADDRESSED
    FALSE_POSITIVE
    EXPIRED
  }

  type DecisionCheckpoint {
    id: ID!
    tenantId: ID!
    stage: DecisionStage!
    checkpointId: String!
    name: String!
    description: String
    controlType: ControlType!
    content: JSON!
    metrics: JSON
    isActive: Boolean!
    metadata: JSON
    createdAt: DateTime!
    updatedAt: DateTime!
  }

  enum DecisionStage {
    AWARENESS
    RESEARCH
    COMPARISON
    DECISION
    POST_PURCHASE
  }

  enum ControlType {
    NARRATIVE_FRAMING
    AI_SUMMARY
    THIRD_PARTY_VALIDATOR
    PROOF_DASHBOARD
    REINFORCEMENT_LOOP
  }

  type PreemptiveAction {
    actionId: ID!
    type: String!
    content: String!
    evidenceRefs: [ID!]!
  }

  # POS Connection types
  type ConsensusSignalConnection {
    edges: [ConsensusSignalEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ConsensusSignalEdge {
    node: ConsensusSignal!
    cursor: String!
  }

  type ExternalValidatorConnection {
    edges: [ExternalValidatorEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type ExternalValidatorEdge {
    node: ExternalValidator!
    cursor: String!
  }

  type AuditConnection {
    edges: [AuditEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type AuditEdge {
    node: Audit!
    cursor: String!
  }

  type SLAConnection {
    edges: [SLAEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type SLAEdge {
    node: SLA!
    cursor: String!
  }

  type RebuttalDocumentConnection {
    edges: [RebuttalDocumentEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type RebuttalDocumentEdge {
    node: RebuttalDocument!
    cursor: String!
  }

  type IncidentExplanationConnection {
    edges: [IncidentExplanationEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type IncidentExplanationEdge {
    node: IncidentExplanation!
    cursor: String!
  }

  type PredictedComplaintConnection {
    edges: [PredictedComplaintEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type PredictedComplaintEdge {
    node: PredictedComplaint!
    cursor: String!
  }

  type DecisionCheckpointConnection {
    edges: [DecisionCheckpointEdge!]!
    pageInfo: PageInfo!
    totalCount: Int!
  }

  type DecisionCheckpointEdge {
    node: DecisionCheckpoint!
    cursor: String!
  }

  # POS Input types
  input ConsensusSignalFilters {
    type: ConsensusSignalType
    minTrustScore: Float
    minRelevanceScore: Float
    publishedAfter: DateTime
  }

  input ValidatorFilters {
    type: ValidatorType
    isActive: Boolean
    minTrustLevel: Float
  }

  input AuditFilters {
    type: AuditType
    status: AuditStatus
    publishedAfter: DateTime
  }

  input SLAFilters {
    isPublic: Boolean
    metric: String
    period: SLAPeriod
  }

  input RebuttalDocumentFilters {
    isPublished: Boolean
    targetClaimId: ID
    targetNodeId: ID
  }

  input IncidentExplanationFilters {
    isPublished: Boolean
    incidentId: String
  }

  input PredictedComplaintFilters {
    status: PredictionStatus
    minProbability: Float
    horizonDays: Int
  }

  input CreateConsensusSignalInput {
    tenantId: ID!
    type: ConsensusSignalType!
    title: String!
    content: String!
    source: String!
    sourceUrl: String
    author: String
    authorCredential: String
    publishedAt: DateTime!
    relevanceScore: Float
    trustScore: Float
    amplification: Float
    evidenceRefs: [ID!]
    relatedNodeIds: [ID!]
  }

  input RegisterExternalValidatorInput {
    tenantId: ID!
    name: String!
    type: ValidatorType!
    description: String
    url: String
    publicKey: String
    trustLevel: Float
  }

  input CreateAuditInput {
    tenantId: ID!
    type: AuditType!
    title: String!
    description: String
    auditorId: ID
    findings: JSON
    recommendations: JSON
  }

  input CompleteAuditInput {
    auditId: ID!
    findings: JSON!
    recommendations: JSON!
    publicUrl: String
  }

  input CreateSLAInput {
    tenantId: ID!
    name: String!
    description: String
    metric: String!
    target: Float!
    unit: String!
    period: SLAPeriod!
  }

  input UpdateSLAMetricInput {
    slaId: ID!
    actual: Float!
  }

  input PublishSLAInput {
    slaId: ID!
    publicUrl: String
  }

  input CreateRebuttalDocumentInput {
    tenantId: ID!
    title: String!
    content: String!
    targetClaimId: ID
    targetNodeId: ID
    evidenceRefs: [ID!]
    structuredData: JSON
  }

  input PublishRebuttalInput {
    documentId: ID!
    publicUrl: String
  }

  input CreateIncidentExplanationInput {
    tenantId: ID!
    incidentId: String!
    title: String!
    summary: String!
    explanation: String!
    rootCause: String
    resolution: String
    prevention: String
    evidenceRefs: [ID!]
  }

  input PublishIncidentExplanationInput {
    explanationId: ID!
    publicUrl: String
  }

  input CreateMetricsDashboardInput {
    tenantId: ID!
    name: String!
    description: String
    metrics: JSON!
    refreshInterval: Int
  }

  input PublishMetricsDashboardInput {
    dashboardId: ID!
    publicUrl: String
  }

  input CreatePredictedComplaintInput {
    tenantId: ID!
    predictedTopic: String!
    predictedContent: String!
    probability: Float!
    confidence: Float!
    horizonDays: Int!
    triggers: JSON!
    evidenceRefs: [ID!]
  }

  input CreateDecisionCheckpointInput {
    tenantId: ID!
    stage: DecisionStage!
    checkpointId: String!
    name: String!
    description: String
    controlType: ControlType!
    content: JSON!
    metrics: JSON
  }
`;
