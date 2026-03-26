# Chunking Patterns — Go Implementation

Text chunking splits a document's raw text into overlapping windows suitable for embedding with a fixed-context model (e.g., max 512 tokens for BERT-style models).

---

## Token-Based Chunker (Word-Approximate)

For BERT-style models, 1 token ≈ 0.75 words. A conservative approx: use **words** as the unit and assume `words * 1.3 ≈ tokens`. A proper tokenizer is preferred for production; this pattern is zero-dependency.

```go
// backend/utils/chunker.go

package utils

import "strings"

type Chunk struct {
    Text       string
    WordStart  int
    WordEnd    int
    ChunkIndex int
}

// ChunkText splits text into overlapping word windows.
// maxWords: target words per chunk (e.g., 380 → ~512 tokens)
// overlapWords: words to repeat between consecutive chunks (e.g., 40)
func ChunkText(text string, maxWords, overlapWords int) []Chunk {
    words := strings.Fields(text)
    if len(words) == 0 {
        return nil
    }

    var chunks []Chunk
    start := 0
    idx := 0

    for start < len(words) {
        end := start + maxWords
        if end > len(words) {
            end = len(words)
        }

        chunks = append(chunks, Chunk{
            Text:       strings.Join(words[start:end], " "),
            WordStart:  start,
            WordEnd:    end,
            ChunkIndex: idx,
        })
        idx++

        // advance by (maxWords - overlapWords) to create overlap
        advance := maxWords - overlapWords
        if advance <= 0 {
            advance = maxWords // safety: prevent infinite loop
        }
        start += advance

        if end == len(words) {
            break
        }
    }

    return chunks
}
```

**Recommended settings for BERT-style embedding models (512-token context):**
```go
chunks := utils.ChunkText(rawText, 380, 40)
```

**Recommended settings for longer-context models (e.g., 8192 tokens):**
```go
chunks := utils.ChunkText(rawText, 1500, 150)
```

---

## Text Extraction by Document Type

The RAG Docs backend stores `document_type` per document. Map it to an extractor:

```go
// backend/utils/extractor.go

package utils

import (
    "fmt"
    "os"
    "strings"
)

// ExtractText returns plain text from a file path, using the document type hint.
// For production, integrate a proper library per format.
func ExtractText(filePath, documentType string) (string, error) {
    switch strings.ToLower(documentType) {
    case "txt", "text":
        data, err := os.ReadFile(filePath)
        if err != nil {
            return "", err
        }
        return string(data), nil

    case "pdf":
        // Use pdfcpu, unipdf, or shell out to pdftotext
        // Example shell-out (requires poppler-utils on host):
        return shellExtract("pdftotext", filePath, "-")

    case "docx", "doc":
        // Use github.com/nguyenthenguyen/docx or unoconv
        return shellExtract("unoconv", "--stdout", "-f", "txt", filePath)

    case "csv":
        data, err := os.ReadFile(filePath)
        if err != nil {
            return "", err
        }
        // CSV: join all fields with spaces; preserve structure as text
        return string(data), nil

    case "xlsx":
        // Use github.com/tealeg/xlsx or excelize
        return "", fmt.Errorf("xlsx extraction requires excelize integration")

    default:
        // Attempt raw text read as fallback
        data, err := os.ReadFile(filePath)
        if err != nil {
            return "", err
        }
        return string(data), nil
    }
}
```

**Recommended Go libraries:**

| Format | Library |
|--------|---------|
| PDF    | `github.com/pdfcpu/pdfcpu` (Apache 2.0) |
| DOCX   | `github.com/nguyenthenguyen/docx` |
| XLSX   | `github.com/xuri/excelize/v2` |
| PPTX   | shell-out to LibreOffice `--headless --convert-to txt` |
| Images | OCR via `github.com/otiai10/gosseract` (requires Tesseract) |

---

## Tokenizer for Accurate Token Counts

