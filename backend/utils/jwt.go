package utils

import (
	"errors"
	"time"

	"rag-backend/config"
	"rag-backend/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// Claims is the JWT payload embedded in every auth token.
type Claims struct {
	UserID       int64  `json:"user_id"`
	Email        string `json:"email"`
	Role         string `json:"role"`
	CompanyID    *int64 `json:"company_id"`
	DepartmentID *int64 `json:"department_id"`
	SubDeptID    *int64 `json:"sub_dept_id"`
	jwt.RegisteredClaims
}

// GenerateToken creates a signed HS256 JWT for the given user.
func GenerateToken(user *models.User, cfg *config.Config) (string, error) {
	claims := Claims{
		UserID:       user.UserID,
		Email:        user.Email,
		Role:         user.Role,
		CompanyID:    user.CompanyID,
		DepartmentID: user.DepartmentID,
		SubDeptID:    user.SubDeptID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(cfg.JWTExpiry)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(cfg.JWTSecret))
}

// ParseToken validates and parses a JWT string.
func ParseToken(tokenStr string, cfg *config.Config) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("invalid or expired token")
	}
	return claims, nil
}

// SetAuthCookie writes the JWT into an HttpOnly cookie.
func SetAuthCookie(c *gin.Context, token string, expiry time.Duration) {
	c.SetCookie(
		"auth_token",
		token,
		int(expiry.Seconds()),
		"/",
		"",
		false, // set true in production (HTTPS only)
		true,  // HttpOnly — not accessible from JavaScript
	)
}

// ClearAuthCookie expires the auth cookie immediately.
func ClearAuthCookie(c *gin.Context) {
	c.SetCookie("auth_token", "", -1, "/", "", false, true)
}
