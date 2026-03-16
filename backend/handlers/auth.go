package handlers

import (
	"time"

	"rag-backend/config"
	"rag-backend/database"
	"rag-backend/middleware"
	"rag-backend/models"
	"rag-backend/utils"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// AuthHandler groups all authentication-related endpoints.
type AuthHandler struct {
	cfg *config.Config
}

func NewAuthHandler(cfg *config.Config) *AuthHandler {
	return &AuthHandler{cfg: cfg}
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

type RegisterRequest struct {
	FullName        string `json:"full_name"        binding:"required"`
	Email           string `json:"email"            binding:"required,email"`
	Password        string `json:"password"         binding:"required,min=8"`
	ConfirmPassword string `json:"confirm_password" binding:"required"`
	CompanyID       *int64 `json:"company_id"`
	DepartmentID    *int64 `json:"department_id"`
	SubDeptID       *int64 `json:"sub_dept_id"`
	JobTitle        string `json:"job_title"`
	Phone           string `json:"phone"`
}

// Register creates a new user account.
// The first user in the system automatically receives the system_admin role.
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}
	if req.Password != req.ConfirmPassword {
		utils.BadRequest(c, "passwords do not match")
		return
	}

	var emailCount int64
	database.DB.Model(&models.User{}).Where("email = ?", req.Email).Count(&emailCount)
	if emailCount > 0 {
		utils.Conflict(c, "email is already registered")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		utils.Internal(c, "failed to hash password")
		return
	}

	// Bootstrap: first registered user becomes system_admin.
	var totalUsers int64
	database.DB.Model(&models.User{}).Count(&totalUsers)
	role := "contributor"
	if totalUsers == 0 {
		role = "system_admin"
	}

	user := models.User{
		FullName:     req.FullName,
		Email:        req.Email,
		PasswordHash: string(hash),
		JobTitle:     req.JobTitle,
		Phone:        req.Phone,
		CompanyID:    req.CompanyID,
		DepartmentID: req.DepartmentID,
		SubDeptID:    req.SubDeptID,
		Role:         role,
		Status:       "active",
	}

	if err := database.DB.Create(&user).Error; err != nil {
		utils.Internal(c, "failed to create user")
		return
	}

	utils.WriteAudit(database.DB, "user", user.UserID, "registered", user.UserID,
		c.ClientIP(), c.Request.UserAgent(), "")

	utils.Created(c, gin.H{
		"message": "registration successful — please log in",
		"role":    user.Role,
	})
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

type LoginRequest struct {
	Email    string `json:"email"    binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Login authenticates the user and sets an HttpOnly JWT cookie.
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	var user models.User
	if err := database.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		middleware.RecordFailedLogin(c.ClientIP())
		utils.Unauthorized(c)
		return
	}

	if user.Status != "active" {
		utils.Unauthorized(c)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		middleware.RecordFailedLogin(c.ClientIP())
		utils.Unauthorized(c)
		return
	}

	middleware.ResetLoginAttempts(c.ClientIP())

	now := time.Now()
	database.DB.Model(&user).Update("last_login_at", now)

	token, err := utils.GenerateToken(&user, h.cfg)
	if err != nil {
		utils.Internal(c, "failed to generate token")
		return
	}

	utils.SetAuthCookie(c, token, h.cfg.JWTExpiry)
	utils.WriteAudit(database.DB, "user", user.UserID, "login", user.UserID,
		c.ClientIP(), c.Request.UserAgent(), "")

	user.PasswordHash = "" // never send the hash to client
	utils.OK(c, user)
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

// Logout clears the auth cookie and writes an audit log entry.
func (h *AuthHandler) Logout(c *gin.Context) {
	userID := c.MustGet("user_id").(int64)
	utils.ClearAuthCookie(c)
	utils.WriteAudit(database.DB, "user", userID, "logout", userID,
		c.ClientIP(), c.Request.UserAgent(), "")
	utils.OKMessage(c, "logged out successfully")
}

// ---------------------------------------------------------------------------
// Change password (in-app, requires current password)
// ---------------------------------------------------------------------------

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password"     binding:"required,min=8"`
}

func (h *AuthHandler) ChangePassword(c *gin.Context) {
	var req ChangePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	userID := c.MustGet("user_id").(int64)
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		utils.NotFound(c, "user not found")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.CurrentPassword)); err != nil {
		utils.BadRequest(c, "current password is incorrect")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), 12)
	if err != nil {
		utils.Internal(c, "failed to hash password")
		return
	}

	database.DB.Model(&user).Update("password_hash", string(hash))
	utils.WriteAudit(database.DB, "user", userID, "password_changed", userID,
		c.ClientIP(), c.Request.UserAgent(), "")
	utils.OKMessage(c, "password changed successfully")
}
