$ErrorActionPreference = 'Stop'

function Escape-Xml([string]$s) {
  if ($null -eq $s) { return '' }
  return $s.Replace('&','&amp;').Replace('<','&lt;').Replace('>','&gt;')
}

function Make-Paragraph([string]$text, [bool]$bold=$false) {
  $t = Escape-Xml $text
  if ($bold) {
    return "<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>$t</w:t></w:r></w:p>"
  }
  return "<w:p><w:r><w:t>$t</w:t></w:r></w:p>"
}

$items = @(
  @{title='1. Relationship between users and classes'; body='The relationship is One to Many (1:M), where one user with the role of a teacher can create multiple classes, but each class is created by only one user. The classes table stores teacher_id as a foreign key reference to users.id.'},
  @{title='2. Relationship between classes and class_members'; body='The relationship is One to Many (1:M), where one class can have many member records, but each member record belongs to only one class. The class_members table stores class_id as a foreign key reference to classes.id.'},
  @{title='3. Relationship between users and class_members'; body='The relationship is One to Many (1:M), where one user (student) can have multiple membership records across classes, but each membership record refers to only one user. The class_members table stores user_id as a foreign key reference to users.id.'},
  @{title='4. Relationship between classes and materials'; body='The relationship is One to Many (1:M), where one class can have multiple materials, but each material belongs to only one class. The materials table stores class_id as a foreign key reference to classes.id.'},
  @{title='5. Relationship between users and materials'; body='The relationship is One to Many (1:M), where one user (teacher) can upload multiple materials, but each material is uploaded by only one user. The materials table stores uploader_id as a foreign key reference to users.id.'},
  @{title='6. Relationship between materials and modules'; body='The relationship is One to Many (1:M), where one material can have multiple modules, but each module belongs to only one material. The modules table stores material_id as a foreign key reference to materials.id.'},
  @{title='7. Relationship between materials and essay_questions'; body='The relationship is One to Many (1:M), where one material can have multiple essay questions, but each question belongs to only one material. The essay_questions table stores material_id as a foreign key reference to materials.id.'},
  @{title='8. Relationship between modules and essay_questions'; body='The relationship is One to Many (1:M), where one module can be linked to multiple questions, and each question can reference only one module (optional). The essay_questions table stores module_id as a foreign key reference to modules.id. The optional link means module_id can be NULL (0..1).'},
  @{title='9. Relationship between essay_questions and rubrics'; body='The relationship is One to Many (1:M), where one question can have multiple rubric aspects, but each rubric aspect belongs to only one question. The rubrics table stores question_id as a foreign key reference to essay_questions.id.'},
  @{title='10. Relationship between essay_questions and essay_submissions'; body='The relationship is One to Many (1:M), where one question can receive multiple submissions, but each submission belongs to only one question. The essay_submissions table stores soal_id as a foreign key reference to essay_questions.id.'},
  @{title='11. Relationship between users and essay_submissions'; body='The relationship is One to Many (1:M), where one user (student) can submit multiple answers, but each submission is created by only one user. The essay_submissions table stores siswa_id as a foreign key reference to users.id.'},
  @{title='12. Relationship between essay_submissions and ai_results'; body='The relationship is One to Many (1:M), where one submission can have multiple AI result records, but each AI result belongs to only one submission. The ai_results table stores submission_id as a foreign key reference to essay_submissions.id.'},
  @{title='13. Relationship between essay_submissions and teacher_reviews'; body='The relationship is One to Many (1:M), where one submission can have multiple teacher reviews, but each review belongs to only one submission. The teacher_reviews table stores submission_id as a foreign key reference to essay_submissions.id.'},
  @{title='14. Relationship between users and teacher_reviews'; body='The relationship is One to Many (1:M), where one user (teacher) can create multiple reviews, but each review is created by only one user. The teacher_reviews table stores teacher_id as a foreign key reference to users.id.'}
)

$ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
$body = New-Object System.Text.StringBuilder

[void]$body.Append((Make-Paragraph 'B. Table Relationships' $true))
[void]$body.Append((Make-Paragraph 'The following are the relationships between the core LMS tables:'))

foreach ($item in $items) {
  [void]$body.Append((Make-Paragraph $item.title $true))
  [void]$body.Append((Make-Paragraph $item.body))
  [void]$body.Append((Make-Paragraph ''))
}

$documentXml = "<w:document xmlns:w='$ns'><w:body>$($body.ToString())<w:sectPr/></w:body></w:document>"

$tmp = Join-Path $env:TEMP ("docx_rel_" + [guid]::NewGuid().ToString())
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

$outPath = Join-Path (Get-Location) 'database_relationships.docx'
if (Test-Path $outPath) { Remove-Item $outPath -Force }
Add-Type -AssemblyName System.IO.Compression.FileSystem
[System.IO.Compression.ZipFile]::CreateFromDirectory($tmp, $outPath)

Remove-Item -Recurse -Force $tmp

Write-Output "Created $outPath"
