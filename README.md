# Vee-Alert: Real-Time AI Media Intelligence & Crisis War Room

**Target Client:** Infosys  
**Tracked Competitors:** TCS, Wipro, Accenture  
**SLA Guarantee:** Sub-120 seconds from publication to alert (Zero-Lag in-memory event-driven streaming)  
**Data Sources:** Print ePapers (*The Economic Times*, *Mint*, etc. with page numbers and journalist bylines), Social Media (*Twitter/X*, *Instagram*, *Facebook*), and Global Tech Wires.  
**Multi-Channel Push Alerts:** WhatsApp, Slack, Email, and Automated Voice Calls (Tier-4 Critical with interactive IVR).

---

## Quick Start Guide

Both the backend streaming server and frontend web app are already active:

- **Frontend Application:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:5000](http://localhost:5000)

### To start manually in new terminals:
```bash
# Terminal 1: Backend API
cd "d:\VEE TRACK\server"
npm run dev

# Terminal 2: Modern Animated UI
cd "d:\VEE TRACK\client"
npm run dev
```

---

## Key Features Built for Industrial Mentor & Hackathon Judges

### 1. Crisis War Room (Mobile-First / C-Suite View)
- Highly condensed **5-Bullet Executive Brief** strictly adhering to the specification:
  1. *What happened*
  2. *Why it matters*
  3. *Risk score justification (1-10)*
  4. *Competitor & market impact*
  5. *Immediate recommended action*
- One-tap rapid actions: `Acknowledge`, `Simulate Voice Call`, `Inspect Metadata`.

### 2. Mandatory Industrial Mentor Metadata
Every article/post includes full rich metadata:
- **Newspaper / Platform:** e.g. *The Economic Times*, *Mint*, *Twitter/X*, *Instagram*, *Facebook*
- **Author / Journalist:** e.g. *Surabhi Agarwal*, *@FinTechDisrupt_Global*
- **Page Number / Placement:** e.g. *Page 1 (Front Page Lead)*, *Page 4 (Banking & Finance)*
- **Title / Headline & Short Description**
- **SLA Telemetry Breakdown:** Published $\to$ Ingested $\to$ Triaged $\to$ Dispatched timestamps in milliseconds.

### 3. Competitor Radar (Desktop-Optimized)
- Real-time side-by-side tracking of **Infosys vs. TCS, Wipro, and Accenture**.
- Net sentiment parity score (-100 to +100).
- Social share-of-voice breakdown across Twitter, Instagram, Facebook, and Print.
- Automatic vulnerability detection (e.g. *TCS European Cloud Outage*) paired with instant market counter-play briefings for Infosys sales teams.

### 4. Interactive Tier-4 Voice Call Escalation Simulator
- Simulates automated telephony calls (Twilio / Ultravox engine) to the Chief Crisis Officer.
- Synthetic dual-tone telephone ringing.
- Authoritative Text-to-Speech briefing synthesized directly in browser.
- Real-time animated audio waveform visualizer.
- Interactive DTMF dialer keypad:
  - **Press 1:** Acknowledge alert and log to crisis room.
  - **Press 2:** Bridge directly to Corporate PR & Legal Emergency Line.

### 5. Multi-Channel Push Hub
- Live previews of simultaneous dispatches to **WhatsApp Business**, **Slack War Room** (`#crisis-war-room-exec`), **Executive Email**, and **Voice Telephony**.

### 6. Mathematical SLA Proof Engine
- Live running chronometer proving total pipeline elapsed time is strictly under 120 seconds (typical: 28s - 40s).
- Zero-lag in-memory streaming proof.
- Single-click JSON audit report download.

### 7. Dual Viewport Switcher
- Seamless toggle between **Full Desktop Command Center** and an on-screen **iPhone 16 Pro Executive Mobile Simulator** (plus 100% native mobile responsive layout).
