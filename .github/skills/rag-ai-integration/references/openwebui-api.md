# OpenWebUI API Reference

Base URL: `http://<openwebui-host>:<port>` (default port: **3000**)  
Authentication: `Authorization: Bearer <API_KEY>` — get from OpenWebUI → Settings → Account → API Keys

---

## Authentication

```bash
# All API calls require the header:
Authorization: Bearer <OPENWEBUI_API_KEY>
```

OpenWebUI also accepts session cookies for browser interactions. For server-to-server calls (pipeline registration, knowledge base management), always use the Bearer token.

---

## Knowledge Base API

Knowledge bases are named document collections visible inside OpenWebUI chat.

### Create a Collection

```bash
POST /api/v1/knowledge/
Content-Type: application/json
Authorization: Bearer <key>

{
  "name": "Finance Dept Docs",
  "description": "Documents from the Finance department",
  "data": {}
}
```

Response:
```json
{
  "id": "kb_abc123",
  "name": "Finance Dept Docs",
  "description": "...",
  "created_at": 1710000000,
  "updated_at": 1710000000
}
```

### List Collections

```bash
GET /api/v1/knowledge/
```

### Get Collection

```bash
GET /api/v1/knowledge/{id}/
```

### Add File to Collection

Upload a file from disk to a knowledge base (OpenWebUI handles embedding internally when using OpenWebUI's built-in RAG engine):

```bash
# Step 1: Upload file to OpenWebUI file store
POST /api/v1/files/
Content-Type: multipart/form-data
Authorization: Bearer <key>

file=@/path/to/document.pdf

# Response:
{ "id": "file_xyz789", "filename": "document.pdf", ... }

# Step 2: Associate file with knowledge base
POST /api/v1/knowledge/{kb_id}/file/add
Content-Type: application/json
Authorization: Bearer <key>

{ "file_id": "file_xyz789" }
```

### Remove File from Collection

```bash
POST /api/v1/knowledge/{kb_id}/file/remove
Content-Type: application/json

{ "file_id": "file_xyz789" }
```

### Delete Collection

```bash
DELETE /api/v1/knowledge/{id}/
```

---

## RAG Configuration (Admin)

These settings control OpenWebUI's embedded RAG engine. When using an **external OVMS embedding endpoint**, set these in OpenWebUI Admin → Settings → RAG, or via environment variables.

| Setting | Env Var | Value for OVMS |
|---------|---------|----------------|
| Embedding Engine | `RAG_EMBEDDING_ENGINE` | `openai` (use OpenAI-compatible REST) |
| Embedding Base URL | `RAG_OPENAI_API_BASE_URL` | `http://ovms:8001/v2/models/bge-small-en` |
| Embedding API Key | `RAG_OPENAI_API_KEY` | any non-empty string |
| Embedding Model | `RAG_EMBEDDING_MODEL` | `bge-small-en` |
| Chunk Size | `CHUNK_SIZE` | `500` |
| Chunk Overlap | `CHUNK_OVERLAP` | `50` |

**Note**: OVMS does NOT expose an OpenAI-compatible `/v1/embeddings` endpoint by default. You have two options:
1. Deploy an adapter (e.g., `ovms-openai-adapter`) that translates `/v1/embeddings` → OVMS `/v2/models/{m}/infer`
2. Use the **External Pipeline** approach (recommended) so OpenWebUI never calls OVMS directly

---

## Pipelines API

OpenWebUI Pipelines are external Python servers that intercept chat messages, add context (RAG), and return augmented prompts.

### Register a Pipeline

```bash
POST /api/v1/pipelines/add
Content-Type: application/json
Authorization: Bearer <key>

{
  "url": "http://pipeline-server:9099"
}
```

OpenWebUI will immediately call `GET http://pipeline-server:9099/` to fetch the pipeline manifest.

### List Pipelines

```bash
GET /api/v1/pipelines/
```

### Delete Pipeline

```bash
DELETE /api/v1/pipelines/{id}/
```

---

## Pipeline Server Contract

Your pipeline server must implement this REST interface:

### GET / — Manifest

```json
{
  "id": "rag-docs-pipeline",
  "name": "RAG Docs Pipeline",
  "description": "Retrieves context from the RAG Docs system",
  "type": "filter",
  "valves": {
    "rag_docs_api_url": {"description": "RAG Docs backend URL", "default": "http://localhost:8080", "type": "str"},
    "ovms_url":         {"description": "OVMS base URL",        "default": "http://ovms:8001",     "type": "str"},
    "vector_store_url": {"description": "ChromaDB or Qdrant URL","default": "http://chroma:8000", "type": "str"},
    "top_k":            {"description": "Number of chunks to retrieve", "default": 5, "type": "int"}
  }
}
```

### POST / — Inference Hook

OpenWebUI sends the chat context here before passing to the LLM:

```json
{
  "user": {
    "id": "user_abc",
    "role": "user",
    "name": "Alice"
  },
  "messages": [
    {"role": "user", "content": "What is the accounts payable process?"}
  ],
  "model": "llama3.2:latest",
  "body": {}
}
```

Your pipeline must return one of:
1. **Modified messages list** — inject context into the last user message
2. **Direct string** — replaces the last user message content

**Minimal Python pipeline (FastAPI):**

```python
from fastapi import FastAPI, Request
from pydantic import BaseModel
import httpx, numpy as np

app = FastAPI()

class Valves(BaseModel):
    rag_docs_api_url: str = "http://localhost:8080"
    ovms_url: str = "http://ovms:8001"
    vector_store_url: str = "http://chroma:8000"
    ovms_model_name: str = "bge-small-en"
    top_k: int = 5

valves = Valves()

@app.get("/")
def manifest():
    return {
        "id": "rag-docs-pipeline",
        "name": "RAG Docs Pipeline",
        "type": "filter",
        "valves": valves.model_json_schema()["properties"]
    }

@app.post("/")
async def pipe(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    if not messages:
        return {"messages": messages}

    user_query = messages[-1]["content"]

    # 1. Encode query
    query_vec = embed_text(user_query, valves.ovms_url, valves.ovms_model_name)

    # 2. Resolve collections for this user (based on body["user"])
    user_info = body.get("user", {})
    collections = resolve_user_collections(user_info, valves.rag_docs_api_url)

    # 3. Search vector store
    chunks = search_chunks(query_vec, collections, valves.vector_store_url, valves.top_k)

    # 4. Augment user message
    if chunks:
        context = "\n\n".join(f"[Source: doc {c['metadata']['document_id']}]\n{c['document']}" for c in chunks)
        messages[-1]["content"] = f"Use the following context to answer the question:\n\n{context}\n\nQuestion: {user_query}"

    return {"messages": messages}
```

---

## Models API

```bash
# List available models (shows pipelines as special models)
GET /api/models

# Response includes pipeline entries like:
{
  "id": "rag-docs-pipeline",
  "name": "RAG Docs Pipeline",
  "object": "model",
  "owned_by": "pipeline"
}
```

---

## Chat Completions (OpenAI-compatible)

OpenWebUI exposes an OpenAI-compatible endpoint for programmatic chat:

```bash
POST /api/chat/completions
Content-Type: application/json
Authorization: Bearer <key>

{
  "model": "llama3.2:latest",
  "messages": [
    {"role": "user", "content": "What documents are in the Finance department?"}
  ],
  "stream": false
}
```

When `model` is set to a pipeline ID, the pipeline's `pipe()` method intercepts the call.

---

## ChromaDB Vector Store Query (used inside pipeline)

```bash
POST /api/v1/collections/{collection_name}/query
Content-Type: application/json

{
  "query_embeddings": [[0.021, -0.043, ...]],
  "n_results": 5,
  "include": ["documents", "metadatas", "distances"]
}
```

Response:
```json
{
  "ids": [["doc_7_chunk_2", "doc_3_chunk_0"]],
  "documents": [["chunk text ...", "other chunk ..."]],
  "metadatas": [[{"document_id": 7, "company_id": 1}, {...}]],
  "distances": [[0.12, 0.31]]
}
```

---

## Qdrant Vector Store Query (alternative)

```bash
POST /collections/{collection_name}/points/search

{
  "vector": [0.021, -0.043, ...],
  "limit": 5,
  "with_payload": true
}
```

---

## JWT Token Validation (RAG Docs Backend → Pipeline)

The pipeline server can validate user identity by calling the RAG Docs API:

```bash
# Pass the user's OpenWebUI JWT or a service account token
GET http://rag-docs:8080/api/profile
Authorization: Bearer <user-jwt-from-rag-docs>

# Response includes role, company_id, department_id for RBAC collection resolution
```

For production: issue a **service account** API key in RAG Docs for use by the pipeline server, then run RBAC resolution via SQL or a dedicated API endpoint. Never expose internal JWT signing secrets between services.

---

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Missing or invalid Bearer token | Check `OPENWEBUI_API_KEY` |
| `422 Unprocessable` | Wrong request body shape | Check pipeline manifest valves schema |
| Pipeline not receiving requests | Wrong pipeline type (`"pipe"` vs `"filter"`) | Use `"filter"` for context injection |
| Empty RAG context | Collections not matching user's scope | Log `resolve_user_collections()` output |
| Slow embedding | OVMS `nireq` too low | Increase `nireq` in OVMS config.json |
