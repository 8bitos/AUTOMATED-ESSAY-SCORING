package services

import (
	"database/sql"
	"fmt"
	"strings"
)

// SystemSettingService manages global application settings stored in DB.
type SystemSettingService struct {
	db *sql.DB
}

// NewSystemSettingService constructs a SystemSettingService.
func NewSystemSettingService(db *sql.DB) *SystemSettingService {
	return &SystemSettingService{db: db}
}

// GetSetting returns the raw value for a given key.
func (s *SystemSettingService) GetSetting(key string) (string, error) {
	var value string
	err := s.db.QueryRow(
		"SELECT value FROM system_settings WHERE key = $1",
		key,
	).Scan(&value)
	if err != nil {
		return "", err
	}
	return value, nil
}

// SetSetting inserts or updates a key with the provided value.
func (s *SystemSettingService) SetSetting(key, value string) error {
	_, err := s.db.Exec(
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ($1, $2, NOW())
		 ON CONFLICT (key) DO UPDATE
		 SET value = EXCLUDED.value,
		     updated_at = NOW()`,
		key,
		value,
	)
	return err
}

// GetGradingMode reads the current grading_mode setting, defaulting to queued.
func (s *SystemSettingService) GetGradingMode() (string, error) {
	mode, err := s.GetSetting("grading_mode")
	if err != nil {
		if err == sql.ErrNoRows {
			return "queued", nil
		}
		return "", err
	}
	mode = strings.ToLower(strings.TrimSpace(mode))
	if mode != "instant" {
		return "queued", nil
	}
	return "instant", nil
}

// SetGradingMode validates and stores the grading_mode setting.
func (s *SystemSettingService) SetGradingMode(mode string) error {
	mode = strings.ToLower(strings.TrimSpace(mode))
	if mode != "instant" && mode != "queued" {
		return fmt.Errorf("invalid grading mode: %s", mode)
	}
	return s.SetSetting("grading_mode", mode)
}
