/**
 * Phase 2.8.4: Handler for capture_forecast_snapshot job.
 */

import { captureForecastSnapshot } from "@/lib/forecasting/snapshot-service";

export async function handleCaptureForecastSnapshot(): Promise<object> {
  return captureForecastSnapshot();
}
