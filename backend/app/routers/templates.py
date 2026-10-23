from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from ..schemas.templates import TemplateItem, TemplateListResponse, TemplateResponse
from ..core.db import get_database

router = APIRouter(prefix="/templates", tags=["templates"])

# Built-in seed reference diagrams per EBNF grammar (a handful for each diagram type)
SEED_TEMPLATES = [
  # --- FLOWCHART DIAGRAMS ---
  {
    "id": "tpl-flow-onboarding",
    "name": "User Onboarding & Verification Flow",
    "diagramType": "flowchart-diagram",
    "category": "Flowchart",
    "description": "Decision trees, identity verification status gates, and condition logic with rich color styling.",
    "code": "title User Onboarding & Verification\ndirection down\nstyleMode shadow\ntypeface rough\n\nstart [shape: oval, color: blue, label: \"Start\"]\nsignupForm [shape: rectangle, color: default, label: \"Sign Up Form\"]\nvalidateEmail [shape: diamond, color: orange, label: \"Email Valid?\"]\nsendOtp [shape: rectangle, color: purple, label: \"Send OTP SMS\"]\ndashboard [shape: rectangle, color: green, label: \"User Dashboard\"]\nrejected [shape: oval, color: red, label: \"Reject / Retry\"]\n\nstart > signupForm: submit credentials\nsignupForm > validateEmail\nvalidateEmail > sendOtp: yes\nvalidateEmail --> rejected: no [color: red]\nsendOtp > dashboard: verified [color: green]"
  },
  {
    "id": "tpl-flow-ecommerce",
    "name": "Order Fulfillment & Returns State Machine",
    "diagramType": "flowchart-diagram",
    "category": "Flowchart",
    "description": "Complete warehouse fulfillment pipeline with payment verification, inventory allocation, and dispatch.",
    "code": "title Order Fulfillment Pipeline\ndirection down\nstyleMode shadow\ntypeface clean\n\nCartCheckout [shape: oval, color: blue, label: \"Checkout Completed\"]\nProcessPayment [shape: diamond, color: yellow, label: \"Payment Cleared?\"]\nAllocateInventory [shape: rectangle, color: default, label: \"Allocate Stock in Warehouse\"]\nPackShipment [shape: rectangle, color: purple, label: \"Pack & Generate Label\"]\nCarrierDispatch [shape: rectangle, color: green, label: \"Handover to Carrier\"]\nCancelOrder [shape: oval, color: red, label: \"Cancel & Release Stock\"]\n\nCartCheckout > ProcessPayment\nProcessPayment > AllocateInventory: authorized\nProcessPayment --> CancelOrder: declined [color: red]\nAllocateInventory > PackShipment: in-stock\nPackShipment > CarrierDispatch: ready for pickup"
  },

  # --- SEQUENCE DIAGRAMS ---
  {
    "id": "tpl-seq-oauth2",
    "name": "OAuth2 Authorization Code Flow with PKCE",
    "diagramType": "sequence-diagram",
    "category": "Sequence",
    "description": "Standard OAuth2 flow with participants, lifelines, sync/async messages, and activations.",
    "code": "title OAuth2 Authorization Code Flow\norder Browser, AppClient, AuthServer, ResourceServer\nautoNumber on\n\nBrowser > AppClient: Click \"Login with Provider\"\nAppClient > Browser: Redirect to /authorize\nBrowser > AuthServer: GET /authorize?client_id=xyz\nactivate AuthServer\nAuthServer --> Browser: Login & Consent Page\nBrowser > AuthServer: POST /consent (user accepts)\nAuthServer --> Browser: 302 Redirect with code=auth123\ndeactivate AuthServer\n\nBrowser > AppClient: Callback with code=auth123\nactivate AppClient\nAppClient > AuthServer: POST /oauth/token (code + secret)\nactivate AuthServer\nAuthServer --> AppClient: 200 OK (access_token + refresh_token)\ndeactivate AuthServer\n\nAppClient > ResourceServer: GET /api/v1/profile (Bearer token)\nResourceServer --> AppClient: 200 Profile JSON\ndeactivate AppClient"
  },
  {
    "id": "tpl-seq-payment",
    "name": "Payment Gateway 3D-Secure & Webhook Lifecycle",
    "diagramType": "sequence-diagram",
    "category": "Sequence",
    "description": "Asynchronous payment processing with bank 3D-Secure challenge and asynchronous fulfillment webhook.",
    "code": "title 3D-Secure Payment & Webhook Lifecycle\norder Customer, MerchantWeb, PaymentAPI, BankACS\nautoNumber on\n\nCustomer > MerchantWeb: Submit Payment Details\nMerchantWeb > PaymentAPI: POST /v1/intents/create\nactivate PaymentAPI\nPaymentAPI --> MerchantWeb: 200 RequiresAction (3DS)\ndeactivate PaymentAPI\nMerchantWeb > BankACS: Redirect to 3DS Challenge Page\nactivate BankACS\nCustomer > BankACS: Enter SMS OTP code\nBankACS --> MerchantWeb: Authentication Complete Callback\ndeactivate BankACS\nPaymentAPI > MerchantWeb: Webhook payment_intent.succeeded\nactivate MerchantWeb\nMerchantWeb --> Customer: Render Order Success Confirmation\ndeactivate MerchantWeb"
  },

  # --- ERD DIAGRAMS ---
  {
    "id": "tpl-erd-saas",
    "name": "SaaS Multi-Tenant Database Schema",
    "diagramType": "erd-diagram",
    "category": "ERD",
    "description": "Entities, field types, constraints, and relationships with Crow's Foot notation.",
    "code": "title SaaS Multi-Tenant Data Model\nnotation crows-foot\n\nWorkspaces [color: blue] {\n  id string pk\n  name string\n  slug string unique\n  created_at timestamp\n}\n\nUsers [color: green] {\n  id string pk\n  workspace_id string fk\n  email string unique\n  full_name string\n  role string\n  avatar_url string nullable\n}\n\nFiles [color: purple] {\n  id string pk\n  workspace_id string fk\n  user_id string fk\n  title string\n  doc_content text nullable\n  canvas_data json\n}\n\nProfiles [color: default] {\n  id string pk\n  user_id string fk unique\n  bio string\n}\n\nWorkspaces > Users: contains\nWorkspaces > Files: owns\nUsers - Profiles: has_profile\nUsers > Files: created_by"
  },
  {
    "id": "tpl-erd-ecommerce",
    "name": "E-Commerce Product Catalog & Inventory Model",
    "diagramType": "erd-diagram",
    "category": "ERD",
    "description": "Complete relational model covering products, SKU variants, categories, warehouse inventory, and reviews.",
    "code": "title E-Commerce Catalog & Inventory\nnotation crows-foot\n\nCategories [color: blue] {\n  id string pk\n  name string\n  slug string unique\n}\n\nProducts [color: green] {\n  id string pk\n  category_id string fk\n  title string\n  base_price float\n  is_active boolean\n}\n\nProductVariants [color: purple] {\n  id string pk\n  product_id string fk\n  sku string unique\n  stock_quantity int\n  size string nullable\n  color string nullable\n}\n\nProductReviews [color: default] {\n  id string pk\n  product_id string fk\n  user_id string\n  rating int\n  comment text nullable\n}\n\nCategories > Products: groups\nProducts > ProductVariants: has_variants\nProducts > ProductReviews: receives"
  },

  # --- CLOUD ARCHITECTURE DIAGRAMS ---
  {
    "id": "tpl-cloud-aws-serverless",
    "name": "AWS Microservices & Serverless",
    "diagramType": "cloud-architecture-diagram",
    "category": "Cloud Architecture",
    "description": "Production AWS architecture with Route53, ALB, ECS Fargate, Aurora DB, and S3.",
    "code": "title AWS Serverless & Container Architecture\ndirection right\nstyleMode shadow\ntypeface clean\n\nClients [icon: globe, color: white, label: \"Web / Mobile Clients\"]\nRoute53 [icon: aws-route53, color: blue, label: \"Amazon Route 53\"]\nLoadBalancer [icon: aws-alb, color: orange, label: \"Application Load Balancer\"]\n\nVPC [color: blue] {\n  ApiService [icon: aws-ecs, color: blue, label: \"ECS Fargate Microservices\"]\n  AuthWorker [icon: aws-lambda, color: yellow, label: \"Lambda Auth Validator\"]\n}\n\nDatabaseCluster [icon: aws-rds, color: purple, label: \"Amazon Aurora PostgreSQL\"]\nObjectStorage [icon: aws-s3, color: green, label: \"S3 Static Assets\"]\n\nClients > Route53: DNS Lookup\nRoute53 > LoadBalancer: Route Traffic\nLoadBalancer > ApiService: Forward Requests\nApiService > AuthWorker: Verify Token\nApiService > DatabaseCluster: Read/Write SQL\nApiService > ObjectStorage: Upload Media"
  },
  {
    "id": "tpl-cloud-k8s-cluster",
    "name": "Multi-Region Kubernetes Cluster Architecture",
    "diagramType": "cloud-architecture-diagram",
    "category": "Cloud Architecture",
    "description": "High-availability multi-region cluster with cloud CDN, ingress controller, worker pods, and replication.",
    "code": "title Multi-Region Kubernetes Architecture\ndirection right\nstyleMode shadow\ntypeface clean\n\nGlobalDNS [icon: globe, color: white, label: \"Global Cloud CDN\"]\nIngressGateway [icon: router, color: orange, label: \"NGINX Ingress Controller\"]\n\nClusterPod [color: blue] {\n  FrontendPod [icon: server, color: blue, label: \"Next.js Web Pods\"]\n  ApiWorker [icon: server, color: purple, label: \"Node.js API Services\"]\n}\n\nRedisCache [icon: server, color: yellow, label: \"Redis Cluster Cache\"]\nPrimaryDatabase [icon: database, color: green, label: \"PostgreSQL Database\"]\n\nGlobalDNS > IngressGateway: Secure Edge Routing\nIngressGateway > FrontendPod: HTTP Ingress\nFrontendPod > ApiWorker: Internal gRPC\nApiWorker > RedisCache: Cache Lookup\nApiWorker > PrimaryDatabase: Persistent Storage"
  }
]

