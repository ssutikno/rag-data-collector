package main

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"rag-backend/config"
	"rag-backend/database"
	"rag-backend/handlers"
	"rag-backend/middleware"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

//go:embed all:ui
var uiFS embed.FS

func main() {
	cfg := config.Load()

	// Connect to SQLite and run auto-migrations.
	database.Connect(cfg.DBPath)

	// Seed default admin user (no-op if users already exist).
	database.SeedAdminUser()

	// Ensure the uploads root directory exists.
	if err := os.MkdirAll(cfg.UploadDir, 0750); err != nil {
		log.Fatalf("failed to create uploads directory: %v", err)
	}

	r := gin.Default()

	// ── CORS ──────────────────────────────────────────────────────────────
	r.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.AllowedOrigins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Cap multipart memory (remainder spills to temp disk).
	r.MaxMultipartMemory = cfg.MaxFileSize

	// ── Initialise handlers ───────────────────────────────────────────────
	authH := handlers.NewAuthHandler(cfg)
	companyH := handlers.NewCompanyHandler()
	deptH := handlers.NewDepartmentHandler()
	subDeptH := handlers.NewSubDepartmentHandler()
	docH := handlers.NewDocumentHandler(cfg)
	userH := handlers.NewUserHandler()

	// ── Auth (public) ─────────────────────────────────────────────────────
	auth := r.Group("/api/auth")
	{
		auth.POST("/register", authH.Register)
		auth.POST("/login", middleware.LoginRateLimit(), authH.Login)
	}

	// ── Public lookup routes (no auth required, used by registration form) ──
	pub := r.Group("/api/public")
	{
		pub.GET("/companies", companyH.List)
		pub.GET("/departments", deptH.List)
		pub.GET("/sub-departments", subDeptH.List)
	}

	// ── All other routes require a valid JWT cookie ───────────────────────
	api := r.Group("/api", middleware.Auth(cfg))
	{
		// Auth (authenticated)
		api.POST("/auth/logout", authH.Logout)
		api.PUT("/auth/change-password", authH.ChangePassword)

		// Profile (self-service)
		api.GET("/profile", userH.GetProfile)
		api.PUT("/profile", userH.UpdateProfile)

		// Companies
		api.GET("/companies", companyH.List)
		api.GET("/companies/:id", companyH.Get)
		api.POST("/companies", middleware.RequireSystemAdmin(), companyH.Create)
		api.PUT("/companies/:id", middleware.RequireSystemAdmin(), companyH.Update)
		api.DELETE("/companies/:id", middleware.RequireSystemAdmin(), companyH.Deactivate)

		// Departments
		api.GET("/departments", deptH.List)
		api.GET("/departments/:id", deptH.Get)
		api.POST("/departments", middleware.RequireAdminOrDeptAdmin(), deptH.Create)
		api.PUT("/departments/:id", middleware.RequireAdminOrDeptAdmin(), deptH.Update)
		api.DELETE("/departments/:id", middleware.RequireSystemAdmin(), deptH.Deactivate)

		// Sub-Departments
		api.GET("/sub-departments", subDeptH.List)
		api.GET("/sub-departments/:id", subDeptH.Get)
		api.POST("/sub-departments", middleware.RequireAdminOrDeptAdmin(), subDeptH.Create)
		api.PUT("/sub-departments/:id", middleware.RequireAdminOrDeptAdmin(), subDeptH.Update)
		api.DELETE("/sub-departments/:id", middleware.RequireSystemAdmin(), subDeptH.Deactivate)

		// Documents
		api.GET("/documents", docH.List)
		api.POST("/documents/upload", middleware.RequireContributor(), docH.Upload)
		api.GET("/documents/:id", docH.Get)
		api.PUT("/documents/:id/metadata", middleware.RequireContributor(), docH.UpdateMetadata)
		api.PUT("/documents/:id/file", middleware.RequireContributor(), docH.ReplaceFile)
		api.GET("/documents/:id/download", docH.Download)
		api.PUT("/documents/:id/archive", docH.Archive)
		api.GET("/documents/:id/versions", docH.GetVersions)
		api.POST("/documents/:id/new-version", middleware.RequireContributor(), docH.UploadNewVersion)

		// Admin (system_admin only)
		admin := api.Group("/admin", middleware.RequireSystemAdmin())
		{
			admin.GET("/users", userH.ListUsers)
			admin.GET("/users/:id", userH.GetUser)
			admin.PUT("/users/:id", userH.UpdateUser)
			admin.PUT("/users/:id/role", userH.UpdateRole)
			admin.PUT("/users/:id/status", userH.UpdateStatus)
			admin.POST("/users/import", userH.ImportUsers)
			admin.GET("/audit-logs", userH.GetAuditLogs)
		}
	}

	// ── Serve embedded React SPA (must be registered last) ─────────────
	sub, err := fs.Sub(uiFS, "ui")
	if err != nil {
		log.Fatalf("failed to mount embedded UI: %v", err)
	}
	r.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		// API miss → JSON 404
		if strings.HasPrefix(path, "/api/") {
			c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "endpoint not found"})
			return
		}
		// Real static asset (assets/, favicon, etc.)
		if _, statErr := fs.Stat(sub, strings.TrimPrefix(path, "/")); statErr == nil {
			http.FileServer(http.FS(sub)).ServeHTTP(c.Writer, c.Request)
			return
		}
		// SPA fallback — let React Router handle the path
		data, _ := fs.ReadFile(sub, "index.html")
		c.Data(http.StatusOK, "text/html; charset=utf-8", data)
	})

	log.Printf("RAG backend listening on :%s", cfg.ServerPort)
	if err := r.Run(":" + cfg.ServerPort); err != nil {
		log.Fatal(err)
	}
}
