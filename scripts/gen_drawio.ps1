$ErrorActionPreference = 'Stop'

function New-Vertex($id,$value,$style,$parent,$x,$y,$w,$h){
  return "<mxCell id=`"$id`" value=`"$value`" style=`"$style`" parent=`"$parent`" vertex=`"1`"><mxGeometry x=`"$x`" y=`"$y`" width=`"$w`" height=`"$h`" as=`"geometry`"/></mxCell>"
}
function New-Edge($id,$parent,$source,$target){
  return "<mxCell id=`"$id`" style=`"edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;`" parent=`"$parent`" source=`"$source`" target=`"$target`" edge=`"1`"><mxGeometry relative=`"1`" as=`"geometry`"/></mxCell>"
}

function Page-Login($pageId,$pageName){
  $cells = @()
  $cells += '<mxCell id="0"/>'
  $cells += '<mxCell id="1" parent="0"/>'
  $cells += New-Vertex 'U1' 'User' 'swimlane;horizontal=0;startSize=30;fillColor=#ffffff;strokeColor=#000000;' '1' 0 0 340 520
  $cells += New-Vertex 'S1' 'System' 'swimlane;horizontal=0;startSize=30;fillColor=#ffffff;strokeColor=#000000;' '1' 340 0 340 520

  $cells += New-Vertex 'u_start' '' 'ellipse;whiteSpace=wrap;html=1;fillColor=#000000;strokeColor=#000000;' 'U1' 140 60 16 16
  $cells += New-Vertex 'u_open' 'Open Login Page' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 90 110 160 40
  $cells += New-Vertex 'u_input' 'Input Email & Password' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 70 180 200 40

  $cells += New-Vertex 's_form' 'Show Login Form' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 90 110 160 40
  $cells += New-Vertex 's_valid' 'Valid?' 'rhombus;whiteSpace=wrap;html=1;' 'S1' 120 180 100 60
  $cells += New-Vertex 's_error' 'Show Error Message' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 80 270 200 40
  $cells += New-Vertex 's_ok' 'Login Successful' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 80 340 200 40
  $cells += New-Vertex 's_end' '' 'ellipse;whiteSpace=wrap;html=1;fillColor=#000000;strokeColor=#000000;' 'S1' 140 420 16 16

  $cells += New-Edge 'e1' '1' 'u_start' 'u_open'
  $cells += New-Edge 'e2' '1' 'u_open' 's_form'
  $cells += New-Edge 'e3' '1' 's_form' 'u_input'
  $cells += New-Edge 'e4' '1' 'u_input' 's_valid'
  $cells += New-Edge 'e5' '1' 's_valid' 's_error'
  $cells += New-Edge 'e6' '1' 's_error' 's_form'
  $cells += New-Edge 'e7' '1' 's_valid' 's_ok'
  $cells += New-Edge 'e8' '1' 's_ok' 's_end'

  $root = ($cells -join "")
  return "<diagram id=`"$pageId`" name=`"$pageName`"><mxGraphModel dx=`"1200`" dy=`"800`" grid=`"1`" gridSize=`"10`" guides=`"1`" tooltips=`"1`" connect=`"1`" arrows=`"1`" fold=`"1`" page=`"1`" pageScale=`"1`" pageWidth=`"800`" pageHeight=`"600`" math=`"0`" shadow=`"0`"><root>$root</root></mxGraphModel></diagram>"
}

function Page-Template($pageId,$pageName,$userActions,$systemActions,$edges){
  $cells = @()
  $cells += '<mxCell id="0"/>'
  $cells += '<mxCell id="1" parent="0"/>'
  $cells += New-Vertex 'U1' 'User' 'swimlane;horizontal=0;startSize=30;fillColor=#ffffff;strokeColor=#000000;' '1' 0 0 340 520
  $cells += New-Vertex 'S1' 'System' 'swimlane;horizontal=0;startSize=30;fillColor=#ffffff;strokeColor=#000000;' '1' 340 0 340 520
  $cells += $userActions
  $cells += $systemActions
  $cells += $edges
  $root = ($cells -join "")
  return "<diagram id=`"$pageId`" name=`"$pageName`"><mxGraphModel dx=`"1200`" dy=`"800`" grid=`"1`" gridSize=`"10`" guides=`"1`" tooltips=`"1`" connect=`"1`" arrows=`"1`" fold=`"1`" page=`"1`" pageScale=`"1`" pageWidth=`"800`" pageHeight=`"600`" math=`"0`" shadow=`"0`"><root>$root</root></mxGraphModel></diagram>"
}

