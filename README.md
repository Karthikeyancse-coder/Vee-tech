# Vee-Alert: Real-Time AI Media Intelligence & Crisis War Room

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-purple?logo=vite)](https://vitejs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)](https://nodejs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime%20Postgres-3ecf8e?logo=supabase)](https://supabase.com/)
[![Ollama](https://img.shields.io/badge/Ollama-Qwen%202.5%3A7B-black?logo=ollama)](https://ollama.com/)

**Target Client:** Infosys  
**Tracked Competitors:** TCS, Wipro, Accenture  
**SLA Guarantee:** Sub-120 seconds from publication to alert dispatch  
**Real-Time Data Streams:** NewsAPI, GDELT DOC 2.0, The Guardian Open Platform, Publisher RSS (*The Economic Times*, *Google News Wire*)  
**Multi-Channel Push Alerts:** Slack Webhook, WhatsApp Business Cloud, Executive Email, and Interactive Automated Voice Telephony (Tier-4 Critical)

---

## Architecture Overview

Vee-Alert is an enterprise-grade AI crisis intelligence platform engineered for proactive corporate risk monitoring and real-time competitor parity tracking.

```
[NewsAPI / GDELT / Guardian / RSS]
              │
              ▼
   [Multi-Source Ingestion]
   ├── Two-Phase Deduplication (Signature + URL/Title)
   └── Strict Entity Keyword Guardrails (Infosys, TCS, Wipro, Accenture)
              │
              ▼
    [Local AI Triage Engine]
   ├── Qwen 2.5:7b (Local Ollama Inference via GPU)
   └── Deterministic Heuristic Fallback (Zero Downtime)
              │
              ▼
 [Supabase Realtime PostgreSQL] ◄──► [Real-Time WebSocket Sync]
              │                               │
              ▼                               ▼
    [Multi-Channel Dispatch]       [VEE-ALERT Command Center]
    ├── Slack Webhook              ├── Executive Dashboard
    ├── WhatsApp Alerts            ├── Crisis War Room (5-Point Brief)
    ├── Executive Email Dossier    ├── Competitor Intelligence Radar
    └── Tier-4 Voice Call (DTMF)   ├── SLA Proof Engine (<120s Audit)
                                   ├── Trend & Sentiment Analysis
                                   └── Configured Intelligence Sources
```

---

## Key Features

### 1. Command Center & Crisis War Room
- **5-Bullet Executive Briefing**:
  1. *What happened*: Direct facts and source verification.
  2. *Why it matters*: Immediate operational and market perception impact.
  3. *Risk score justification*: Calibrated 1.0–10.0 score with threat categorization.
  4. *Competitor & market impact*: Impact on TCS, Wipro, and Accenture market parity.
  5. *Recommended action*: Operational and PR guidance for executive leadership.
- **One-Tap Incident Actions**: Instant article acknowledgement, voice escalation trigger, and detailed source inspection modal.

### 2. Competitor Intelligence Radar
- Live side-by-side sentiment and share-of-voice tracking across **Infosys, TCS, Wipro, and Accenture**.
- Mathematical net sentiment parity scoring (-100 to +100).
- Automatic vulnerability detection flagging competitor weaknesses with instant counter-play briefs.

### 3. Mathematical SLA Proof Engine
- Real-time pipeline latency tracking (`published_at` $\to$ `ingested_at` $\to$ `triaged_at` $\to$ `dispatched_at`).
- Explicit SLA compliance indicator verifying event-to-alert dispatch in **under 120 seconds** (typical: 14s – 38s).
- One-click JSON audit report download for executive and regulatory verification.

### 4. Intelligence Trend Analysis
- 100% dynamically derived analytics bound to live article telemetry.
- Real-time **Infosys Share of Voice**, **Negative Sentiment Ratio**, **Average Threat Level**, and **24h Mentions**.
- Multi-bucket time-series sentiment and risk curves with graceful telemetry-building states.

### 5. Configured Intelligence Sources & Telemetry Wire
- Real-time health monitoring of all configured ingestion streams:
  - **NewsAPI Global Wire** (24/7 continuous stream)
  - **GDELT DOC 2.0 Global Discovery** (Tone and thematic metadata)
  - **The Guardian Open Platform** (Premium investigative wire)
  - **The Economic Times & Google News RSS** (Verified corporate & tech wire)
- Active connection health, latency measurements, and article counters.

### 6. Interactive Voice Escalation (Tier-4 Critical)
- Automated telephony escalation simulation to the Chief Risk Officer / Crisis Lead.
- Text-to-Speech audio synthesis with live audio waveform visualization.
- Interactive DTMF response keypad:
  - **Press 1**: Acknowledge alert and log to crisis room.
  - **Press 2**: Bridge directly to Emergency PR & Legal Crisis War Room.

### 7. Responsive Mobile Navigation
- **Desktop ( $\ge$ 768px)**: Fixed left sidebar with collapsible `>>` / `<<` controls, dense data tables, and comprehensive header metrics.
- **Mobile (< 768px)**: Native bottom navigation bar with safe-area inset support:
  - `Dashboard` | `Crisis War Room` | `Competitor Radar` | `SLA Engine` | `More`
  - Smooth animated bottom sheet drawer accessing *Analysis*, *Reports*, *News Feed*, *Sources*, and *Alerts*.

---

## Getting Started

### Prerequisites
- **Node.js**: v18 or higher (v20 LTS recommended)
- **npm** or **yarn**
- **Ollama** (optional for local AI inference): [ollama.ai](https://ollama.ai/) with `qwen2.5:7b` pulled (`ollama run qwen2.5:7b`)
- **Supabase Account**: (Pre-configured in environment)

### 1. Installation

Clone the repository and install dependencies for both server and client:

```bash
# Clone repository
git clone https://github.com/aditya84ya/VEE-TECH.git
cd VEE-TECH

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2. Environment Configuration

#### Backend (`server/.env`):
```env
PORT=5000

# Supabase Realtime & PostgreSQL
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key

# Local Ollama AI Engine
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5:7b

# Ingestion API Keys
NEWSAPI_KEY=your-newsapi-key
GUARDIAN_API_KEY=your-guardian-api-key

# Notification Channels (Optional / Sandbox)
SLACK_WEBHOOK_URL=
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
```

#### Frontend (`client/.env`):
```env
VITE_API_BASE_URL=http://localhost:5000
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Running Locally

Start the backend and frontend in separate terminals:

```bash
# Terminal 1: Backend Ingestion & Triage Server (Port 5000)
cd server
npm run dev

# Terminal 2: React / Vite Dashboard (Port 5173)
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser to access the VEE-ALERT platform.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/articles` | Retrieve all active articles (Supabase / in-memory fallback) |
| `POST` | `/api/fetch-live` | Trigger immediate live multi-source scraping and triage |
| `POST` | `/api/news/fetch` | On-demand aggregation across all configured streams |
| `PATCH` | `/api/articles/:id/acknowledge` | Acknowledge a high-priority crisis article |
| `GET` | `/api/health` | Backend and subsystem health check |

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Date-fns
- **Backend**: Node.js, Express, Axios, Cheerio, Tsx
- **Database / Sync**: Supabase (PostgreSQL, Realtime WebSockets)
- **AI / LLM Engine**: Ollama (`qwen2.5:7b` locally hosted on GPU/CPU)
- **Telephony & Alerts**: Twilio Voice, Slack Webhooks, SendGrid, Meta WhatsApp Cloud

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
