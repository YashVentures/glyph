import React, { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { parseDiagram } from '../lib/engine/parser.js';
import { renderDiagramToSVG } from '../lib/engine/renderer.js';
import { 
  CheckCircle2, 
  ChevronLeft, 
  Workflow, 
  GitCommit, 
  Database, 
  Cloud,
  Sliders,
  Type,
  SunMoon,
  ArrowRightLeft,
  ListOrdered
} from 'lucide-react';

const SAMPLES = [
  {
    id: 'flowchart',
    name: '1. Flowchart Diagram',
    type: 'flowchart-diagram',
    icon: Workflow,
    category: 'Core Diagrams',
    description: 'Directives (title, direction), multiple shapes (oval, rectangle, diamond), colors from palette, solid & dashed connections, labels.',
    code: `title User Onboarding & Verification
direction down
styleMode shadow
typeface rough

start [shape: oval, color: blue, label: "Start"]
signupForm [shape: rectangle, color: default, label: "Sign Up Form"]
validateEmail [shape: diamond, color: orange, label: "Email Valid?"]
sendOtp [shape: rectangle, color: purple, label: "Send OTP SMS"]
dashboard [shape: rectangle, color: green, label: "User Dashboard"]
rejected [shape: oval, color: red, label: "Reject / Retry"]

start > signupForm: submit credentials
signupForm > validateEmail
validateEmail > sendOtp: yes
validateEmail --> rejected: no [color: red]
sendOtp > dashboard: verified [color: green]
`
  },
  {
    id: 'sequence',
    name: '2. Sequence Diagram',
    type: 'sequence-diagram',
    icon: GitCommit,
    category: 'Core Diagrams',
    description: 'Participant order, synchronous (>) and asynchronous (-->) messages, activations, self-calls, and loop/alt blocks.',
    code: `title OAuth2 Authorization Code Flow
order Browser, AppClient, AuthServer, ResourceServer
autoNumber on

Browser > AppClient: Click "Login with Provider"
AppClient > Browser: Redirect to /authorize
Browser > AuthServer: GET /authorize?client_id=xyz
activate AuthServer
AuthServer --> Browser: Login & Consent Page
Browser > AuthServer: POST /consent (user accepts)
AuthServer --> Browser: 302 Redirect with code=auth123
deactivate AuthServer

Browser > AppClient: Callback with code=auth123
activate AppClient
AppClient > AuthServer: POST /oauth/token (code + secret)
activate AuthServer
AuthServer --> AppClient: 200 OK (access_token + refresh_token)
deactivate AuthServer

AppClient > ResourceServer: GET /api/v1/profile (Bearer token)
ResourceServer --> AppClient: 200 Profile JSON
deactivate AppClient
`
  },
  {
    id: 'erd-crows-foot',
    name: '3. ERD (Crow\'s Foot)',
    type: 'erd-diagram',
    icon: Database,
    category: 'Core Diagrams',
    description: 'Strict recovered ERD grammar: table blocks with field constraints (pk, fk, unique, nullable) and real operators: < (1:N), > (N:1), - (1:1), <> (N:M).',
    code: `title SaaS Multi-Tenant Data Model
notation crows-foot
colorMode pastel

Workspaces [color: blue] {
  id string pk
  name string
  slug string unique
  created_at timestamp
}

Users [color: green] {
  id string pk
  workspace_id string fk
  email string unique
  full_name string
  role string
  avatar_url string nullable
}

Files [color: purple] {
  id string pk
  workspace_id string fk
  user_id string fk
  title string
  doc_content text nullable
  canvas_data json
}

Profiles [color: default] {
  id string pk
  user_id string fk unique
  bio string
}

Workspaces < Users: contains
Workspaces < Files: owns
Users - Profiles: has_profile
Users < Files: created_by
`
  },
  {
    id: 'erd-chen',
    name: '4. ERD (Chen Notation)',
    type: 'erd-diagram',
    icon: Database,
    category: 'Core Diagrams',
    description: 'Chen notation (notation chen): Diamond relationship blocks in the center of edges with 1, N, M cardinality markers and field targets.',
    code: `title University Enrollment Schema
notation chen
colorMode pastel

Students [color: blue] {
  id int pk
  name string
  email string unique
}

Courses [color: green] {
  id int pk
  code string unique
  title string
}

Instructors [color: purple] {
  id int pk
  full_name string
}

Students <> Courses: enrolls
Instructors < Courses: teaches
`
  },
  {
    id: 'cloud',
    name: '5. Cloud Architecture',
    type: 'cloud-architecture-diagram',
    icon: Cloud,
    category: 'Core Diagrams',
    description: 'Cloud microservices with bundled open-source icons (AWS Route53, ALB, ECS, Lambda, RDS, S3), direction right, and connection labels.',
    code: `title AWS Serverless & Container Architecture
direction right
styleMode shadow
typeface clean

Clients [icon: globe, color: white, label: "Web / Mobile Clients"]
Route53 [icon: aws-route53, color: blue, label: "Amazon Route 53"]
LoadBalancer [icon: aws-alb, color: orange, label: "Application Load Balancer"]

VPC [color: blue] {
  ApiService [icon: aws-ecs, color: blue, label: "ECS Fargate Microservices"]
  AuthWorker [icon: aws-lambda, color: yellow, label: "Lambda Auth Validator"]
}

DatabaseCluster [icon: aws-rds, color: purple, label: "Amazon Aurora PostgreSQL"]
ObjectStorage [icon: aws-s3, color: green, label: "S3 Static Assets"]

Clients > Route53: DNS Lookup
Route53 > LoadBalancer: Route Traffic
LoadBalancer > ApiService: Forward Requests
ApiService > AuthWorker: Verify Token
ApiService > DatabaseCluster: Read/Write SQL
ApiService > ObjectStorage: Upload Media
`
  },
  {
    id: 'directive-colormode',
    name: 'Directive: colorMode',
    type: 'flowchart-diagram',
    icon: SunMoon,
    category: 'Directives',
    description: 'Global colorMode directive sets light or dark background/text contrast.',
    code: `title colorMode Directive (Light Theme)
colorMode light
direction right

Source [color: blue, label: "Client Application"]
Router [color: orange, label: "API Gateway"]
Database [color: purple, label: "Postgres Database"]

Source > Router: HTTPS Request
Router > Database: SQL Query
`
  },
  {
    id: 'directive-stylemode',
    name: 'Directive: styleMode',
    type: 'flowchart-diagram',
    icon: Sliders,
    category: 'Directives',
    description: 'Global styleMode directive: plain vs shadow vs watercolor filter effects.',
    code: `title styleMode: plain vs shadow
styleMode plain
direction down

StepA [shape: rectangle, color: blue, label: "Step A: Plain (No Shadow)"]
StepB [shape: rectangle, color: green, label: "Step B: Crisp Geometry"]
StepC [shape: rectangle, color: purple, label: "Step C: Clean Borders"]

StepA > StepB: triggers
StepB > StepC: executes
`
  },
  {
    id: 'directive-typeface',
    name: 'Directive: typeface',
    type: 'flowchart-diagram',
    icon: Type,
    category: 'Directives',
    description: 'Global typeface directive: rough (default organic look), clean (Inter sans-serif), or mono (JetBrains Mono).',
    code: `title typeface: mono Technical Blueprint
typeface mono
direction right

TelemetryEmitter [shape: rectangle, color: blue, label: "agent_daemon.go"]
KafkaQueue [shape: cylinder, color: orange, label: "kafka:9092/events"]
MetricsConsumer [shape: rectangle, color: green, label: "collector_worker.py"]

TelemetryEmitter > KafkaQueue: produce_record()
KafkaQueue > MetricsConsumer: poll_batch()
`
  },
  {
    id: 'directive-direction',
    name: 'Directive: direction',
    type: 'flowchart-diagram',
    icon: ArrowRightLeft,
    category: 'Directives',
    description: 'Global direction directive: up, down, left, right (maps to Dagre rankdir).',
    code: `title direction: up (Bottom-to-Top Pipeline)
direction up

StorageLayer [shape: cylinder, color: purple, label: "3. Persistent Storage"]
ComputeLayer [shape: rectangle, color: blue, label: "2. Worker Pool"]
IngressLayer [shape: oval, color: green, label: "1. Data Ingestion"]

IngressLayer > ComputeLayer: stream
ComputeLayer > StorageLayer: persist
`
  },
  {
    id: 'directive-autonumber',
    name: 'Directive: autoNumber',
    type: 'sequence-diagram',
    icon: ListOrdered,
    category: 'Directives',
    description: 'Global autoNumber directive in sequence diagrams: auto-numbers message arrows sequentially (1., 2., 3.).',
    code: `title autoNumber: on Demonstration
order Client, Cache, Database
autoNumber on

Client > Cache: 1. Check cached session
Cache --> Client: 2. Cache miss (nil)
Client > Database: 3. Query user credentials
Database --> Client: 4. User record returned
Client > Cache: 5. Store session token (TTL 1h)
`
  }
];

export default function ReviewPage() {
  const [activeTab, setActiveTab] = useState(SAMPLES[0].id);

  const currentSample = SAMPLES.find(s => s.id === activeTab) || SAMPLES[0];
  const { ast, errors } = parseDiagram(currentSample.code, currentSample.type);
  const svgHtml = renderDiagramToSVG(ast, { theme: 'dark' });

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: '100vh',
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-sans)'
    }}>
      <Head>
        <title>Step 3 Review Gallery – Glyph vs Eraser EBNF</title>
      </Head>

      {/* Top Banner */}
      <header style={{
        height: '60px',
        backgroundColor: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <Link href="/dashboard/all" className="btn-icon">
            <ChevronLeft size={18} />
          </Link>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Step 3 Verification Gallery: Strict EBNF & Directives</span>
              <span style={{
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: '#6EE7B7',
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                FastAPI + MongoDB Backend Live
              </span>
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Link href="/dashboard/all" className="btn btn-secondary" style={{ height: '32px', fontSize: '12px' }}>
            Open Dashboard
          </Link>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div style={{
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
        padding: '0 20px',
        display: 'flex',
        gap: '4px',
        overflowX: 'auto',
        whiteSpace: 'nowrap'
      }}>
        {SAMPLES.map(sample => {
          const Icon = sample.icon;
          const isActive = sample.id === activeTab;
          return (
            <button
              key={sample.id}
              onClick={() => setActiveTab(sample.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 14px',
                fontSize: '12px',
                fontWeight: 600,
                color: isActive ? '#60A5FA' : 'var(--text-secondary)',
                borderBottom: isActive ? '2px solid #3B82F6' : '2px solid transparent',
                background: 'transparent',
                borderLeft: 'none',
                borderRight: 'none',
                borderTop: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={14} />
              <span>{sample.name}</span>
            </button>
          );
        })}
      </div>

      {/* Main Review Body: Code on Left, Live SVG on Right */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '460px 1fr',
        gap: 0,
        height: 'calc(100vh - 110px)'
      }}>
        {/* Left Column: Code, AST summary & EBNF features */}
        <div style={{
          backgroundColor: '#14161C',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          padding: '20px'
        }}>
          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
              {currentSample.name}
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              {currentSample.description}
            </p>
          </div>

          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Diagram Code (Strict EBNF Input)
          </div>

          <pre style={{
            backgroundColor: '#0D0E12',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            color: '#E2E8F0',
            lineHeight: '1.6',
            overflowX: 'auto',
            marginBottom: '16px',
            whiteSpace: 'pre-wrap'
          }}>
            {currentSample.code.trim()}
          </pre>

          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            marginBottom: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Parser AST Metrics
          </div>

          <div style={{
            backgroundColor: 'var(--bg-secondary)',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div><strong>Type:</strong> <code>{ast.type}</code></div>
            <div><strong>Title:</strong> {ast.title || 'Untitled'}</div>
            {ast.direction && <div><strong>Direction:</strong> <code>{ast.direction}</code></div>}
            {ast.styleMode && <div><strong>Style Mode:</strong> <code>{ast.styleMode}</code></div>}
            {ast.typeface && <div><strong>Typeface:</strong> <code>{ast.typeface}</code></div>}
            {ast.colorMode && <div><strong>Color Mode:</strong> <code>{ast.colorMode}</code></div>}
            {ast.notation && <div><strong>ERD Notation:</strong> <code>{ast.notation}</code></div>}
            {ast.autoNumber && <div><strong>Auto Number:</strong> <code>{ast.autoNumber}</code></div>}
            {ast.nodes && <div><strong>Nodes count:</strong> {ast.nodes.length}</div>}
            {ast.edges && <div><strong>Edges count:</strong> {ast.edges.length}</div>}
            {ast.participants && <div><strong>Participants:</strong> {ast.participants.length}</div>}
            {ast.steps && <div><strong>Messages / Steps:</strong> {ast.steps.length}</div>}
            {ast.tables && <div><strong>Tables count:</strong> {ast.tables.length}</div>}
            {ast.relationships && <div><strong>Relationships:</strong> {ast.relationships.length}</div>}
            <div><strong>Syntax Errors:</strong> <span style={{ color: errors.length === 0 ? '#10B981' : '#EF4444' }}>{errors.length}</span></div>
          </div>
        </div>

        {/* Right Column: Rendered SVG Surface */}
        <div style={{
          backgroundColor: '#0D0E11',
          backgroundImage: 'radial-gradient(circle, #252836 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '30px',
          overflow: 'auto',
          position: 'relative'
        }}>
          <div style={{
            backgroundColor: ast.colorMode === 'light' ? '#FFFFFF' : 'rgba(20, 22, 28, 0.95)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
            padding: '30px',
            maxWidth: '100%',
            overflow: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          dangerouslySetInnerHTML={{ __html: svgHtml }}
          />
        </div>
      </div>
    </div>
  );
}
