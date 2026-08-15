/**
 * Site Build Pipeline — artifact types and phase configuration.
 * 9 phases, each produces an Artifact with one of these types.
 */

export const SITE_BUILDER_ARTIFACT_TYPES = [
  "site_architecture",
  "site_design_system",
  "site_content",
  "site_components",
  "site_figma_prompts",
  "site_motion_spec",
  "site_responsive_spec",
  "site_data_spec",
  "site_qa_report",
] as const;

export type SiteBuilderArtifactType = (typeof SITE_BUILDER_ARTIFACT_TYPES)[number];

export const PHASE_CONFIG = [
  { num: 1, skill: "architecture-strategist", artifactType: "site_architecture" as const },
  { num: 2, skill: "design-system-generator", artifactType: "site_design_system" as const },
  { num: 3, skill: "content-architect", artifactType: "site_content" as const },
  { num: 4, skill: "component-logic-builder", artifactType: "site_components" as const },
  { num: 5, skill: "figma-make-prompt-engineer", artifactType: "site_figma_prompts" as const },
  { num: 6, skill: "animation-interaction-designer", artifactType: "site_motion_spec" as const },
  { num: 7, skill: "responsive-behavior-strategist", artifactType: "site_responsive_spec" as const },
  { num: 8, skill: "data-integration-planner", artifactType: "site_data_spec" as const },
  { num: 9, skill: "qa-optimization-checklist", artifactType: "site_qa_report" as const },
] as const;
