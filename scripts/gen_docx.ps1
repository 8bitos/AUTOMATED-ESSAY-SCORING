$ErrorActionPreference = 'Stop'

function Escape-Xml([string]$s) {
  if ($null -eq $s) { return '' }
  return $s.Replace('&','&amp;').Replace('<','&lt;').Replace('>','&gt;')
}

function Format-DataType([string]$dataType, [string]$udtName) {
  switch ($dataType) {
    'timestamp with time zone' { return 'timestamptz' }
    'character varying' { return 'varchar' }
    'double precision' { return 'float8' }
    'USER-DEFINED' {
      if ($udtName -eq 'user_role') { return 'user_role' }
      return $udtName
    }
    'ARRAY' {
      if ($udtName -eq '_text') { return 'text[]' }
      return $udtName
    }
    default { return $dataType }
  }
}

function Titleize([string]$s) {
  if ([string]::IsNullOrWhiteSpace($s)) { return '' }
  $s = $s -replace '_', ' '
  return ($s.Substring(0,1).ToUpper() + $s.Substring(1))
}

function Describe-Column([string]$col) {
  switch -Regex ($col) {
    '^id$' { return 'Primary key' }
    '(_id|_by)$' { return 'Foreign key reference' }
    '^email$' { return 'User email' }
    '^password$' { return 'Hashed password' }
    '^peran$' { return 'User role' }
    '^role$' { return 'User role' }
    '^created_at$' { return 'Created timestamp' }
    '^updated_at$' { return 'Updated timestamp' }
    '^deleted_at$' { return 'Deleted timestamp' }
    '(_at)$' { return 'Timestamp' }
    '^file_url$' { return 'File URL' }
    '^judul$' { return 'Title' }
    '^title$' { return 'Title' }
    '^teks_soal$' { return 'Question text' }
    '^teks_jawaban$' { return 'Student answer' }
    '^nama_lengkap$' { return 'User full name' }
    '^class_name$' { return 'Class name' }
    '^class_code$' { return 'Class code' }
    '^deskripsi$' { return 'Description' }
    '^status$' { return 'Status' }
    '^model_name$' { return 'Model name' }
    '^feature$' { return 'Feature name' }
    '^error_type$' { return 'Error type' }
    '^error_message$' { return 'Error message' }
    '^prompt_tokens$' { return 'Prompt tokens' }
    '^candidates_tokens$' { return 'Candidates tokens' }
    '^total_tokens$' { return 'Total tokens' }
    '^response_time_ms$' { return 'Response time (ms)' }
    '^skor_ai$' { return 'AI score' }
    '^umpan_balik_ai$' { return 'AI feedback' }
    '^raw_response$' { return 'Raw AI response' }
    '^logs_rag$' { return 'RAG logs' }
    '^nama_modul$' { return 'Module name' }
    '^isi_materi$' { return 'Material content' }
    '^capaian_pembelajaran$' { return 'Learning outcomes' }
    '^kata_kunci$' { return 'Keywords' }
    '^keywords$' { return 'Keywords' }
    '^weight$' { return 'Weight' }
    '^rubrics$' { return 'Rubric JSON' }
    '^max_score$' { return 'Maximum score' }
    '^descriptors$' { return 'Score descriptors' }
    '^bobot$' { return 'Aspect weight' }
    '^ideal_answer$' { return 'Ideal answer' }
    '^level_kognitif$' { return 'Cognitive level' }
    '^submission_type$' { return 'Submission type' }
    '^attempt_count$' { return 'Attempt count' }
    '^ai_grading_status$' { return 'AI grading status' }
    '^ai_grading_error$' { return 'AI grading error' }
    '^teacher_feedback$' { return 'Teacher feedback' }
    '^revised_score$' { return 'Adjusted score' }
    default { return Titleize $col }
  }
}

$tablesWanted = @(
  'users','classes','class_members','materials','modules','essay_questions','rubrics','essay_submissions','ai_results','teacher_reviews'
)

$tablesList = $tablesWanted -join "','"
$sql = "SELECT table_name, column_name, data_type, is_nullable, column_default, udt_name, ordinal_position FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('$tablesList') ORDER BY table_name, ordinal_position;"

$raw = & docker compose exec db psql -U user -d essay_scoring -t -A -F "," -c $sql
if ($LASTEXITCODE -ne 0) { throw 'Failed to query database schema.' }

$rows = @()
foreach ($line in $raw) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  $parts = $line.Split(',')
  if ($parts.Length -lt 7) { continue }
  $rows += [pscustomobject]@{
    table_name = $parts[0]
    column_name = $parts[1]
    data_type = $parts[2]
    is_nullable = $parts[3]
    column_default = $parts[4]
    udt_name = $parts[5]
    ordinal_position = [int]$parts[6]
  }
}

$grouped = $rows | Group-Object table_name | Sort-Object Name

