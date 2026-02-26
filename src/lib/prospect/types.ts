export type ProspectCriteria = {
  clientType: string;
  industry?: string;
  keywords?: string[];
  budgetMin?: number;
  budgetMax?: number;
  location?: string;
};

export type ProspectResult = {
  id: string;
  source: string;
  title: string;
  description: string;
  url?: string;
  contactPath?: string;
  tags: string[];
  confidence: number;
  meta?: Record<string, unknown>;
};

export type ProspectRunReport = {
  id: string;
  criteria: ProspectCriteria;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "error";
  results: ProspectResult[];
  sourcesSearched: string[];
  totalApiCalls: number;
  errors: string[];
};
