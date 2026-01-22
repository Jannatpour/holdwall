/**
 * Production Evidence Vault Implementation
 * Database-backed evidence storage
 */

import { DatabaseEvidenceVault } from "./vault-db";

// Export singleton instance
export const evidenceVault = new DatabaseEvidenceVault();
