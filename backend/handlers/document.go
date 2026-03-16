package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"rag-backend/config"
	"rag-backend/database"
	"rag-backend/models"
	"rag-backend/utils"

	"github.com/gin-gonic/gin"
)

// DocumentHandler handles all document-related endpoints.
type DocumentHandler struct {
	cfg *config.Config
}

func NewDocumentHandler(cfg *config.Config) *DocumentHandler {
	return &DocumentHandler{cfg: cfg}
}

// allowedExtensions is used as a secondary MIME check for types that
// http.DetectContentType may mis-classify (e.g. XML-based Office formats).
var allowedExtensions = map[string]bool{
	".pdf": true, ".doc": true, ".docx": true, ".txt": true, ".rtf": true,
	".html": true, ".htm": true, ".md": true, ".mdx": true,
	".csv": true, ".xls": true, ".xlsx": true, ".ods": true,
	".ppt": true, ".pptx": true, ".odp": true, ".odt": true,
	".eml": true, ".msg": true, ".mhtml": true,
	".png": true, ".jpg": true, ".jpeg": true, ".tiff": true, ".tif": true,
}

// sanitizeDirName normalises an entity name into a safe directory component:
// lowercase, spaces become underscores, only a–z / 0–9 / - / _ are kept.
func sanitizeDirName(name string) string {
	name = strings.ToLower(strings.TrimSpace(name))
	result := strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			return r
		}
		if r == ' ' {
			return '_'
		}
		return -1 // drop everything else
	}, name)
	if result == "" {
		return "_unnamed"
	}
	return result
}

// sanitizeFilename strips path separators and replaces non-safe characters.
// This prevents path traversal when building upload paths.
func sanitizeFilename(name string) string {
	name = filepath.Base(name) // strip any directory components
	name = strings.ReplaceAll(name, "\x00", "")
	return strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') ||
			(r >= '0' && r <= '9') || r == '.' || r == '-' || r == '_' {
			return r
		}
		return '_'
	}, name)
}

// ctxInt64 safely reads an int64 value stored in gin's context.
func ctxInt64(c *gin.Context, key string) int64 {
	v, ok := c.Get(key)
	if !ok {
		return 0
	}
	if n, ok := v.(int64); ok {
		return n
	}
	return 0
}

// ---------------------------------------------------------------------------
// Upload  (POST /api/documents/upload — multipart/form-data)
// ---------------------------------------------------------------------------
//
// Form fields:
//   file             — the binary file (required)
//   title            — document title (optional, defaults to filename)
//   document_type    — e.g. "Policy", "Manual"  (optional)
//   description      — (optional)
//   tags             — JSON array string e.g. ["tag1","tag2"]  (optional)
//   access_level     — public|company|department|sub_department|restricted|confidential
//   update_frequency — real_time|daily|weekly|monthly|quarterly|annually|ad_hoc|one_time
//   version          — defaults to "1.0"
//   language         — defaults to "en"
//   date_created     — ISO date string  (optional)
//   expiry_date      — ISO date string  (optional)
//
// company_id, department_id, sub_dept_id are taken from the JWT — never from
// the request body (FR-6.4.6).