For models with strict token limits, use a proper tokenizer instead of word counting:

```go
// Option 1: Use tiktoken-go (BPE tokenizer, good approximation for many models)
// go get github.com/pkoukk/tiktoken-go

import "github.com/pkoukk/tiktoken-go"

func CountTokens(text string) (int, error) {
    enc, err := tiktoken.GetEncoding("cl100k_base") // GPT-4 tokenizer; close enough for BERT
    if err != nil {
        return 0, err
    }
    return len(enc.Encode(text, nil, nil)), nil
}

// Option 2: WordPiece tokenizer for BERT
// go get github.com/sugarme/tokenizer
```

For index-accurate chunking with exact token windows, use a tokenizer that matches the embedding model's vocabulary (e.g., `bert-base-uncased` vocab for BGE models).

---

## Full Embedding Pipeline (Goroutine)

```go
// backend/handlers/embedding.go

package handlers

import (
    "context"
    "log"
    "net/http"
    "time"

    "github.com/gin-gonic/gin"
    "your-module/config"
    "your-module/database"
    "your-module/models"
    "your-module/utils"
    ovmsclient "your-module/ovms"
)

// TriggerEmbedding handles POST /api/documents/:id/embed
func TriggerEmbedding(cfg *config.Config) gin.HandlerFunc {
    return func(c *gin.Context) {
        id := c.Param("id")

        var doc models.Document
        if err := database.DB.First(&doc, id).Error; err != nil {
            c.JSON(http.StatusNotFound, gin.H{"error": "document not found"})
            return
        }
        if doc.Status != "stored" && doc.Status != "embedded" {
            c.JSON(http.StatusBadRequest, gin.H{"error": "document must be in 'stored' status"})
            return
        }

        // Update status immediately
        database.DB.Model(&doc).Update("status", "embedding")

        // Run async
        go runEmbeddingPipeline(cfg, doc)

        c.JSON(http.StatusAccepted, gin.H{"message": "embedding started", "document_id": doc.ID})
    }
}

func runEmbeddingPipeline(cfg *config.Config, doc models.Document) {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
    defer cancel()

    // 1. Extract text
    text, err := utils.ExtractText(doc.FilePath, doc.DocumentType)
    if err != nil {
        log.Printf("[embed] extract failed for doc %d: %v", doc.ID, err)
        database.DB.Model(&doc).Update("status", "embed_failed")
        return
    }

    // 2. Chunk text
    chunks := utils.ChunkText(text, cfg.ChunkSize, cfg.ChunkOverlap)

    // 3. Init OVMS client
    client := &ovmsclient.Client{
        BaseURL:   cfg.OVMSBaseURL,
        ModelName: cfg.OVMSModelName,
        Client:    &http.Client{Timeout: 30 * time.Second},
    }

    // 4. For each chunk: embed → store in vector store
    for _, chunk := range chunks {
        inputIDs, attentionMask := simpleTokenize(chunk.Text, 512) // replace with real tokenizer

        vec, err := client.Embed(ctx, inputIDs, attentionMask, len(inputIDs))
        if err != nil {
            log.Printf("[embed] OVMS error for doc %d chunk %d: %v", doc.ID, chunk.ChunkIndex, err)
            continue
        }

        vectorID, err := upsertToVectorStore(cfg, doc, chunk, vec)
        if err != nil {
            log.Printf("[embed] vector store error for doc %d chunk %d: %v", doc.ID, chunk.ChunkIndex, err)
            continue
        }

        // 5. Persist chunk record
        dbChunk := models.DocumentChunk{
            DocumentID:      doc.ID,
            ChunkIndex:      chunk.ChunkIndex,
            ChunkText:       chunk.Text,
            TokenCount:      len(inputIDs),
            EmbeddingStatus: "embedded",
            VectorID:        vectorID,
        }
        database.DB.Create(&dbChunk)
    }

    // 6. Mark document as fully embedded
    database.DB.Model(&doc).Update("status", "embedded")
    log.Printf("[embed] completed doc %d: %d chunks embedded", doc.ID, len(chunks))
}
```

