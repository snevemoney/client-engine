import { runPipelineIfEligible } from "../src/lib/pipeline/runPipeline";

async function main() {
  const leadId = process.argv[2] ?? "cmm4aua7t0000v5dbtaqgk9hb";
  const r = await runPipelineIfEligible(leadId, "manual_test");
  console.log(JSON.stringify(r, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
