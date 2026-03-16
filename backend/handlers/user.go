package handlers

import (
	"encoding/csv"
	"fmt"
	"io"
	"strconv"
	"strings"

	"rag-backend/database"
	"rag-backend/models"
	"rag-backend/utils"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// UserHandler covers profile management and admin user operations.
type UserHandler struct{}

func NewUserHandler() *UserHandler { return &UserHandler{} }

// ---------------------------------------------------------------------------
// Profile  (self-service)
// ---------------------------------------------------------------------------

// GetProfile returns the authenticated user's own profile.
func (h *UserHandler) GetProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(int64)
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		utils.NotFound(c, "user not found")
		return
	}
	user.PasswordHash = ""
	utils.OK(c, user)
}

// UpdateProfile lets a user update their own editable fields.
// Set update_org:true to also update company_id / department_id / sub_dept_id
// (pass null to clear them).
func (h *UserHandler) UpdateProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(int64)
	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		utils.NotFound(c, "user not found")
		return
	}

	var req struct {
		FullName     string `json:"full_name"`
		JobTitle     string `json:"job_title"`
		Phone        string `json:"phone"`
		UpdateOrg    bool   `json:"update_org"`
		CompanyID    *int64 `json:"company_id"`
		DepartmentID *int64 `json:"department_id"`
		SubDeptID    *int64 `json:"sub_dept_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	updates := map[string]interface{}{}
	if req.FullName != "" {
		updates["full_name"] = req.FullName
	}
	if req.JobTitle != "" {
		updates["job_title"] = req.JobTitle
	}
	if req.Phone != "" {
		updates["phone"] = req.Phone
	}
	if req.UpdateOrg {
		updates["company_id"] = req.CompanyID
		updates["department_id"] = req.DepartmentID
		updates["sub_dept_id"] = req.SubDeptID
	}

	if len(updates) > 0 {
		database.DB.Model(&user).Updates(updates)
	}

	utils.WriteAudit(database.DB, "user", userID, "profile_updated", userID,
		c.ClientIP(), c.Request.UserAgent(), "")
	if err := database.DB.First(&user, userID).Error; err == nil {
		user.PasswordHash = ""
	}
	utils.OK(c, user)
}

// ---------------------------------------------------------------------------
// Admin — user management  (system_admin only)
// ---------------------------------------------------------------------------

// ListUsers returns a paginated list of all users including resolved company and department names.
func (h *UserHandler) ListUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	} else if limit > 9999 {
		limit = 9999
	}

	type userListRow struct {
		models.User
		CompanyName    string `json:"company_name"`
		DepartmentName string `json:"department_name"`
	}

	baseData := database.DB.Table("users").
		Select("users.user_id, users.full_name, users.email, users.job_title, users.phone, " +
			"users.company_id, users.department_id, users.sub_dept_id, users.role, users.status, " +
			"users.last_login_at, users.created_at, users.updated_at, " +
			"COALESCE(c.name, '') AS company_name, COALESCE(d.name, '') AS department_name").
		Joins("LEFT JOIN companies c ON c.company_id = users.company_id").
		Joins("LEFT JOIN departments d ON d.department_id = users.department_id")

	baseCount := database.DB.Model(&models.User{})

	if v := c.Query("status"); v != "" {
		baseData = baseData.Where("users.status = ?", v)
		baseCount = baseCount.Where("status = ?", v)
	}
	if v := c.Query("role"); v != "" {
		baseData = baseData.Where("users.role = ?", v)
		baseCount = baseCount.Where("role = ?", v)
	}
	if v := c.Query("company_id"); v != "" {
		baseData = baseData.Where("users.company_id = ?", v)
		baseCount = baseCount.Where("company_id = ?", v)
	}
	if v := c.Query("q"); v != "" {
		like := "%" + v + "%"
		baseData = baseData.Where("users.full_name LIKE ? OR users.email LIKE ?", like, like)
		baseCount = baseCount.Where("full_name LIKE ? OR email LIKE ?", like, like)
	}

	var total int64
	baseCount.Count(&total)

	var rows []userListRow
	baseData.Order("users.created_at DESC").Offset((page - 1) * limit).Limit(limit).Scan(&rows)

	utils.OK(c, gin.H{
		"data":  rows,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetUser returns a single user by ID.
func (h *UserHandler) GetUser(c *gin.Context) {
	var user models.User
	if err := database.DB.Select("user_id,full_name,email,job_title,phone,company_id,department_id,sub_dept_id,role,status,created_at,updated_at,last_login_at").
		First(&user, c.Param("id")).Error; err != nil {
		utils.NotFound(c, "user not found")
		return
	}
	utils.OK(c, user)
}

// UpdateUser lets a system_admin update a user's org assignments and basic info.
func (h *UserHandler) UpdateUser(c *gin.Context) {
	var user models.User
	if err := database.DB.First(&user, c.Param("id")).Error; err != nil {
		utils.NotFound(c, "user not found")
		return
	}

	var req struct {
		FullName     string `json:"full_name"`
		JobTitle     string `json:"job_title"`
		Phone        string `json:"phone"`
		CompanyID    *int64 `json:"company_id"`
		DepartmentID *int64 `json:"department_id"`
		SubDeptID    *int64 `json:"sub_dept_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	updates := map[string]interface{}{
		"company_id":    req.CompanyID,
		"department_id": req.DepartmentID,
		"sub_dept_id":   req.SubDeptID,
	}
	if req.FullName != "" {
		updates["full_name"] = req.FullName
	}
	if req.JobTitle != "" {
		updates["job_title"] = req.JobTitle
	}
	if req.Phone != "" {
		updates["phone"] = req.Phone
	}

	database.DB.Model(&user).Updates(updates)
	adminID := c.MustGet("user_id").(int64)
	utils.WriteAudit(database.DB, "user", user.UserID, "admin_updated", adminID,
		c.ClientIP(), c.Request.UserAgent(), "")
	user.PasswordHash = ""
	utils.OK(c, user)
}

