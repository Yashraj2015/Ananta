# Ananta DB

> A modern, multi-model cloud database platform. Collections, tables, files, auth, and realtime — all in one place. Built for developers who refuse to be locked in.

## What is Ananta?

Ananta DB is an independent cloud database platform that gives your application:

- **Collections** — Schema-free document store (NoSQL)
- **Tables** — Full relational SQL database
- **Files** — Object storage with automatic media optimization
- **Auth** — User management, JWT, social logins
- **Realtime** — Live WebSocket subscriptions
- **MongoDB compat** — Connect existing Mongoose apps with zero code changes

Connect via SQL (`:5432`), MongoDB wire protocol (`:27017`), REST API, or the `@ananta/js` SDK.

## Repository Structure

```
Ananta/
├── studio/          # Ananta Studio — web dashboard
├── sdk/             # @ananta/js — JavaScript/TypeScript SDK
├── server/          # Core server — multiplexers, API, file processing
├── kavacha/         # Credential vault — dynamic secret management
├── gateway/         # Cloudflare Workers — global edge layer
├── auth/            # Ananta Auth Server
├── realtime/        # Ananta Realtime Server
├── shim/            # LibreChat integration shim
└── www/             # Ananta marketing website
```

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Fill in your configuration

# Start development
npm run dev
```

## License

Apache 2.0 — see [LICENSE](LICENSE)
