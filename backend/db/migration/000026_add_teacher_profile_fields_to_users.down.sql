ALTER TABLE users
  DROP COLUMN IF EXISTS mata_pelajaran_tambahan,
  DROP COLUMN IF EXISTS pengalaman_mengajar,
  DROP COLUMN IF EXISTS tingkat_ajar,
  DROP COLUMN IF EXISTS rombel_aktif,
  DROP COLUMN IF EXISTS is_wali_kelas,
  DROP COLUMN IF EXISTS no_whatsapp,
  DROP COLUMN IF EXISTS bio_singkat;