// UpdateRole changes a user's role (system_admin only).
func (h *UserHandler) UpdateRole(c *gin.Context) {
	var user models.User
	if err := database.DB.First(&user, c.Param("id")).Error; err != nil {
		utils.NotFound(c, "user not found")
		return
	}

	var req struct {
		Role string `json:"role" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	allowed := map[string]bool{
		"system_admin": true, "dept_admin": true,
		"contributor": true, "viewer": true,
	}
	if !allowed[req.Role] {
		utils.BadRequest(c, "invalid role")
		return
	}

	database.DB.Model(&user).Update("role", req.Role)
	adminID := c.MustGet("user_id").(int64)
	utils.WriteAudit(database.DB, "user", user.UserID, "role_changed", adminID,
		c.ClientIP(), c.Request.UserAgent(),
		`{"new_role":"`+req.Role+`"}`)
	utils.OKMessage(c, "role updated")
}

// UpdateStatus activates or suspends a user account (system_admin only).
func (h *UserHandler) UpdateStatus(c *gin.Context) {
	var user models.User
	if err := database.DB.First(&user, c.Param("id")).Error; err != nil {
		utils.NotFound(c, "user not found")
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, err.Error())
		return
	}
	if req.Status != "active" && req.Status != "suspended" {
		utils.BadRequest(c, "status must be 'active' or 'suspended'")
		return
	}

	// Prevent a system_admin from suspending themselves.
	adminID := c.MustGet("user_id").(int64)
	if user.UserID == adminID && req.Status == "suspended" {
		utils.BadRequest(c, "cannot suspend your own account")
		return
	}

	database.DB.Model(&user).Update("status", req.Status)
	utils.WriteAudit(database.DB, "user", user.UserID, "status_changed", adminID,
		c.ClientIP(), c.Request.UserAgent(),
		`{"new_status":"`+req.Status+`"}`)
	utils.OKMessage(c, "status updated")
}

// ---------------------------------------------------------------------------
// Audit logs  (system_admin only)
// ---------------------------------------------------------------------------

// GetAuditLogs returns a paginated list of audit log entries.
func (h *UserHandler) GetAuditLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}

	query := database.DB.Model(&models.AuditLog{})

	if v := c.Query("entity_type"); v != "" {
		query = query.Where("entity_type = ?", v)
	}
	if v := c.Query("performed_by"); v != "" {
		query = query.Where("performed_by = ?", v)
	}
	if v := c.Query("action"); v != "" {
		query = query.Where("action = ?", v)
	}

	var total int64
	query.Count(&total)

	var logs []models.AuditLog
	query.Order("timestamp DESC").Offset((page - 1) * limit).Limit(limit).Find(&logs)

	utils.OK(c, gin.H{
		"data":  logs,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// ---------------------------------------------------------------------------
// ImportUsers  POST /api/admin/users/import  (system_admin only)
// ---------------------------------------------------------------------------

// orgIDByName looks up an active record by name (case-insensitive) in the
// given table using the supplied name column and primary-key column.
// If no record exists it inserts a new one and returns its ID.
func orgIDByName(table, nameCol, pkCol, name string) (int64, error) {
	var id int64
	row := database.DB.Raw(
		fmt.Sprintf(`SELECT %s FROM %s WHERE lower(%s)=lower(?) AND is_active=1 LIMIT 1`, pkCol, table, nameCol),
		name,
	).Row()
	if err := row.Scan(&id); err == nil {
		return id, nil
	}
	// Not found — insert.
	res := database.DB.Exec(
		fmt.Sprintf(`INSERT INTO %s (%s, is_active) VALUES (?, 1)`, table, nameCol),
		name,
	)
	if res.Error != nil {
		return 0, res.Error
	}
	// Fetch the newly created ID.
	row2 := database.DB.Raw(
		fmt.Sprintf(`SELECT %s FROM %s WHERE lower(%s)=lower(?) AND is_active=1 LIMIT 1`, pkCol, table, nameCol),
		name,
	).Row()
	if err := row2.Scan(&id); err != nil {
		return 0, err
	}
	return id, nil
}

// resolveOrg resolves (or creates) the company/department/sub-department by
// name and returns their IDs. companyName must be non-empty for a department
// to be resolved; departmentName must be non-empty for a sub-department.
func resolveOrg(companyName, deptName, subDeptName string) (companyID, deptID, subDeptID *int64, err error) {
	if companyName == "" {
		return nil, nil, nil, nil
	}

	cid, e := orgIDByName("companies", "name", "company_id", companyName)
	if e != nil {
		return nil, nil, nil, fmt.Errorf("company %q: %w", companyName, e)
	}
	companyID = &cid

	if deptName == "" {
		return companyID, nil, nil, nil
	}

	// Look up / create department scoped to this company.
	var did int64
	row := database.DB.Raw(
		`SELECT department_id FROM departments WHERE lower(name)=lower(?) AND company_id=? AND is_active=1 LIMIT 1`,
		deptName, cid,
	).Row()
	if scanErr := row.Scan(&did); scanErr != nil {
		// Insert.
		res := database.DB.Exec(
			`INSERT INTO departments (company_id, name, is_active) VALUES (?, ?, 1)`,
			cid, deptName,
		)
		if res.Error != nil {
			return companyID, nil, nil, fmt.Errorf("department %q: %w", deptName, res.Error)
		}
		row2 := database.DB.Raw(
			`SELECT department_id FROM departments WHERE lower(name)=lower(?) AND company_id=? AND is_active=1 LIMIT 1`,
			deptName, cid,
		).Row()
		if err2 := row2.Scan(&did); err2 != nil {
			return companyID, nil, nil, fmt.Errorf("department %q: %w", deptName, err2)
		}
	}
	deptID = &did

	if subDeptName == "" {
		return companyID, deptID, nil, nil
	}

	// Look up / create sub-department scoped to this department.
	var sid int64
	row3 := database.DB.Raw(
		`SELECT sub_dept_id FROM sub_departments WHERE lower(name)=lower(?) AND department_id=? AND is_active=1 LIMIT 1`,
		subDeptName, did,
	).Row()
	if scanErr := row3.Scan(&sid); scanErr != nil {
		res := database.DB.Exec(
			`INSERT INTO sub_departments (department_id, name, is_active) VALUES (?, ?, 1)`,
			did, subDeptName,
		)
		if res.Error != nil {
			return companyID, deptID, nil, fmt.Errorf("sub-department %q: %w", subDeptName, res.Error)
		}
		row4 := database.DB.Raw(
			`SELECT sub_dept_id FROM sub_departments WHERE lower(name)=lower(?) AND department_id=? AND is_active=1 LIMIT 1`,
			subDeptName, did,
		).Row()
		if err2 := row4.Scan(&sid); err2 != nil {
			return companyID, deptID, nil, fmt.Errorf("sub-department %q: %w", subDeptName, err2)
		}
	}
	subDeptID = &sid

	return companyID, deptID, subDeptID, nil
}

// ImportUsers reads a CSV file and bulk-creates user accounts.
// Required CSV columns: full_name, email, password, role
// Optional CSV columns: job_title, phone, company, department, sub_department
// Company/department/sub_department are resolved by name; new entries are
// created automatically when they do not yet exist.
func (h *UserHandler) ImportUsers(c *gin.Context) {
	file, _, err := c.Request.FormFile("file")
	if err != nil {
		utils.BadRequest(c, "no file uploaded (field name: file)")
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true

	headers, err := reader.Read()
	if err != nil {
		utils.BadRequest(c, "could not read CSV header row")
		return
	}

	// Build a case-insensitive column index map.
	colIdx := make(map[string]int, len(headers))
	for i, h := range headers {
		colIdx[strings.ToLower(strings.TrimSpace(h))] = i
	}

	required := []string{"full_name", "email", "password", "role"}
	for _, col := range required {
		if _, ok := colIdx[col]; !ok {
			utils.BadRequest(c, fmt.Sprintf("missing required CSV column: %s", col))
			return
		}
	}

	validRoles := map[string]bool{
		"system_admin": true,
		"dept_admin":   true,
		"contributor":  true,
		"viewer":       true,
	}

	type rowResult struct {
		Row   int    `json:"row"`
		Email string `json:"email,omitempty"`
		Error string `json:"error"`
	}

	var created int
	var skipped []rowResult
	var errored []rowResult

	get := func(row []string, col string) string {
		idx, ok := colIdx[col]
		if !ok || idx >= len(row) {
			return ""
		}
		return strings.TrimSpace(row[idx])
	}

	performedBy := c.MustGet("user_id").(int64)
	rowNum := 1 // header is row 0

	for {
		rowNum++
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			errored = append(errored, rowResult{Row: rowNum, Error: "CSV parse error: " + err.Error()})
			continue
		}

		email := strings.ToLower(get(record, "email"))
		fullName := get(record, "full_name")
		password := get(record, "password")
		role := strings.ToLower(get(record, "role"))

		if fullName == "" || email == "" || password == "" || role == "" {
			errored = append(errored, rowResult{Row: rowNum, Email: email, Error: "missing required field (full_name, email, password, role)"})
			continue
		}
		if !validRoles[role] {
			errored = append(errored, rowResult{Row: rowNum, Email: email, Error: fmt.Sprintf("invalid role %q; must be system_admin, dept_admin, contributor, or viewer", role)})
			continue
		}

		// Check duplicate email.
		var count int64
		database.DB.Model(&models.User{}).Where("email = ?", email).Count(&count)
		if count > 0 {
			skipped = append(skipped, rowResult{Row: rowNum, Email: email, Error: "email already exists"})
			continue
		}

		// Resolve org by name (auto-create if missing).
		companyName := get(record, "company")
		deptName := get(record, "department")
		subDeptName := get(record, "sub_department")
		companyID, deptID, subDeptID, orgErr := resolveOrg(companyName, deptName, subDeptName)
		if orgErr != nil {
			errored = append(errored, rowResult{Row: rowNum, Email: email, Error: "org error: " + orgErr.Error()})
			continue
		}

		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			errored = append(errored, rowResult{Row: rowNum, Email: email, Error: "password hashing failed"})
			continue
		}

		user := models.User{
			FullName:     fullName,
			Email:        email,
			PasswordHash: string(hash),
			JobTitle:     get(record, "job_title"),
			Phone:        get(record, "phone"),
			Role:         role,
			Status:       "active",
			CompanyID:    companyID,
			DepartmentID: deptID,
			SubDeptID:    subDeptID,
		}

		if err := database.DB.Create(&user).Error; err != nil {
			errored = append(errored, rowResult{Row: rowNum, Email: email, Error: "database error: " + err.Error()})
			continue
		}

		utils.WriteAudit(database.DB, "user", user.UserID, "imported", performedBy,
			c.ClientIP(), c.Request.UserAgent(), "")
		created++
	}

	utils.OK(c, gin.H{
		"created": created,
		"skipped": skipped,
		"errored": errored,
	})
}
