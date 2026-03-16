package handlers

import (
	"rag-backend/database"
	"rag-backend/models"
	"rag-backend/utils"

	"github.com/gin-gonic/gin"
)

type DepartmentHandler struct{}

func NewDepartmentHandler() *DepartmentHandler { return &DepartmentHandler{} }

type departmentRequest struct {
	CompanyID   int64  `json:"company_id"  binding:"required"`
	Name        string `json:"name"        binding:"required"`
	Code        string `json:"code"`
	Description string `json:"description"`
	HeadUserID  *int64 `json:"head_user_id"`
}

// List returns all active departments; filter by ?company_id= if provided.
func (h *DepartmentHandler) List(c *gin.Context) {
	query := database.DB.Where("is_active = 1")
	if cid := c.Query("company_id"); cid != "" {
		query = query.Where("company_id = ?", cid)
	}
	var departments []models.Department
	query.Find(&departments)
	utils.OK(c, departments)
}

// Get returns a single department by ID.
func (h *DepartmentHandler) Get(c *gin.Context) {
	var dept models.Department
	if err := database.DB.First(&dept, c.Param("id")).Error; err != nil {
		utils.NotFound(c, "department not found")
		return
	}
	utils.OK(c, dept)
}

// Create adds a new department (system_admin or dept_admin).
func (h *DepartmentHandler) Create(c *gin.Context) {
	var req departmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	// Verify company exists.
	var company models.Company
	if err := database.DB.Where("company_id = ? AND is_active = 1", req.CompanyID).First(&company).Error; err != nil {
		utils.BadRequest(c, "company not found or inactive")
		return
	}

	dept := models.Department{
		CompanyID:   req.CompanyID,
		Name:        req.Name,
		Code:        req.Code,
		Description: req.Description,
		HeadUserID:  req.HeadUserID,
		IsActive:    1,
	}

	if err := database.DB.Create(&dept).Error; err != nil {
		utils.Internal(c, "failed to create department")
		return
	}

	userID := c.MustGet("user_id").(int64)
	utils.WriteAudit(database.DB, "department", dept.DepartmentID, "created", userID,
		c.ClientIP(), c.Request.UserAgent(), "")
	utils.Created(c, dept)
}

// Update modifies an existing department (system_admin or dept_admin).
func (h *DepartmentHandler) Update(c *gin.Context) {
	var dept models.Department
	if err := database.DB.First(&dept, c.Param("id")).Error; err != nil {
		utils.NotFound(c, "department not found")
		return
	}

	var req struct {
		Name        string `json:"name"        binding:"required"`
		Code        string `json:"code"`
		Description string `json:"description"`
		HeadUserID  *int64 `json:"head_user_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	database.DB.Model(&dept).Updates(map[string]interface{}{
		"name":         req.Name,
		"code":         req.Code,
		"description":  req.Description,
		"head_user_id": req.HeadUserID,
	})

	userID := c.MustGet("user_id").(int64)
	utils.WriteAudit(database.DB, "department", dept.DepartmentID, "updated", userID,
		c.ClientIP(), c.Request.UserAgent(), "")
	utils.OK(c, dept)
}

// Deactivate soft-deletes a department (system_admin only).
func (h *DepartmentHandler) Deactivate(c *gin.Context) {
	var dept models.Department
	if err := database.DB.First(&dept, c.Param("id")).Error; err != nil {
		utils.NotFound(c, "department not found")
		return
	}
	database.DB.Model(&dept).Update("is_active", 0)
	userID := c.MustGet("user_id").(int64)
	utils.WriteAudit(database.DB, "department", dept.DepartmentID, "deactivated", userID,
		c.ClientIP(), c.Request.UserAgent(), "")
	utils.OKMessage(c, "department deactivated")
}
