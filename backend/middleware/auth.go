package middleware

import (
	"rag-backend/config"
	"rag-backend/utils"

	"github.com/gin-gonic/gin"
)

// Auth extracts and validates the JWT from the auth_token cookie.
// On success it stores user context values for downstream handlers.
func Auth(cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		token, err := c.Cookie("auth_token")
		if err != nil || token == "" {
			utils.Unauthorized(c)
			c.Abort()
			return
		}

		claims, err := utils.ParseToken(token, cfg)
		if err != nil {
			utils.Unauthorized(c)
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		c.Set("role", claims.Role)

		// Only set org context keys when the user has them assigned.
		if claims.CompanyID != nil {
			c.Set("company_id", *claims.CompanyID)
		}
		if claims.DepartmentID != nil {
			c.Set("department_id", *claims.DepartmentID)
		}
		if claims.SubDeptID != nil {
			c.Set("sub_dept_id", *claims.SubDeptID)
		}

		c.Next()
	}
}
