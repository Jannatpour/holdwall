/**
 * GraphQL Query and Mutation Definitions
 * 
 * Pre-defined GraphQL queries and mutations for agent protocols
 */

// AP2 (Agent Payment Protocol) Queries
export const AP2_QUERIES = {
  GET_WALLET_BALANCE: `
    query GetWalletBalance($walletId: ID!, $currency: String) {
      walletBalance(walletId: $walletId, currency: $currency) {
        walletId
        agentId
        currency
        balance
        availableBalance
      }
    }
  `,

  GET_WALLET_LEDGER: `
    query GetWalletLedger($walletId: ID!, $currency: String, $limit: Int) {
      walletLedger(walletId: $walletId, currency: $currency, limit: $limit) {
        edges {
          node {
            entryId
            walletId
            agentId
            type
            amount
            currency
            mandateId
            transactionId
            description
            balance
            timestamp
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    }
  `,

  GET_PAYMENT_MANDATE: `
    query GetPaymentMandate($mandateId: ID!) {
      paymentMandate(mandateId: $mandateId) {
        mandateId
        fromAgentId
        toAgentId
        type
        amount
        currency
        description
        metadata
        expiresAt
        status
        createdAt
        updatedAt
      }
    }
  `,

  LIST_PAYMENT_MANDATES: `
    query ListPaymentMandates($filters: PaymentMandateFilters, $limit: Int) {
      paymentMandates(filters: $filters, limit: $limit) {
        mandateId
        fromAgentId
        toAgentId
        type
        amount
        currency
        description
        metadata
        expiresAt
        status
        createdAt
        updatedAt
      }
    }
  `,

  GET_PAYMENT_AUDIT_LOGS: `
    query GetPaymentAuditLogs(
      $filters: PaymentAuditFilters
      $pagination: Pagination
    ) {
      paymentAuditLogs(filters: $filters, pagination: $pagination) {
        edges {
          node {
            auditId
            mandateId
            transactionId
            action
            fromAgentId
            toAgentId
            amount
            currency
            status
            error
            metadata
            timestamp
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    }
  `,
};

export const AP2_MUTATIONS = {
  CREATE_PAYMENT_MANDATE: `
    mutation CreatePaymentMandate($input: CreatePaymentMandateInput!) {
      createPaymentMandate(input: $input) {
        mandateId
        fromAgentId
        toAgentId
        type
        amount
        currency
        description
        metadata
        expiresAt
        status
        createdAt
        updatedAt
      }
    }
  `,

  APPROVE_PAYMENT_MANDATE: `
    mutation ApprovePaymentMandate($input: ApprovePaymentMandateInput!) {
      approvePaymentMandate(input: $input) {
        mandateId
        status
        updatedAt
      }
    }
  `,

  EXECUTE_PAYMENT: `
    mutation ExecutePayment($input: ExecutePaymentInput!) {
      executePayment(input: $input) {
        success
        transactionId
        fromBalance
        toBalance
        error
      }
    }
  `,

  REVOKE_PAYMENT_MANDATE: `
    mutation RevokePaymentMandate($mandateId: ID!, $agentId: ID!) {
      revokePaymentMandate(mandateId: $mandateId, agentId: $agentId)
    }
  `,

  SET_WALLET_LIMIT: `
    mutation SetWalletLimit($input: SetWalletLimitInput!) {
      setWalletLimit(input: $input) {
        walletId
        agentId
        limitType
        limitAmount
        currency
        currentUsage
        resetAt
        createdAt
        updatedAt
      }
    }
  `,
};

// ANP (Agent Network Protocol) Queries
export const ANP_QUERIES = {
  GET_NETWORKS: `
    query GetNetworks($filters: NetworkFilters, $pagination: Pagination) {
      networks(filters: $filters, pagination: $pagination) {
        edges {
          node {
            networkId
            name
            description
            topology
            agents {
              agentId
              capabilities
              status
            }
            metadata
            createdAt
            updatedAt
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    }
  `,

  GET_NETWORK_HEALTH: `
    query GetNetworkHealth($networkId: ID!) {
      networkHealth(networkId: $networkId) {
        networkId
        overallStatus
        agentHealth {
          agentId
          status
          lastHeartbeat
          latency
          errorRate
        }
        networkMetrics {
          totalAgents
          activeAgents
          averageLatency
          messageThroughput
        }
      }
    }
  `,
};

export const ANP_MUTATIONS = {
  CREATE_NETWORK: `
    mutation CreateNetwork($input: CreateNetworkInput!) {
      createNetwork(input: $input) {
        networkId
        name
        description
        topology
        agents
        metadata
        createdAt
        updatedAt
      }
    }
  `,

  JOIN_NETWORK: `
    mutation JoinNetwork($networkId: ID!, $agentId: ID!) {
      joinNetwork(networkId: $networkId, agentId: $agentId) {
        networkId
        agentId
        joinedAt
      }
    }
  `,

  LEAVE_NETWORK: `
    mutation LeaveNetwork($networkId: ID!, $agentId: ID!) {
      leaveNetwork(networkId: $networkId, agentId: $agentId)
    }
  `,
};

