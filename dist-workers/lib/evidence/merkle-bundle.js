"use strict";
/**
 * Merkleized Evidence Bundles
 *
 * Builds Merkle trees for incident bundles, approval bundles, and export bundles.
 * Enables selective disclosure, tamper-evident audits, and faster verification at scale.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MerkleTreeBuilder = void 0;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("@/lib/logging/logger");
/**
 * Merkle Tree Builder
 */
class MerkleTreeBuilder {
    /**
     * Build Merkle tree from evidence items
     */
    buildTree(items) {
        if (items.length === 0) {
            throw new Error("Cannot build Merkle tree from empty items");
        }
        // Create leaf nodes
        const leaves = items.map((item, index) => {
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
    buildTreeRecursive(nodes) {
        if (nodes.length === 1) {
            return nodes[0];
        }
        const parents = [];
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
    generateProof(tree, leafIndex) {
        const leaf = this.findLeaf(tree, leafIndex);
        if (!leaf) {
            return null;
        }
        const path = [];
        let current = leaf;
        let currentIndex = leafIndex;
        // Traverse up to root
        while (current && current.left !== undefined) {
            // Find sibling
            const parent = this.findParent(tree, current);
            if (!parent)
                break;
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
    verifyProof(proof) {
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
    createBundle(bundleId, items, metadata) {
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
    verifyBundle(bundle) {
        // Rebuild tree and compare root hash
        try {
            const evidence = bundle.items.map((item) => this.deserializeEvidence(item.data));
            const rebuiltTree = this.buildTree(evidence);
            return rebuiltTree.hash === bundle.root_hash;
        }
        catch (error) {
            logger_1.logger.error("Merkle: Bundle verification failed", { error, bundle_id: bundle.bundle_id });
            return false;
        }
    }
    /**
     * Selective disclosure: prove item is in bundle without revealing others
     */
    proveInclusion(bundle, itemIndex) {
        return this.generateProof(bundle.tree, itemIndex);
    }
    /**
     * Hash data using SHA-256
     */
    hash(data) {
        return crypto_1.default.createHash("sha256").update(data).digest("hex");
    }
    /**
     * Serialize evidence to string
     */
    serializeEvidence(evidence) {
        // Create content hash from raw or normalized content
        const contentStr = evidence.content.raw || evidence.content.normalized || "";
        const contentHash = crypto_1.default.createHash("sha256").update(contentStr).digest("hex");
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
    deserializeEvidence(data) {
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
    findLeaf(node, index) {
        if (node.index === index && node.data !== undefined) {
            return node;
        }
        if (node.left) {
            const leftResult = this.findLeaf(node.left, index);
            if (leftResult)
                return leftResult;
        }
        if (node.right) {
            const rightResult = this.findLeaf(node.right, index);
            if (rightResult)
                return rightResult;
        }
        return null;
    }
    /**
     * Find parent of a node
     */
    findParent(root, target) {
        if (root.left === target || root.right === target) {
            return root;
        }
        if (root.left) {
            const leftResult = this.findParent(root.left, target);
            if (leftResult)
                return leftResult;
        }
        if (root.right) {
            const rightResult = this.findParent(root.right, target);
            if (rightResult)
                return rightResult;
        }
        return null;
    }
}
exports.MerkleTreeBuilder = MerkleTreeBuilder;
