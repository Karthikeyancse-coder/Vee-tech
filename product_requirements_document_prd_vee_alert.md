# Product Requirements Document (PRD)
## Vee-Alert: Real-Time AI Media Intelligence & Crisis Response

**Document Version:** 1.0 (Hackathon Edition)
**Date:** September 18, 2026
**Product Owner:** Hackathon Team
**Target Client:** VEE Technologies

---

## 1. Executive Summary
Vee-Alert is an event-driven, AI-powered media intelligence platform designed to replace legacy batch-processing systems. By ingesting data streams in real-time, triaging them using a local Large Language Model (LLM), and executing omnichannel escalations (including automated voice calls), Vee-Alert guarantees a sub-2-minute Service Level Agreement (SLA) from article publication to executive alert. This transforms media monitoring from an archival reporting tool into an active crisis management weapon.

## 2. Problem Statement
Current media monitoring solutions operate on a 5-6 hour lag. By the time insights reach leadership, the narrative is already set on social media and news outlets. 
* **Batch Processing:** Articles are collected and analyzed in bulk, delaying critical alerts.
* **Human Bottleneck:** Systems rely on human analysts, meaning SLAs fail during nights and weekends.
* **Delivery Friction:** Insights are hidden in 10MB PDFs or desktop dashboards, which are ineffective for mobile users during an emergency.
* **Alert Fatigue:** Systems cannot distinguish between a routine sponsorship announcement and a catastrophic regulatory probe.

## 3. User Personas
1. **The CMO / Crisis Lead:** Requires instant, mobile-first, and highly condensed actionable intelligence for brand-threatening events. Susceptible to alert fatigue; only wants to be notified for Tier-3 and Tier-4 risks.
2. **The Marketing Strategist:** Focuses on market positioning. Needs desktop-optimized, side-by-side comparisons of client vs. competitor sentiment to capitalize on rival vulnerabilities.
3. **The System Admin / Hackathon Judge:** Requires absolute transparency into system performance. Needs mathematical proof that the sub-2-minute SLA is being met for every processed article.

## 4. User Journeys

### 4.1 The 2:00 AM Crisis Escalation
* **Trigger:** A regulatory agency publishes an audit notice regarding the client at 2:14 AM.
* **System Action:** Webhook ingests the article (14s). LLM Triage Agent categorizes it as `CRITICAL` risk and generates a 5-bullet summary (18s). 
* **Delivery:** System triggers the Voice API. The CMO receives a phone call at 2:15 AM. An automated voice reads the summary and provides keypad options to escalate directly to the PR team.

### 4.2 The Competitor Opportunity
* **Trigger:** A major competitor experiences a massive server outage, sparking negative Twitter/X sentiment.
* **System Action:** Ingestion and triage occur under 30s. LLM identifies the competitor, tags sentiment as `Negative`, and assigns `Medium` risk.
* **Delivery:** No phone calls are made. The article flows instantly into the 'Competitor Radar' dashboard via WebSockets, turning the sentiment heatmap red and alerting the strategist to a market opportunity.

## 5. Functional Requirements (Features)

### 5.1 Streaming Ingestion Engine
* **Feature:** Webhook & API listeners to capture incoming news (NewsAPI, social feeds, OCR ePaper data) instantly.
* **Requirement:** Must bypass polling (RSS) in favor of event-driven pushes.
* **Constraint:** Initial payload ingestion must be logged in backend memory in < 30 seconds.

### 5.2 Real-Time AI Triage Agent
* **Feature:** Localized LLM inference (Qwen 2.5 via Ollama) to analyze incoming text streams.
* **Requirement:** Must return a strictly validated JSON payload containing: `Entity`, `Sentiment`, `Theme`, `Risk_Score (1-10)`, `Risk_Level (Low, Medium, High, Critical)`.
* **Constraint:** AI analysis must complete in < 20 seconds to maintain the SLA.

### 5.3 2-Minute Insight Briefing
* **Feature:** AI-generated executive summaries for high-priority news.
* **Requirement:** Generates a strict 5-bullet brief: *What Happened, Why It Matters, Risk Score Justification, Competitor Impact, Recommended Action*.

### 5.4 Intelligent Omnichannel Alerting
* **Feature:** Dynamic routing of alerts based on the AI-assigned `Risk_Level`.
* **Requirement:** 
    * `Tier 1 (Low) & Tier 2 (Medium)`: Dashboard only.
    * `Tier 3 (High)`: WhatsApp / Telegram Bot message containing the 5-bullet brief.
    * `Tier 4 (Critical)`: Automated Twilio/Ultravox phone call to the primary duty contact.

### 5.5 Three-Tier Frontend Architecture
* **Feature:** Role-specific dashboards updated via Realtime WebSockets (Supabase).
    1. **Crisis War Room:** Mobile-first, alert-card UI for the C-Suite.
    2. **Competitor Radar:** Desktop UI with sentiment heatmaps and side-by-side brand tracking.
    3. **SLA Proof Engine:** Technical dashboard tracking `Ingest-to-Alert` millisecond latency for hackathon judging.

## 6. Non-Functional Requirements (NFRs)
* **Performance (Latency):** 95% of Tier-3 and Tier-4 alerts must be delivered within 120 seconds of the original publication timestamp.
* **Availability:** System must run autonomously 24/7 with a 99.9% uptime target. No human-in-the-loop required for the critical alert path.
* **Scalability:** The in-memory Node.js queue must handle bursts of up to 500 articles per minute during major breaking news cycles without dropping payloads.
* **Cost Efficiency:** AI inference must utilize local GPU hardware (RTX 5060) to avoid catastrophic cloud API costs (e.g., OpenAI) at scale.

## 7. Out of Scope (For Hackathon V1)
* Deep historical archiving beyond a 7-day rolling window.
* Complex user-role management and SSO authentication (mock logins will be used).
* Direct posting/replying to social media from within the dashboard.

## 8. Success Metrics & KPIs
1. **SLA Breach Rate:** Target < 5% of articles exceeding the 120-second processing window.
2. **System Latency Check:** Average AI Triage time consistently under 20 seconds.
3. **Alert Accuracy:** Zero critical alerts mistakenly assigned as Tier-1 (Low risk).