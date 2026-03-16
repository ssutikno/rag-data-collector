package utils

import (
	"rag-backend/models"

	"gorm.io/gorm"
)

// WriteAudit inserts a row into audit_logs.
// It is a fire-and-forget helper; errors are silently ignored to avoid
// disrupting the primary operation.
func WriteAudit(db *gorm.DB, entityType string, entityID int64, action string,
	performedBy int64, ip, userAgent, diffJSON string) {

	entry := models.AuditLog{
		EntityType:  entityType,
		EntityID:    entityID,
		Action:      action,
		PerformedBy: performedBy,
		IPAddress:   ip,
		UserAgent:   userAgent,
		DiffJSON:    diffJSON,
	}
	db.Create(&entry)
}

// CtxInt64 safely retrieves an int64 value stored in the Gin context.
// Returns 0 if the key is absent or the type does not match.
func CtxInt64(val interface{}, exists bool) int64 {
	if !exists || val == nil {
		return 0
	}
	v, ok := val.(int64)
	if !ok {
		return 0
	}
	return v
}
