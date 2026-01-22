/**
 * Bounded Toolsets
 * 
 * Focused, least-privilege tools with explicit I/O schemas
 * for security and clarity.
 */

import type { MCPTool } from "./types";

export interface ToolSchema {
  name: string;
  description: string;
  input: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
    }>;
    required?: string[];
  };
  output: {
    type: string;
    description: string;
  };
  permissions: string[];
  rateLimit?: {
    requests: number;
    window: string; // e.g., "1 minute"
  };
}

export class ToolBuilder {
  /**
   * Build tool from schema
   */
  buildTool(schema: ToolSchema): MCPTool {
    return {
      name: schema.name,
      description: schema.description,
      version: "1.0.0",
      inputSchema: schema.input,
      outputSchema: schema.output,
      requires_approval: schema.permissions.length > 0,
      requires_evidence: false,
      cost: {
        credits: 1,
      },
    };
  }

  /**
   * Validate tool call against schema
   */
  validateToolCall(
    toolCall: { tool_name: string; parameters: Record<string, unknown> },
    schema: ToolSchema
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required properties
    for (const required of schema.input.required || []) {
      if (!(required in toolCall.parameters)) {
        errors.push(`Missing required parameter: ${required}`);
      }
    }

    // Check parameter types
    for (const [param, value] of Object.entries(toolCall.parameters)) {
      const property = schema.input.properties[param];
      if (!property) {
        errors.push(`Unknown parameter: ${param}`);
        continue;
      }

      const valueType = typeof value;
      if (property.type === "string" && valueType !== "string") {
        errors.push(`Parameter ${param} must be string, got ${valueType}`);
      } else if (property.type === "number" && valueType !== "number") {
        errors.push(`Parameter ${param} must be number, got ${valueType}`);
      } else if (property.type === "boolean" && valueType !== "boolean") {
        errors.push(`Parameter ${param} must be boolean, got ${valueType}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Create schema from tool definition
   */
  createSchema(
    name: string,
    description: string,
    inputProperties: Record<string, { type: string; description: string; required?: boolean }>,
    outputType: string = "string",
    permissions: string[] = []
  ): ToolSchema {
    const required = Object.entries(inputProperties)
      .filter(([_, prop]) => prop.required !== false)
      .map(([name]) => name);

    return {
      name,
      description,
      input: {
        type: "object",
        properties: inputProperties,
        required,
      },
      output: {
        type: outputType,
        description: `Output from ${name}`,
      },
      permissions,
    };
  }
}
