# ADR-002: Claude for Brain/Agents, OpenAI for Pipeline

## Status: Accepted

## Context
The system has two distinct AI needs:
1. **Brain + Agents:** Interactive chat with tool calling, complex reasoning, multi-step workflows.
2. **Pipeline steps:** Batch processing (enrich, score, position, propose) on lead data.

## Decision
Use Claude (Anthropic, `claude-sonnet-4-20250514`) for Brain and multi-agent system. Keep OpenAI GPT-4o-mini for pipeline steps.

Reasons:
- **Tool calling quality:** Claude's tool-use is more reliable for the 25-tool Brain and 10-agent system, with better adherence to system prompts.
- **Cost efficiency:** GPT-4o-mini is significantly cheaper for the batch pipeline steps that don't need interactive reasoning.
- **Pipeline stability:** Pipeline steps were built and tested with OpenAI. Migrating would risk regressions in scoring/positioning quality without clear benefit.
- **Streaming:** Claude's streaming API works well for the SSE-based Brain chat UI.

## Consequences
- Two AI provider dependencies (Anthropic + OpenAI).
- Two API keys required (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`).
- Different error handling patterns for each provider.
- Pipeline could eventually migrate to Claude if cost/quality warrants it.
