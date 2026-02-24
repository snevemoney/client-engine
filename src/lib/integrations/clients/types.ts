/**
 * Shared types for integration provider clients.
 */

import type { IntegrationMode } from "../providerRegistry";

export type ProviderClientResult<T = unknown> =
  | { ok: true; data: T; message?: string }
  | { ok: false; data: null; message: string };

export type ConnectionContext = {
  provider: string;
  mode: IntegrationMode;
  prodOnly: boolean;
  configJson: Record<string, unknown>;
};
