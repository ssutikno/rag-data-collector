---
name: rag-ai-integration
description: 'AI Engineering skill for integrating OVMS (OpenVINO Model Server) and OpenWebUI into the RAG Docs document pipeline. Use when: adding document embedding or vectorization via OVMS REST or gRPC APIs; configuring OpenWebUI RAG knowledge base connections; implementing document chunking pipelines in Go; troubleshooting OVMS model deployment or inference endpoints; setting up OpenWebUI pipeline/function integrations; building end-to-end RAG pipelines from document upload to LLM-queryable knowledge base; connecting OVMS embedding models to vector stores like ChromaDB or Qdrant.'
argument-hint: 'Describe the AI integration task — e.g., "add OVMS embedding endpoint", "configure OpenWebUI RAG pipeline", "implement chunking for document ID 5"'
---

# RAG AI Integration — OVMS & OpenWebUI

## When to Use

- Adding embedding or inference capabilities to the RAG Docs document pipeline
- Calling OVMS (OpenVINO Model Server) REST `/v2` or gRPC APIs from Go
- Connecting OpenWebUI as the chat UI with this document store as a RAG knowledge base
- Implementing async document chunking and vectorization in the Go backend
- Setting up OpenWebUI Pipelines that respect the existing RBAC/JWT model
- Debugging OVMS model readiness, shape mismatches, or inference errors
- Integrating a vector store (ChromaDB, Qdrant, pgvector) with the existing SQLite metadata layer

---

## Architecture Overview

```
┌──────────────────────┐     upload     ┌──────────────────────┐
│   React Frontend     │──────────────▶│   Go Backend (Gin)   │
│   (frontend/src/)    │               │   :8080               │
└──────────────────────┘               └──────────┬───────────┘
                                                   │ async embed job
                                    ┌──────────────▼───────────────┐
                                    │  OVMS Embedding Endpoint      │
                                    │  REST: /v2/models/{m}/infer   │
                                    │  gRPC: ModelInferRequest      │
                                    └──────────────┬───────────────┘
                                                   │ float32 vector
                                    ┌──────────────▼───────────────┐
                                    │  Vector Store                 │
                                    │  (ChromaDB / Qdrant)          │
                                    └──────────────┬───────────────┘
                                                   │ similarity search
                     ┌─────────────────────────────▼───────────────┐
                     │  OpenWebUI Pipeline Server                   │
                     │  • Encodes query via OVMS                    │
                     │  • Searches vector store (top-k)             │
                     │  • Fetches chunks respecting RBAC            │
                     └─────────────────────────────────────────────┘
                                    ▲
                     ┌──────────────┘
                     │  OpenWebUI Chat UI
                     │  /api/v1/knowledge/  (collections)
                     │  /api/v1/pipelines/  (custom pipelines)
                     └─────────────────────────────────────────────
```

---

## Procedure

### Step 1 — Verify OVMS Endpoint Health

Before any integration work, confirm the model is loaded and input/output shapes are known.

```bash
# Model readiness
curl http://<ovms-host>:<port>/v2/models/<model-name>/ready

# Model metadata — reveals input/output tensor names and shapes
curl http://<ovms-host>:<port>/v2/models/<model-name>

# Server health
curl http://<ovms-host>:<port>/v2/health
```

Expected ready response: `HTTP 200` with body `{}`.  
If `HTTP 404`: model not loaded — check OVMS `config.json` and model directory mount.  
See [OVMS API Reference](./references/ovms-api.md) for full endpoint list and gRPC equivalents.

---

### Step 2 — Understand the Inference Payload (KServe v2)

OVMS uses the **KServe v2 inference protocol** for both REST and gRPC.

**REST request shape:**
```json
POST /v2/models/{model_name}/infer
{
  "inputs": [
    {
      "name": "input_ids",
      "shape": [1, 512],
      "datatype": "INT64",
      "data": [101, 2023, 2003, ...]
    },
    {
      "name": "attention_mask",
      "shape": [1, 512],
      "datatype": "INT64",
      "data": [1, 1, 1, ...]
    }
  ]
}
```