$descriptions = @{
  users = 'Table 3.3 stores user data consisting of teachers, students, and superadmins. Each user has a role identifier to distinguish access level.'
  classes = 'Table 3.4 stores class information created and managed by teachers.'
  class_members = 'Table 3.5 stores data on students who are enrolled in a particular class.'
  materials = 'Table 3.6 stores learning materials posted by teachers, including content and attachments.'
  modules = 'Table 3.7 stores module files attached to a material.'
  essay_questions = 'Table 3.8 stores essay questions created by teachers, including optional ideal answers and keywords for AI assessment.'
  rubrics = 'Table 3.9 stores scoring rubrics per question, including aspects, descriptors, and weights.'
  essay_submissions = 'Table 3.10 stores student essay submissions and their AI grading status.'
  ai_results = 'Table 3.11 stores AI grading results for each submission.'
  teacher_reviews = 'Table 3.12 stores teacher reviews and adjusted scores for submissions.'
}

$ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'

function Make-Paragraph([string]$text, [bool]$bold=$false) {
  $t = Escape-Xml $text
  if ($bold) {
    return "<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>$t</w:t></w:r></w:p>"
  }
  return "<w:p><w:r><w:t>$t</w:t></w:r></w:p>"
}

function Make-Table($rows) {
  $tblPr = @"
<w:tblPr>
  <w:tblBorders>
    <w:top w:val="single" w:sz="8" w:space="0" w:color="000000"/>
    <w:left w:val="single" w:sz="8" w:space="0" w:color="000000"/>
    <w:bottom w:val="single" w:sz="8" w:space="0" w:color="000000"/>
    <w:right w:val="single" w:sz="8" w:space="0" w:color="000000"/>
    <w:insideH w:val="single" w:sz="8" w:space="0" w:color="000000"/>
    <w:insideV w:val="single" w:sz="8" w:space="0" w:color="000000"/>
  </w:tblBorders>
</w:tblPr>
"@
  $sb = New-Object System.Text.StringBuilder
  [void]$sb.Append("<w:tbl>" + $tblPr)
  for ($i=0; $i -lt $rows.Count; $i++) {
    $row = $rows[$i]
    [void]$sb.Append('<w:tr>')
    for ($j=0; $j -lt $row.Count; $j++) {
      $cellText = Escape-Xml $row[$j]
      if ($i -eq 0) {
        $cell = "<w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>$cellText</w:t></w:r></w:p></w:tc>"
      } else {
        $cell = "<w:tc><w:p><w:r><w:t>$cellText</w:t></w:r></w:p></w:tc>"
      }
      [void]$sb.Append($cell)
    }
    [void]$sb.Append('</w:tr>')
  }
  [void]$sb.Append('</w:tbl>')
  return $sb.ToString()
}

$body = New-Object System.Text.StringBuilder

foreach ($g in $grouped) {
  $tableName = $g.Name
  [void]$body.Append((Make-Paragraph ("Table " + $tableName) $true))
  if ($descriptions.ContainsKey($tableName)) {
    [void]$body.Append((Make-Paragraph $descriptions[$tableName]))
  }
  [void]$body.Append((Make-Paragraph ("Table " + $tableName + " Table") $true))

  $rows = @()
  $rows += ,@('Attribute','Data Type','Description')
  $cols = $g.Group | Sort-Object ordinal_position
  foreach ($c in $cols) {
    $dt = Format-DataType $c.data_type $c.udt_name
    $desc = Describe-Column $c.column_name
    $rows += ,@($c.column_name, $dt, $desc)
  }
  [void]$body.Append((Make-Table $rows))
  [void]$body.Append((Make-Paragraph ''))
}

$documentXml = "<w:document xmlns:w='$ns'><w:body>$($body.ToString())<w:sectPr/></w:body></w:document>"

$tmp = Join-Path $env:TEMP ("docx_" + [guid]::NewGuid().ToString())
$wordDir = Join-Path $tmp 'word'
$relsDir = Join-Path $tmp '_rels'
$wordRelsDir = Join-Path $wordDir '_rels'
New-Item -ItemType Directory -Path $tmp,$wordDir,$relsDir,$wordRelsDir | Out-Null

@"
<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
"@ | Out-File -LiteralPath (Join-Path $tmp '[Content_Types].xml') -Encoding utf8

@"
<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
"@ | Out-File -LiteralPath (Join-Path $relsDir '.rels') -Encoding utf8

@"
<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships" />
"@ | Out-File -LiteralPath (Join-Path $wordRelsDir 'document.xml.rels') -Encoding utf8

$documentXml | Out-File -LiteralPath (Join-Path $wordDir 'document.xml') -Encoding utf8

$outPath = Join-Path (Get-Location) 'database_tables_desc.docx'
if (Test-Path $outPath) { Remove-Item $outPath -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tmp, $outPath)

Remove-Item -Recurse -Force $tmp

Write-Output "Created $outPath"
