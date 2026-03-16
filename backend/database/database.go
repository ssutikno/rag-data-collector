package database

import (
	"log"
	"rag-backend/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DB is the global database handle used by all handlers.
var DB *gorm.DB

// Connect opens the SQLite database, enables WAL mode and foreign keys,
// then auto-migrates all models.
func Connect(dbPath string) {
	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("database: failed to connect: %v", err)
	}

	DB.Exec("PRAGMA foreign_keys = ON")
	DB.Exec("PRAGMA journal_mode = WAL")
	DB.Exec("PRAGMA busy_timeout = 5000")

	err = DB.AutoMigrate(
		&models.Company{},
		&models.Department{},
		&models.SubDepartment{},
		&models.User{},
		&models.Document{},
		&models.AuditLog{},
	)
	if err != nil {
		log.Fatalf("database: migration failed: %v", err)
	}

	log.Println("database: connected and migrated")
}