**REST response shape:**
```json
{
  "model_name": "bge-small-en",
  "outputs": [
    {
      "name": "last_hidden_state",
      "shape": [1, 512, 384],
      "datatype": "FP32",
      "data": [0.021, -0.043, ...]
    }
  ]
}
```

**Mean pooling** to produce a single sentence vector (shape `[384]`):  
Average the token dimension (axis=1) of `last_hidden_state`, then L2-normalize.

For models that expose a `sentence_embedding` or `pooler_output` output directly, use that tensor without pooling.

---

### Step 3 — Add Config Fields (backend/config/config.go)

Extend the existing `Config` struct with AI integration settings:

```go
// AI / Embedding integration
OVMSBaseURL         string // e.g. "http://ovms:8001"
OVMSModelName       string // e.g. "bge-small-en"
OVMSEmbeddingDim    int    // e.g. 384 or 768
VectorStoreURL      string // e.g. "http://chroma:8000"
VectorStoreBackend  string // "chroma" | "qdrant"
ChunkSize           int    // tokens per chunk, default 512
ChunkOverlap        int    // overlapping tokens, default 50
EmbeddingEnabled    bool   // feature flag: skip embedding if false
```

Load from environment using the existing pattern in `config.go` (os.Getenv with defaults).

---

### Step 4 — Implement Document Chunking Pipeline (Go)

Create `backend/handlers/embedding.go` with two endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/documents/:id/embed` | Trigger async embedding for a stored document |
| `GET`  | `/api/documents/:id/chunks` | List chunks and their embedding status |

Create `backend/models/chunk.go`:

```go
type DocumentChunk struct {
    ID              uint      `json:"id" gorm:"primaryKey"`
    DocumentID      uint      `json:"document_id"`
    ChunkIndex      int       `json:"chunk_index"`
    ChunkText       string    `json:"chunk_text"`
    TokenCount      int       `json:"token_count"`
    EmbeddingStatus string    `json:"embedding_status"` // pending | embedded | failed
    VectorID        string    `json:"vector_id"`         // ID in the vector store
    CreatedAt       time.Time `json:"created_at"`
}
```

**Async embedding flow:**
1. HTTP handler sets document status to `embedding` and returns `202 Accepted`
2. Goroutine: extract text → chunk → for each chunk, call OVMS → upsert to vector store
3. Update `DocumentChunk.embedding_status` per chunk
4. On completion, update parent document to `embedded`

See [Chunking Patterns](./references/chunking-patterns.md) for the Go chunker and OVMS HTTP client implementations.

---

### Step 5 — OVMS Go Client Pattern

```go
type OVMSClient struct {
    BaseURL    string
    ModelName  string
    HTTPClient *http.Client
}

type InferRequest struct {
    Inputs []Tensor `json:"inputs"`
}

type Tensor struct {
    Name     string  `json:"name"`
    Shape    []int   `json:"shape"`
    Datatype string  `json:"datatype"`
    Data     any     `json:"data"` // []int64 for INT64, []float32 for FP32
}

type InferResponse struct {
    ModelName string   `json:"model_name"`
    Outputs   []Tensor `json:"outputs"`
}

