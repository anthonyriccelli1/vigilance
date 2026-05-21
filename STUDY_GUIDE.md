# Vigilance — Complete Technical Study Guide

Everything we built, why we built it, and what it means. Study this like notes from class — every decision is explained so you can defend it in an interview without hesitation.

---

## Table of Contents

1. [The Big Picture](#the-big-picture)
2. [Backend — FastAPI + PostgreSQL](#backend)
3. [Frontend — React + TypeScript](#frontend)
4. [Real-Time Pipeline — WebSocket + Simulator](#real-time-pipeline)
5. [AI Assistant — Vigil](#ai-assistant)
6. [Docker + Docker Compose](#docker)
7. [CI/CD Pipeline — GitHub Actions](#cicd)
8. [AWS Infrastructure](#aws)
9. [How It All Connects](#how-it-all-connects)
10. [Interview Questions and Answers](#interview-qa)

---

## 1. The Big Picture

Vigilance simulates how a defense or aerospace facility tracks physical assets — tools, equipment, components — as they move between zones using RFID readers mounted on the ceiling.

**The problem it solves:** In a real facility, an operator needs to know where every asset is at any given moment, whether it is compliant with regulations, and whether it needs maintenance. Without a system like this, that information lives in spreadsheets, whiteboards, or nobody's head at all.

**The architecture in one sentence:** A React frontend talks to a FastAPI backend over REST and WebSocket. The backend stores data in PostgreSQL on AWS RDS. Docker packages everything. GitHub Actions deploys it automatically to AWS ECS every time code merges to main.

```
Browser (React)
    ↓ REST API calls (fetch)
    ↓ WebSocket (live events)
FastAPI Backend (ECS Fargate)
    ↓ SQL queries
PostgreSQL (RDS — private subnet)
```

---

## 2. Backend — FastAPI + PostgreSQL

### Why FastAPI?

FastAPI is a modern Python web framework. We chose it over Flask or Django because:
- It generates automatic documentation at `/docs` (Swagger UI) — you can test every endpoint in the browser
- It uses Python type hints to validate request and response data automatically
- It supports async — important for the WebSocket endpoint
- It is fast and production-ready

### File: `backend/models.py`

This is where we define the database schema using SQLAlchemy ORM (Object Relational Mapper). ORM means we write Python classes instead of raw SQL — SQLAlchemy translates them into database tables.

```python
class Zone(Base):
    __tablename__ = "zones"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    zone_type = Column(String)
    assets = relationship("Asset", back_populates="zone")

class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True)
    asset_tag = Column(String, unique=True)
    name = Column(String)
    status = Column(String)  # active, inactive, maintenance
    compliant = Column(Boolean)
    zone_id = Column(Integer, ForeignKey("zones.id"))
    zone = relationship("Zone", back_populates="assets")
```

**Why two tables with a foreign key?**
An asset belongs to one zone. A zone can have many assets. This is called a one-to-many relationship. The `zone_id` column on the Asset table is the foreign key — it points to which zone that asset is currently in. When an asset moves, we just update `zone_id`.

**Why ORM instead of raw SQL?**
With raw SQL you write `SELECT * FROM assets WHERE zone_id = 3`. With ORM you write `db.query(Asset).filter(Asset.zone_id == 3).all()`. The ORM version is safer (no SQL injection), easier to read, and works across different databases without changing code.

### File: `backend/schemas.py`

Pydantic schemas define what data looks like going in and out of the API. Think of them as contracts — if the request doesn't match the schema, FastAPI rejects it automatically.

```python
class AssetResponse(BaseModel):
    id: int
    asset_tag: str
    name: str
    status: str
    compliant: bool
    zone_id: int
    zone_name: str = ""  # populated manually from the relationship

    model_config = ConfigDict(from_attributes=True)
```

**Why separate schemas from models?**
The database model is what gets stored. The schema is what gets sent to the client. They are often similar but not identical — for example, we add `zone_name` to the response schema even though that field doesn't exist on the Asset table. We populate it from the relationship.

### File: `backend/database.py`

```python
DATABASE_URL = settings.database_url
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

**What is `get_db`?**
It is a FastAPI dependency. Every endpoint that needs database access declares `db: Session = Depends(get_db)` in its function signature. FastAPI calls `get_db`, opens a session, passes it to the endpoint, and then closes it when the request is done. This pattern ensures the connection is always closed even if the endpoint throws an error.

**What is `SessionLocal`?**
A session is one conversation with the database. You open it, run queries, commit changes, and close it. `SessionLocal()` creates a new session. We never reuse sessions across requests — each request gets its own.

### File: `backend/config.py`

```python
class Settings(BaseSettings):
    database_url: str
    anthropic_api_key: str

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
```

**Why Pydantic Settings?**
It reads environment variables automatically. Locally it reads from `.env`. In production (ECS) the values come from the task definition environment variables. The code never changes — just the environment. This is the 12-factor app pattern for configuration.

### File: `backend/seed_data.py`

Seeds the database with realistic fake data — 8 zones and 75 assets. It is idempotent, meaning you can run it multiple times and it will not create duplicates. It checks if data already exists before inserting.

**Why seed data?**
Without data the app looks empty and useless in a demo. The seed data makes it look like a real facility with real assets the moment it starts.

### File: `backend/main.py` — The Endpoints

**`GET /health`**
Returns `{"status": "healthy"}`. Used by the ALB health check to know the container is running. If this endpoint stops responding, the ALB stops sending traffic to that container. This is why we built it in Phase 1 — AWS needs it.

**`GET /health/detailed`**
Runs a real database query (`SELECT 1`) and measures how long it takes. Returns both API status and database status with latency. Used by the System Health page in the frontend.

**`GET /assets`**
Returns all assets. Supports query parameters for filtering: `?status=active`, `?zone_id=3`, `?category=tools`. Each filter adds a `.filter()` clause to the SQLAlchemy query.

**`GET /zones`**
Returns all zones with an asset count for each. The count is computed with a separate `db.query(Asset).filter(Asset.zone_id == zone.id).count()` call for each zone.

**`GET /dashboard`**
Aggregates counts for the KPI cards: total assets, active, inactive, maintenance, compliant, non-compliant. All computed with SQLAlchemy `.count()` queries.

**`POST /assets/{id}/move`**
Moves an asset to a different zone. Takes a `zone_id` in the request body, updates `asset.zone_id`, and commits to the database.

**`POST /chat`**
The AI endpoint. Fetches live data, builds a system prompt, calls Claude Haiku, returns the response. Explained in detail in the Vigil section.

**`WebSocket /ws`**
The real-time endpoint. Explained in the WebSocket section.

---

## 3. Frontend — React + TypeScript

### Why React?

React is the industry standard for building interactive UIs. It uses a component model — you build small reusable pieces and compose them into pages. When data changes, React re-renders only what changed, not the whole page.

### Why TypeScript?

TypeScript adds types to JavaScript. Instead of `let asset = {}` you write `let asset: Asset = {}` where `Asset` is a defined interface. This catches errors at compile time instead of runtime — your editor tells you when you pass the wrong data to a component before you even run the code.

### File: `src/types.ts`

Defines TypeScript interfaces that mirror the backend Pydantic schemas:

```typescript
export interface Asset {
  id: number;
  asset_tag: string;
  name: string;
  status: string;
  compliant: boolean;
  zone_id: number;
  zone_name: string;
}
```

**Why mirror the backend schemas?**
The frontend and backend need to agree on what data looks like. If the backend sends `zone_id` but the frontend expects `zoneId`, things break silently. Keeping them in sync prevents that.

### File: `src/api.ts`

Centralized API client. Every fetch call goes through here:

```typescript
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) throw new Error(`API error: ${response.status}`);
  return response.json();
}
```

**Why centralize?**
If the base URL changes, you change it in one place. If you need to add authentication headers later, you add them in one place. If you need error handling, it lives in one place.

**What is `import.meta.env.VITE_API_URL`?**
Vite (the build tool) reads environment variables at build time. In development it reads from `.env.local`. In production the CI/CD pipeline injects `VITE_API_URL` as an environment variable during the build — the compiled JavaScript has the ALB URL baked in.

### File: `src/facilityMapStore.tsx`

A React Context provider that lives above the router. It stores buildings, floors, floor plan images, and zone polygons.

**Why above the router?**
React unmounts components when you navigate away from them. If the map state lived inside the FacilityMap page component, it would be destroyed every time you navigated to Assets or Dashboard and came back. By placing the provider above the router in the component tree, it never unmounts — the state persists for the entire session.

**Why not localStorage?**
We tried. Base64-encoded images can exceed localStorage's 5MB quota silently — the write fails with no error and the image disappears. React state has no size limit and is always reliable. localStorage is used as a best-effort backup only.

### File: `src/hooks/useAssetFeed.ts`

A custom React hook that manages the WebSocket connection:

```typescript
export function useAssetFeed(initialAssets: Asset[]): FeedState {
  const [assets, setAssets] = useState<Asset[]>(initialAssets);
  const [moves, setMoves]   = useState<MoveEvent[]>([]);
  const [connected, setConnected] = useState(false);
  // connects WebSocket, patches assets in-place on move events
}
```

**What is a custom hook?**
A function that starts with `use` and contains React state or effects. It lets you extract and reuse stateful logic across components.

**Why patch in-place instead of re-fetching?**
When an asset moves, we already have all the data we need in the WebSocket event. Re-fetching all assets from the API would be wasteful. Instead we update just the one asset that moved using `setAssets(prev => prev.map(a => a.id === data.asset_id ? {...a, zone_id: data.to_zone_id} : a))`.

**Why auto-reconnect?**
WebSocket connections drop — network blips, server restarts, load balancer timeouts. Auto-reconnect with a 3 second delay means the operator never has to manually refresh the page.

### The Pages

**`Dashboard.tsx`**
Fetches from `/dashboard` on load. Shows KPI cards (total, active, maintenance, compliant) and zone breakdown. Cards are clickable and link to the Assets page with filters pre-applied.

**`FacilityMap.tsx`**
The most complex page. Uses `useFacilityMap()` for persistent state, `useAssetFeed()` for live asset positions, and a draw state machine for zone creation:
- `idle` — no drawing happening
- `drawing` — user is clicking vertices on the SVG
- `naming` — polygon closed, user types the zone name

Zone polygons are stored as arrays of `{x, y}` points as percentages of the image dimensions — this way zones scale correctly if the image is resized.

**`Assets.tsx`**
Filterable table of all assets. Clicking a row opens a detail drawer with the full asset profile. URL query parameters (`?status=active`) allow deep linking from the Dashboard KPI cards.

**`SystemHealth.tsx`**
Pings `/health/detailed` every 30 seconds. Runs its own WebSocket connection to check connectivity. Shows a live uptime counter ticking every second. Surfaces overall system status in a single banner.

---

## 4. Real-Time Pipeline — WebSocket + Simulator

### Why WebSocket instead of polling?

Polling means the browser asks the server "anything new?" every N seconds. This introduces up to N seconds of lag and sends a constant stream of HTTP requests even when nothing has changed.

WebSocket is a persistent TCP connection. The server pushes data to the browser the instant something happens — no lag, no wasted requests. This mirrors how real RFID systems work: the reader detects a tag, immediately emits an event, and every connected client sees it in milliseconds.

### File: `backend/simulator.py`

```python
class AssetSimulator:
    def __init__(self):
        self.subscribers: Set[WebSocket] = set()
        self.running = False

    async def start(self):
        self.running = True
        while self.running:
            await asyncio.sleep(random.uniform(10, 25))
            await self._move_random_assets()
```

**What is asyncio?**
Python's built-in async framework. `await asyncio.sleep()` pauses the coroutine without blocking the entire process — other requests can be handled while the simulator is sleeping. This is why FastAPI can serve HTTP requests and run the simulator simultaneously.

**Why a module-level singleton?**
```python
simulator = AssetSimulator()  # at the bottom of simulator.py
```
Every Python import of this module gets the same instance. This means `main.py` and the WebSocket endpoint both reference the exact same subscriber set — when a client connects, it is added to the set that the simulator broadcasts to.

**The broadcast pattern:**
```python
async def _broadcast(self, payload: dict):
    await asyncio.gather(*(_send(ws) for ws in self.subscribers))
    self.subscribers -= dead
```
`asyncio.gather` sends to all subscribers in parallel — a slow client doesn't block others. Dead connections (disconnected clients) are removed from the set silently.

### WebSocket Endpoint in `main.py`

```python
@app.websocket("/ws")
async def websocket_feed(websocket: WebSocket):
    await websocket.accept()
    simulator.add_subscriber(websocket)
    try:
        while True:
            await websocket.receive_text()  # keeps connection alive, detects disconnect
    except WebSocketDisconnect:
        pass
    finally:
        simulator.remove_subscriber(websocket)
```

**Why `receive_text()` in a loop?**
We never expect the client to send messages — this is a one-way push channel. But `receive_text()` is how FastAPI detects when the client disconnects. When the tab closes, `receive_text()` raises `WebSocketDisconnect`, the `finally` block runs, and the subscriber is removed cleanly.

---

## 5. AI Assistant — Vigil

### File: `backend/main.py` — `POST /chat`

**Step 1 — Fetch live data**
```python
total = db.query(Asset).count()
active = db.query(Asset).filter(Asset.status == "active").count()
non_compliant_assets = db.query(Asset).filter(Asset.compliant == False).all()
```

**Step 2 — Build the system prompt**
```python
system_prompt = f"""You are Vigil, the AI assistant for Vigilance...
CURRENT FACILITY STATUS:
- Total assets: {total}
- Active: {active}
- Non-compliant: {non_compliant}
...
```

**Step 3 — Call Claude**
```python
client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
message = client.messages.create(
    model="claude-haiku-4-5",
    max_tokens=512,
    system=system_prompt,
    messages=[{"role": "user", "content": request.message}]
)
```

**Why this pattern?**
This is called context injection — a RAG-adjacent pattern. Instead of letting the AI answer from its training data (which would produce hallucinated numbers), we pull the real current data from the database and inject it directly into the prompt. The AI can only answer based on what we give it.

**Why Claude Haiku?**
Haiku is the fastest and cheapest Claude model. For a chatbot that needs to respond quickly to operational queries, speed matters more than raw capability. A facility operator is not asking for an essay — they want a fast accurate answer.

**Why not true RAG?**
True RAG uses a vector database (like pgvector on PostgreSQL) to store embeddings of historical data — past movement events, compliance history, maintenance logs. Semantic search retrieves the most relevant historical context before calling the model. We architected Vigilance to support this as the next phase — pgvector can be enabled on our existing RDS instance with one SQL command.

---

## 6. Docker + Docker Compose

### What is Docker?

Docker packages your application and all its dependencies into a container — a self-contained unit that runs identically everywhere. No more "works on my machine" problems.

### File: `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim          # start from a minimal Python image
WORKDIR /app                   # set working directory inside container
COPY requirements.txt .        # copy requirements first (layer caching)
RUN pip install -r requirements.txt  # install dependencies
COPY . .                       # copy application code
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Why copy requirements.txt before the rest of the code?**
Docker builds in layers. Each instruction is a layer. If requirements.txt hasn't changed, Docker reuses the cached `pip install` layer — the slowest step. Only if requirements.txt changes does it reinstall packages. This makes rebuilds much faster.

**Why `0.0.0.0` instead of `127.0.0.1`?**
`127.0.0.1` means "only accept connections from this machine." Inside a container that means nothing can reach it from outside. `0.0.0.0` means "accept connections from any network interface" — required for the ALB to reach the container.

### File: `docker-compose.yml`

Docker Compose is the local development tool. It orchestrates multiple containers together:

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: vigilance
      POSTGRES_USER: vigilance
      POSTGRES_PASSWORD: vigilance
    volumes:
      - postgres_data:/var/lib/postgresql/data  # persist data between restarts

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy  # wait for postgres to be ready
    environment:
      DATABASE_URL: postgresql://vigilance:vigilance@db:5432/vigilance
```

**Why `depends_on` with `service_healthy`?**
Without this, the backend starts immediately and tries to connect to PostgreSQL before PostgreSQL is ready. The connection fails and the backend crashes. `service_healthy` tells Compose to wait until the PostgreSQL health check passes before starting the backend.

**Why a named volume?**
`postgres_data:/var/lib/postgresql/data` maps a Docker-managed volume to the directory where PostgreSQL stores its data files. Without this, every `docker compose down` would destroy all your data. With it, data persists between container restarts.

**Docker Compose is only for local development.** In production we use ECS Fargate for the backend and RDS for the database. Docker Compose does not exist in production.

---

## 7. CI/CD Pipeline — GitHub Actions

### What is CI/CD?

**CI (Continuous Integration)** — every code change is automatically tested. Broken code is caught before it reaches production.

**CD (Continuous Deployment)** — every code change that passes tests is automatically deployed to production. No manual deployment steps.

### File: `.github/workflows/deploy.yml`

```yaml
on:
  push:
    branches: [main]        # runs on push to main
  pull_request:
    branches: [main]        # also runs on PRs targeting main
```

**Why both push and pull_request?**
Pull requests run only the CI portion (tests). This gates merging — you cannot merge a PR if tests fail. Pushes to main run both CI and CD. This means:
- Feature branch → PR → tests run → human reviews → merge → CD deploys

### Job 1 — `test-backend`

```yaml
test-backend:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4          # clone the repo
    - uses: actions/setup-python@v5      # install Python
    - run: pip install -r requirements.txt
    - run: python -m pytest test_api.py -v
```

**What do the tests check?**
The pytest suite (`backend/test_api.py`) tests every API endpoint:
- Does `/health` return 200?
- Does `/assets` return a list?
- Does filtering by status work?
- Does `/dashboard` return the right shape of data?
- Does moving an asset update its zone?

If any test fails, the entire pipeline stops. The deploy job never runs.

### Job 2 — `deploy`

```yaml
deploy:
  needs: test-backend   # only runs if test-backend passed
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
```

The `if` condition is critical — it ensures deployment only happens on pushes to main, not on pull requests. This is the gate between CI and CD.

**Steps:**

**Configure AWS credentials**
```yaml
- uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```
GitHub Secrets store sensitive values encrypted. The pipeline reads them at runtime — they are never in the code.

**Login to ECR**
```yaml
- uses: aws-actions/amazon-ecr-login@v2
```
Same as running `aws ecr get-login-password | docker login` manually — authenticates Docker to your private registry.

**Build, tag, push**
```yaml
- run: |
    docker build -t vigilance-backend ./backend
    docker tag vigilance-backend:latest ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.us-east-1.amazonaws.com/vigilance-backend:latest
    docker push ...
```
Builds the image, gives it the ECR address as its name, uploads it.

**Deploy to ECS**
```yaml
- run: |
    aws ecs update-service \
      --cluster vigilance-cluster \
      --service vigilance-backend-service-2xqpf774 \
      --force-new-deployment
```
Tells ECS to pull the new image and start a rolling deployment. ECS starts the new container, waits for the health check to pass, then terminates the old container. Zero downtime.

**Build and deploy frontend**
```yaml
- name: Build and deploy frontend to S3
  env:
    VITE_API_URL: ${{ secrets.VITE_API_URL }}
  run: |
    cd frontend
    npm install
    npm run build
    aws s3 sync dist/ s3://vigilance-frontend --delete
```
`VITE_API_URL` is injected as an environment variable. Vite reads it at build time and bakes the ALB URL into the compiled JavaScript. `aws s3 sync` uploads everything in `dist/` to S3 and removes any old files.

---

## 8. AWS Infrastructure

### The Architecture

```
Internet
    ↓
vigilance-igw (Internet Gateway)
    ↓
vigilance-alb (Application Load Balancer) — public subnet
    ↓  port 80
ECS Fargate Task (FastAPI) — public subnet
    ↓  port 5432
RDS PostgreSQL — private subnet (NO internet access)
```

### VPC (Virtual Private Cloud)

**What it is:** Your own private network inside AWS. Nothing enters or leaves except through rules you define.

**Why we created it:** Without a VPC, all your resources are on the default AWS network — shared with other customers, less control. A custom VPC gives you complete control over IP addressing, routing, and network isolation.

**CIDR block `10.0.0.0/16`:** Defines the IP address range for your entire VPC — 65,536 possible IP addresses. Every resource inside gets an IP from this range.

### Subnets

**Public subnets** (`10.0.1.0/24`, `10.0.2.0/24`):
- Have a route to the Internet Gateway
- Resources here can receive inbound internet traffic
- ALB and ECS tasks live here

**Private subnets** (`10.0.3.0/24`, `10.0.4.0/24`):
- No route to the internet
- Resources here are completely unreachable from outside AWS
- RDS lives here

**Why two of each?**
AWS requires resources to span at least 2 Availability Zones (AZs) for high availability. Each AZ is a physically separate data center. If one catches fire, the other keeps running.

### Internet Gateway

Connects your VPC to the public internet. Without it, nothing in your VPC can reach or be reached from the internet. The public subnets have a route table entry that sends all internet traffic (`0.0.0.0/0`) through the IGW.

### Security Groups

Security groups are stateful firewalls attached to individual resources. "Stateful" means if you allow inbound traffic on port 80, the response is automatically allowed outbound — you do not need a separate outbound rule.

**`vigilance-alb-sg`**
- Inbound: port 80 from `0.0.0.0/0` (anyone on the internet)
- This is the only resource that accepts public traffic

**`vigilance-ecs-sg`**
- Inbound: port 8000 from `vigilance-alb-sg` only
- The ECS task is completely unreachable from the internet — only the ALB can talk to it

**`vigilance-rds-sg`**
- Inbound: port 5432 from `vigilance-ecs-sg` only
- The database is completely unreachable from everywhere except the application

This is called **defense in depth** — multiple layers of security so a breach at one layer does not expose everything.

### ECR (Elastic Container Registry)

AWS's private Docker registry. After `docker build` produces an image, `docker push` uploads it to ECR. ECR stores versioned images — every deployment produces a new image tagged with `latest`. ECS pulls from ECR when starting a new task.

**Why not Docker Hub?**
Docker Hub is public by default. ECR is private — only your AWS account can pull from it. For a real application you never want your container image publicly accessible.

### ECS Fargate

**ECS (Elastic Container Service)** — AWS's container orchestration service. You tell it what to run, how many copies, and where.

**Fargate** — the serverless mode. You never see or manage the underlying EC2 instances. AWS handles scheduling, patching, and scaling the servers. You just define the container.

**Cluster** — the boundary that contains your services. Think of it as the building.

**Task Definition** — the blueprint for your container. Defines the image, CPU, memory, ports, and environment variables.

**Service** — the manager that keeps your task running. You say "I want 1 copy of this task definition running at all times." If the task crashes, the service starts a new one automatically.

**Why Fargate over EC2?**
With EC2 you manage the server — OS updates, security patches, capacity planning. With Fargate you just say "run this container with 0.25 vCPU and 0.5GB RAM" and AWS figures out where to run it. Less operational overhead.

### Application Load Balancer (ALB)

Sits in front of ECS and receives all public traffic. It forwards requests to the ECS task and returns responses to the client.

**Why not just expose ECS directly?**
ECS tasks have dynamic IP addresses that change every time a task restarts. The ALB has a stable DNS name that never changes. Users always hit the same URL regardless of how many times ECS restarts behind it.

**Health checks:** The ALB pings `/health` on your container every 30 seconds. If it stops responding, the ALB marks the task unhealthy and stops sending traffic to it. ECS then starts a new task. This is why building the `/health` endpoint in Phase 1 was critical.

### RDS (Relational Database Service)

AWS's managed PostgreSQL service. Instead of installing and managing PostgreSQL on an EC2 instance, AWS runs it for you.

**What AWS handles:**
- Automated daily backups
- OS and PostgreSQL patches
- Storage management
- Multi-AZ failover (in production)

**db.t3.micro** — the smallest instance size. 2 vCPU, 1GB RAM. More than enough for a portfolio project.

**Private subnet placement** — the database has no public IP address. The only way to reach it is from inside the VPC, through the ECS security group. This is the correct production pattern.

### S3 (Simple Storage Service)

Stores your compiled React application as static files — HTML, CSS, JavaScript. S3 serves these files directly to browsers with no server needed.

**Static website hosting** — S3 has a built-in feature that serves files as a website. We enabled it and set `index.html` as the root document.

**Why `index.html` as both index and error document?**
React Router handles navigation in the browser. When a user visits `/assets` directly, S3 looks for a file called `assets` — which doesn't exist. Without setting `index.html` as the error document, S3 returns a 404. With it, S3 serves `index.html` and React Router takes over to show the right page.

### IAM (Identity and Access Management)

Controls who can do what in your AWS account.

**`anthony-admin` user** — the IAM user we created with programmatic access (access key + secret key). Used by the AWS CLI and GitHub Actions to interact with AWS services.

**Why not use the root account?**
The root account has unlimited permissions and cannot be restricted. If those credentials leaked, someone could do anything to your account. IAM users have specific permissions you define. If an IAM user's keys leak, you delete the user and the damage is limited.

**GitHub Secrets** — `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are stored as encrypted secrets in GitHub. The pipeline reads them at runtime. They are never written to the code repository.

**Service-linked role** — ECS needs permission to perform actions on your behalf (create network interfaces, write logs, etc.). The service-linked role `AWSServiceRoleForECS` grants these permissions. We had to create it manually because it was a new account.

---

## 9. How It All Connects

Here is the full end-to-end flow for a single user action — opening the dashboard:

1. User opens `http://vigilance-frontend.s3-website-us-east-1.amazonaws.com`
2. S3 serves `index.html` and the compiled React JavaScript bundle
3. React loads in the browser, renders the Dashboard page
4. Dashboard calls `api.getDashboard()` which fetches from `http://vigilance-alb.../dashboard`
5. The request hits the ALB in the public subnet
6. ALB forwards to the ECS Fargate task on port 8000
7. FastAPI receives the request, calls `get_db()` to open a database session
8. SQLAlchemy runs COUNT queries against RDS PostgreSQL in the private subnet
9. FastAPI returns a JSON response
10. React receives the JSON, updates state, re-renders the KPI cards

And for a real-time asset movement:

1. Simulator wakes up, picks a random asset and zone
2. Updates `asset.zone_id` in PostgreSQL via SQLAlchemy
3. Builds a JSON event and calls `_broadcast()`
4. `asyncio.gather` sends the event to every connected WebSocket client simultaneously
5. Browser receives the event in `useAssetFeed`
6. `setAssets` patches the moved asset in local state — no API call needed
7. React re-renders the asset dot on the facility map in its new zone
8. The movement is prepended to the MovementLog

---

## 10. Interview Questions and Answers

**"Walk me through the architecture of Vigilance."**
> "It's a three-tier architecture. React frontend served from S3, FastAPI backend running in a Docker container on ECS Fargate, and PostgreSQL on RDS in a private subnet. The frontend and backend communicate over REST for initial data loads and WebSocket for real-time asset movement events. The whole stack sits inside a custom VPC with public subnets for the ALB and ECS, and private subnets for the database."

**"Why did you choose Fargate over EC2?"**
> "Fargate removes the operational overhead of managing servers. With EC2 I'd be responsible for OS patching, capacity planning, and instance health. Fargate lets me define the container requirements — CPU, memory, image — and AWS handles the rest. For this workload that tradeoff made sense."

**"How does your CI/CD pipeline work?"**
> "GitHub Actions. On every push to a feature branch, the pipeline runs the pytest suite. If tests fail, everything stops. On merge to main, it builds a Docker image, pushes it to ECR, forces a new ECS deployment with a rolling update, and syncs the compiled frontend to S3. The whole thing is automated — no manual steps from commit to production."

**"How did you secure the database?"**
> "RDS lives in a private subnet with no public IP address. The security group only allows inbound traffic on port 5432 from the ECS security group — nothing else can reach it. The only path to the database is through the application layer."

**"What is the WebSocket used for?"**
> "Real-time asset movement events. Rather than polling the API every few seconds, the frontend maintains a persistent WebSocket connection. When the backend moves an asset it broadcasts a JSON event to all connected clients instantly. The frontend patches the local state in-place — no full re-fetch needed."

**"What would you add to this in production?"**
> "Several things. Environment separation — dev, staging, and prod pipelines with separate infrastructure. Rollback mechanisms if a deployment fails health checks. Container vulnerability scanning in the pipeline before images reach ECR. CloudWatch alarms for ECS CPU and RDS connection counts. And I'd replace the simulator with a real UDP listener that receives packets from actual RFID readers."

**"Have you used Kubernetes?"**
> "I've written Kubernetes manifests — Deployments, Services, and Ingress configurations. I understand the architecture: pods scheduled by the control plane, Services abstracting the network layer, Ingress handling external routing. I deployed this project to ECS Fargate rather than EKS to manage cost, but the containerization and orchestration concepts translate directly."

**"What is the difference between CI and CD?"**
> "CI is continuous integration — every code change is automatically tested. The goal is catching broken code before it reaches production. CD is continuous deployment — every change that passes CI is automatically deployed to production with no manual steps. They work together: CI is the gate, CD is the delivery mechanism."

---

*Study this until you can explain every section without looking at it. The goal is not to memorize — it is to understand. If you understand why each decision was made, you can answer any follow-up question an interviewer throws at you.*