---

## Simple Tokenizer Stub

Replace with a real tokenizer (tiktoken-go or bert tokenizer) for production. This stub pads with zeros to the target length — only suitable for testing shapes:

```go
// simpleTokenize returns padded input_ids and attention_mask of length seqLen.
// This is a placeholder — replace with a proper WordPiece or BPE tokenizer.
func simpleTokenize(text string, seqLen int) ([]int64, []int64) {
    words := strings.Fields(text)
    ids := make([]int64, seqLen)
    mask := make([]int64, seqLen)

    ids[0] = 101 // [CLS]
    for i, w := range words {
        if i+1 >= seqLen-1 {
            break
        }
        // Very rough: hash word to a vocab-range ID (100–30521 for bert-base)
        ids[i+1] = int64(hashWord(w)%30000 + 100)
        mask[i+1] = 1
    }
    mask[0] = 1
    // [SEP] at position of last real token
    // Remaining positions: ids=0, mask=0 (padding)
    return ids, mask
}

func hashWord(s string) uint32 {
    var h uint32 = 2166136261
    for i := 0; i < len(s); i++ {
        h ^= uint32(s[i])
        h *= 16777619
    }
    return h
}
```

---

## Vector Store Upsert Helper

```go
import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

// upsertToVectorStore stores a chunk embedding in ChromaDB.
// Returns the vector ID on success.
func upsertToVectorStore(cfg *config.Config, doc models.Document, chunk utils.Chunk, vec []float32) (string, error) {
    vectorID := fmt.Sprintf("doc_%d_chunk_%d", doc.ID, chunk.ChunkIndex)
    collName := resolveCollection(doc)

    payload := map[string]any{
        "ids":        []string{vectorID},
        "embeddings": [][]float32{vec},
        "documents":  []string{chunk.Text},
        "metadatas": []map[string]any{{
            "document_id":  doc.ID,
            "company_id":   doc.CompanyID,
            "dept_id":      doc.DepartmentID,
            "access_level": doc.AccessLevel,
            "chunk_index":  chunk.ChunkIndex,
        }},
    }

    body, _ := json.Marshal(payload)
    url := fmt.Sprintf("%s/api/v1/collections/%s/upsert", cfg.VectorStoreURL, collName)

    resp, err := http.Post(url, "application/json", bytes.NewReader(body))
    if err != nil {
        return "", err
    }
    defer resp.Body.Close()

    if resp.StatusCode >= 300 {
        return "", fmt.Errorf("vector store upsert returned %d", resp.StatusCode)
    }
    return vectorID, nil
}

// resolveCollection maps a document's access level to a ChromaDB collection name.
func resolveCollection(doc models.Document) string {
    switch doc.AccessLevel {
    case "public":
        return "public"
    case "company":
        return fmt.Sprintf("co_%d", doc.CompanyID)
    case "department":
        return fmt.Sprintf("co_%d_dept_%d", doc.CompanyID, doc.DepartmentID)
    default: // sub_department, restricted, confidential
        return fmt.Sprintf("co_%d_dept_%d_sub_%d", doc.CompanyID, doc.DepartmentID, doc.SubDeptID)
    }
}
```

---

## Cosine Similarity (for testing)

```go
func cosineSimilarity(a, b []float32) float32 {
    if len(a) != len(b) {
        return 0
    }
    var dot, normA, normB float32
    for i := range a {
        dot += a[i] * b[i]
        normA += a[i] * a[i]
        normB += b[i] * b[i]
    }
    if normA == 0 || normB == 0 {
        return 0
    }
    return dot / (float32(math.Sqrt(float64(normA))) * float32(math.Sqrt(float64(normB))))
}
```

Expected: two semantically similar chunks should score **> 0.80**. Unrelated chunks typically score **< 0.40**.