func (c *OVMSClient) Embed(ctx context.Context, inputIDs, attentionMask []int64, seqLen int) ([]float32, error) {
    req := InferRequest{Inputs: []Tensor{
        {Name: "input_ids",      Shape: []int{1, seqLen}, Datatype: "INT64", Data: inputIDs},
        {Name: "attention_mask", Shape: []int{1, seqLen}, Datatype: "INT64", Data: attentionMask},
    }}
    // marshal → POST to /v2/models/{model}/infer → unmarshal → mean pool → L2 normalize
}
```

Full implementation with error handling: [OVMS API Reference](./references/ovms-api.md#go-client).

---

### Step 6 — Vector Store Integration

**RBAC-aware collection naming:**

Map the existing access_level + organizational hierarchy to vector store collections:

| Document access_level | Collection name pattern |
|-----------------------|------------------------|
| `public`              | `public`               |
| `company`             | `co_{company_id}`      |
| `department`          | `co_{company_id}_dept_{dept_id}` |
| `sub_department`      | `co_{company_id}_dept_{dept_id}_sub_{sub_id}` |
| `restricted` / `confidential` | `co_{company_id}_dept_{dept_id}_sub_{sub_id}_restricted` |

At query time, the pipeline server resolves which collections the requesting user may read (using their JWT claims + RBAC role), then fans out the similarity search.

**ChromaDB upsert (REST):**
```
POST /api/v1/collections/{collection_name}/upsert
{
  "ids":        ["doc_{doc_id}_chunk_{chunk_idx}"],
  "embeddings": [[0.021, -0.043, ...]],
  "documents":  ["chunk text here"],
  "metadatas":  [{"document_id": 7, "company_id": 1, "chunk_index": 0}]
}
```

**Qdrant upsert (REST):**
```
PUT /collections/{collection_name}/points
{
  "points": [{"id": "...", "vector": [...], "payload": {...}}]
}
```

See [OpenWebUI API Reference](./references/openwebui-api.md) for vector store query patterns used inside the pipeline.

---

### Step 7 — OpenWebUI Pipeline Integration

Create a Python pipeline server (`pipeline/main.py`) using the [OpenWebUI Pipelines](https://github.com/open-webui/pipelines) framework:

```python
from pydantic import BaseModel
import requests, numpy as np

class Pipeline:
    class Valves(BaseModel):
        rag_docs_api_url: str = "http://localhost:8080"
        ovms_url:         str = "http://ovms:8001"
        vector_store_url: str = "http://chroma:8000"
        ovms_model_name:  str = "bge-small-en"
        top_k:            int = 5

    def __init__(self):
        self.valves = self.Valves()

    def pipe(self, user_message: str, model_id: str, messages: list, body: dict) -> str:
        # 1. Encode query via OVMS
        query_vec = self._embed(user_message)
        # 2. Resolve allowed collections from user JWT (passed in body["user"])
        collections = self._resolve_collections(body.get("user", {}))
        # 3. Vector search
        chunks = self._search(query_vec, collections)
        # 4. Return augmented prompt
        context = "\n\n".join(c["document"] for c in chunks)
        return f"Context:\n{context}\n\nQuestion: {user_message}"
```

**Register pipeline with OpenWebUI:**
```bash
curl -X POST http://<openwebui-host>/api/v1/pipelines/add \
  -H "Authorization: Bearer $OPENWEBUI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://<pipeline-server>:9099"}'
```

See [OpenWebUI API Reference](./references/openwebui-api.md) for full API surface and authentication patterns.

---

### Step 8 — End-to-End Validation Checklist

```
[ ] OVMS model ready:   curl .../v2/models/<name>/ready → HTTP 200
[ ] Shape correct:      /v2/models/<name> shows expected input/output tensors
[ ] Single inference:   POST sample tokenized text → embedding vector returned
[ ] Chunk pipeline:     POST /api/documents/:id/embed → status becomes "embedded"
[ ] Vector stored:      ChromaDB/Qdrant collection has entries for document
[ ] Similar docs:       embed 2 related docs → cosine similarity > 0.8
[ ] RBAC respected:     pipeline query as dept-limited user returns only dept docs
[ ] OpenWebUI pipeline: ask question in chat → RAG context appears in response
[ ] Audit trail:        embedding events logged in audit_logs table
```

---

## Key References

- [OVMS API Reference](./references/ovms-api.md) — endpoint list, KServe v2 payload, gRPC, Go client, error codes
- [OpenWebUI API Reference](./references/openwebui-api.md) — knowledge base API, pipeline server contract, authentication
- [Chunking Patterns](./references/chunking-patterns.md) — Go text chunker, OVMS HTTP client, mean pooling util
