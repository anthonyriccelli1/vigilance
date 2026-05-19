# Vigilance — Development Log

## 2026-05-19 — Project Initialization

### What we set up
- Created project folder structure with separate `backend/` and `frontend/` directories
- Initialized Git repository
- Created `.gitignore` to prevent secrets and build artifacts from being committed
- Created README with architecture diagram and tech stack
- Created `docs/decisions/` for Architecture Decision Records

### Why the structure matters
Each directory (`backend/`, `frontend/`) becomes its own Docker container and deployment unit. This is the microservices pattern — each service is independently buildable, testable, and deployable. The `.github/workflows/` directory is where GitHub looks for CI/CD pipeline definitions (this is a GitHub convention, not something we invented).

### Key decisions
- **PostgreSQL over SQLite**: SQLite is simpler but PostgreSQL in Docker is more credible for interviews and mirrors real production environments. One extra line in docker-compose.yml.
- **Backend-first build order**: The API needs to exist before the frontend can consume it. Building API-first avoids double-mocking.
- **WebSocket over polling**: Real-time updates via WebSocket instead of HTTP polling. Better performance, better demo, better interview talking point.

### Next up
- Phase 1: Build the FastAPI backend with PostgreSQL, data models, and seed data
