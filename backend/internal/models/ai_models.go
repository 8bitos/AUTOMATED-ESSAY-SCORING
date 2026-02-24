package models

// RubricCriterion represents a single score criterion within a rubric aspect for AI grading.
type RubricCriterion struct {
	Skor      int    `json:"skor"`      // Possible score.
	Deskripsi string `json:"deskripsi"` // Description for the score.
}

// RubricAspect represents a single grading aspect in a rubric for AI grading,
// containing a list of score criteria.
type RubricAspect struct {
	Aspek    string            `json:"aspek"`    // Name of the aspect (e.g., "Coherence").
	Kriteria []RubricCriterion `json:"kriteria"` // List of criteria for this aspect.
}
