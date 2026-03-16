package models

import "time"

type Company struct {
	CompanyID   int64     `gorm:"column:company_id;primaryKey;autoIncrement" json:"company_id"`
	Name        string    `gorm:"column:name;uniqueIndex;not null"           json:"name"`
	Code        string    `gorm:"column:code;uniqueIndex"                    json:"code"`
	Industry    string    `gorm:"column:industry"                            json:"industry"`
	Description string    `gorm:"column:description"                         json:"description"`
	LogoURL     string    `gorm:"column:logo_url"                            json:"logo_url"`
	IsActive    int       `gorm:"column:is_active;default:1"                 json:"is_active"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime"           json:"created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at;autoUpdateTime"           json:"updated_at"`
}

func (Company) TableName() string { return "companies" }
