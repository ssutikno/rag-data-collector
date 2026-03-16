package models

import "time"

type AuditLog struct {
	LogID       int64     `gorm:"column:log_id;primaryKey;autoIncrement" json:"log_id"`
	EntityType  string    `gorm:"column:entity_type"                     json:"entity_type"`
	EntityID    int64     `gorm:"column:entity_id"                       json:"entity_id"`
	Action      string    `gorm:"column:action"                          json:"action"`
	PerformedBy int64     `gorm:"column:performed_by"                    json:"performed_by"`
	IPAddress   string    `gorm:"column:ip_address"                      json:"ip_address"`
	UserAgent   string    `gorm:"column:user_agent"                      json:"user_agent"`
	DiffJSON    string    `gorm:"column:diff_json"                       json:"diff_json"`
	Timestamp   time.Time `gorm:"column:timestamp;autoCreateTime"        json:"timestamp"`
}

func (AuditLog) TableName() string { return "audit_logs" }
