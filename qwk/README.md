# QWK Tool

Letakkan file Excel kamu di folder `qwk` atau berikan path penuh.

## Contoh format file Excel
Kolom minimal:
- `skor_ai`
- `skor_guru_avg`

Opsional untuk per-teacher:
- `g1`
- `g2`
- `g3`

## Jalankan
```bash
python qwk\qwk_eval.py --file qwk\data_uji.xlsx --ai-col skor_ai --guru-col skor_guru_avg
```

## Jika mau per teacher
```bash
python qwk\qwk_eval.py --file qwk\data_uji.xlsx --ai-col skor_ai --guru-col skor_guru_avg --per-teacher g1,g2,g3
```

## Ubah pembagian kategori QWK
Default bins: 0,20,40,60,80,100 (label 0..4)
Kalau mau 0..3 (4 kategori), contoh:
```bash
python qwk\qwk_eval.py --file qwk\data_uji.xlsx --ai-col skor_ai --guru-col skor_guru_avg --bins 0,25,50,75,100 --labels 0,1,2,3
```

## Output file laporan
```bash
python qwk\qwk_eval.py --file qwk\data_uji.xlsx --ai-col skor_ai --guru-col skor_guru_avg --output qwk\qwk_report.txt
```
