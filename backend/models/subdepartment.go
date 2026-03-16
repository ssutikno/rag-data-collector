package models

import "time"

type SubDepartment struct {
	SubDeptID    int64     `gorm:"column:sub_dept_id;primaryKey;autoIncrement" json:"sub_dept_id"`
	DepartmentID int64     `gorm:"column:department_id;not null"               json:"department_id"`
	Name         string    `gorm:"column:name;not null"                        json:"name"`
	Code         string    `gorm:"column:code"                                 json:"code"`
	Description  string    `gorm:"column:description"                          json:"description"`
	LeadUserID   *int64    `gorm:"column:lead_user_id"                         json:"lead_user_id"`
	IsActive     int       `gorm:"column:is_active;default:1"                  json:"is_active"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime"            json:"created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at;autoUpdateTime"            json:"updated_at"`
}

func (SubDepartment) TableName() string { return "sub_departments" }
