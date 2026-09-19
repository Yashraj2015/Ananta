# Ananta DB — Production-Grade Database Platform

## Overview
Ananta is an independent, multi-protocol database platform competing directly with Firebase, Supabase, MongoDB Atlas, and PlanetScale.

- **MongoDB Wire Protocol** (:27017) — Mongoose, MongoDB drivers, Compass compatible
- **PostgreSQL Wire Protocol** (:5432) — Prisma, Django, Rails, psql compatible  
- **REST API** (:8080) — Any HTTP client, @ananta/js SDK
- **File Storage** (:8081) — S3-compatible, with automatic compression

## Architecture

`
Users → Cloudflare Edge → Ananta Server → Kavacha Vault → Backends
`

All backend credentials live exclusively in Kavacha (a separate credential vault).
Ananta's source code contains zero vendor names — infrastructure is identified by codenames only.

## Monorepo Structure

| Directory | Purpose |
|-----------|---------|
| server/ | Core Node.js server (API, MongoDB proxy, Files) |
| kavacha/ | Credential vault (mTLS, scoped tokens, rotation) |
| gateway/ | Cloudflare Workers edge (WAF, rate limit, routing) |
| sdk/ | @ananta/js TypeScript SDK |
| shim/ | LibreChat pre-start integration shim |
| supabase/ | Supabase Studio fork (Ananta Studio dashboard) |
| supabase-js/ | supabase-js fork → @ananta/js base |
| gotrue/ | GoTrue fork → Ananta Auth server |
| ealtime/ | Supabase Realtime fork → Ananta Realtime |
| FerretDB/ | MongoDB → PostgreSQL translation layer |
| pgcat/ | PostgreSQL connection pooler (Rust) |
| postgrest/ | Auto-REST from PostgreSQL schema |
| mongobetween/ | MongoDB wire protocol multiplexer (Go) |
| alkey/ | Redis-compatible cache (BSD-3-Clause) |
| ullmq/ | Redis-backed job queue |
| uptime-kuma/ | Private internal monitoring (never exposed) |
| sharp/ | Image compression library |
| FFmpeg/ | Video transcoding (system-installed) |

## Quick Start (Development)

\\\ash
# 1. Copy env files
cp server/.env.example server/.env
cp kavacha/.env.example kavacha/.env

# 2. Add your credentials to both .env files

# 3. Install dependencies
cd server && npm install
cd ../kavacha && npm install
cd ../gateway && npm install
cd ../sdk && npm install

# 4. Start Kavacha (separate terminal)
cd kavacha && npm start

# 5. Start Ananta Server
cd server && npm run dev
\\\

## Security Model

- **Kavacha**: All backend credentials live here. Ananta only knows KAVACHA_URL + mTLS cert.
- **Codenames**: All backends identified as 
ode-a1, 
ode-n1, etc. in all logs and code.
- **Credential rotation**: Atlas 7-day, Neon 15-min temp roles, R2 15-min presigned.
- **Error sanitization**: All vendor names stripped from any outbound error messages.

## License

Proprietary. All rights reserved. Open-source components used under their respective licenses (Apache 2.0, MIT, BSD-3-Clause).
