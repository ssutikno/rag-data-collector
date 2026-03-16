package models

import "time"

type Department struct {
	DepartmentID int64     `gorm:"column:department_id;primaryKey;autoIncrement" json:"department_id"`
	CompanyID    int64     `gorm:"column:company_id;not null"                    json:"company_id"`
	Name         string    `gorm:"column:name;not null"                          json:"name"`
	Code         string    `gorm:"column:code"                                   json:"code"`
	Description  string    `gorm:"column:description"                            json:"description"`
	HeadUserID   *int64    `gorm:"column:head_user_id"                           json:"head_user_id"`
	IsActive     int       `gorm:"column:is_active;default:1"                    json:"is_active"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime"              json:"created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime"              json:"updated_at"`
}

func (Department) TableName() string { return "departments" }