function Build-CreateContent($id,$name){
  $u = @(
    New-Vertex 'u_start' '' 'ellipse;whiteSpace=wrap;html=1;fillColor=#000000;strokeColor=#000000;' 'U1' 140 40 16 16,
    New-Vertex 'u_dash' 'Open Class Dashboard' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 70 80 200 40,
    New-Vertex 'u_mat' 'Create/Select Material' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 70 140 200 40,
    New-Vertex 'u_mod' 'Upload Module (optional)' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 70 200 200 40,
    New-Vertex 'u_q' 'Create Essay Question' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 70 260 200 40,
    New-Vertex 'u_r' 'Define Rubric Aspects & Weights' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 40 320 260 40
  )
  $s = @(
    New-Vertex 's_val' 'Validate Inputs' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 90 140 160 40,
    New-Vertex 's_ok' 'Valid?' 'rhombus;whiteSpace=wrap;html=1;' 'S1' 120 200 100 60,
    New-Vertex 's_err' 'Show Error' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 100 280 160 40,
    New-Vertex 's_save1' 'Save Material' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 100 340 160 40,
    New-Vertex 's_save2' 'Save Module' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 100 390 160 40,
    New-Vertex 's_save3' 'Save Question' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 100 440 160 40,
    New-Vertex 's_end' '' 'ellipse;whiteSpace=wrap;html=1;fillColor=#000000;strokeColor=#000000;' 'S1' 170 490 16 16
  )
  $e = @(
    New-Edge 'e1' '1' 'u_start' 'u_dash',
    New-Edge 'e2' '1' 'u_dash' 'u_mat',
    New-Edge 'e3' '1' 'u_mat' 's_val',
    New-Edge 'e4' '1' 's_val' 's_ok',
    New-Edge 'e5' '1' 's_ok' 's_err',
    New-Edge 'e6' '1' 's_err' 'u_dash',
    New-Edge 'e7' '1' 's_ok' 's_save1',
    New-Edge 'e8' '1' 's_save1' 'u_mod',
    New-Edge 'e9' '1' 'u_mod' 's_save2',
    New-Edge 'e10' '1' 's_save2' 'u_q',
    New-Edge 'e11' '1' 'u_q' 's_save3',
    New-Edge 'e12' '1' 's_save3' 'u_r',
    New-Edge 'e13' '1' 'u_r' 's_end'
  )
  return Page-Template $id $name $u $s $e
}

function Build-Submission($id,$name){
  $u = @(
    New-Vertex 'u_start' '' 'ellipse;whiteSpace=wrap;html=1;fillColor=#000000;strokeColor=#000000;' 'U1' 140 40 16 16,
    New-Vertex 'u_open' 'Open Assignment/Question' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 60 90 220 40,
    New-Vertex 'u_write' 'Write Essay Answer' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 70 150 200 40,
    New-Vertex 'u_submit' 'Submit Answer' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 90 210 160 40
  )
  $s = @(
    New-Vertex 's_val' 'Validate Submission' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 90 150 160 40,
    New-Vertex 's_ok' 'Valid?' 'rhombus;whiteSpace=wrap;html=1;' 'S1' 120 210 100 60,
    New-Vertex 's_err' 'Show Error' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 100 300 160 40,
    New-Vertex 's_store' 'Store Submission' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 90 360 160 40,
    New-Vertex 's_status' 'Set AI Grading Status = queued' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 40 420 260 40,
    New-Vertex 's_end' '' 'ellipse;whiteSpace=wrap;html=1;fillColor=#000000;strokeColor=#000000;' 'S1' 170 480 16 16
  )
  $e = @(
    New-Edge 'e1' '1' 'u_start' 'u_open',
    New-Edge 'e2' '1' 'u_open' 'u_write',
    New-Edge 'e3' '1' 'u_write' 'u_submit',
    New-Edge 'e4' '1' 'u_submit' 's_val',
    New-Edge 'e5' '1' 's_val' 's_ok',
    New-Edge 'e6' '1' 's_ok' 's_err',
    New-Edge 'e7' '1' 's_err' 'u_write',
    New-Edge 'e8' '1' 's_ok' 's_store',
    New-Edge 'e9' '1' 's_store' 's_status',
    New-Edge 'e10' '1' 's_status' 's_end'
  )
  return Page-Template $id $name $u $s $e
}

