package services

import "errors"

var (
	ErrAuthUserNotFound   = errors.New("auth user not found")
	ErrAuthInvalidPassword = errors.New("auth invalid password")
)
