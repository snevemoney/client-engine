/**
 * Phase 2.8.4: Handler for generate_automation_suggestions job.
 */

import { generateAutomationSuggestionsService } from "@/lib/automation-suggestions/generate-service";

export async function handleGenerateAutomationSuggestions(): Promise<object> {
  return generateAutomationSuggestionsService();
}
