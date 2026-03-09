/**
 * intentHandler.ts
 * The core routing layer for agent transaction intents.
 *
 * Flow:
 *   Agent Intent → Policy Check → Build Transaction → Vault Signs → Kora Sponsors Gas → Broadcast
 */
import { Router } from 'express';
import { AsgardVault } from '../vault/AsgardVault';
import { PolicyEngine } from '../policy/PolicyEngine';
export declare function createIntentRouter(vault: AsgardVault, policy: PolicyEngine): Router;
