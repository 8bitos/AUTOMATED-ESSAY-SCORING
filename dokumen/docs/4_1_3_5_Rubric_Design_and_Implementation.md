# 4.1.3.5 Rubric Design and Implementation

## Overview

Rubric design forms the structural foundation of SAGE's automated essay grading mechanism. Rather than relying on opaque black-box scoring, SAGE implements explicit, criterion-based rubrics that define exactly what constitutes quality performance. The rubric serves two critical functions: (1) as an authoritative scoring guide for the AI model, and (2) as a transparent communication tool for students and teachers to understand grading expectations.

## Rubric Structure Architecture

SAGE supports two rubric design paradigms, each suited to different pedagogical contexts:

### Analytic Rubrics (Multi-Aspect)
Analytic rubrics decompose essay quality into distinct, measurable dimensions. Each dimension (aspect) is scored independently, then aggregated into a final grade. For example, a typical essay rubric might include:
- **Content Accuracy**: How well does the essay demonstrate correct subject-matter knowledge?
- **Argument Structure**: Is the thesis clear? Are supporting arguments logical and well-organized?
- **Evidence and Support**: Does the essay cite credible sources? Are examples relevant and sufficient?
- **Language and Clarity**: Is writing clear, grammatically correct, and appropriate to the audience?

Each aspect receives a score on a defined scale (typically 1-4 or 1-5), allowing fine-grained feedback. This design supports the educational principle of "transparent standards"—students see precisely which dimensions contributed to their grade.

### Holistic Rubrics (Single Aspect)
Holistic rubrics assign a single overall score to the essay, useful when evaluating impressionistic qualities like "overall persuasiveness" or when quick placement decisions (pass/fail, placement level) are needed. SAGE treats holistic rubrics internally as single-aspect rubrics, ensuring consistent processing.

## Rubric Level Design

Within each aspect or the holistic rubric, performance levels are explicitly defined. SAGE typically implements 4-5 scoring levels:

**4-Level Scale Example (Content Accuracy):**
- **4 (Excellent)**: Demonstrates sophisticated, nuanced understanding of the topic. Synthesizes multiple concepts correctly. No factual errors.
- **3 (Proficient)**: Demonstrates solid understanding with accurate application of main concepts. Minor conceptual gaps may exist but do not undermine the overall argument.
- **2 (Developing)**: Shows basic understanding but with notable gaps or oversimplifications. May confuse related concepts or provide insufficient depth.
- **1 (Incomplete)**: Shows minimal understanding or contains significant factual errors that obscure meaning.

These level descriptions serve as the interpretive framework for the AI model. Rather than learning arbitrary numeric scores, the model learns to recognize linguistic, structural, and evidential markers that correspond to these performance descriptors.

## Implementation in SAGE System Architecture

### Storage and Retrieval
Rubrics are stored in the `rubrics` database table with the following structure:
- **essay_question_id**: Foreign key linking to the specific question
- **aspect_name**: Name of the scoring dimension (e.g., "Content Accuracy")
- **max_score**: Maximum points for this aspect (typically 4 or 5)
- **level_descriptions**: JSON object mapping score levels to descriptive text

This design allows different questions within a course to use different rubric structures. An essay question on historical analysis might emphasize "Historical Evidence," while a question on scientific reasoning emphasizes "Experimental Design."

### Prompt Integration
When grading, the `buildPrompt()` function in `ai_service.go` (line 678) incorporates rubric structure as the primary constraint:

```
For each aspect below, assign a score from 1-4:
- Content Accuracy (1-4): Level descriptions text...
- Argument Structure (1-4): Level descriptions text...
- Evidence and Support (1-4): Level descriptions text...
- Language and Clarity (1-4): Level descriptions text...
```

The AI model is instructed to produce a JSON response with the structure:
```json
{
  "skor_aspek": {
    "content": 3,
    "argument": 4,
    "evidence": 3,
    "language": 2
  },
  "feedback_keseluruhan": "Feedback text..."
}
```

This JSON-constrained output ensures consistent parsing and avoids free-form scoring variability.

### Score Aggregation
The final essay score is computed by averaging the aspect scores:

**Final Score = (skor_aspek.content + skor_aspek.argument + skor_aspek.evidence + skor_aspek.language) / 4**

For scales where raw scores range 1-4, this aggregation preserves the scale (result in range 1-4). Teachers can optionally normalize to percent scale (multiply by 25 to convert to 0-100).

For holistic rubrics, the single aspect score becomes the final score directly.

## Design Principles in SAGE Rubrics

### Principle 1: Transparency
Rubric text is shared with students before the essay assignment. This reduces ambiguity and aligns student effort with grading criteria. The AI model sees the same rubric text, ensuring human and machine grading operate from the same standards.

### Principle 2: Criterion-Referenced Grading
Scores reference absolute performance levels, not relative ranking. An essay scoring 3 ("Proficient") meets the defined criteria for proficiency, regardless of how many other essays in the cohort score 3. This principle ensures fairness and consistency across grading sessions.

### Principle 3: Decomposition
Multi-aspect rubrics decompose holistic quality into teachable skills. Instead of receiving a single "C" grade, students receive specific feedback: "Your evidence is weak (aspect 2) while your argument structure is strong (aspect 1)." This granularity enables targeted improvement.