// A2A (Agent-to-Agent Protocol) Queries
export const A2A_QUERIES = {
  DISCOVER_AGENTS: `
    query DiscoverAgents($filters: AgentFilters, $pagination: Pagination) {
      agents(filters: $filters, pagination: $pagination) {
        edges {
          node {
            id
            name
            version
            capabilities
            endpoint
            publicKey
            profile {
              agentId
              name
              version
              description
              capabilities
              skills {
                skill
                proficiency
                verified
              }
              cost {
                baseCost
                currency
                pricingModel
                tokenCost
              }
              reliability {
                uptime
                successRate
                averageLatency
                lastVerified
              }
              availability {
                status
                maxConcurrentTasks
                currentLoad
              }
              metadata {
                author
                tags
                documentation
                license
                supportContact
              }
            }
            connections {
              connectionId
              agentId
              peerAgentId
              status
              establishedAt
            }
            createdAt
          }
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
        totalCount
      }
    }
  `,

  GET_AGENT: `
    query GetAgent($id: ID!) {
      agent(id: $id) {
        id
        name
        version
        capabilities
        endpoint
        publicKey
        profile {
          agentId
          name
          version
          description
          capabilities
          skills {
            skill
            proficiency
            verified
          }
          cost {
            baseCost
            currency
            pricingModel
            tokenCost
          }
          reliability {
            uptime
            successRate
            averageLatency
            lastVerified
          }
          availability {
            status
            maxConcurrentTasks
            currentLoad
          }
          metadata {
            author
            tags
            documentation
            license
            supportContact
          }
        }
        connections {
          connectionId
          agentId
          peerAgentId
          status
          establishedAt
        }
        createdAt
      }
    }
  `,

  HIRE_AGENT: `
    query HireAgent($input: HireAgentInput!) {
      hireAgent(input: $input) {
        id
        name
        version
        capabilities
        endpoint
        profile {
          agentId
          name
          cost {
            baseCost
            currency
            pricingModel
          }
          reliability {
            uptime
            successRate
            averageLatency
          }
          availability {
            status
            maxConcurrentTasks
            currentLoad
          }
        }
      }
    }
  `,

  GET_AGENT_CONNECTIONS: `
    query GetAgentConnections($agentId: ID!) {
      agentConnections(agentId: $agentId) {
        connectionId
        fromAgentId
        toAgentId
        status
        lastMessageAt
        messageCount
      }
    }
  `,
};

export const A2A_MUTATIONS = {
  REGISTER_AGENT: `
    mutation RegisterAgent($input: RegisterAgentInput!) {
      registerAgent(input: $input) {
        id
        name
        version
        capabilities
        endpoint
        publicKey
        profile {
          agentId
          name
          version
        }
        createdAt
      }
    }
  `,

  REGISTER_AGENT_WITH_PROFILE: `
    mutation RegisterAgentWithProfile($input: RegisterAgentWithProfileInput!) {
      registerAgentWithProfile(input: $input) {
        id
        name
        version
        capabilities
        endpoint
        publicKey
        profile {
          agentId
          name
          version
          description
          capabilities
          skills {
            skill
            proficiency
            verified
          }
          cost {
            baseCost
            currency
            pricingModel
            tokenCost
          }
          reliability {
            uptime
            successRate
            averageLatency
            lastVerified
          }
          availability {
            status
            maxConcurrentTasks
            currentLoad
          }
          metadata {
            author
            tags
            documentation
            license
            supportContact
          }
        }
        createdAt
      }
    }
  `,

  CONNECT_AGENTS: `
    mutation ConnectAgents($fromAgentId: ID!, $toAgentId: ID!) {
      connectAgents(fromAgentId: $fromAgentId, toAgentId: $toAgentId) {
        connectionId
        fromAgentId
        toAgentId
        status
        connectedAt
      }
    }
  `,

  DISCONNECT_AGENTS: `
    mutation DisconnectAgents($connectionId: ID!) {
      disconnectAgents(connectionId: $connectionId)
    }
  `,
};

// AG-UI (Agent-User Interaction Protocol) Queries
export const AGUI_QUERIES = {
  GET_SESSION: `
    query GetSession($sessionId: ID!) {
      conversationSession(sessionId: $sessionId) {
        sessionId
        userId
        agentId
        state
        intent
        messages {
          role
          content
          timestamp
          citations
          metadata
        }
        createdAt
        updatedAt
      }
    }
  `,
};

export const AGUI_MUTATIONS = {
  START_SESSION: `
    mutation StartSession($userId: ID!, $agentId: ID!) {
      startSession(userId: $userId, agentId: $agentId) {
        sessionId
        userId
        agentId
        state
        createdAt
      }
    }
  `,

  PROCESS_INPUT: `
    mutation ProcessInput($sessionId: ID!, $input: ConversationInput!) {
      processInput(sessionId: $sessionId, input: $input) {
        sessionId
        response {
          content
          citations
          metadata
        }
        updatedAt
      }
    }
  `,

  END_SESSION: `
    mutation EndSession($sessionId: ID!) {
      endSession(sessionId: $sessionId)
    }
  `,
};
