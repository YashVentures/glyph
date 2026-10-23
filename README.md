# Glyph Workspace (Eraser Clone)

A clean, modular clone of the core Eraser diagramming workspace application, split into two fully decoupled services:
- **/backend**: Pure FastAPI REST service backed by MongoDB (Motor), with icon SVG sanitization, AI streaming events, and OpenAPI docs.
- **/frontend**: Pure Next.js React application with client-side diagram parser and renderer, Monaco code editor, and interactive canvas.

---

## Architecture Overview

```
├── backend/                  # FastAPI Backend Service (Python 3.11+)
│   ├── app/
│   │   ├── core/             # Configuration & Database connection
│   │   ├── routers/          # files, folders, versions, share, icons, templates, ai
│   │   ├── schemas/          # Pydantic v2 schemas
│   │   ├── services/         # SVG sanitization & AI streaming services
│   │   └── main.py           # FastAPI entrypoint & lifespan
│   ├── tests/                # Async pytest test suite
│   ├── requirements.txt      # Python dependencies
│   ├── Dockerfile            # Container definition
│   └── .env.example          # Backend environment variables
│
├── frontend/                 # Next.js Frontend Application (Node 20+)
│   ├── src/
│   │   ├── components/       # Editor & Dashboard components
│   │   ├── lib/
│   │   │   ├── api/client.ts # Single typed API client
│   │   │   └── engine/       # Browser-based tokenizer, parser & renderer
│   │   ├── pages/            # Next.js routes (/dashboard, /workspace, /review)
│   │   └── styles/           # CSS & design tokens
│   ├── tests/                # Diagram parser & renderer test suite
│   ├── package.json          # Node dependencies & scripts
│   ├── tsconfig.json         # TypeScript configuration
│   ├── Dockerfile            # Container definition
│   └── .env.example          # Frontend environment variables
│
├── docker-compose.yml        # Orchestration for MongoDB, Backend, and Frontend
└── README.md
```

---

## 1. Running the Backend Alone

### Prerequisites
- Python 3.11 or 3.12
- MongoDB (local or MongoDB Atlas connection string)

### Steps
1. Navigate to `/backend`:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   # On Windows (PowerShell):
   .\venv\Scripts\Activate.ps1
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env to set your MONGODB_URL
   ```
5. Run the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
6. Access interactive OpenAPI documentation:
   - Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
   - ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)
   - Health check: [http://localhost:8000/health](http://localhost:8000/health)

### Running Backend Tests
```bash
pytest -v
```

---

## 2. Running the Frontend Alone

### Prerequisites
- Node.js 18+ or 20+
- Running backend service at `http://localhost:8000`

### Steps
1. Navigate to `/frontend`:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Default: NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
   ```
4. Run the Next.js development server:
   ```bash
   npm run dev
   ```
5. Open your browser:
   - Dashboard: [http://localhost:3000/dashboard/all](http://localhost:3000/dashboard/all)
   - Diagram Review Gallery: [http://localhost:3000/review](http://localhost:3000/review)
   - New File: [http://localhost:3000/new](http://localhost:3000/new)

### Running Frontend Tests
```bash
npm run test
```

---

## 3. Running with Docker Compose

To start MongoDB, Backend, and Frontend in containers together:

```bash
docker-compose up --build
```

Services:
- **MongoDB**: `localhost:27017`
- **FastAPI API**: `localhost:8000` (docs at `/docs`)
- **Next.js App**: `localhost:3000`

---

## Rules & Decoupling Guarantees
- **Zero cross-imports**: Backend has no JavaScript or Node dependencies; Frontend has no Python or database packages (`sqlite3`, `motor`, etc. are strictly isolated to backend).
- **Single API Client**: All frontend network requests pass through `src/lib/api/client.ts`.
- **Client-Side Engine**: The diagram tokenizer, parser, and renderer run in the browser for low-latency live canvas sync.
- **AI Stream Validation**: Generated code is parsed by the frontend engine; if syntax errors occur, the frontend requests an automatic repair pass (`retry_error`).
- **Fixed Defaults**: User and workspace identities default to `default-user` and `default-workspace` to prepare for future authentication without redesigns.