async def seed_templates_idempotent(db):
    """Idempotently seed reference templates into MongoDB on backend startup."""
    for tpl in SEED_TEMPLATES:
        await db.templates.update_one(
            {"id": tpl["id"]},
            {"$set": tpl},
            upsert=True
        )

@router.get("", response_model=TemplateListResponse)
async def list_templates(category: Optional[str] = Query(None)):
    db = await get_database()
    query = {}
    if category and category.lower() != "all":
        query["category"] = {"$regex": f"^{category}$", "$options": "i"}
    
    # Query database for seeded templates
    cursor = db.templates.find(query).sort("category", 1)
    templates = []
    try:
        async for doc in cursor:
            d = dict(doc)
            if "_id" in d:
                del d["_id"]
            templates.append(d)
    except TypeError:
        for doc in cursor:
            d = dict(doc)
            if "_id" in d:
                del d["_id"]
            templates.append(d)

    # Fallback to in-memory SEED_TEMPLATES if DB collection was not yet read
    if not templates:
        filtered = SEED_TEMPLATES
        if category and category.lower() != "all":
            filtered = [t for t in SEED_TEMPLATES if t["category"].lower() == category.lower()]
        return {"success": True, "templates": filtered}

    return {"success": True, "templates": templates}

@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str):
    db = await get_database()
    res = db.templates.find_one({"id": template_id})
    doc = await res if hasattr(res, "__await__") else res

    if doc:
        d = dict(doc)
        if "_id" in d:
            del d["_id"]
        return {"success": True, "template": d}

    found = next((t for t in SEED_TEMPLATES if t["id"] == template_id), None)
    if not found:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"success": True, "template": found}
