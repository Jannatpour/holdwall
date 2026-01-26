"use strict";
/**
 * Model Context Protocol (MCP) Integration
 *
 * Standardize tool access: ingestion tools, evidence query, graph query, publish portal, eval runner.
 * Orchestrator chooses tools/models based on policies, costs, and evaluation outcomes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILTIN_MCP_TOOLS = void 0;
/**
 * Built-in MCP Tools
 */
exports.BUILTIN_MCP_TOOLS = [
    {
        name: "ingest_signal",
        description: "Ingest a signal from a source",
        inputSchema: {
            type: "object",
            properties: {
                source: { type: "string" },
                content: { type: "string" },
                metadata: { type: "object" },
            },
            required: ["source", "content"],
        },
    },
    {
        name: "query_evidence",
        description: "Query the evidence vault",
        inputSchema: {
            type: "object",
            properties: {
                query: { type: "string" },
                filters: { type: "object" },
            },
            required: ["query"],
        },
    },
    {
        name: "query_graph",
        description: "Query the belief graph",
        inputSchema: {
            type: "object",
            properties: {
                node_id: { type: "string" },
                path_depth: { type: "number" },
            },
        },
    },
    {
        name: "publish_artifact",
        description: "Publish an AAAL artifact to PADL",
        inputSchema: {
            type: "object",
            properties: {
                artifact_id: { type: "string" },
                target_url: { type: "string" },
            },
            required: ["artifact_id"],
        },
        requires_approval: true,
    },
    {
        name: "run_evaluation",
        description: "Run AI Answer Evaluation Harness",
        inputSchema: {
            type: "object",
            properties: {
                prompt_id: { type: "string" },
                model: { type: "string" },
            },
            required: ["prompt_id", "model"],
        },
    },
];