### Principle 4: Bounded Levels
Limiting performance levels to 4-5 tiers prevents excessive granularity. Five levels (Exceptional, Proficient, Developing, Beginning, Insufficient) remain distinguishable in language and teachable to LLMs; finer scales (e.g., 10 levels) introduce inconsistent interpretation.

## Scope Limitation: Cognitive Levels C1–C4

SAGE's rubric-based grading is optimized for assessing cognitive objectives at Bloom's Revised Taxonomy levels C1 through C4:
- **C1 (Remember)**: Recall facts and basic concepts
- **C2 (Understand)**: Explain ideas and concepts
- **C3 (Apply)**: Use information in a new situation
- **C4 (Analyze)**: Draw connections between ideas

For these levels, criterion-based rubrics with 4–5 discrete performance levels function effectively. The AI model can reliably recognize linguistic and structural markers corresponding to each level (e.g., use of supporting evidence for C3, logical identification of relationships for C4).

Higher cognitive levels—**C5 (Evaluate)** and **C6 (Create)**—present greater challenges for automated assessment because performance at these levels is more divergent and context-dependent. A student response demonstrating sophisticated evaluation or creative synthesis may manifest in unexpected structural or linguistic forms that rubric categories struggle to capture. These levels are better suited to human expert review or human-in-the-loop hybrid systems where teachers maintain primary grading authority with AI as an assistive tool.

## Practical Rubric Design Workflow in SAGE

1. **Teacher Defines Aspects and Cognitive Level**: Through the instructor dashboard, the teacher specifies (a) which dimensions matter for this essay (e.g., "Content Accuracy," "Structure," "Clarity") and (b) which cognitive level is targeted (C1–C4). If the essay targets C5 or C6, the teacher may opt for manual grading with AI-generated preliminary feedback.

2. **Teacher Specifies Cognitive Objectives**: Teachers should explicitly state what cognitive work students are asked to do. Example: "Analyze the economic causes of the French Revolution" (C4: Analyze) rather than "Discuss the French Revolution" (ambiguous cognitive level).

2. **Teacher Writes Level Descriptors**: For each aspect and scoring level (1-4), the teacher writes a brief criterion. Example:
   - Aspect: "Evidence Quality"
   - Level 4: "Uses 5+ credible academic sources; citations are accurate and integrated smoothly into the argument."
   - Level 3: "Uses 3-4 credible sources; citations are present but could be better integrated."
   - Level 2: "Uses 1-2 sources, some of questionable credibility; citations are awkward or incomplete."
   - Level 1: "No sources cited or only unreliable sources."

3. **Rubric Stored in Database**: The system persists this rubric as a structured record.

4. **AI Receives Rubric During Grading**: When `GradeEssay()` is called, the prompt construction includes the full rubric text, ensuring the AI model has the exact performance definitions.

5. **Teacher Review and Adjustment**: After AI grading, teachers review scores. If the AI misapplied a criterion, the teacher can override the score. The final recorded score in `essay_submissions.final_score` reflects the teacher's judgment (or AI score if teacher does not override).

## Example: Science Lab Report Rubric

**Question**: "Write a 500-word lab report on the photosynthesis experiment conducted in class."

**Rubric Structure** (4 aspects, 4-point scale):

| Aspect | Level 4 | Level 3 | Level 2 | Level 1 |
|--------|---------|---------|---------|---------|
| **Hypothesis and Purpose** | Hypothesis is clearly stated and scientifically justified; purpose of experiment is explicit. | Hypothesis and purpose are present and generally clear. | Hypothesis or purpose is vague or partially stated. | Hypothesis and purpose are missing or incorrect. |
| **Experimental Design** | Methods section includes all materials, precise procedures, and identified variables (independent, dependent, control). Replicable by another scientist. | Methods section includes most required elements; minor gaps in clarity or variable identification. | Methods section is incomplete; significant gaps in procedure or variable identification. | Methods section is missing or severely incomplete. |
| **Data Presentation** | Data are presented in organized tables/graphs with clear labels, legends, and units. Consistent with experimental design. | Data presentation is mostly clear; minor labeling issues. | Data presentation is disorganized or difficult to interpret. | Data are missing or illegible. |
| **Conclusion and Analysis** | Conclusion clearly restates findings, interprets results relative to hypothesis, identifies sources of error, and suggests improvements. | Conclusion addresses most elements; may lack depth in error analysis or implications. | Conclusion addresses only some elements; limited analysis. | Conclusion is missing or fails to address findings. |

When this rubric is used for grading, the AI model receives each level descriptor and learns to recognize essay features that correspond to each score. A response with vague methods and missing procedure details would score "2" on Experimental Design; one with complete procedure and identified variables would score "3" or "4."

## Advantages of Rubric-Based Design

- **Explicit Standards**: Both AI and teachers grade against the same, documented criteria, reducing inconsistency.
- **Pedagogical Clarity**: Students understand what quality looks like before they write.
- **Interpretability**: A score of "3 in Evidence but 2 in Organization" is more informative than "75%."
- **Flexibility**: Rubrics adapt to different essay types, subjects, and proficiency levels without system changes.
- **Human-AI Alignment**: Teachers can verify whether the AI applied rubric criteria appropriately, supporting oversight.

## Conclusion

Rubric design in SAGE moves automated essay scoring away from opaque black-box systems toward transparent, criterion-based evaluation. By embedding detailed rubric structures into prompt-based grading, SAGE ensures that both AI and human educators assess essays against shared, explicit standards. This design supports equity, clarity, and the educational principle that grades should communicate specific, actionable feedback to students.
