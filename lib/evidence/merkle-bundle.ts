/**
 * Merkleized Evidence Bundles
 * 
 * Builds Merkle trees for incident bundles, approval bundles, and export bundles.
 * Enables selective disclosure, tamper-evident audits, and faster verification at scale.
 */

import crypto from "crypto";
import { logger } from "@/lib/logging/logger";
import type { Evidence } from "@/lib/evidence/vault";

export interface MerkleNode {
  /** Node hash */
  hash: string;
  /** Left child (if internal node) */
  left?: MerkleNode;
  /** Right child (if internal node) */
  right?: MerkleNode;
  /** Data (if leaf node) */
  data?: string;
  /** Data index (if leaf node) */
  index?: number;
}

export interface MerkleProof {
  /** Root hash */
  root_hash: string;
  /** Proof path (sibling hashes) */
  path: Array<{
    hash: string;
    is_left: boolean;
  }>;
  /** Leaf index */
  leaf_index: number;
  /** Leaf data */
  leaf_data: string;
}

export interface MerkleBundle {
  /** Bundle ID */
  bundle_id: string;
  /** Root hash */
  root_hash: string;
  /** Merkle tree */
  tree: MerkleNode;
  /** Items in bundle */
  items: Array<{
    index: number;
    data: string;
    hash: string;
  }>;
  /** Created timestamp */
  created_at: string;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Merkle Tree Builder
 */
export class MerkleTreeBuilder {
  /**
   * Build Merkle tree from evidence items
   */
  buildTree(items: Evidence[]): MerkleNode {
    if (items.length === 0) {
      throw new Error("Cannot build Merkle tree from empty items");
    }

    // Create leaf nodes
    const leaves: MerkleNode[] = items.map((item, index) => {
      const data = this.serializeEvidence(item);
      const hash = this.hash(data);

      return {
        hash,
        data,
        index,
      };
    });

    // Build tree bottom-up
    return this.buildTreeRecursive(leaves);
  }

  /**
   * Build tree recursively
   */
  private buildTreeRecursive(nodes: MerkleNode[]): MerkleNode {
    if (nodes.length === 1) {
      return nodes[0];
    }

    const parents: MerkleNode[] = [];

    // Pair nodes and create parents
    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = nodes[i + 1] || left; // Duplicate last node if odd

      const combined = left.hash + right.hash;
      const parentHash = this.hash(combined);

      parents.push({
        hash: parentHash,
        left,
        right,
      });
    }

    return this.buildTreeRecursive(parents);
  }

  /**
   * Generate Merkle proof for a leaf
   */
  generateProof(tree: MerkleNode, leafIndex: number): MerkleProof | null {
    const leaf = this.findLeaf(tree, leafIndex);
    if (!leaf) {
      return null;
    }

    const path: Array<{ hash: string; is_left: boolean }> = [];
    let current: MerkleNode | undefined = leaf;
    let currentIndex = leafIndex;

    // Traverse up to root
    while (current && current.left !== undefined) {
      // Find sibling
      const parent = this.findParent(tree, current);
      if (!parent) break;

      const sibling = parent.left === current ? parent.right : parent.left;
      if (sibling) {
        path.push({
          hash: sibling.hash,
          is_left: parent.left === current,
        });
      }

      current = parent;
      currentIndex = Math.floor(currentIndex / 2);
    }

    return {
      root_hash: tree.hash,
      path,
      leaf_index: leafIndex,
      leaf_data: leaf.data || "",
    };
  }

  /**
   * Verify Merkle proof
   */
  verifyProof(proof: MerkleProof): boolean {
    // Recompute hash from leaf up to root
    let currentHash = this.hash(proof.leaf_data);

    for (const step of proof.path) {
      const combined = step.is_left
        ? step.hash + currentHash
        : currentHash + step.hash;
      currentHash = this.hash(combined);
    }

    return currentHash === proof.root_hash;
  }

  /**
   * Create Merkle bundle from evidence
   */
  createBundle(
    bundleId: string,
    items: Evidence[],
    metadata?: Record<string, unknown>
  ): MerkleBundle {
    const tree = this.buildTree(items);

    const bundleItems = items.map((item, index) => {
      const data = this.serializeEvidence(item);
      return {
        index,
        data,
        hash: this.hash(data),
      };
    });

    return {
      bundle_id: bundleId,
      root_hash: tree.hash,
      tree,
      items: bundleItems,
      created_at: new Date().toISOString(),
      metadata,
    };
  }

  /**
   * Verify bundle integrity
   */
  verifyBundle(bundle: MerkleBundle): boolean {
    // Rebuild tree and compare root hash
    try {
      const evidence = bundle.items.map((item) => this.deserializeEvidence(item.data));
      const rebuiltTree = this.buildTree(evidence);

      return rebuiltTree.hash === bundle.root_hash;
    } catch (error) {
      logger.error("Merkle: Bundle verification failed", { error, bundle_id: bundle.bundle_id });
      return false;
    }
  }

  /**
   * Selective disclosure: prove item is in bundle without revealing others
   */
  proveInclusion(bundle: MerkleBundle, itemIndex: number): MerkleProof | null {
    return this.generateProof(bundle.tree, itemIndex);
  }

  /**
   * Hash data using SHA-256
   */
  private hash(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  /**
   * Serialize evidence to string
   */
  private serializeEvidence(evidence: Evidence): string {
    // Create content hash from raw or normalized content
    const contentStr = evidence.content.raw || evidence.content.normalized || "";
    const contentHash = crypto.createHash("sha256").update(contentStr).digest("hex");
    
    return JSON.stringify({
      id: evidence.evidence_id,
      type: evidence.type,
      source: evidence.source,
      content_hash: contentHash,
      collected_at: evidence.source.collected_at,
      metadata: evidence.metadata,
    });
  }

  /**
   * Deserialize evidence from string
   */
  private deserializeEvidence(data: string): Evidence {
    const parsed = JSON.parse(data);
    // Return minimal Evidence structure
    return {
      evidence_id: parsed.id,
      tenant_id: "", // Will be set by caller
      type: parsed.type,
      source: parsed.source || {
        type: "",
        id: "",
        collected_at: parsed.collected_at || new Date().toISOString(),
        collected_by: "",
        method: "manual",
      },
      content: {
        raw: "",
        normalized: "",
        metadata: { hash: parsed.content_hash },
      },
      provenance: {
        collection_method: parsed.source?.method || "manual",
        retention_policy: "",
      },
      created_at: parsed.collected_at || new Date().toISOString(),
      metadata: parsed.metadata || {},
    };
  }

  /**
   * Find leaf node by index
   */
  private findLeaf(node: MerkleNode, index: number): MerkleNode | null {
    if (node.index === index && node.data !== undefined) {
      return node;
    }

    if (node.left) {
      const leftResult = this.findLeaf(node.left, index);
      if (leftResult) return leftResult;
    }

    if (node.right) {
      const rightResult = this.findLeaf(node.right, index);
      if (rightResult) return rightResult;
    }

    return null;
  }

  /**
   * Find parent of a node
   */
  private findParent(root: MerkleNode, target: MerkleNode): MerkleNode | null {
    if (root.left === target || root.right === target) {
      return root;
    }

    if (root.left) {
      const leftResult = this.findParent(root.left, target);
      if (leftResult) return leftResult;
    }

    if (root.right) {
      const rightResult = this.findParent(root.right, target);
      if (rightResult) return rightResult;
    }

    return null;
  }
}
