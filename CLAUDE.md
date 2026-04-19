@AGENTS.md

# Claude Quick Entry

Use `AGENTS.md` as the source of truth for architecture, deployment topology, and runbooks.

Claude-specific working rules:
- Prefer changing existing abstractions instead of bypassing `VaultAdapter` and `LLMProvider`.
- Preserve vault-mode branching behavior (`cloud` vs `remote` vs browser local).
- Keep embeddings side effects non-fatal in write/compile flows.
- For infrastructure checks, validate against live CLIs (`vercel`, `supabase`, `ssh parrytech-vps`) before asserting state.
