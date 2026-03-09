# Grading Calibration Kit

Dokumen ini dipakai untuk mengecek akurasi penilaian AI sebelum deploy, terutama setelah perubahan prompt, RAG, atau mode rubrik global/per-soal.

## Tujuan
- Mengukur apakah skor AI makin dekat ke penilaian guru.
- Menangkap pola salah nilai yang sering muncul.
- Membandingkan perilaku `rubrik per-soal` vs `rubrik global`.
- Mengecek apakah `light RAG` membantu atau justru mengganggu.

## Isi Paket
- `test-set-v1.json`: kumpulan sampel jawaban uji.
- `manual-score-sheet.csv`: template penilaian guru dan hasil AI.

## Cara Pakai
1. Pilih 10-20 sampel dari `test-set-v1.json`.
2. Minta 1-2 guru memberi nilai manual tanpa melihat hasil AI.
3. Jalankan AI grading pada sampel yang sama.
4. Isi `manual-score-sheet.csv`.
5. Bandingkan:
   - skor AI vs skor guru
   - aspek yang paling sering meleset
   - apakah error lebih sering terjadi di `global` atau `per_question`
   - apakah konteks RAG membantu pada soal berbasis materi

## Kolom yang Perlu Dicek
- `teacher_final_score`
- `ai_final_score`
- `score_gap`
- `teacher_review_needed`
- `error_pattern`
- `notes`

## Target Minimal Sebelum Deploy
- Rata-rata selisih skor AI ke guru tidak lebih dari 10 poin.
- Tidak ada pola error berat berulang pada jawaban benar tapi phrasing berbeda.
- Tidak ada pola AI menaikkan skor hanya karena keyword cocok.
- Soal `per_question` harus lebih stabil daripada `global` untuk soal spesifik/faktual.
- Jawaban off-topic tidak boleh lolos tinggi hanya karena konteks RAG relevan.

## Pola Error yang Perlu Ditandai
- `false_negative_paraphrase`: jawaban benar tapi frasa berbeda dari jawaban ideal.
- `false_positive_keyword_match`: jawaban salah/off-topic tapi keyword cocok.
- `overcredit_fluency`: bahasa rapi tapi isi lemah diberi skor terlalu tinggi.
- `undercredit_short_correct`: jawaban singkat tapi benar diberi skor terlalu rendah.
- `rag_override_rubric`: konteks materi terlalu memengaruhi skor dan mengalahkan rubrik.
- `global_rubric_too_generic`: rubrik global terlalu umum untuk soal spesifik.
- `partial_answer_extreme`: jawaban parsial diberi nol penuh atau skor penuh.
- `hallucinated_evidence`: AI mengklaim bukti yang tidak ada di jawaban siswa.

## Saran Interpretasi
- Jika error dominan `global_rubric_too_generic`, pindahkan soal jenis itu ke rubrik per-soal.
- Jika error dominan `rag_override_rubric`, kurangi jumlah snippet grounding atau kecilkan bobot konteks di prompt.
- Jika error dominan `false_negative_paraphrase`, perkuat instruksi anti-literal matching.
- Jika error dominan `false_positive_keyword_match`, tambahkan aturan “keyword tidak boleh langsung menaikkan skor”.