function Build-AI($id,$name){
  $u = @(
    New-Vertex 'u_start' '' 'ellipse;whiteSpace=wrap;html=1;fillColor=#000000;strokeColor=#000000;' 'U1' 140 40 16 16,
    New-Vertex 'u_req' 'Request/Trigger Grading' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 60 90 220 40
  )
  $s = @(
    New-Vertex 's_mode' 'Grading Mode?' 'rhombus;whiteSpace=wrap;html=1;' 'S1' 120 100 100 60,
    New-Vertex 's_queue' 'Push Job to Queue' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 80 180 200 40,
    New-Vertex 's_worker' 'Worker Fetches Job' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 80 230 200 40,
    New-Vertex 's_prompt' 'Build Prompt from Rubric + Essay' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 40 280 280 40,
    New-Vertex 's_call' 'Call Gemini API' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 80 330 200 40,
    New-Vertex 's_valid' 'Response Valid?' 'rhombus;whiteSpace=wrap;html=1;' 'S1' 120 390 100 60,
    New-Vertex 's_err' 'Store Error & Update Status' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 40 470 280 40,
    New-Vertex 's_parse' 'Parse JSON Scores' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 80 460 200 40,
    New-Vertex 's_compute' 'Compute Final Score' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 80 510 200 40,
    New-Vertex 's_store' 'Store ai_results & Update essay_submissions' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 10 560 320 40,
    New-Vertex 's_end' '' 'ellipse;whiteSpace=wrap;html=1;fillColor=#000000;strokeColor=#000000;' 'S1' 170 610 16 16
  )
  $e = @(
    New-Edge 'e1' '1' 'u_start' 'u_req',
    New-Edge 'e2' '1' 'u_req' 's_mode',
    New-Edge 'e3' '1' 's_mode' 's_prompt',
    New-Edge 'e4' '1' 's_mode' 's_queue',
    New-Edge 'e5' '1' 's_queue' 's_worker',
    New-Edge 'e6' '1' 's_worker' 's_prompt',
    New-Edge 'e7' '1' 's_prompt' 's_call',
    New-Edge 'e8' '1' 's_call' 's_valid',
    New-Edge 'e9' '1' 's_valid' 's_err',
    New-Edge 'e10' '1' 's_valid' 's_parse',
    New-Edge 'e11' '1' 's_parse' 's_compute',
    New-Edge 'e12' '1' 's_compute' 's_store',
    New-Edge 'e13' '1' 's_store' 's_end',
    New-Edge 'e14' '1' 's_err' 's_end'
  )
  return Page-Template $id $name $u $s $e
}