func (h *DocumentHandler) Upload(c *gin.Context) {
	userID := c.MustGet("user_id").(int64)

	cID := ctxInt64(c, "company_id")
	dID := ctxInt64(c, "department_id")
	sID := ctxInt64(c, "sub_dept_id") // 0 when not assigned

	if cID == 0 || dID == 0 {
		utils.BadRequest(c, "user must be assigned to a company and department before uploading")
		return
	}

	// ── File ──────────────────────────────────────────────────────────────
	file, header, err := c.Request.FormFile("file")
	if err != nil {
		utils.BadRequest(c, "file is required")
		return
	}
	defer file.Close()

	if header.Size > h.cfg.MaxFileSize {
		utils.BadRequest(c, fmt.Sprintf("file exceeds the %d MB limit",
			h.cfg.MaxFileSize/1024/1024))
		return
	}

	// Detect MIME from first 512 bytes, then restore reader position.
	sniff := make([]byte, 512)
	n, _ := file.Read(sniff)
	mimeType := strings.TrimSpace(strings.Split(http.DetectContentType(sniff[:n]), ";")[0])
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		utils.Internal(c, "failed to seek file")
		return
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !allowedExtensions[ext] {
		utils.BadRequest(c, "file type not permitted")
		return
	}

	// ── Hash ──────────────────────────────────────────────────────────────
	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		utils.Internal(c, "failed to compute file hash")
		return
	}
	fileHash := hex.EncodeToString(hasher.Sum(nil))
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		utils.Internal(c, "failed to seek file")
		return
	}

	// Duplicate detection (same hash, not archived).
	var existing models.Document
	if err := database.DB.Where("file_hash = ? AND status != ?", fileHash, "archived").
		First(&existing).Error; err == nil {
		utils.Conflict(c, fmt.Sprintf("duplicate file — already stored as document_id %d", existing.DocumentID))
		return
	}

	// ── Resolve org names for the folder hierarchy ────────────────────────
	var company models.Company
	if err := database.DB.First(&company, cID).Error; err != nil {
		utils.Internal(c, "failed to resolve company")
		return
	}
	var dept models.Department
	if err := database.DB.First(&dept, dID).Error; err != nil {
		utils.Internal(c, "failed to resolve department")
		return
	}
	subDirName := "general"
	if sID != 0 {
		var sub models.SubDepartment
		if err := database.DB.First(&sub, sID).Error; err == nil {
			if s := sanitizeDirName(sub.Name); s != "" {
				subDirName = s
			}
		}
	}

	// ── Persist to disk ───────────────────────────────────────────────────
	uploadDir := filepath.Join(h.cfg.UploadDir,
		sanitizeDirName(company.Name),
		sanitizeDirName(dept.Name),
		subDirName,
	)
	if err := os.MkdirAll(uploadDir, 0750); err != nil {
		utils.Internal(c, "failed to create upload directory")
		return
	}

	safeName := sanitizeFilename(header.Filename)
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	storedName := ts + "_" + safeName
	fullPath := filepath.Join(uploadDir, storedName)

	dst, err := os.Create(fullPath)
	if err != nil {
		utils.Internal(c, "failed to create file on disk")
		return
	}
	if _, err := io.Copy(dst, file); err != nil {
		dst.Close()
		os.Remove(fullPath)
		utils.Internal(c, "failed to write file")
		return
	}
	dst.Close()

	// ── Metadata from form fields ──────────────────────────────────────────
	title := c.PostForm("title")
	if title == "" {
		title = header.Filename
	}
	accessLevel := c.PostForm("access_level")
	if accessLevel == "" {
		accessLevel = "company"
	}
	updateFreq := c.PostForm("update_frequency")
	if updateFreq == "" {
		updateFreq = "ad_hoc"
	}
	version := c.PostForm("version")
	if version == "" {
		version = "1.0"
	}
	language := c.PostForm("language")
	if language == "" {
		language = "en"
	}

	var tags models.StringSlice
	if tagsRaw := c.PostForm("tags"); tagsRaw != "" {
		_ = tags.Scan(tagsRaw) // silently ignore parse errors; defaults to empty
	}

	var subDeptIDPtr *int64
	if sID != 0 {
		subDeptIDPtr = &sID
	}

	doc := models.Document{
		CompanyID:       cID,
		DepartmentID:    dID,
		SubDeptID:       subDeptIDPtr,
		DocumentType:    c.PostForm("document_type"),
		Title:           title,
		Description:     c.PostForm("description"),
		Tags:            tags,
		AccessLevel:     accessLevel,
		UpdateFrequency: updateFreq,
		Version:         version,
		Language:        language,
		DateCreated:     c.PostForm("date_created"),
		ExpiryDate:      c.PostForm("expiry_date"),
		FileName:        header.Filename,
		FilePath:        fullPath,
		FileSizeBytes:   header.Size,
		FileMimeType:    mimeType,
		FileHash:        fileHash,
		UploaderUserID:  userID,
		Status:          "stored",
		IsLatestVersion: 1,
	}

	if err := database.DB.Create(&doc).Error; err != nil {
		os.Remove(fullPath)
		utils.Internal(c, "failed to save document record: "+err.Error())
		return
	}

	utils.WriteAudit(database.DB, "document", doc.DocumentID, "uploaded", userID,
		c.ClientIP(), c.Request.UserAgent(), "")
	utils.Created(c, doc)
}

// ---------------------------------------------------------------------------
// List  (GET /api/documents)
// ---------------------------------------------------------------------------
//
// Query params:
//   company_id, department_id, sub_dept_id, document_type,
//   access_level, q (title/description search), latest_only=true,
//   include_archived=true, page, limit

