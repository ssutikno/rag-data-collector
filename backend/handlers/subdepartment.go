package handlers

import (
	"rag-backend/database"
	"rag-backend/models"
	"rag-backend/utils"

	"github.com/gin-gonic/gin"
)

type SubDepartmentHandler struct{}

func NewSubDepartmentHandler() *SubDepartmentHandler { return &SubDepartmentHandler{} }

// List returns all active sub-departments; filter by ?department_id= if provided.
func (h *SubDepartmentHandler) List(c *gin.Context) {
	query := database.DB.Where("is_active = 1")
	if did := c.Query("department_id"); did != "" {
		query = query.Where("department_id = ?", did)
	}
	var subs []models.SubDepartment
	query.Find(&subs)
	utils.OK(c, subs)
}

// Get returns a single sub-department by ID.
func (h *SubDepartmentHandler) Get(c *gin.Context) {
	var sub models.SubDepartment
	if err := database.DB.First(&sub, c.Param("id")).Error; err != nil {
		utils.NotFound(c, "sub-department not found")
		return
	}
	utils.OK(c, sub)
}

// Create adds a new sub-department (system_admin or dept_admin).
func (h *SubDepartmentHandler) Create(c *gin.Context) {
	var req struct {
		DepartmentID int64  `json:"department_id" binding:"required"`
		Name         string `json:"name"          binding:"required"`
		Code         string `json:"code"`
		Description  string `json:"description"`
		LeadUserID   *int64 `json:"lead_user_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	// Verify parent department exists.
	var dept models.Department
	if err := database.DB.Where("department_id = ? AND is_active = 1", req.DepartmentID).First(&dept).Error; err != nil {
		utils.BadRequest(c, "department not found or inactive")
		return
	}

	sub := models.SubDepartment{
		DepartmentID: req.DepartmentID,
		Name:         req.Name,
		Code:         req.Code,
		Description:  req.Description,
		LeadUserID:   req.LeadUserID,
		IsActive:     1,
	}

	if err := database.DB.Create(&sub).Error; err != nil {
		utils.Internal(c, "failed to create sub-department")
		return
	}

	userID := c.MustGet("user_id").(int64)
	utils.WriteAudit(database.DB, "sub_department", sub.SubDeptID, "created", userID,
		c.ClientIP(), c.Request.UserAgent(), "")
	utils.Created(c, sub)
}

// Update modifies a sub-department (system_admin or dept_admin).
func (h *SubDepartmentHandler) Update(c *gin.Context) {
	var sub models.SubDepartment
	if err := database.DB.First(&sub, c.Param("id")).Error; err != nil {
		utils.NotFound(c, "sub-department not found")
		return
	}

	var req struct {
		Name        string `json:"name"        binding:"required"`
		Code        string `json:"code"`
		Description string `json:"description"`
		LeadUserID  *int64 `json:"lead_user_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	database.DB.Model(&sub).Updates(map[string]interface{}{
		"name":         req.Name,
		"code":         req.Code,
		"description":  req.Description,
		"lead_user_id": req.LeadUserID,
	})

	userID := c.MustGet("user_id").(int64)
	utils.WriteAudit(database.DB, "sub_department", sub.SubDeptID, "updated", userID,
		c.ClientIP(), c.Request.UserAgent(), "")
	utils.OK(c, sub)
}

// Deactivate soft-deletes a sub-department (system_admin only).
func (h *SubDepartmentHandler) Deactivate(c *gin.Context) {
	var sub models.SubDepartment
	if err := database.DB.First(&sub, c.Param("id")).Error; err != nil {
		utils.NotFound(c, "sub-department not found")
		return
	}
	database.DB.Model(&sub).Update("is_active", 0)
	userID := c.MustGet("user_id").(int64)
	utils.WriteAudit(database.DB, "sub_department", sub.SubDeptID, "deactivated", userID,
		c.ClientIP(), c.Request.UserAgent(), "")
	utils.OKMessage(c, "sub-department deactivated")
}
