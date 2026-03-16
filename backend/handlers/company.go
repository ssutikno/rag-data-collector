package handlers

import (
	"rag-backend/database"
	"rag-backend/models"
	"rag-backend/utils"

	"github.com/gin-gonic/gin"
)

type CompanyHandler struct{}

func NewCompanyHandler() *CompanyHandler { return &CompanyHandler{} }

type companyRequest struct {
	Name        string `json:"name"        binding:"required"`
	Code        string `json:"code"`
	Industry    string `json:"industry"`
	Description string `json:"description"`
	LogoURL     string `json:"logo_url"`
}

// List returns all active companies.
func (h *CompanyHandler) List(c *gin.Context) {
	var companies []models.Company
	database.DB.Where("is_active = 1").Find(&companies)
	utils.OK(c, companies)
}

// Get returns a single company by ID.
func (h *CompanyHandler) Get(c *gin.Context) {
	var company models.Company
	if err := database.DB.First(&company, c.Param("id")).Error; err != nil {
		utils.NotFound(c, "company not found")
		return
	}
	utils.OK(c, company)
}

// Create adds a new company (system_admin only).
func (h *CompanyHandler) Create(c *gin.Context) {
	var req companyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	company := models.Company{
		Name:        req.Name,
		Code:        req.Code,
		Industry:    req.Industry,
		Description: req.Description,
		LogoURL:     req.LogoURL,
		IsActive:    1,
	}

	if err := database.DB.Create(&company).Error; err != nil {
		utils.Conflict(c, "company name or code already exists")
		return
	}

	userID := c.MustGet("user_id").(int64)
	utils.WriteAudit(database.DB, "company", company.CompanyID, "created", userID,
		c.ClientIP(), c.Request.UserAgent(), "")
	utils.Created(c, company)
}

// Update modifies an existing company (system_admin only).
func (h *CompanyHandler) Update(c *gin.Context) {
	var company models.Company
	if err := database.DB.First(&company, c.Param("id")).Error; err != nil {
		utils.NotFound(c, "company not found")
		return
	}

	var req companyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	if err := database.DB.Model(&company).Updates(map[string]interface{}{
		"name":        req.Name,
		"code":        req.Code,
		"industry":    req.Industry,
		"description": req.Description,
		"logo_url":    req.LogoURL,
	}).Error; err != nil {
		utils.Conflict(c, "company name or code already exists")
		return
	}

	userID := c.MustGet("user_id").(int64)
	utils.WriteAudit(database.DB, "company", company.CompanyID, "updated", userID,
		c.ClientIP(), c.Request.UserAgent(), "")
	utils.OK(c, company)
}

// Deactivate soft-deletes a company (system_admin only).
func (h *CompanyHandler) Deactivate(c *gin.Context) {
	var company models.Company
	if err := database.DB.First(&company, c.Param("id")).Error; err != nil {
		utils.NotFound(c, "company not found")
		return
	}
	database.DB.Model(&company).Update("is_active", 0)
	userID := c.MustGet("user_id").(int64)
	utils.WriteAudit(database.DB, "company", company.CompanyID, "deactivated", userID,
		c.ClientIP(), c.Request.UserAgent(), "")
	utils.OKMessage(c, "company deactivated")
}
