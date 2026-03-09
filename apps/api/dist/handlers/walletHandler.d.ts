/**
 * walletHandler.ts
 * Routes for querying an agent's on-chain wallet state.
 */
import { Router } from 'express';
import { AsgardVault } from '../vault/AsgardVault';
export declare function createWalletRouter(vault: AsgardVault): Router;
