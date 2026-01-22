/**
 * Protocol Security Identity API
 * Register and verify agent identities
 */

import { NextRequest, NextResponse } from "next/server";
import { getProtocolSecurity } from "@/lib/security/protocol-security";
import { requireAuth } from "@/lib/auth/session";
import { logger } from "@/lib/logging/logger";
import { z } from "zod";

const registerIdentitySchema = z.object({
  agentId: z.string(),
  publicKey: z.string(),
  certificate: z.string().optional(),
  oidcToken: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const verifyIdentitySchema = z.object({
  agentId: z.string(),
});

const generateKeyPairSchema = z.object({
  agentId: z.string(),
  algorithm: z.enum(["RSA", "ECDSA", "Ed25519"]).optional(),
});

const signMessageSchema = z.object({
  agentId: z.string(),
  message: z.string(),
  useKMS: z.boolean().optional(),
  useHSM: z.boolean().optional(),
});

const verifySignatureSchema = z.object({
  agentId: z.string(),
  message: z.string(),
  signature: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const action = body.action || "register";

    const protocolSecurity = getProtocolSecurity();

    if (action === "register") {
      const validated = registerIdentitySchema.parse(body);
      await protocolSecurity.registerAgentIdentity(
        validated.agentId,
        validated.publicKey,
        {
          certificate: validated.certificate,
          oidcToken: validated.oidcToken,
          metadata: validated.metadata,
        }
      );

      return NextResponse.json({
        success: true,
        agentId: validated.agentId,
      });
    } else if (action === "verify") {
      const validated = verifyIdentitySchema.parse(body);
      const context = await protocolSecurity.verifyAgentIdentity(validated.agentId);

      if (!context) {
        return NextResponse.json(
          { error: "Agent identity not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        context,
      });
    } else if (action === "generate_keypair") {
      const validated = generateKeyPairSchema.parse(body);
      const keyPair = await protocolSecurity.generateKeyPair(
        validated.agentId,
        validated.algorithm
      );

      return NextResponse.json({
        success: true,
        publicKey: keyPair.publicKey,
        algorithm: keyPair.algorithm,
        // Never return private key in API response
      });
    } else if (action === "sign") {
      const validated = signMessageSchema.parse(body);
      const signature = await protocolSecurity.signMessage(
        validated.agentId,
        validated.message,
        {
          useKMS: validated.useKMS,
          useHSM: validated.useHSM,
        }
      );

      return NextResponse.json({
        success: true,
        signature,
      });
    } else if (action === "verify_signature") {
      const validated = verifySignatureSchema.parse(body);
      const result = await protocolSecurity.verifySignature(
        validated.agentId,
        validated.message,
        validated.signature
      );

      return NextResponse.json({
        success: result.valid,
        result,
      });
    } else {
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 400 }
      );
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }

    logger.error("Protocol security operation failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Operation failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const agentId = searchParams.get("agentId");

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId parameter required" },
        { status: 400 }
      );
    }

    const protocolSecurity = getProtocolSecurity();
    const context = await protocolSecurity.getSecurityContext(agentId);

    if (!context) {
      return NextResponse.json(
        { error: "Agent identity not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ context });
  } catch (error) {
    logger.error("Protocol security context retrieval failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Retrieval failed" },
      { status: 500 }
    );
  }
}
