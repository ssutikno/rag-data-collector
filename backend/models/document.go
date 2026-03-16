package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// StringSlice serialises a []string as a JSON text column in SQLite.
type StringSlice []string

func (s StringSlice) Value() (driver.Value, error) {
	if s == nil {
		return "[]", nil
	}
	b, err := json.Marshal(s)
	return string(b), err
}

func (s *StringSlice) Scan(src interface{}) error {
	var raw string
	switch v := src.(type) {
	case string:
		raw = v
	case []byte:
		raw = string(v)
	case nil:
		*s = StringSlice{}
		return nil
	default:
		return fmt.Errorf("StringSlice: unsupported source type %T", src)
	}
	return json.Unmarshal([]byte(raw), s)
}

// Document represents a stored unstructured file and its metadata.
type Document struct {
	DocumentID       int64       `gorm:"column:document_id;primaryKey;autoIncrement"                                                                                           json:"document_id"`
	CompanyID        int64       `gorm:"column:company_id;not null"                                                                                                            json:"company_id"`
	DepartmentID     int64       `gorm:"column:department_id;not null"                                                                                                         json:"department_id"`
	SubDeptID        *int64      `gorm:"column:sub_dept_id"                                                                                                                    json:"sub_dept_id"`
	DocumentType     string      `gorm:"column:document_type"                                                                                                                  json:"document_type"`
	Title            string      `gorm:"column:title;not null"                                                                                                                 json:"title"`
	Description      string      `gorm:"column:description"                                                                                                                    json:"description"`
	Tags             StringSlice `gorm:"column:tags;type:text;default:'[]'"                                                                                                    json:"tags"`
	AccessLevel      string      `gorm:"column:access_level;check:access_level IN ('public','company','department','sub_department','restricted','confidential');default:company" json:"access_level"`
	UpdateFrequency  string      `gorm:"column:update_frequency;check:update_frequency IN ('real_time','daily','weekly','monthly','quarterly','annually','ad_hoc','one_time');default:ad_hoc" json:"update_frequency"`
	Version          string      `gorm:"column:version;default:1.0"                                                                                                            json:"version"`
	Language         string      `gorm:"column:language;default:en"                                                                                                            json:"language"`
	DateCreated      string      `gorm:"column:date_created"                                                                                                                   json:"date_created"`
	DateUploaded     time.Time   `gorm:"column:date_uploaded;autoCreateTime"                                                                                                   json:"date_uploaded"`
	ExpiryDate       string      `gorm:"column:expiry_date"                                                                                                                    json:"expiry_date"`
	FileName         string      `gorm:"column:file_name"                                                                                                                      json:"file_name"`
	FilePath         string      `gorm:"column:file_path"                                                                                                                      json:"-"`
	FileSizeBytes    int64       `gorm:"column:file_size_bytes"                                                                                                                json:"file_size_bytes"`
	FileMimeType     string      `gorm:"column:file_mime_type"                                                                                                                 json:"file_mime_type"`
	FileHash         string      `gorm:"column:file_hash"                                                                                                                      json:"file_hash"`
	UploaderUserID   int64       `gorm:"column:uploader_user_id;not null"                                                                                                      json:"uploader_user_id"`
	Status           string      `gorm:"column:status;check:status IN ('pending_metadata','stored','failed','archived');default:pending_metadata"                              json:"status"`
	IsLatestVersion  int         `gorm:"column:is_latest_version;default:1"                                                                                                    json:"is_latest_version"`
	ParentDocumentID *int64      `gorm:"column:parent_document_id"                                                                                                             json:"parent_document_id"`
	CreatedAt        time.Time   `gorm:"column:created_at;autoCreateTime"                                                                                                      json:"created_at"`
	UpdatedAt        time.Time   `gorm:"column:updated_at;autoUpdateTime"                                                                                                      json:"updated_at"`
}

func (Document) TableName() string { return "documents" }
