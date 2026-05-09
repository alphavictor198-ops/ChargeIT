# GatiCharge ⚡ — India's Unified EV Charging Intelligence Layer

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)](https://postgresql.org)

> **Not just a charging locator. An intelligence engine.**

GatiCharge is a production-grade EV charging platform for India combining physics-based range prediction, Erlang-C queuing theory, Bayesian trust scoring, and Monte Carlo simulations.

---

## 🚀 Quick Start (Docker)

```bash
# 1. Clone repository
git clone https://github.com/your-org/gaticharge.git
cd gaticharge

# 2. Configure environment
cp .env.example .env
# Edit .env and add your API keys (optional for demo mode)

# 3. Start all services
docker-compose up --build

# 4. Seed initial data (first run only)
docker exec gaticharge_backend python scripts/seed.py
```

**Access:**
- 🌐 Frontend: http://localhost:3000
- ⚙️ Backend API: http://localhost:8000
- 📚 API Docs: http://localhost:8000/docs

**Demo credentials:**
| Role | Email | Password |
|------|-------|----------|
| User | `demo@gaticharge.in` | `Demo@12345` |
| Admin | `admin@gaticharge.in` | `Admin@12345` |

---

## 📁 Project Structure

```
gaticharge/
├── apps/
│   └── web/                    # Next.js 15 frontend
│       ├── app/                # App Router pages
│       │   ├── page.tsx        # Landing page
│       │   ├── dashboard/      # EV intelligence dashboard
│       │   ├── stations/       # Station explorer + map
│       │   ├── route-planner/  # A* route optimizer
│       │   ├── bookings/       # Slot booking management
│       │   └── auth/           # Login / register
│       ├── components/         # Reusable UI components
│       │   ├── map/MapView.tsx # Leaflet map with custom markers
│       │   └── stations/       # Station panel
│       ├── lib/api.ts          # Centralized API client
│       └── store/              # Zustand state stores
│
├── backend/
│   ├── app/
│   │   ├── api/v1/             # FastAPI route handlers
│   │   │   ├── auth.py         # JWT + Google OAuth
│   │   │   ├── stations.py     # Station discovery
│   │   │   ├── bookings.py     # Slot booking CRUD
│   │   │   ├── intelligence.py # Range / route / wait APIs
│   │   │   └── admin.py        # Admin dashboard APIs
│   │   ├── algorithms/         # Core intelligence engine
│   │   │   ├── energy_model.py # Physics-based EV energy model
│   │   │   ├── erlang_c.py     # Queuing wait prediction
│   │   │   ├── monte_carlo.py  # Arrival SOC simulation
│   │   │   ├── route_optimizer.py # A* route planning
│   │   │   └── trust_layer.py  # Bayesian trust scoring
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic schemas
│   │   ├── services/           # External API wrappers
│   │   ├── workers/            # Celery background tasks
│   │   └── core/               # Config, security, database
│   ├── tests/                  # Pytest test suite
│   ├── scripts/seed.py         # Database seeder
│   └── Dockerfile
│
├── docker/
│   ├── nginx/nginx.conf        # Reverse proxy
│   └── postgres/init.sql       # DB initialization
├── docker-compose.yml
└── .env.example
```

---

## 🧠 Intelligence Engine

### 1. Physics-Based Range Model

Implements the full energy equation:

```
P(v, θ, T) = P_rolling + P_aero + P_gradient + P_hvac

P_rolling  = m × g × Cr × v
P_aero     = 0.5 × ρ × Cd × A × v³
P_gradient = m × g × sin(θ) × v
P_hvac     = f(ΔT from 22°C)
```

**Supported Indian EVs:**
| Vehicle | Battery | Efficiency | Max Charge |
|---------|---------|-----------|-----------|
| Tata Nexon EV | 40.5 kWh | 155 Wh/km | 50 kW |
| Tata Tiago EV | 24.0 kWh | 115 Wh/km | 25 kW |
| MG ZS EV | 50.3 kWh | 175 Wh/km | 76 kW |
| BYD Atto 3 | 60.5 kWh | 165 Wh/km | 88 kW |

### 2. Erlang-C Queuing Model

```
E_c(c, ρ) = P(wait > 0)

Where:
  c = number of chargers
  λ = arrival rate (vehicles/hour)
  μ = service rate per charger
  ρ = λ / (c × μ)   [utilization]
```

### 3. Bayesian Trust Scoring

Beta conjugate model:
- α increases with positive reports
- β increases with negative reports  
- Time decay: negative reports decay 4× faster
- Output: trust score ∈ [0, 1]

### 4. Monte Carlo Arrival SOC

1000 simulations per request with Gaussian noise on:
- Speed (σ=8%), Traffic factor (σ=15%)
- Temperature (σ=2°C), Elevation (σ=10%)

Returns p5/p25/p50/p75/p95 confidence intervals.

### 5. A* Route Optimizer

Greedy A* planning:
1. Check if direct route is feasible (SOC allows it)
2. Find reachable stations within SOC budget
3. Select furthest reachable with highest trust score
4. Charge to 80% (optimal battery health)
5. Repeat until destination reached

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| State | Zustand, React Query |
| Maps | Leaflet + OpenStreetMap |
| Animations | Framer Motion |
| Backend | FastAPI, Python 3.12 |
| Database | PostgreSQL 16 + SQLAlchemy |
| Cache | Redis |
| Queue | Celery + Celery Beat |
| Auth | JWT + Google OAuth |
| Proxy | Nginx |

---

## 📡 API Reference

### Authentication
```http
POST /api/v1/auth/register    # Create account
POST /api/v1/auth/login       # Login (JWT)
POST /api/v1/auth/refresh     # Refresh token
GET  /api/v1/auth/me          # Current user
POST /api/v1/auth/google      # Google OAuth
```

### Stations
```http
GET  /api/v1/stations                  # List all
GET  /api/v1/stations/nearby           # Near coordinates
GET  /api/v1/stations/:id              # Station detail
GET  /api/v1/stations/:id/trust        # Trust score
POST /api/v1/stations/report           # Submit issue report
```

### Intelligence
```http
POST /api/v1/range/predict             # Physics range prediction
POST /api/v1/route/optimize            # A* route optimizer
GET  /api/v1/stations/:id/wait         # Erlang-C wait prediction
GET  /api/v1/vehicles                  # Supported EV profiles
```

### Bookings
```http
POST   /api/v1/bookings                # Create booking
GET    /api/v1/bookings                # List my bookings
GET    /api/v1/bookings/:id            # Booking detail
PATCH  /api/v1/bookings/:id/cancel     # Cancel booking
DELETE /api/v1/bookings/:id            # Delete (admin)
```

### Admin
```http
GET /api/v1/admin/stats                # Platform stats
GET /api/v1/admin/users                # User management
GET /api/v1/admin/reports              # All reports
GET /api/v1/admin/bookings/analytics   # Booking charts
```

---

## ⚙️ Development Setup

### Backend Only

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Start PostgreSQL + Redis (via Docker)
docker run -d --name pg -e POSTGRES_DB=gaticharge \
  -e POSTGRES_USER=gaticharge -e POSTGRES_PASSWORD=gaticharge_secure_pass_2025 \
  -p 5432:5432 postgres:16-alpine

docker run -d --name redis -p 6379:6379 redis:7-alpine

# Set environment
cp .env.example .env

# Run migrations + seed
python scripts/seed.py

# Start API server
uvicorn app.main:app --reload --port 8000
```

### Frontend Only

```bash
cd apps/web

# Install dependencies
npm install

# Configure environment
echo "NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1" > .env.local

# Start dev server
npm run dev
```

### Run Tests

```bash
# Backend unit tests
cd backend
pytest tests/ -v --cov=app

# Frontend (when test suite added)
cd apps/web
npm test
```

---

## 🌐 External API Setup

All external APIs are **optional** — GatiCharge gracefully falls back to estimates when keys are missing.

| API | Purpose | Get Key |
|-----|---------|---------|
| Open Charge Map | Live station data | [openchargemap.org/site/develop/api](https://openchargemap.org/site/develop/api) |
| Google Maps/Directions | Traffic-aware routing | [console.cloud.google.com](https://console.cloud.google.com) |
| OpenWeather | Temperature for range adjustment | [openweathermap.org/api](https://openweathermap.org/api) |
| Open Elevation | Elevation gain for energy model | Free, no key needed |

---

## 🚢 Production Deployment

### Vercel (Frontend)
```bash
cd apps/web
vercel deploy --prod
# Set NEXT_PUBLIC_API_URL to your Railway backend URL
```

### Railway (Backend)
```bash
railway up --service backend
# Set all environment variables in Railway dashboard
```

### Full Docker Production
```bash
# Build with production settings
docker-compose -f docker-compose.yml up -d --build

# Scale workers
docker-compose up -d --scale celery_worker=3
```

---

## 🔐 Security

- JWT with configurable expiry (default: 60 min)
- bcrypt password hashing (12 rounds)
- IP-based rate limiting via Redis
- SQL injection protection via SQLAlchemy ORM
- CORS whitelist configuration
- Non-root Docker user
- Nginx security headers

---

## 📊 Performance Targets

| Metric | Target |
|--------|--------|
| API response time | < 300ms p99 |
| Map render time | < 2s |
| Concurrent users | 50,000+ |
| Cache hit rate | > 80% |
| Uptime | 99.9% |

---

## 🛣 Roadmap

- [x] Physics-based range prediction
- [x] Erlang-C queue prediction
- [x] Bayesian trust scores
- [x] A* route optimization
- [x] Monte Carlo confidence intervals
- [x] JWT + Google OAuth
- [x] Slot booking system
- [x] Admin dashboard
- [ ] React Native mobile app
- [ ] AI trip assistant (LLM)
- [ ] Predictive charger failure detection
- [ ] Fleet management dashboard
- [ ] Carbon savings tracker

---

## 📄 License

MIT License — see [LICENSE](LICENSE)

---

Built with ❤️ for India's EV revolution.
