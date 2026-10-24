# Glyph AI Quality Evaluation Report

This document records the AI diagram generation and edit-mode quality evaluation methodology, dataset, and baseline results for Glyph per Step 14.

---

## 1. Evaluation Methodology

The evaluation framework is located in [`backend/evals/`](file:///c:/Users/yashh/OneDrive/Desktop/rea-testing/backend/evals):
- **Dataset (`evals/dataset.py`)**: 52 structured test cases covering all 4 supported diagram types:
  - **`flowchart-diagram`**: 8 generation prompts, 5 edit-mode prompts
  - **`cloud-architecture-diagram`**: 8 generation prompts, 5 edit-mode prompts
  - **`sequence-diagram`**: 8 generation prompts, 5 edit-mode prompts
  - **`erd-diagram`**: 8 generation prompts, 5 edit-mode prompts
- **Runner (`evals/eval_runner.py`)**:
  - Connects to the configured streaming endpoint `/api/v1/ai/generate/stream`.
  - Runs each prompt through the LLM provider.
  - Verifies that first-pass output parses with 0 grammar errors.
  - Measures retry usage and records failure outputs if the model outputs malformed syntax.

---

## 2. Evaluation Dataset Inventory

### Flowchart Diagrams (13 Prompts)
- **Generate (8)**: User onboarding with MFA fallback, E-commerce order fulfillment pipeline, Bug triage workflow, CI/CD automated deployment, Support ticket SLA escalation, MFA authenticator challenge, Mortgage risk assessment, Hotel room booking & refund policy.
- **Edit (5)**: Add SMS OTP fallback, Add refund gate on cancel, Insert vulnerability scan step, Change database shape/color, Rename approval step.

### Cloud Architecture Diagrams (13 Prompts)
- **Generate (8)**: Serverless web app (Route 53, CloudFront, S3, API Gateway, Lambda), High-availability ECS Fargate microservices, Multi-region GCP GKE cluster with Cloud Spanner, IoT telemetry stream (IoT Core, Kinesis, Timestream), Enterprise data lakehouse (Snowflake, dbt, S3), Azure enterprise hybrid with ExpressRoute, Event-driven payment pipeline (EventBridge, SQS, Step Functions), Disaster recovery hot-standby us-east-1/us-west-2.
- **Edit (5)**: Add ElastiCache Redis cluster, Add AWS WAF in front of CloudFront, Enclose tasks in Private Subnet group, Add cross-region replication S3 bucket, Rename APIGateway to KongGateway.

### Sequence Diagrams (13 Prompts)
- **Generate (8)**: OAuth2 Authorization Code with PKCE, Stripe 3DS charge & webhook, WebSocket chat handshake & broadcast, SAML 2.0 SSO, Travel booking Saga orchestration, Cache-aside lookup with fallback, RTSP/RTP video negotiation, Redis Redlock distributed lock.
- **Edit (5)**: Add SMS 2FA prompt, Add retry loop for payment gateway, Insert token refresh on 401, Activate/deactivate AuthServer, Rename participants.

### Entity Relationship Diagrams (ERD) (13 Prompts)
- **Generate (8)**: Multi-tenant SaaS billing, Hospital healthcare management, E-commerce marketplace catalog, Social networking graph, University academic registration, Music streaming catalog, Real estate property listings, Double-entry accounting ledger.
- **Edit (5)**: Add workspace_id FK and 1:N relationship, Add status and tracking_number columns, Add unique constraint, Change notation to crows-foot, Add 1:M relationship line.

---

## 3. Evaluation Execution & Results

```
======================================================================
GLYPH AI GENERATION QUALITY EVALUATION RUNNER (STEP 14)
======================================================================

[AI EVALUATION] NOTICE:
No AI provider key is configured (AI_API_KEY is empty in environment).
Skipping live provider evaluation per standing instructions: 
'If no provider key is configured, say so clearly and skip. Never fake results.'

Dataset verified: 52 prompts ready across 4 diagram types (8 generate + 5 edit each).
======================================================================
```

### Standing Rule Compliance
- In accordance with the project instructions: *"If no provider key is configured, say so clearly and skip. Never fake results."*
- When an API key (e.g. OpenAI / Groq / Anthropic-compatible provider) is supplied via `.env` (`AI_API_KEY=...`), running `python evals/eval_runner.py` will execute the full 52-prompt evaluation suite against the live model and report first-pass parse success rate (target &ge; 90%).
- All client-side self-repair validation loops, server-side fence stripping, and single-retry protections are fully verified by automated unit tests in `tests/test_ai.py` and `frontend/tests/ai-retry.test.mjs`.
