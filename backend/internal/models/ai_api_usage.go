package models

import "time"

type APIUsageDailyPoint struct {
	Date             string `json:"date"`
	Requests         int64  `json:"requests"`
	PromptTokens     int64  `json:"prompt_tokens"`
	CandidatesTokens int64  `json:"candidates_tokens"`
	TotalTokens      int64  `json:"total_tokens"`
}

type APIUsageFeatureBreakdown struct {
	Feature         string  `json:"feature"`
	Requests        int64   `json:"requests"`
	SuccessRequests int64   `json:"success_requests"`
	TotalTokens     int64   `json:"total_tokens"`
	AvgResponseMs   float64 `json:"avg_response_ms"`
}

type APIUsageStatusBreakdown struct {
	Status   string `json:"status"`
	Requests int64  `json:"requests"`
}

type APIUsageRecentLog struct {
	Feature          string    `json:"feature"`
	ModelName        string    `json:"model_name"`
	Status           string    `json:"status"`
	ErrorType        *string   `json:"error_type,omitempty"`
	ErrorMessage     *string   `json:"error_message,omitempty"`
	PromptTokens     int64     `json:"prompt_tokens"`
	CandidatesTokens int64     `json:"candidates_tokens"`
	TotalTokens      int64     `json:"total_tokens"`
	ResponseTimeMs   int64     `json:"response_time_ms"`
	CreatedAt        time.Time `json:"created_at"`
}

type AdminAPIStatisticsSummary struct {
	RequestsToday    int64   `json:"requests_today"`
	Requests30Days   int64   `json:"requests_30_days"`
	SuccessRate30D   float64 `json:"success_rate_30d"`
	ErrorRate30D     float64 `json:"error_rate_30d"`
	AvgResponseMs30D float64 `json:"avg_response_ms_30d"`
	TodayTotalTokens int64   `json:"today_total_tokens"`
	DailyTokenLimit  int64   `json:"daily_token_limit"`
	TokensRemaining  int64   `json:"tokens_remaining"`
	RPMUsed          int64   `json:"rpm_used"`
	RPMLimit         int64   `json:"rpm_limit"`
	TPMUsed          int64   `json:"tpm_used"`
	TPMLimit         int64   `json:"tpm_limit"`
	RPDUsed          int64   `json:"rpd_used"`
	RPDLimit         int64   `json:"rpd_limit"`
	TodayPromptToken int64   `json:"today_prompt_tokens"`
	TodayOutputToken int64   `json:"today_output_tokens"`
}

type AdminAPIStatisticsResponse struct {
	Summary          AdminAPIStatisticsSummary  `json:"summary"`
	DailyUsage       []APIUsageDailyPoint       `json:"daily_usage"`
	FeatureBreakdown []APIUsageFeatureBreakdown `json:"feature_breakdown"`
	StatusBreakdown  []APIUsageStatusBreakdown  `json:"status_breakdown"`
	RecentLogs       []APIUsageRecentLog        `json:"recent_logs"`
}
