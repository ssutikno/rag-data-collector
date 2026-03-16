package utils

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// APIResponse is the standard JSON envelope returned by every endpoint.
type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func OK(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, APIResponse{Success: true, Data: data})
}

func Created(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, APIResponse{Success: true, Data: data})
}

func OKMessage(c *gin.Context, message string) {
	c.JSON(http.StatusOK, APIResponse{Success: true, Message: message})
}

func BadRequest(c *gin.Context, errMsg string) {
	c.JSON(http.StatusBadRequest, APIResponse{Success: false, Error: errMsg})
}

func Unauthorized(c *gin.Context) {
	c.JSON(http.StatusUnauthorized, APIResponse{Success: false, Error: "unauthorized"})
}

func Forbidden(c *gin.Context) {
	c.JSON(http.StatusForbidden, APIResponse{Success: false, Error: "forbidden: insufficient role"})
}

func NotFound(c *gin.Context, errMsg string) {
	c.JSON(http.StatusNotFound, APIResponse{Success: false, Error: errMsg})
}

func Conflict(c *gin.Context, errMsg string) {
	c.JSON(http.StatusConflict, APIResponse{Success: false, Error: errMsg})
}

func Internal(c *gin.Context, errMsg string) {
	c.JSON(http.StatusInternalServerError, APIResponse{Success: false, Error: errMsg})
}

func TooManyRequests(c *gin.Context, errMsg string) {
	c.JSON(http.StatusTooManyRequests, APIResponse{Success: false, Error: errMsg})
}
