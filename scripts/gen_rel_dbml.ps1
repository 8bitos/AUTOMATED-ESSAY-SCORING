$ErrorActionPreference = 'Stop'

$tables = @{
  users = @(
    'id uuid [pk]',
    'nama_lengkap text','email text','password text','peran user_role',
    'nomor_identitas text','username text','created_at timestamptz',
    'foto_profil_url text','mata_pelajaran text','kelas_tingkat text','institusi text',
    'bahasa text','notif_email boolean','notif_inapp boolean','last_login_at timestamptz',
    'tanggal_lahir date','mata_pelajaran_tambahan text','pengalaman_mengajar int4','tingkat_ajar text',
    'rombel_aktif text','is_wali_kelas boolean','no_whatsapp text','bio_singkat text','is_teacher_verified boolean','ui_preferences jsonb'
  );
  classes = @(
    'id uuid [pk]','class_name text','class_code text','teacher_id uuid','deskripsi text',
    'created_at timestamptz','updated_at timestamptz','is_archived boolean','announcement_enabled boolean',
    'announcement_title text','announcement_content text','announcement_tone text','announcement_starts_at timestamptz',
    'announcement_ends_at timestamptz','join_policy text'
  );
  class_members = @(
    'id uuid [pk]','class_id uuid','user_id uuid','joined_at timestamptz','status varchar','requested_at timestamptz','approved_at timestamptz'
  );
  materials = @(
    'id uuid [pk]','class_id uuid','uploader_id uuid','judul text','isi_materi text','file_url text','created_at timestamptz',
    'capaian_pembelajaran text','kata_kunci text[]','updated_at timestamptz','display_order int4'
  );
  modules = @(
    'id uuid [pk]','material_id uuid','nama_modul varchar','file_url text','created_at timestamptz'
  );
  essay_questions = @(
    'id uuid [pk]','material_id uuid','teks_soal text','created_at timestamptz','module_id uuid','level_kognitif text','ideal_answer text',
    'keywords text[]','weight numeric','rubrics jsonb','updated_at timestamptz','round_score_to_5 boolean','round_score_step float8'
  );
  rubrics = @(
    'id uuid [pk]','question_id uuid','nama_aspek text','deskripsi text','max_score int4','descriptors jsonb','bobot float8','created_at timestamptz','updated_at timestamptz'
  );
  essay_submissions = @(
    'id uuid [pk]','soal_id uuid','siswa_id uuid','teks_jawaban text','submitted_at timestamptz','ai_grading_status text','ai_graded_at timestamptz',
    'ai_grading_error text','submission_type text','attempt_count int4'
  );
  ai_results = @(
    'id uuid [pk]','submission_id uuid','skor_ai numeric','umpan_balik_ai text','raw_response jsonb','generated_at timestamptz','logs_rag text'
  );
  teacher_reviews = @(
    'id uuid [pk]','submission_id uuid','teacher_id uuid','revised_score numeric','teacher_feedback text','created_at timestamptz','updated_at timestamptz'
  )
}

$relations = @(
  @{name='users_classes'; left='users'; right='classes'; ref='Ref: classes.teacher_id > users.id'},
  @{name='classes_class_members'; left='classes'; right='class_members'; ref='Ref: class_members.class_id > classes.id'},
  @{name='users_class_members'; left='users'; right='class_members'; ref='Ref: class_members.user_id > users.id'},
  @{name='classes_materials'; left='classes'; right='materials'; ref='Ref: materials.class_id > classes.id'},
  @{name='users_materials'; left='users'; right='materials'; ref='Ref: materials.uploader_id > users.id'},
  @{name='materials_modules'; left='materials'; right='modules'; ref='Ref: modules.material_id > materials.id'},
  @{name='materials_essay_questions'; left='materials'; right='essay_questions'; ref='Ref: essay_questions.material_id > materials.id'},
  @{name='modules_essay_questions'; left='modules'; right='essay_questions'; ref='Ref: essay_questions.module_id > modules.id'},
  @{name='essay_questions_rubrics'; left='essay_questions'; right='rubrics'; ref='Ref: rubrics.question_id > essay_questions.id'},
  @{name='essay_questions_essay_submissions'; left='essay_questions'; right='essay_submissions'; ref='Ref: essay_submissions.soal_id > essay_questions.id'},
  @{name='users_essay_submissions'; left='users'; right='essay_submissions'; ref='Ref: essay_submissions.siswa_id > users.id'},
  @{name='essay_submissions_ai_results'; left='essay_submissions'; right='ai_results'; ref='Ref: ai_results.submission_id > essay_submissions.id'},
  @{name='essay_submissions_teacher_reviews'; left='essay_submissions'; right='teacher_reviews'; ref='Ref: teacher_reviews.submission_id > essay_submissions.id'},
  @{name='users_teacher_reviews'; left='users'; right='teacher_reviews'; ref='Ref: teacher_reviews.teacher_id > users.id'}
)

$outDir = 'dbdiagram_relations'
if (!(Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }

$enumBlock = @"
Enum user_role {
  student
  teacher
  superadmin
}

"@

function TableBlock($name, $cols) {
  $lines = @("Table $name {")
  $lines += $cols | ForEach-Object { "  $_" }
  $lines += "}"
  return ($lines -join "`n")
}

$idx = 1
foreach ($r in $relations) {
  $file = Join-Path $outDir ("rel_{0:00}_{1}.dbml" -f $idx, $r.name)
  $content = @()
  $content += $enumBlock
  $content += (TableBlock $r.left $tables[$r.left])
  $content += ""
  $content += (TableBlock $r.right $tables[$r.right])
  $content += ""
  $content += $r.ref
  $content -join "`n" | Out-File -LiteralPath $file -Encoding utf8
  $idx++
}

Write-Output "Created $($relations.Count) files in $outDir"
