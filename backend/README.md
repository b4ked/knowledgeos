# KnowledgeOS Backend

This service runs the filesystem-backed API on a VPS while the frontend stays on Vercel.

## Run locally

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

The backend listens on `http://127.0.0.1:8787` by default and expects requests to include the `x-knowledgeos-backend-secret` header matching `KNOWLEDGEOS_PROXY_SECRET`.

## Production

1. Copy the repo to the VPS.
2. Set `backend/.env`.
3. Run `npm install && npm run build` inside `backend/`.
4. Install the systemd unit from `deploy/knowledgeos-backend.service`.
5. Reverse proxy `knos-api.parrytech.co` to port `8787` using the included nginx example.
