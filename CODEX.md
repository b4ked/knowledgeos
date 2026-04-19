# Codex Quick Entry

Read `AGENTS.md` first. It contains current architecture + deployment context.

Codex priorities for this repo:
- Respect Next.js 16 behavior and App Router route handler patterns.
- Keep server mode resolution intact (`getServerVaultMode`, `getAdapter`).
- Do not hardcode local-only paths in code intended for VPS or Vercel.
- Validate deploy assumptions with:
  - `vercel project ls`
  - `supabase projects list`
  - `ssh parrytech-vps 'pm2 ls'`
