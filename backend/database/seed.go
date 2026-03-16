package database

import (
	"log"

	"rag-backend/models"

	"golang.org/x/crypto/bcrypt"
)

const (
	DefaultAdminEmail    = "admin@ragdocs.local"
	DefaultAdminPassword = "Admin@1234!"
	DefaultAdminName     = "System Administrator"
)

// SeedAdminUser creates the default system_admin account if no users exist yet.
// The credentials are printed to stdout exactly once so the operator can
// change them immediately after first login.
func SeedAdminUser() {
	var count int64
	DB.Model(&models.User{}).Count(&count)
	if count > 0 {
		return // already have users — nothing to seed
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(DefaultAdminPassword), 12)
	if err != nil {
		log.Fatalf("seed: failed to hash default admin password: %v", err)
	}

	admin := models.User{
		FullName:     DefaultAdminName,
		Email:        DefaultAdminEmail,
		PasswordHash: string(hash),
		Role:         "system_admin",
		Status:       "active",
		JobTitle:     "System Administrator",
	}

	if err := DB.Create(&admin).Error; err != nil {
		log.Fatalf("seed: failed to create default admin user: %v", err)
	}

	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	log.Println("  DEFAULT ADMIN ACCOUNT CREATED")
	log.Printf("  Email   : %s", DefaultAdminEmail)
	log.Printf("  Password: %s", DefaultAdminPassword)
	log.Println("  ⚠  Change this password immediately after login!")
	log.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
}