func (h *DocumentHandler) List(c *gin.Context) {
	role := c.MustGet("role").(string)
	userID := c.MustGet("user_id").(int64)
	cID := ctxInt64(c, "company_id")
	dID := ctxInt64(c, "department_id")
	sID := ctxInt64(c, "sub_dept_id")

	query := database.DB.Model(&models.Document{})

	// Default: hide archived unless requested.
	if c.Query("include_archived") != "true" {
		query = query.Where("status != ?", "archived")
	}

	// ── Access-level filtering (skipped for system_admin) ─────────────────
	if role != "system_admin" {
		// Build OR-chain with parameterized placeholders.
		var orClauses []string
		var orArgs []interface{}

		orClauses = append(orClauses, "access_level = ?")
		orArgs = append(orArgs, "public")

		if cID != 0 {
			orClauses = append(orClauses, "(access_level = ? AND company_id = ?)")
			orArgs = append(orArgs, "company", cID)
		}
		if dID != 0 {
			orClauses = append(orClauses, "(access_level = ? AND department_id = ?)")
			orArgs = append(orArgs, "department", dID)
		}
		if sID != 0 {
			orClauses = append(orClauses, "(access_level = ? AND sub_dept_id = ?)")
			orArgs = append(orArgs, "sub_department", sID)
		}
		if role == "dept_admin" {
			orClauses = append(orClauses, "(access_level = ? AND department_id = ?)")
			orArgs = append(orArgs, "restricted", dID)
		}
		// contributor / viewer can see restricted only if they are the uploader.
		orClauses = append(orClauses, "(access_level = ? AND uploader_user_id = ?)")
		orArgs = append(orArgs, "restricted", userID)

		// confidential: uploader only.
		orClauses = append(orClauses, "(access_level = ? AND uploader_user_id = ?)")
		orArgs = append(orArgs, "confidential", userID)

		combined := strings.Join(orClauses, " OR ")
		query = query.Where(combined, orArgs...)
	}

	// ── Optional filters ──────────────────────────────────────────────────
	if v := c.Query("company_id"); v != "" {
		query = query.Where("company_id = ?", v)
	}
	if v := c.Query("department_id"); v != "" {
		query = query.Where("department_id = ?", v)
	}
	if v := c.Query("sub_dept_id"); v != "" {
		query = query.Where("sub_dept_id = ?", v)
	}
	if v := c.Query("document_type"); v != "" {
		query = query.Where("document_type = ?", v)
	}
	if v := c.Query("access_level"); v != "" {
		query = query.Where("access_level = ?", v)
	}
	if v := c.Query("q"); v != "" {
		like := "%" + v + "%"
		query = query.Where("title LIKE ? OR description LIKE ?", like, like)
	}
	if c.Query("latest_only") == "true" {
		query = query.Where("is_latest_version = 1")
	}

	// ── Pagination ────────────────────────────────────────────────────────
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	var total int64
	query.Count(&total)

	var docs []models.Document
	query.Order("date_uploaded DESC").Offset((page - 1) * limit).Limit(limit).Find(&docs)

	utils.OK(c, gin.H{
		"data":  docs,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// ---------------------------------------------------------------------------
// Get  (GET /api/documents/:id)
// ---------------------------------------------------------------------------

func (h *DocumentHandler) Get(c *gin.Context) {
	doc, ok := h.loadDocWithAccess(c)
	if !ok {
		return
	}
	utils.OK(c, doc)
}

// ---------------------------------------------------------------------------
// Download  (GET /api/documents/:id/download)
// ---------------------------------------------------------------------------

func (h *DocumentHandler) Download(c *gin.Context) {
	doc, ok := h.loadDocWithAccess(c)
	if !ok {
		return
	}
	if doc.Status == "archived" {
		utils.BadRequest(c, "document is archived")
		return
	}

	userID := c.MustGet("user_id").(int64)
	utils.WriteAudit(database.DB, "document", doc.DocumentID, "downloaded", userID,
		c.ClientIP(), c.Request.UserAgent(), "")

	c.FileAttachment(doc.FilePath, doc.FileName)
}

// ---------------------------------------------------------------------------
// UpdateMetadata  (PUT /api/documents/:id/metadata)
// ---------------------------------------------------------------------------

func (h *DocumentHandler) UpdateMetadata(c *gin.Context) {
	var doc models.Document
	if err := database.DB.First(&doc, c.Param("id")).Error; err != nil {
		utils.NotFound(c, "document not found")
		return
	}

	userID := c.MustGet("user_id").(int64)
	role := c.MustGet("role").(string)

	if !canEditDocument(&doc, userID, role) {
		utils.Forbidden(c)
		return
	}

	var req struct {
		DocumentType    string             `json:"document_type"`
		Title           string             `json:"title"`
		Description     string             `json:"description"`
		Tags            models.StringSlice `json:"tags"`
		AccessLevel     string             `json:"access_level"`
		UpdateFrequency string             `json:"update_frequency"`
		Version         string             `json:"version"`
		Language        string             `json:"language"`
		DateCreated     string             `json:"date_created"`
		ExpiryDate      string             `json:"expiry_date"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	updates := map[string]interface{}{
		"document_type":    req.DocumentType,
		"description":      req.Description,
		"tags":             req.Tags,
		"access_level":     req.AccessLevel,
		"update_frequency": req.UpdateFrequency,
		"version":          req.Version,
		"language":         req.Language,
		"date_created":     req.DateCreated,
		"expiry_date":      req.ExpiryDate,
	}
	if req.Title != "" {
		updates["title"] = req.Title
	}
	// If metadata was previously pending, mark as stored.
	if doc.Status == "pending_metadata" {
		updates["status"] = "stored"
	}

	database.DB.Model(&doc).Updates(updates)
	utils.WriteAudit(database.DB, "document", doc.DocumentID, "metadata_updated", userID,
		c.ClientIP(), c.Request.UserAgent(), "")
	utils.OK(c, doc)
}

// ---------------------------------------------------------------------------
// Archive  (PUT /api/documents/:id/archive)
// ---------------------------------------------------------------------------

func (h *DocumentHandler) Archive(c *gin.Context) {
	var doc models.Document
	if err := database.DB.First(&doc, c.Param("id")).Error; err != nil {
		utils.NotFound(c, "document not found")
		return
	}

	userID := c.MustGet("user_id").(int64)
	role := c.MustGet("role").(string)

	if !canEditDocument(&doc, userID, role) {
		utils.Forbidden(c)
		return
	}

	database.DB.Model(&doc).Update("status", "archived")
	utils.WriteAudit(database.DB, "document", doc.DocumentID, "archived", userID,
		c.ClientIP(), c.Request.UserAgent(), "")
	utils.OKMessage(c, "document archived")
}

// ---------------------------------------------------------------------------
// ReplaceFile  (PUT /api/documents/:id/file)
// ---------------------------------------------------------------------------
//
// Replaces the stored file for an existing document record without creating
// a new version. Only the physical file and its technical metadata
// (file_name, file_path, file_size_bytes, file_mime_type, file_hash) are
// updated; all descriptive metadata is preserved.

func (h *DocumentHandler) ReplaceFile(c *gin.Context) {
	var doc models.Document
	if err := database.DB.First(&doc, c.Param("id")).Error; err != nil {
		utils.NotFound(c, "document not found")
		return
	}

	userID := c.MustGet("user_id").(int64)
	role := c.MustGet("role").(string)

	if !canEditDocument(&doc, userID, role) {
		utils.Forbidden(c)
		return
	}
	if doc.Status == "archived" {
		utils.BadRequest(c, "cannot replace file of an archived document")
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		utils.BadRequest(c, "file is required")
		return
	}
	defer file.Close()

	if header.Size > h.cfg.MaxFileSize {
		utils.BadRequest(c, fmt.Sprintf("file exceeds the %d MB limit", h.cfg.MaxFileSize/1024/1024))
		return
	}

	// Detect MIME.
	sniff := make([]byte, 512)
	n, _ := file.Read(sniff)
	mimeType := strings.TrimSpace(strings.Split(http.DetectContentType(sniff[:n]), ";")[0])
	file.Seek(0, io.SeekStart)

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !allowedExtensions[ext] {
		utils.BadRequest(c, "file type not permitted")
		return
	}

	// Hash.
	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		utils.Internal(c, "failed to compute file hash")
		return
	}
	fileHash := hex.EncodeToString(hasher.Sum(nil))
	file.Seek(0, io.SeekStart)

	// Duplicate check — skip if the file is identical to what's already stored.
	if fileHash == doc.FileHash {
		utils.BadRequest(c, "the uploaded file is identical to the current file")
		return
	}
	// Reject if the same file is stored under a different document.
	var dup models.Document
	if err := database.DB.Where("file_hash = ? AND document_id != ? AND status != ?",
		fileHash, doc.DocumentID, "archived").First(&dup).Error; err == nil {
		utils.Conflict(c, fmt.Sprintf("duplicate file — already stored as document_id %d", dup.DocumentID))
		return
	}

	// Write new file to the same directory as the existing one.
	uploadDir := filepath.Dir(doc.FilePath)
	safeName := sanitizeFilename(header.Filename)
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	newStoredName := ts + "_" + safeName
	newFullPath := filepath.Join(uploadDir, newStoredName)

	dst, err := os.Create(newFullPath)
	if err != nil {
		utils.Internal(c, "failed to create file on disk")
		return
	}
	if _, err := io.Copy(dst, file); err != nil {
		dst.Close()
		os.Remove(newFullPath)
		utils.Internal(c, "failed to write file")
		return
	}
	dst.Close()

	// Remove old file (best-effort; do not abort on failure).
	_ = os.Remove(doc.FilePath)

	// Update DB record.
	updates := map[string]interface{}{
		"file_name":       header.Filename,
		"file_path":       newFullPath,
		"file_size_bytes": header.Size,
		"file_mime_type":  mimeType,
		"file_hash":       fileHash,
	}
	if err := database.DB.Model(&doc).Updates(updates).Error; err != nil {
		utils.Internal(c, "failed to update document record: "+err.Error())
		return
	}

	utils.WriteAudit(database.DB, "document", doc.DocumentID, "file_replaced", userID,
		c.ClientIP(), c.Request.UserAgent(), "")

	// Return the refreshed document.
	database.DB.First(&doc, doc.DocumentID)
	utils.OK(c, doc)
}

// ---------------------------------------------------------------------------
// GetVersions  (GET /api/documents/:id/versions)
// ---------------------------------------------------------------------------

func (h *DocumentHandler) GetVersions(c *gin.Context) {
	doc, ok := h.loadDocWithAccess(c)
	if !ok {
		return
	}

	// Find the root of the version chain.
	rootID := doc.DocumentID
	if doc.ParentDocumentID != nil {
		rootID = *doc.ParentDocumentID
	}

	var versions []models.Document
	database.DB.Where("document_id = ? OR parent_document_id = ?", rootID, rootID).
		Order("created_at ASC").Find(&versions)

	utils.OK(c, versions)
}

// ---------------------------------------------------------------------------
// UploadNewVersion  (POST /api/documents/:id/new-version)
// ---------------------------------------------------------------------------

func (h *DocumentHandler) UploadNewVersion(c *gin.Context) {
	var parent models.Document
	if err := database.DB.First(&parent, c.Param("id")).Error; err != nil {
		utils.NotFound(c, "parent document not found")
		return
	}

	userID := c.MustGet("user_id").(int64)
	role := c.MustGet("role").(string)

	if !canEditDocument(&parent, userID, role) {
		utils.Forbidden(c)
		return
	}

	cID := parent.CompanyID
	dID := parent.DepartmentID
	sID := parent.SubDeptID

	// Resolve org names for folder hierarchy.
	var pCompany models.Company
	if err := database.DB.First(&pCompany, cID).Error; err != nil {
		utils.Internal(c, "failed to resolve company")
		return
	}
	var pDept models.Department
	if err := database.DB.First(&pDept, dID).Error; err != nil {
		utils.Internal(c, "failed to resolve department")
		return
	}
	pSubDirName := "general"
	if sID != nil {
		var pSub models.SubDepartment
		if err := database.DB.First(&pSub, *sID).Error; err == nil {
			if s := sanitizeDirName(pSub.Name); s != "" {
				pSubDirName = s
			}
		}
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		utils.BadRequest(c, "file is required")
		return
	}
	defer file.Close()

	if header.Size > h.cfg.MaxFileSize {
		utils.BadRequest(c, "file exceeds size limit")
		return
	}

	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		utils.Internal(c, "failed to hash file")
		return
	}
	fileHash := hex.EncodeToString(hasher.Sum(nil))
	file.Seek(0, io.SeekStart)

	sniff := make([]byte, 512)
	n, _ := file.Read(sniff)
	mimeType := strings.TrimSpace(strings.Split(http.DetectContentType(sniff[:n]), ";")[0])
	file.Seek(0, io.SeekStart)

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !allowedExtensions[ext] {
		utils.BadRequest(c, "file type not permitted")
		return
	}

	uploadDir := filepath.Join(h.cfg.UploadDir,
		sanitizeDirName(pCompany.Name),
		sanitizeDirName(pDept.Name),
		pSubDirName,
	)
	os.MkdirAll(uploadDir, 0750)

	safeName := sanitizeFilename(header.Filename)
	ts := strconv.FormatInt(time.Now().UnixMilli(), 10)
	fullPath := filepath.Join(uploadDir, ts+"_"+safeName)

	dst, err := os.Create(fullPath)
	if err != nil {
		utils.Internal(c, "failed to create file on disk")
		return
	}
	io.Copy(dst, file)
	dst.Close()

	// Mark existing latest version as non-latest.
	rootID := parent.DocumentID
	if parent.ParentDocumentID != nil {
		rootID = *parent.ParentDocumentID
	}
	database.DB.Model(&models.Document{}).
		Where("document_id = ? OR parent_document_id = ?", rootID, rootID).
		Update("is_latest_version", 0)

	version := c.PostForm("version")
	if version == "" {
		version = parent.Version + ".1"
	}

	newDoc := models.Document{
		CompanyID:        cID,
		DepartmentID:     dID,
		SubDeptID:        sID,
		DocumentType:     parent.DocumentType,
		Title:            parent.Title,
		Description:      parent.Description,
		Tags:             parent.Tags,
		AccessLevel:      parent.AccessLevel,
		UpdateFrequency:  parent.UpdateFrequency,
		Version:          version,
		Language:         parent.Language,
		FileName:         header.Filename,
		FilePath:         fullPath,
		FileSizeBytes:    header.Size,
		FileMimeType:     mimeType,
		FileHash:         fileHash,
		UploaderUserID:   userID,
		Status:           "stored",
		IsLatestVersion:  1,
		ParentDocumentID: &rootID,
	}

	if err := database.DB.Create(&newDoc).Error; err != nil {
		os.Remove(fullPath)
		utils.Internal(c, "failed to save new version")
		return
	}

	utils.WriteAudit(database.DB, "document", newDoc.DocumentID, "new_version_uploaded", userID,
		c.ClientIP(), c.Request.UserAgent(), fmt.Sprintf(`{"parent_id":%d}`, rootID))
	utils.Created(c, newDoc)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// loadDocWithAccess loads a document and checks whether the requesting user
// is allowed to see it based on the document's access_level.
func (h *DocumentHandler) loadDocWithAccess(c *gin.Context) (*models.Document, bool) {
	var doc models.Document
	if err := database.DB.First(&doc, c.Param("id")).Error; err != nil {
		utils.NotFound(c, "document not found")
		return nil, false
	}

	role := c.MustGet("role").(string)
	if role == "system_admin" {
		return &doc, true
	}

	userID := c.MustGet("user_id").(int64)
	cID := ctxInt64(c, "company_id")
	dID := ctxInt64(c, "department_id")
	sID := ctxInt64(c, "sub_dept_id")

	switch doc.AccessLevel {
	case "public":
		// anyone
	case "company":
		if doc.CompanyID != cID {
			utils.Forbidden(c)
			return nil, false
		}
	case "department":
		if doc.DepartmentID != dID {
			utils.Forbidden(c)
			return nil, false
		}
	case "sub_department":
		if doc.SubDeptID == nil || *doc.SubDeptID != sID {
			utils.Forbidden(c)
			return nil, false
		}
	case "restricted":
		if doc.UploaderUserID != userID && role != "dept_admin" {
			utils.Forbidden(c)
			return nil, false
		}
	case "confidential":
		if doc.UploaderUserID != userID {
			utils.Forbidden(c)
			return nil, false
		}
	}
	return &doc, true
}

// canEditDocument returns true if the user may modify the document's metadata
// or archive it. Allowed for: the uploader, dept_admin, system_admin.
func canEditDocument(doc *models.Document, userID int64, role string) bool {
	if role == "system_admin" {
		return true
	}
	if role == "dept_admin" {
		return true
	}
	return doc.UploaderUserID == userID
}
