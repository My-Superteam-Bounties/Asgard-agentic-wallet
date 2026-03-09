/**
 * agentHandler.ts
 * Routes for provisioning and managing AI agents.
 * Admin-protected: requires ASGARD_ADMIN_KEY.
 */
import { Router } from 'express';
import { AsgardVault } from '../vault/AsgardVault';
import { PolicyEngine } from '../policy/PolicyEngine';
export declare function createAgentRouter(vault: AsgardVault, policy: PolicyEngine): Router;
