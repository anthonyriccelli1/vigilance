# Vigilance

Real-time operational asset tracking dashboard for facility management. Monitor asset locations, zone assignments, compliance status, and query operational data through an AI-powered assistant.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, TypeScript |
| Backend | Python, FastAPI |
| Database | PostgreSQL |
| Containerization | Docker, Docker Compose |
| CI/CD | GitHub Actions |
| Cloud | AWS ECR, ECS Fargate, S3 |
| AI | Anthropic Claude API |

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   React UI  │────▶│  FastAPI Backend │────▶│  PostgreSQL   │
│  (TypeScript)│◀────│  (Python)       │◀────│  (Docker)     │
└─────────────┘     └────────┬────────┘     └──────────────┘
                             │
                    ┌────────▼────────┐
                    │  Anthropic API  │
                    │  (AI Assistant) │
                    └─────────────────┘
```

## Running Locally

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Project Structure

```
vigilance/
├── backend/          # FastAPI Python service
├── frontend/         # React TypeScript app
├── docs/decisions/   # Architecture Decision Records
├── .github/workflows # CI/CD pipeline
├── docker-compose.yml
└── DEVLOG.md         # Build log and decisions
```

## CI/CD Pipeline

Every push to `main` triggers:
1. Run backend tests (pytest)
2. Run frontend tests
3. Build Docker images
4. Push to AWS ECR
5. Deploy to AWS ECS Fargate

## License

MIT
