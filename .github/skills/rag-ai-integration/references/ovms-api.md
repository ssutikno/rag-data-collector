# OVMS (OpenVINO Model Server) API Reference

OVMS implements the **KServe v2 inference protocol** (also called the Open Inference Protocol).

---

## REST Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/v2/health`                        | Server liveness check |
| `GET`  | `/v2/health/ready`                  | Server readiness check |
| `GET`  | `/v2/models/{model}`                | Model metadata (input/output tensors, versions) |
| `GET`  | `/v2/models/{model}/ready`          | Model readiness (returns 200 or 404) |
| `GET`  | `/v2/models/{model}/versions/{ver}` | Specific version metadata |
| `POST` | `/v2/models/{model}/infer`          | Run inference |
| `POST` | `/v2/models/{model}/versions/{ver}/infer` | Run inference on specific version |

Default REST port: **8001**  
Default gRPC port: **9001**

---

## Model Metadata Response

```json
GET /v2/models/bge-small-en

{
  "name": "bge-small-en",
  "versions": ["1"],
  "platform": "openvino",
  "inputs": [
    {"name": "input_ids",      "datatype": "INT64", "shape": [-1, 512]},
    {"name": "attention_mask", "datatype": "INT64", "shape": [-1, 512]},
    {"name": "token_type_ids", "datatype": "INT64", "shape": [-1, 512]}
  ],
  "outputs": [
    {"name": "last_hidden_state", "datatype": "FP32", "shape": [-1, 512, 384]},
    {"name": "pooler_output",     "datatype": "FP32", "shape": [-1, 384]}
  ]
}
```

`-1` in shape = dynamic batch dimension.

---

## Inference Request (REST)

```json
POST /v2/models/bge-small-en/infer
Content-Type: application/json

{
  "inputs": [
    {
      "name": "input_ids",
      "shape": [1, 128],
      "datatype": "INT64",
      "data": [101, 7592, 1010, 2023, 2003, 1037, 3231, 102, 0, 0, ...]
    },
    {
      "name": "attention_mask",
      "shape": [1, 128],
      "datatype": "INT64",
      "data": [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, ...]
    },
    {
      "name": "token_type_ids",
      "shape": [1, 128],
      "datatype": "INT64",
      "data": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...]
    }
  ]
}
```

**Notes:**
- `token_type_ids` is required for BERT-style models; omit for RoBERTa/DeBERTa models.
- Pad sequences to the declared shape using `0`; set `attention_mask=0` for pad tokens.
- Check model metadata to know which inputs are required.

---

## Inference Response (REST)

```json
{
  "model_name": "bge-small-en",
  "model_version": "1",
  "outputs": [
    {
      "name": "last_hidden_state",
      "shape": [1, 128, 384],
      "datatype": "FP32",
      "data": [0.021, -0.043, 0.112, ...]
    },
    {
      "name": "pooler_output",
      "shape": [1, 384],
      "datatype": "FP32",
      "data": [0.031, -0.011, 0.089, ...]
    }
  ]
}
```

`data` is a **flat array** in row-major order. For `last_hidden_state` shape `[1, 128, 384]`:  
- Element at `[batch, token, dim]` = `data[token * 384 + dim]` (for batch=0)

---

## Mean Pooling (from last_hidden_state)

```
1. Reshape flat data to [seq_len, hidden_dim]
2. Multiply each token vector by its attention_mask value (0 or 1)
3. Sum all token vectors: sum_vec[dim] = Σ token_vec[t][dim]
4. Divide by the count of non-padding tokens: mean_vec = sum_vec / sum(attention_mask)
5. L2-normalize: unit_vec = mean_vec / ||mean_vec||₂
```

If the model exposes `sentence_embedding` or `pooler_output` directly, prefer those — no manual pooling needed.

---

## gRPC API

Proto: `grpc_service.proto` (KServe v2)  
Import path: `github.com/kserve/kserve/pkg/apis/serving/v1beta1`

```protobuf
rpc ModelInfer(ModelInferRequest) returns (ModelInferResponse);
rpc ModelMetadata(ModelMetadataRequest) returns (ModelMetadataResponse);
rpc ServerReady(ServerReadyRequest) returns (ServerReadyResponse);
```

**Go gRPC client setup:**
```go
import (
    "google.golang.org/grpc"
    pb "github.com/ovms/grpc_proto/go"       // or your local proto
)

conn, err := grpc.Dial("ovms-host:9001", grpc.WithInsecure())
client := pb.NewGRPCInferenceServiceClient(conn)
```

**gRPC vs REST guidance:**
- Use gRPC when: high-throughput batch embedding, latency-sensitive paths
- Use REST when: simpler integration, debugging, one-off calls

---

## Go Client Implementation {#go-client}

