package models

import "time"

type User struct {
	UserID       int64      `gorm:"column:user_id;primaryKey;autoIncrement"                                       json:"user_id"`
	FullName     string     `gorm:"column:full_name;not null"                                                     json:"full_name"`
	Email        string     `gorm:"column:email;uniqueIndex;not null"                                              json:"email"`
	PasswordHash string     `gorm:"column:password_hash;not null"                                                 json:"-"`
	JobTitle     string     `gorm:"column:job_title"                                                              json:"job_title"`
	Phone        string     `gorm:"column:phone"                                                                  json:"phone"`
	CompanyID    *int64     `gorm:"column:company_id"                                                             json:"company_id"`
	DepartmentID *int64     `gorm:"column:department_id"                                                          json:"department_id"`
	SubDeptID    *int64     `gorm:"column:sub_dept_id"                                                            json:"sub_dept_id"`
	Role         string     `gorm:"column:role;check:role IN ('system_admin','dept_admin','contributor','viewer');default:contributor" json:"role"`
	Status       string     `gorm:"column:status;check:status IN ('active','suspended');default:active"           json:"status"`
	CreatedAt    time.Time  `gorm:"column:created_at;autoCreateTime"                                              json:"created_at"`
	UpdatedAt    time.Time  `gorm:"column:updated_at;autoUpdateTime"                                              json:"updated_at"`
	LastLoginAt  *time.Time `gorm:"column:last_login_at"                                                          json:"last_login_at"`
}

func (User) TableName() string { return "users" }
