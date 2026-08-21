# Recruitment & Hiring Tracker - Full Backend Regression Test (v2, post pipeline redesign)
# Run from: D:\Uni\Second Year\Second Sem\PPPM\Group Assignment\Node
# Requires: backend running (Terminal 1, npm run dev) on http://localhost:4000
# Safe to re-run: uses a timestamp suffix so it never collides with previous runs' data.

$ErrorActionPreference = "Stop"
$base = "http://localhost:4000/api"
$pass = 0
$fail = 0
$failures = @()

function Check($label, $condition, $detail = "") {
    if ($condition) {
        Write-Host "PASS - $label" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host "FAIL - $label $detail" -ForegroundColor Red
        $script:fail++
        $script:failures += $label
    }
}

function Invoke-Api {
    param($Method, $Uri, $Headers = @{}, $Body = $null)
    try {
        if ($Body) {
            return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers -Body ($Body | ConvertTo-Json -Depth 5) -ContentType "application/json"
        } else {
            return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $Headers
        }
    } catch {
        $status = $null
        try { $status = $_.Exception.Response.StatusCode.value__ } catch {}
        return [PSCustomObject]@{ __error = $true; __status = $status }
    }
}

$suffix = Get-Date -Format "yyyyMMddHHmmss"

Write-Host "`n=== 1. AUTH ===`n"

$hr = Invoke-Api POST "$base/auth/login" -Body @{ email="hr@altrium.test"; password="password123" }
Check "HR login" ($null -ne $hr.token)
$hrToken = $hr.token

$interviewer = Invoke-Api POST "$base/auth/login" -Body @{ email="interviewer@altrium.test"; password="password123" }
Check "Interviewer login" ($null -ne $interviewer.token)
$interviewerToken = $interviewer.token
$interviewerId = $interviewer.user.id

$management = Invoke-Api POST "$base/auth/login" -Body @{ email="management@altrium.test"; password="password123" }
Check "Management login" ($null -ne $management.token)
$managementToken = $management.token

$hm = Invoke-Api POST "$base/auth/login" -Body @{ email="hiringmanager@altrium.test"; password="password123" }
Check "Hiring Manager login" ($null -ne $hm.token)
$hmToken = $hm.token
$hmId = $hm.user.id

Write-Host "`n=== 2. VACANCIES + DUPLICATE CHECK ===`n"

$vacTitle = "Regression Test Role $suffix"
$vacBody = @{ title=$vacTitle; department="Engineering"; description="Auto-created by regression script" }
$vac = Invoke-Api POST "$base/vacancies" -Headers @{Authorization="Bearer $hrToken"} -Body $vacBody
Check "HR creates vacancy" ($null -ne $vac.id)
$vacId = $vac.id

$dupVac = Invoke-Api POST "$base/vacancies" -Headers @{Authorization="Bearer $hrToken"} -Body $vacBody
Check "Duplicate vacancy (same title+department) blocked" ($dupVac.__error -eq $true -and $dupVac.__status -eq 409)

$vacByNonHr = Invoke-Api POST "$base/vacancies" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ title="x $suffix"; department="Engineering"; description="x" }
Check "Non-HR blocked from creating vacancy" ($vacByNonHr.__error -eq $true -and $vacByNonHr.__status -eq 403)

$vacOne = Invoke-Api GET "$base/vacancies/$vacId" -Headers @{Authorization="Bearer $managementToken"}
Check "Get single vacancy" ($vacOne.id -eq $vacId)

Write-Host "`n=== 3. VACANCY INTERVIEWER POOL (US-10) ===`n"

$assignInt = Invoke-Api POST "$base/vacancies/$vacId/interviewers" -Headers @{Authorization="Bearer $hrToken"} -Body @{ userId=$interviewerId }
Check "HR assigns interviewer to vacancy pool" ($null -ne $assignInt.id)

$assignHmToPool = Invoke-Api POST "$base/vacancies/$vacId/interviewers" -Headers @{Authorization="Bearer $hrToken"} -Body @{ userId=$hmId }
Check "HR assigns HM to vacancy pool (management/HM eligible too)" ($null -ne $assignHmToPool.id)

