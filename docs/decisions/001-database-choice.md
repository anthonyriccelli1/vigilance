# ADR-001: PostgreSQL over SQLite

## Status
Accepted

## Context
We need a relational database for storing asset, zone, and compliance data. The two main options for a project this size are SQLite (file-based, zero config) and PostgreSQL (client-server, production-grade).

## Decision
Use PostgreSQL running in a Docker container.

## Reasoning
- PostgreSQL mirrors real production environments at defense contractors and enterprise companies
- Running it in Docker means zero local installation — `docker-compose up` and it's running
- Demonstrates knowledge of client-server database architecture, connection pooling, and migrations
- SQLite, while simpler, signals "toy project" to experienced interviewers
- PostgreSQL supports concurrent connections, which matters when the AI chatbot and frontend both query simultaneously

## Consequences
- Slightly more complex local setup (Docker required)
- Need to manage database connection strings via environment variables
- Need a database migration strategy (we'll use Alembic or simple SQL scripts)
