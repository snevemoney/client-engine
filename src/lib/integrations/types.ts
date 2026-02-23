/**
 * Integration registry types.
 * Normalized structure for tracking integrations across the app.
 * See docs/INTEGRATION_MASTER_CHECKLIST.md for full system view.
 */

export type IntegrationCategory =
  | "signal"
  | "lead"
  | "execution"
  | "proof"
  | "operator"
  | "growth";

export type IntegrationStatus = "done" | "partial" | "missing" | "backlog";

export type IntegrationMode = "read" | "write";

export type TestStatus = "tierA" | "tierB" | "none";

export type IntegrationOwner = "code" | "operator" | "manual" | "ai";

export type Integration = {
  key: string;
  name: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  mode: IntegrationMode;
  envVars: string[];
  testStatus: TestStatus;
  owner: IntegrationOwner;
  notes: string;
};