function Build-Review($id,$name){
  $u = @(
    New-Vertex 'u_start' '' 'ellipse;whiteSpace=wrap;html=1;fillColor=#000000;strokeColor=#000000;' 'U1' 140 40 16 16,
    New-Vertex 'u_open' 'Open Submission Detail' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 70 90 200 40,
    New-Vertex 'u_review' 'Review AI Score & Feedback' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 60 150 220 40,
    New-Vertex 'u_adjust' 'Adjust Score / Add Feedback' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 60 210 220 40,
    New-Vertex 'u_finalize' 'Finalize Review' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 90 270 160 40
  )
  $s = @(
    New-Vertex 's_load' 'Load Submission + AI Results' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 50 150 240 40,
    New-Vertex 's_save' 'Save Teacher Review' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 80 270 200 40,
    New-Vertex 's_update' 'Update Final Status' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 90 330 180 40,
    New-Vertex 's_end' '' 'ellipse;whiteSpace=wrap;html=1;fillColor=#000000;strokeColor=#000000;' 'S1' 170 400 16 16
  )
  $e = @(
    New-Edge 'e1' '1' 'u_start' 'u_open',
    New-Edge 'e2' '1' 'u_open' 's_load',
    New-Edge 'e3' '1' 's_load' 'u_review',
    New-Edge 'e4' '1' 'u_review' 'u_adjust',
    New-Edge 'e5' '1' 'u_adjust' 'u_finalize',
    New-Edge 'e6' '1' 'u_finalize' 's_save',
    New-Edge 'e7' '1' 's_save' 's_update',
    New-Edge 'e8' '1' 's_update' 's_end'
  )
  return Page-Template $id $name $u $s $e
}

function Build-Appeal($id,$name){
  $u = @(
    New-Vertex 'u_start' '' 'ellipse;whiteSpace=wrap;html=1;fillColor=#000000;strokeColor=#000000;' 'U1' 140 40 16 16,
    New-Vertex 'u_open' 'Open Score Detail' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 90 90 160 40,
    New-Vertex 'u_reason' 'Submit Appeal Reason' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 70 150 200 40,
    New-Vertex 'u_attach' 'Attach Evidence (optional)' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 60 210 220 40,
    New-Vertex 'u_send' 'Send Appeal' 'rounded=1;whiteSpace=wrap;html=1;' 'U1' 100 270 140 40
  )
  $s = @(
    New-Vertex 's_val' 'Validate Appeal' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 90 150 160 40,
    New-Vertex 's_ok' 'Valid?' 'rhombus;whiteSpace=wrap;html=1;' 'S1' 120 210 100 60,
    New-Vertex 's_err' 'Show Error' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 100 300 160 40,
    New-Vertex 's_store' 'Store grade_appeals' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 80 360 200 40,
    New-Vertex 's_notify' 'Notify Teacher' 'rounded=1;whiteSpace=wrap;html=1;' 'S1' 90 420 180 40,
    New-Vertex 's_end' '' 'ellipse;whiteSpace=wrap;html=1;fillColor=#000000;strokeColor=#000000;' 'S1' 170 480 16 16
  )
  $e = @(
    New-Edge 'e1' '1' 'u_start' 'u_open',
    New-Edge 'e2' '1' 'u_open' 'u_reason',
    New-Edge 'e3' '1' 'u_reason' 'u_attach',
    New-Edge 'e4' '1' 'u_attach' 'u_send',
    New-Edge 'e5' '1' 'u_send' 's_val',
    New-Edge 'e6' '1' 's_val' 's_ok',
    New-Edge 'e7' '1' 's_ok' 's_err',
    New-Edge 'e8' '1' 's_err' 'u_reason',
    New-Edge 'e9' '1' 's_ok' 's_store',
    New-Edge 'e10' '1' 's_store' 's_notify',
    New-Edge 'e11' '1' 's_notify' 's_end'
  )
  return Page-Template $id $name $u $s $e
}

$diagrams = @()
$diagrams += Page-Login 'd1' 'Login Activity'
$diagrams += Build-CreateContent 'd2' 'Create Content Activity'
$diagrams += Build-Submission 'd3' 'Essay Submission Activity'
$diagrams += Build-AI 'd4' 'AI Grading Activity'
$diagrams += Build-Review 'd5' 'Teacher Review Activity'
$diagrams += Build-Appeal 'd6' 'Grade Appeal Activity'

$mxfile = "<mxfile host=`"app.diagrams.net`" modified=`"$(Get-Date -Format s)`" agent=`"codex`" version=`"20.6.3`">$($diagrams -join '')</mxfile>"
$mxfile | Out-File -LiteralPath activity_diagrams.drawio -Encoding utf8

Write-Output 'Created activity_diagrams.drawio'