$dupAssign = Invoke-Api POST "$base/vacancies/$vacId/interviewers" -Headers @{Authorization="Bearer $hrToken"} -Body @{ userId=$interviewerId }
Check "Duplicate pool assignment blocked" ($dupAssign.__error -eq $true -and $dupAssign.__status -eq 409)

$poolList = Invoke-Api GET "$base/vacancies/$vacId/interviewers" -Headers @{Authorization="Bearer $hrToken"}
Check "List vacancy interviewer pool" ($poolList.Count -eq 2)

Write-Host "`n=== 4. CANDIDATES ===`n"

$candBody = @{ name="Regression Candidate $suffix"; email="regression.$suffix@example.com"; phoneNumber="0123456789"; cvUrl="http://example.com/cv.pdf" }
$cand = Invoke-Api POST "$base/candidates" -Headers @{Authorization="Bearer $hrToken"} -Body $candBody
Check "HR creates candidate" ($null -ne $cand.id)
$candId = $cand.id

Write-Host "`n=== 5. APPLICATION LIFECYCLE (new stage model) ===`n"

$app = Invoke-Api POST "$base/vacancies/$vacId/applications" -Headers @{Authorization="Bearer $hrToken"} -Body @{ candidateId=$candId }
Check "HR applies candidate to vacancy" ($null -ne $app.id)
$appId = $app.id

$appGetInitial = Invoke-Api GET "$base/applications/$appId" -Headers @{Authorization="Bearer $hrToken"}
Check "New application starts at APPLIED stage" ($appGetInitial.stage -eq "APPLIED")
Check "Stage history seeded with one APPLIED entry" ($appGetInitial.stageHistory.Count -eq 1 -and $appGetInitial.stageHistory[0].stage -eq "APPLIED")

$dupApp = Invoke-Api POST "$base/vacancies/$vacId/applications" -Headers @{Authorization="Bearer $hrToken"} -Body @{ candidateId=$candId }
Check "Duplicate application blocked" ($dupApp.__error -eq $true -and $dupApp.__status -eq 409)

$shortlist = Invoke-Api PATCH "$base/applications/$appId/status" -Headers @{Authorization="Bearer $hrToken"} -Body @{ status="SHORTLISTED" }
Check "HR shortlists application" ($shortlist.stage -eq "SHORTLISTED")

$shortlistAgain = Invoke-Api PATCH "$base/applications/$appId/status" -Headers @{Authorization="Bearer $hrToken"} -Body @{ status="SHORTLISTED" }
Check "Re-shortlisting an already-shortlisted application blocked (must be APPLIED)" ($shortlistAgain.__error -eq $true -and $shortlistAgain.__status -eq 400)

Write-Host "`n=== 6. INTERVIEW SCHEDULING + CONFLICT CHECK (US-11) ===`n"

$scheduledTime = "2026-09-10T10:00:00.000Z"
$interview1 = Invoke-Api POST "$base/applications/$appId/interviews" -Headers @{Authorization="Bearer $hrToken"} -Body @{ stage="INTERVIEW_1"; scheduledAt=$scheduledTime; panelistUserIds=@($interviewerId) }
Check "HR schedules INTERVIEW_1 with assigned panelist" ($null -ne $interview1.id)
$interview1Id = $interview1.id

$notInPool = Invoke-Api POST "$base/applications/$appId/interviews" -Headers @{Authorization="Bearer $hrToken"} -Body @{ stage="INTERVIEW_1"; scheduledAt="2026-09-11T10:00:00.000Z"; panelistUserIds=@(999999) }
Check "Scheduling with a panelist not in the vacancy pool blocked" ($notInPool.__error -eq $true -and $notInPool.__status -eq 400)

