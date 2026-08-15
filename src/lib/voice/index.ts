/**
 * Voice Phase 1: Proposal follow-up service.
 * See docs/VOICE_ASSISTANT_PHASE_1_MVP.md and docs/VOICE_ASSISTANT_PHASES.md.
 */
export { getEligibleProposals, type VoiceEligibleProposal } from "./eligible";
export { checkConsent, recordConsent, recordOptOut } from "./consent";
export { logCallOutcome, type LogCallParams } from "./call-log";
export { processVoiceFollowUps, type ProcessVoiceResult } from "./process";