```go
package ovms

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "math"
    "net/http"
)

type Client struct {
    BaseURL   string
    ModelName string
    Client    *http.Client
}

type inferRequest struct {
    Inputs []tensor `json:"inputs"`
}

type tensor struct {
    Name     string `json:"name"`
    Shape    []int  `json:"shape"`
    Datatype string `json:"datatype"`
    Data     any    `json:"data"`
}

type inferResponse struct {
    Outputs []struct {
        Name  string    `json:"name"`
        Shape []int     `json:"shape"`
        Data  []float32 `json:"data"`
    } `json:"outputs"`
}

// Embed tokenizes (external tokenizer) and calls OVMS, returning a unit embedding vector.
// inputIDs and attentionMask must have length == seqLen.
func (c *Client) Embed(ctx context.Context, inputIDs, attentionMask []int64, seqLen int) ([]float32, error) {
    req := inferRequest{
        Inputs: []tensor{
            {Name: "input_ids",      Shape: []int{1, seqLen}, Datatype: "INT64", Data: inputIDs},
            {Name: "attention_mask", Shape: []int{1, seqLen}, Datatype: "INT64", Data: attentionMask},
        },
    }

    body, _ := json.Marshal(req)
    url := fmt.Sprintf("%s/v2/models/%s/infer", c.BaseURL, c.ModelName)

    httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
    if err != nil {
        return nil, err
    }
    httpReq.Header.Set("Content-Type", "application/json")

    resp, err := c.Client.Do(httpReq)
    if err != nil {
        return nil, fmt.Errorf("ovms request: %w", err)
    }
    defer resp.Body.Close()

    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("ovms returned %d", resp.StatusCode)
    }

    var result inferResponse
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, fmt.Errorf("decode ovms response: %w", err)
    }

    // Find last_hidden_state or pooler_output
    for _, out := range result.Outputs {
        if out.Name == "pooler_output" || out.Name == "sentence_embedding" {
            return l2Normalize(out.Data), nil
        }
        if out.Name == "last_hidden_state" {
            hidden := meanPool(out.Data, attentionMask, seqLen, out.Shape[2])
            return l2Normalize(hidden), nil
        }
    }
    return nil, fmt.Errorf("no embedding output found in OVMS response")
}

func meanPool(data []float32, mask []int64, seqLen, dim int) []float32 {
    result := make([]float32, dim)
    var count float32
    for t := 0; t < seqLen; t++ {
        if mask[t] == 0 {
            continue
        }
        count++
        for d := 0; d < dim; d++ {
            result[d] += data[t*dim+d]
        }
    }
    if count == 0 {
        return result
    }
    for d := range result {
        result[d] /= count
    }
    return result
}

func l2Normalize(v []float32) []float32 {
    var norm float64
    for _, x := range v {
        norm += float64(x) * float64(x)
    }
    norm = math.Sqrt(norm)
    if norm == 0 {
        return v
    }
    out := make([]float32, len(v))
    for i, x := range v {
        out[i] = float32(float64(x) / norm)
    }
    return out
}
```

---

## Error Codes

| HTTP Status | Meaning | Common Cause |
|-------------|---------|--------------|
| 200 | OK | Inference succeeded |
| 400 | Bad Request | Wrong tensor name, shape mismatch, wrong datatype |
| 404 | Not Found | Model not loaded or wrong model name |
| 422 | Unprocessable | Tensor data length doesn't match declared shape |
| 503 | Service Unavailable | Model not ready yet (loading) |

---

## OVMS Config File (config.json)

```json
{
  "model_config_list": [
    {
      "config": {
        "name": "bge-small-en",
        "base_path": "/models/bge-small-en",
        "target_device": "CPU",
        "plugin_config": {"NUM_STREAMS": "4"},
        "nireq": 8
      }
    }
  ]
}
```

`nireq`: number of inference requests that can run in parallel.  
`NUM_STREAMS`: CPU threading streams — set to number of physical cores for embedding workloads.

---

## Windows Native Install Note

The `C:\ovms\openvino-2025.4.1` directory is the **OpenVINO runtime** source and Python build
(`import openvino` — the inference library). This is **not** the OVMS serving engine.

On Windows, OVMS (the server) runs exclusively in Docker via `openvino/model_server`.
Use [docker-compose.yml](../../../docker-compose.yml) to start the full AI stack.

| Component | Location | Type |
|-----------|----------|------|
| OpenVINO runtime (Python) | `C:\ovms\openvino-2025.4.1` | Native (2025.4.1) |
| OVMS server | `docker-compose.yml` → `ovms` service | Docker |

---

## Docker Compose (Project)

The project includes a ready-to-use Compose stack at `docker-compose.yml`:

```bash
# Export a model first (see ovms/models/README.md), then:
docker compose up -d ovms
docker compose logs -f ovms

# Verify
curl http://localhost:8001/v2/health/ready
curl http://localhost:8001/v2/models/bge-small-en/ready
```

---

## Docker Run (Standalone)

```bash
docker run -d \
  --name ovms \
  -p 8001:8001 \
  -p 9001:9001 \
  -v ./ovms/models:/models:ro \
  -v ./ovms/config.json:/config.json:ro \
  openvino/model_server:2025.4 \
  --config_path /config.json \
  --port 9001 \
  --rest_port 8001 \
  --log_level INFO
```