# Second application, same panelist, same exact time -> should conflict
$cand2Body = @{ name="Regression Candidate B $suffix"; email="regressionb.$suffix@example.com"; phoneNumber="0123456789"; cvUrl="http://example.com/cv.pdf" }
$cand2 = Invoke-Api POST "$base/candidates" -Headers @{Authorization="Bearer $hrToken"} -Body $cand2Body
$app2 = Invoke-Api POST "$base/vacancies/$vacId/applications" -Headers @{Authorization="Bearer $hrToken"} -Body @{ candidateId=$cand2.id }
$conflictInterview = Invoke-Api POST "$base/applications/$($app2.id)/interviews" -Headers @{Authorization="Bearer $hrToken"} -Body @{ stage="INTERVIEW_1"; scheduledAt=$scheduledTime; panelistUserIds=@($interviewerId) }
Check "Scheduling conflict (same panelist, same exact time) blocked" ($conflictInterview.__error -eq $true -and $conflictInterview.__status -eq 409)

Write-Host "`n=== 7. STAGE PROGRESSION: NO SKIP / NO BACKWARDS (US-31) ===`n"

$skipStage = Invoke-Api PATCH "$base/applications/$appId/stage" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ stage="FINAL_INTERVIEW" }
Check "Skipping straight to FINAL_INTERVIEW from SHORTLISTED blocked" ($skipStage.__error -eq $true -and $skipStage.__status -eq 400)

$stageByHr = Invoke-Api PATCH "$base/applications/$appId/stage" -Headers @{Authorization="Bearer $hrToken"} -Body @{ stage="INTERVIEW_1" }
Check "HR blocked from updating stage (Interviewer-only now)" ($stageByHr.__error -eq $true -and $stageByHr.__status -eq 403)

$stageByHm = Invoke-Api PATCH "$base/applications/$appId/stage" -Headers @{Authorization="Bearer $hmToken"} -Body @{ stage="INTERVIEW_1" }
Check "HM blocked from updating stage directly (advisory recommendation only now)" ($stageByHm.__error -eq $true -and $stageByHm.__status -eq 403)

$toInterview1 = Invoke-Api PATCH "$base/applications/$appId/stage" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ stage="INTERVIEW_1" }
Check "Interviewer advances SHORTLISTED -> INTERVIEW_1" ($toInterview1.stage -eq "INTERVIEW_1")

$backwards = Invoke-Api PATCH "$base/applications/$appId/stage" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ stage="SHORTLISTED" }
Check "Moving backwards to SHORTLISTED blocked" ($backwards.__error -eq $true -and $backwards.__status -eq 400)

$skipAgain = Invoke-Api PATCH "$base/applications/$appId/stage" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ stage="FINAL_INTERVIEW" }
Check "Skipping INTERVIEW_2 blocked" ($skipAgain.__error -eq $true -and $skipAgain.__status -eq 400)

$toInterview2 = Invoke-Api PATCH "$base/applications/$appId/stage" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ stage="INTERVIEW_2" }
Check "Interviewer advances INTERVIEW_1 -> INTERVIEW_2" ($toInterview2.stage -eq "INTERVIEW_2")

$toFinal = Invoke-Api PATCH "$base/applications/$appId/stage" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ stage="FINAL_INTERVIEW" }
Check "Interviewer advances INTERVIEW_2 -> FINAL_INTERVIEW" ($toFinal.stage -eq "FINAL_INTERVIEW")

Write-Host "`n=== 8. HM RECOMMENDATION (US-19, advisory only) ===`n"

$recommend = Invoke-Api POST "$base/applications/$appId/recommendation" -Headers @{Authorization="Bearer $hmToken"} -Body @{ recommendation="ADVANCE"; comments="Strong final-round performance" }
Check "HM submits ADVANCE recommendation" ($null -ne $recommend.id)

$appAfterRecommend = Invoke-Api GET "$base/applications/$appId" -Headers @{Authorization="Bearer $hrToken"}
Check "Recommendation does NOT change the application's actual stage" ($appAfterRecommend.stage -eq "FINAL_INTERVIEW")
Check "Recommendation visible to HR via application detail" ($appAfterRecommend.recommendations.Count -eq 1)

