package models

type ClassScoreDistributionBucket struct {
	Label string  `json:"label"`
	Min   float64 `json:"min"`
	Max   float64 `json:"max"`
	Count int     `json:"count"`
}

type ClassScoreDistributionResponse struct {
	Buckets          []ClassScoreDistributionBucket `json:"buckets"`
	Total            int                            `json:"total"`
	Average          *float64                       `json:"average,omitempty"`
	Min              *float64                       `json:"min,omitempty"`
	Max              *float64                       `json:"max,omitempty"`
	Reviewed         int                            `json:"reviewed"`
	Pending          int                            `json:"pending"`
	TotalSubmissions int                            `json:"total_submissions"`
}
