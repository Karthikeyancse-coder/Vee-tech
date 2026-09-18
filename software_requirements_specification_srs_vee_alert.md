# Software Requirements Specification (SRS)
## Vee-Alert: Real-Time AI Media Intelligence & Crisis Response System

**Version:** 1.0 (Hackathon Final Edition)
**Date:** September 18, 2026
**Target Client:** VEE Technologies

---

## 1. Introduction

### 1.1 Purpose
This document specifies the software requirements for **Vee-Alert**, an event-driven media intelligence and crisis response platform. The purpose of this system is to replace legacy batch-processing media monitoring workflows with a real-time, AI-powered streaming architecture that guarantees a sub-2-minute SLA from article publication to executive alert.

### 1.2 Scope
Vee-Alert will ingest data streams (news APIs, social media, ePaper OCR), evaluate them in real-time using a local Large Language Model (LLM), and route critical alerts via mobile push, chat (WhatsApp/Telegram), and automated voice calls. The system includes three specialized frontend dashboards for C-suite executives, market strategists, and system administrators. 

### 1.3 Definitions, Acronyms, and Abbreviations
*   **SLA:** Service Level Agreement (Target: < 120 seconds).
*   **LLM:** Large Language Model (Qwen 2.5).
*   **OCR:** Optical Character Recognition (for local ePapers).
*   **IVR:** Interactive Voice Response.

---

## 2. Overall Description

### 2.1 Product Perspective
Vee-Alert operates as an intelligence layer on top of existing data-gathering methods. Instead of utilizing a traditional "Fetch → Store → Read → Analyze" pipeline, it uses an "Ingest → AI Triage (In-Memory) → Fork (Alert + Store)" pipeline to bypass database disk I/O bottlenecks during critical crisis events.

### 2.2 User Characteristics
1.  **C-Suite / CMO:** Requires highly condensed, actionable data on mobile devices. Will not tolerate alert fatigue.
2.  **Marketing Strategist:** Requires desktop-optimized analytical views of competitor trends.
3.  **System Admin / Hackathon Judge:** Requires transparent, mathematical proof of system latency and SLA adherence.

### 2.3 Operating Environment
*   **Backend:** Node.js / Express environment.
*   **Database:** Supabase (PostgreSQL with Realtime capabilities).
*   **AI Hardware:** Local NVIDIA RTX 5060 (8GB VRAM) for Ollama/Qwen 2.5 inference.
*   **Frontend:** Standard web browsers (Chrome, Safari) and mobile viewports (specifically optimized for Android/Redmi and iOS).

---

## 3. System Features (Functional Requirements)

### 3.1 Streaming Ingestion Engine
*   **FR-1.1 Webhook Listeners:** The system shall expose REST API endpoints (`/api/ingest`) to continuously receive POST payloads from external sources (NewsAPI, Twitter/X, custom scrapers).
*   **FR-1.2 In-Memory Holding:** Incoming data must be held in memory and instantly passed to the AI Triage Agent prior to any database write operations.
*   **FR-1.3 Latency Target:** Ingestion step shall take no longer than 30 seconds from original publication.

### 3.2 AI Triage Agent
*   **FR-2.1 Local LLM Processing:** The backend shall transmit the raw text to a local Ollama instance running Qwen 2.5.
*   **FR-2.2 Strict JSON Output:** The LLM must return a validated JSON object containing: Entity, Sentiment, Theme, Risk Score (1-10), Risk Level (Low, Medium, High, Critical), and a 5-bullet executive summary.
*   **FR-2.3 Latency Target:** AI inference and triage shall take no longer than 20 seconds per article.

### 3.3 Intelligent Routing & Voice Escalation
*   **FR-3.1 Alert Fatigue Prevention:** The system shall silently log Tier 1 (Low) and Tier 2 (Medium) news to the database without triggering external alerts.
*   **FR-3.2 High-Risk Chat Alerts:** For Tier 3 (High), the system shall instantly trigger a webhook to send the 5-bullet summary via Telegram or WhatsApp Business API.
*   **FR-3.3 Critical Emergency Voice Call:** For Tier 4 (Critical), the system shall trigger a telephony API (Twilio or Ultravox) to place a text-to-speech phone call to the designated crisis lead.
*   **FR-3.4 IVR Options:** The voice call shall provide keypress options (e.g., Press 1 to acknowledge, Press 2 to bridge to the PR team).

### 3.4 Dashboard UI
*   **FR-4.1 Real-Time Sync:** The frontend shall use Supabase Realtime (WebSockets) to update feeds instantly without a page refresh.
*   **FR-4.2 Crisis War Room (Mobile-First):** Shall display high-priority alert cards with 1-tap action buttons (Acknowledge, Escalate).
*   **FR-4.3 Competitor Radar:** Shall display a split-screen view comparing Client sentiment vs. Competitor sentiment, including visual heatmaps.
*   **FR-4.4 SLA Proof Engine:** Shall display a live chronometer table proving the exact `Ingest-to-Alert` timestamp breakdown for every processed article.

---

## 4. External Interface Requirements

### 4.1 User Interfaces
The UI shall be built using Next.js (App Router) and Tailwind CSS. It must adhere to a dark-mode aesthetic (slate/gray color palette) with high-contrast red/orange indicators for alerts.

### 4.2 Software Interfaces
*   **NewsAPI / Webhooks:** JSON payloads incoming via HTTP POST.
*   **Ollama API:** HTTP POST to `localhost:11434/api/generate` for local AI inference.
*   **Supabase API:** PostgreSQL connection for parallel asynchronous storage.
*   **Twilio / Ultravox API:** Outbound REST requests to initiate telephony routines.

---

## 5. Non-Functional Requirements (NFRs)

### 5.1 Performance (SLA Strict Adherence)
*   **NFR-1.1:** 95% of Tier-3 and Tier-4 alerts must be delivered within 120 seconds of the `published_at` timestamp.
*   **NFR-1.2:** The frontend UI must render new incoming database rows in under 500 milliseconds via WebSockets.

### 5.2 Scalability
*   **NFR-2.1:** The ingestion API must handle sudden spikes in webhook traffic (e.g., 500 requests per minute) without crashing, utilizing an in-memory queue if the LLM inference is saturated.

### 5.3 Reliability & Availability
*   **NFR-3.1:** The system is designed to operate autonomously 24/7.
*   **NFR-3.2:** If the primary executive does not answer a Critical Voice Call within 45 seconds, the system must failover and dial a secondary contact.

### 5.4 Security
*   **NFR-4.1:** All third-party API keys (NewsAPI, Twilio, Supabase) must be stored securely in `.env` files and never exposed to the frontend browser bundle.

---

## 6. Database Schema Specifications

### 6.1 `articles` Table
* `id`: UUID (Primary Key)
* `source`: VARCHAR
* `raw_text`: TEXT
* `entity`: VARCHAR (Indexed)
* `sentiment`: VARCHAR
* `risk_score`: DECIMAL
* `risk_level`: VARCHAR
* `summary`: JSONB
* `published_at`: TIMESTAMP
* `ingested_at`: TIMESTAMP
* `triaged_at`: TIMESTAMP

### 6.2 `alert_logs` Table
* `id`: UUID (Primary Key)
* `article_id`: UUID (Foreign Key)
* `channel`: VARCHAR (e.g., 'WhatsApp', 'Voice')
* `dispatched_at`: TIMESTAMP
* `sla_breached`: BOOLEAN