$recommendByInterviewer = Invoke-Api POST "$base/applications/$appId/recommendation" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ recommendation="ADVANCE" }
Check "Interviewer blocked from submitting recommendation (HM only)" ($recommendByInterviewer.__error -eq $true -and $recommendByInterviewer.__status -eq 403)

Write-Host "`n=== 9. FEEDBACK ===`n"

$feedback = Invoke-Api POST "$base/interviews/$interview1Id/feedback" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ score=8; comments="Strong technical answers." }
Check "Interviewer submits feedback" ($null -ne $feedback.id)
$feedbackId = $feedback.id

$feedbackEdit = Invoke-Api PATCH "$base/feedback/$feedbackId" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ score=9; reason="Reconsidered after reviewing notes" }
Check "Interviewer edits own feedback with reason" ($feedbackEdit.score -eq 9)

$auditLog = Invoke-Api GET "$base/feedback/$feedbackId/audit-log" -Headers @{Authorization="Bearer $hrToken"}
Check "Audit log recorded the edit" ((($auditLog | Measure-Object).Count -eq 1) -and ($auditLog[0].newScore -eq 9))

Write-Host "`n=== 10. HIRING DECISION ===`n"

$decision = Invoke-Api PATCH "$base/applications/$appId/decision" -Headers @{Authorization="Bearer $hmToken"} -Body @{ hiringDecision="HIRE" }
Check "HM records hire decision" ($decision.hiringDecision -eq "HIRE" -and $decision.stage -eq "HIRED")

$appFinal = Invoke-Api GET "$base/applications/$appId" -Headers @{Authorization="Bearer $hrToken"}
Check "Stage history has 6 entries (Applied/Shortlisted/Int1/Int2/Final/Hired)" ($appFinal.stageHistory.Count -eq 6)
Check "All but the last history entry are closed (exitedAt set)" ((($appFinal.stageHistory | Select-Object -First 5) | Where-Object { $null -eq $_.exitedAt }).Count -eq 0)

Write-Host "`n=== 11. REPORTS ===`n"

$dashboard = Invoke-Api GET "$base/reports/dashboard" -Headers @{Authorization="Bearer $managementToken"}
Check "Dashboard returns active vacancies with stageCounts" ($dashboard.Count -gt 0 -and $null -ne $dashboard[0].stageCounts)

$stageMonitoring = Invoke-Api GET "$base/reports/stage-monitoring?vacancyId=$vacId" -Headers @{Authorization="Bearer $managementToken"}
Check "Stage monitoring returns all 7 fixed stages" ($stageMonitoring.stages.Count -eq 7)
$hiredStage = $stageMonitoring.stages | Where-Object { $_.stage -eq "HIRED" }
Check "Stage monitoring shows 1 HIRED for this vacancy" ($hiredStage.candidateCount -eq 1)

$kpis = Invoke-Api GET "$base/reports/kpis?vacancyId=$vacId" -Headers @{Authorization="Bearer $managementToken"}
Check "KPIs include openVacancies field" ($null -ne $kpis.PSObject.Properties["openVacancies"])
Check "KPIs include averageTimeToHireDays field" ($null -ne $kpis.PSObject.Properties["averageTimeToHireDays"])
Check "KPIs reflect the hire" ($kpis.hires -eq 1)

$vacReport = Invoke-Api GET "$base/vacancies/$vacId/report" -Headers @{Authorization="Bearer $managementToken"}
Check "Vacancy report includes stageCounts" ($null -ne $vacReport.stageCounts)
Check "Vacancy report includes stageTimings" ($null -ne $vacReport.stageTimings -and $vacReport.stageTimings.Count -eq 7)

Write-Host "`n=== SUMMARY ===`n"
Write-Host "Passed: $pass" -ForegroundColor Green
Write-Host "Failed: $fail" -ForegroundColor Red
if ($fail -gt 0) {
    Write-Host "`nFailed checks:"
    $failures | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
}
Write-Host "`nRegression vacancy: id=$vacId (title: $vacTitle)`n"
