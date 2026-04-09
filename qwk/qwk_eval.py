# QWK Evaluation Script
# Usage:
#   python qwk\qwk_eval.py --file data.xlsx --ai-col skor_ai --guru-col skor_guru_avg
# Optional:
#   --sheet Sheet1
#   --bins 0,20,40,60,80,100
#   --labels 0,1,2,3,4
#   --min-score 0 --max-score 100
#   --output qwk\qwk_report.txt
#   --per-teacher g1,g2,g3
#
import argparse
import sys
from pathlib import Path

import pandas as pd
from sklearn.metrics import cohen_kappa_score


def parse_list(arg: str):
    return [x.strip() for x in arg.split(",") if x.strip() != ""]


def parse_float_list(arg: str):
    out = []
    for x in parse_list(arg):
        out.append(float(x))
    return out


def parse_int_list(arg: str):
    out = []
    for x in parse_list(arg):
        out.append(int(x))
    return out


def bin_scores(series: pd.Series, bins, labels):
    # Bins are inclusive on the right, except first bin
    # Example bins: [0,20,40,60,80,100] labels: [0,1,2,3,4]
    # Use pandas cut for consistency
    return pd.cut(series, bins=bins, labels=labels, include_lowest=True, right=True).astype(int)


def compute_qwk(y_true, y_pred):
    return cohen_kappa_score(y_true, y_pred, weights="quadratic")


def main():
    ap = argparse.ArgumentParser(description="Compute QWK (Quadratic Weighted Kappa) between AI and teacher scores.")
    ap.add_argument("--file", required=True, help="Path to Excel file (.xls or .xlsx)")
    ap.add_argument("--sheet", default=None, help="Sheet name (optional)")
    ap.add_argument("--ai-col", required=True, help="Column name for AI score")
    ap.add_argument("--guru-col", required=True, help="Column name for teacher average score")
    ap.add_argument("--per-teacher", default=None, help="Comma-separated teacher score columns (e.g., g1,g2,g3)")
    ap.add_argument("--bins", default="0,20,40,60,80,100", help="Comma-separated bin edges")
    ap.add_argument("--labels", default="0,1,2,3,4", help="Comma-separated bin labels")
    ap.add_argument("--min-score", type=float, default=None, help="Optional min score filter")
    ap.add_argument("--max-score", type=float, default=None, help="Optional max score filter")
    ap.add_argument("--output", default=None, help="Optional output report path")

    args = ap.parse_args()

    file_path = Path(args.file)
    if not file_path.exists():
        print(f"ERROR: file not found: {file_path}")
        return 2

    try:
        df = pd.read_excel(file_path, sheet_name=args.sheet)
    except Exception as e:
        print(f"ERROR: failed to read Excel: {e}")
        return 2

    if args.ai_col not in df.columns:
        print(f"ERROR: AI column not found: {args.ai_col}")
        return 2
    if args.guru_col not in df.columns:
        print(f"ERROR: Guru column not found: {args.guru_col}")
        return 2

    bins = parse_float_list(args.bins)
    labels = parse_int_list(args.labels)
    if len(labels) != len(bins) - 1:
        print("ERROR: labels count must be bins count minus 1")
        return 2

    work = df[[args.ai_col, args.guru_col]].copy()
    work = work.dropna()

    if args.min_score is not None:
        work = work[(work[args.ai_col] >= args.min_score) & (work[args.guru_col] >= args.min_score)]
    if args.max_score is not None:
        work = work[(work[args.ai_col] <= args.max_score) & (work[args.guru_col] <= args.max_score)]

    if work.empty:
        print("ERROR: no data after filtering")
        return 2

    ai_cat = bin_scores(work[args.ai_col], bins, labels)
    guru_cat = bin_scores(work[args.guru_col], bins, labels)

    qwk = compute_qwk(guru_cat, ai_cat)

    lines = []
    lines.append("QWK Evaluation Report")
    lines.append(f"File: {file_path}")
    if args.sheet:
        lines.append(f"Sheet: {args.sheet}")
    lines.append(f"AI column: {args.ai_col}")
    lines.append(f"Guru avg column: {args.guru_col}")
    lines.append(f"Bins: {bins}")
    lines.append(f"Labels: {labels}")
    lines.append(f"Samples used: {len(work)}")
    lines.append(f"QWK (AI vs Guru Avg): {qwk:.4f}")

    if args.per_teacher:
        teacher_cols = parse_list(args.per_teacher)
        for col in teacher_cols:
            if col not in df.columns:
                lines.append(f"WARN: teacher col not found: {col}")
                continue
            sub = df[[args.ai_col, col]].dropna()
            if sub.empty:
                lines.append(f"WARN: no data for teacher col: {col}")
                continue
            if args.min_score is not None:
                sub = sub[(sub[args.ai_col] >= args.min_score) & (sub[col] >= args.min_score)]
            if args.max_score is not None:
                sub = sub[(sub[args.ai_col] <= args.max_score) & (sub[col] <= args.max_score)]
            if sub.empty:
                lines.append(f"WARN: no data after filtering for teacher col: {col}")
                continue
            ai_cat_t = bin_scores(sub[args.ai_col], bins, labels)
            guru_cat_t = bin_scores(sub[col], bins, labels)
            qwk_t = compute_qwk(guru_cat_t, ai_cat_t)
            lines.append(f"QWK (AI vs {col}): {qwk_t:.4f} | samples: {len(sub)}")

    report = "\n".join(lines)
    print(report)

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(report, encoding="utf-8")
        print(f"\nSaved report to: {out_path}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
