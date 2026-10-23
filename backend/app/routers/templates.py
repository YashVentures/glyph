from fastapi import APIRouter
from typing import Optional, List, Dict, Any
from ..schemas.templates import TemplateItem, TemplateListResponse, TemplateResponse

router = APIRouter(prefix="/templates", tags=["templates"])

# Built-in seed reference diagrams per EBNF grammar
SEED_TEMPLATES = [
  {
    "id": "tpl-flowchart",
    "name": "User Onboarding & Verification Flow",
    "diagramType": "flowchart-diagram",
    "category": "Flowchart",
    "description": "Decision trees, status gates, and condition logic with rich color styling.",
    "code": "title User Onboarding & Verification\ndirection down\nstyleMode shadow\ntypeface rough\n\nstart [shape: oval, color: blue, label: \"Start\"]\nsignupForm [shape: rectangle, color: default, label: \"Sign Up Form\"]\nvalidateEmail [shape: diamond, color: orange, label: \"Email Valid?\"]\nsendOtp [shape: rectangle, color: purple, label: \"Send OTP SMS\"]\ndashboard [shape: rectangle, color: green, label: \"User Dashboard\"]\nrejected [shape: oval, color: red, label: \"Reject / Retry\"]\n\nstart > signupForm: submit credentials\nsignupForm > validateEmail\nvalidateEmail > sendOtp: yes\nvalidateEmail --> rejected: no [color: red]\nsendOtp > dashboard: verified [color: green]"
  },
  {
    "id": "tpl-sequence",
    "name": "OAuth2 Authorization Code Flow",
    "diagramType": "sequence-diagram",
    "category": "Sequence",
    "description": "Standard OAuth2 flow with participants, lifelines, sync/async messages, and activations.",
    "code": "title OAuth2 Authorization Code Flow\norder Browser, AppClient, AuthServer, ResourceServer\nautoNumber on\n\nBrowser > AppClient: Click \"Login with Provider\"\nAppClient > Browser: Redirect to /authorize\nBrowser > AuthServer: GET /authorize?client_id=xyz\nactivate AuthServer\nAuthServer --> Browser: Login & Consent Page\nBrowser > AuthServer: POST /consent (user accepts)\nAuthServer --> Browser: 302 Redirect with code=auth123\ndeactivate AuthServer\n\nBrowser > AppClient: Callback with code=auth123\nactivate AppClient\nAppClient > AuthServer: POST /oauth/token (code + secret)\nactivate AuthServer\nAuthServer --> AppClient: 200 OK (access_token + refresh_token)\ndeactivate AuthServer\n\nAppClient > ResourceServer: GET /api/v1/profile (Bearer token)\nResourceServer --> AppClient: 200 Profile JSON\ndeactivate AppClient"
  },
  {
    "id": "tpl-erd",
    "name": "SaaS Multi-Tenant Database Schema",
    "diagramType": "erd-diagram",
    "category": "ERD",
    "description": "Entities, field types, constraints, and relationships with Crow's Foot notation.",
    "code": "title SaaS Multi-Tenant Data Model\nnotation crows-foot\n\nWorkspaces [color: blue] {\n  id string pk\n  name string\n  slug string unique\n  created_at timestamp\n}\n\nUsers [color: green] {\n  id string pk\n  workspace_id string fk\n  email string unique\n  full_name string\n  role string\n  avatar_url string nullable\n}\n\nFiles [color: purple] {\n  id string pk\n  workspace_id string fk\n  user_id string fk\n  title string\n  doc_content text nullable\n  canvas_data json\n}\n\nProfiles [color: default] {\n  id string pk\n  user_id string fk unique\n  bio string\n}\n\nWorkspaces > Users: contains\nWorkspaces > Files: owns\nUsers - Profiles: has_profile\nUsers > Files: created_by"
  },
  {
    "id": "tpl-cloud",
    "name": "AWS Microservices & Serverless",
    "diagramType": "cloud-architecture-diagram",
    "category": "Cloud Architecture",
    "description": "Production AWS architecture with Route53, ALB, ECS Fargate, Aurora DB, and S3.",
    "code": "title AWS Serverless & Container Architecture\ndirection right\nstyleMode shadow\ntypeface clean\n\nClients [icon: globe, color: white, label: \"Web / Mobile Clients\"]\nRoute53 [icon: aws-route53, color: blue, label: \"Amazon Route 53\"]\nLoadBalancer [icon: aws-alb, color: orange, label: \"Application Load Balancer\"]\n\nVPC [color: blue] {\n  ApiService [icon: aws-ecs, color: blue, label: \"ECS Fargate Microservices\"]\n  AuthWorker [icon: aws-lambda, color: yellow, label: \"Lambda Auth Validator\"]\n}\n\nDatabaseCluster [icon: aws-rds, color: purple, label: \"Amazon Aurora PostgreSQL\"]\nObjectStorage [icon: aws-s3, color: green, label: \"S3 Static Assets\"]\n\nClients > Route53: DNS Lookup\nRoute53 > LoadBalancer: Route Traffic\nLoadBalancer > ApiService: Forward Requests\nApiService > AuthWorker: Verify Token\nApiService > DatabaseCluster: Read/Write SQL\nApiService > ObjectStorage: Upload Media"
  }
]

@router.get("", response_model=TemplateListResponse)
async def list_templates():
    return {"success": True, "templates": SEED_TEMPLATES}

@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str):
    found = next((t for t in SEED_TEMPLATES if t["id"] == template_id), None)
    if not found:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Template not found")
    return {"success": True, "template": found}
