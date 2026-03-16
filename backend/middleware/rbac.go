package middleware

import (
	"rag-backend/utils"

	"github.com/gin-gonic/gin"
)

// RequireRole aborts with 403 if the authenticated user's role is not in the
// permitted set.
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		roleVal, exists := c.Get("role")
		if !exists {
			utils.Unauthorized(c)
			c.Abort()
			return
		}
		userRole, _ := roleVal.(string)
		for _, r := range roles {
			if userRole == r {
				c.Next()
				return
			}
		}
		utils.Forbidden(c)
		c.Abort()
	}
}

// RequireSystemAdmin permits only the system_admin role.
func RequireSystemAdmin() gin.HandlerFunc {
	return RequireRole("system_admin")
}

// RequireAdminOrDeptAdmin permits system_admin and dept_admin.
func RequireAdminOrDeptAdmin() gin.HandlerFunc {
	return RequireRole("system_admin", "dept_admin")
}

// RequireContributor permits everyone except viewer.
func RequireContributor() gin.HandlerFunc {
	return RequireRole("system_admin", "dept_admin", "contributor")
}
