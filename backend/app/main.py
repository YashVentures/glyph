from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import time
import json
import logging
from .core.config import settings
from .core.db import get_database, close_database
from .routers import files, folders, versions, share, icons, templates, ai

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("glyph-backend")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    db = await get_database()
    count_res = db.files.count_documents({})
    count = await count_res if hasattr(count_res, "__await__") else count_res

    if count == 0:
        logger.info("Database is empty. Seeding initial cloud architecture diagram...")
        now = int(time.time() * 1000)
        starter_file = {
            "id": "starter-arch",
            "title": "Cloud Architecture & Microservices",
            "folder_id": None,
            "doc_content": "# Cloud Architecture & Microservices Overview\n\nThis architecture diagram illustrates the production AWS setup with Route53, ALB, ECS Fargate services, and Aurora PostgreSQL.",
            "canvas_data": json.dumps({
                "camera": {"zoom": 1, "panX": 0, "panY": 0},
                "diagrams": [
                    {
                        "id": "diag-cloud-1",
                        "type": "diagram",
                        "diagramType": "cloud-architecture-diagram",
                        "code": 'title Production Cloud Architecture\ndirection right\nstyleMode shadow\ntypeface clean\n\nUsers [icon: globe, color: white, label: "Global Clients"]\nRoute53 [icon: aws-route53, color: blue, label: "Amazon Route 53"]\nALB [icon: aws-alb, color: orange, label: "Application Load Balancer"]\n\nVPC [color: blue] {\n  APIService [icon: aws-ecs, color: blue, label: "ECS Fargate Microservices"]\n  AuthWorker [icon: aws-lambda, color: yellow, label: "Lambda Auth"]\n}\n\nAuroraDB [icon: aws-rds, color: purple, label: "Aurora PostgreSQL"]\nS3Assets [icon: aws-s3, color: green, label: "S3 Static Assets"]\n\nUsers > Route53: HTTPS DNS\nRoute53 > ALB: Route traffic\nALB > APIService: Reverse Proxy\nAPIService > AuthWorker: Token check\nAPIService > AuroraDB: Read/Write SQL\nAPIService > S3Assets: Upload media',
                        "x": 80,
                        "y": 80
                    }
                ]
            }),
            "workspace_id": settings.DEFAULT_WORKSPACE_ID,
            "user_id": settings.DEFAULT_USER_ID,
            "is_archived": 0,
            "created_at": now,
            "updated_at": now,
            "last_accessed_at": now
        }
        ins = db.files.insert_one(starter_file)
        if hasattr(ins, "__await__"):
            await ins
    yield
    await close_database()

app = FastAPI(
    title="Glyph Diagramming API",
    description="Independent FastAPI backend for Glyph diagrams-as-code and documents.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Exception Handler for Consistent Error Object Shape
@app.exception_handler(HTTPException)
async def custom_http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": f"HTTP_{exc.status_code}",
                "message": str(exc.detail),
                "details": getattr(exc, "details", None)
            }
        }
    )

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unexpected error occurred processing your request."
            }
        }
    )

# Mount all feature routers under /api/v1
api_v1_prefix = "/api/v1"
app.include_router(files.router, prefix=api_v1_prefix)
app.include_router(folders.router, prefix=api_v1_prefix)
app.include_router(versions.router, prefix=api_v1_prefix)
app.include_router(share.router, prefix=api_v1_prefix)
app.include_router(icons.router, prefix=api_v1_prefix)
app.include_router(templates.router, prefix=api_v1_prefix)
app.include_router(ai.router, prefix=api_v1_prefix)

@app.get("/")
@app.get("/health")
async def health_check():
    return {
        "status": "online",
        "service": "Glyph Diagramming API",
        "version": "1.0.0",
        "api_prefix": "/api/v1",
        "workspace_id": settings.DEFAULT_WORKSPACE_ID,
        "user_id": settings.DEFAULT_USER_ID,
        "docs": "/docs"
    }
