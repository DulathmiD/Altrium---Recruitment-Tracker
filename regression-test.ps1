# Recruitment & Hiring Tracker - Full Backend Regression Test
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

$leadership = Invoke-Api POST "$base/auth/login" -Body @{ email="leadership@altrium.test"; password="password123" }
Check "Leadership login" ($null -ne $leadership.token)

$itAdminViaRegular = Invoke-Api POST "$base/auth/login" -Body @{ email="itadmin@altrium.test"; password="password123" }
Check "IT Admin blocked on regular /login" ($itAdminViaRegular.__error -eq $true -and $itAdminViaRegular.__status -eq 401)

$itAdmin = Invoke-Api POST "$base/auth/admin-login" -Body @{ email="itadmin@altrium.test"; password="password123" }
Check "IT Admin login via /admin-login" ($null -ne $itAdmin.token)

$hrViaAdmin = Invoke-Api POST "$base/auth/admin-login" -Body @{ email="hr@altrium.test"; password="password123" }
Check "HR blocked on /admin-login" ($hrViaAdmin.__error -eq $true -and $hrViaAdmin.__status -eq 401)

$disabled = Invoke-Api POST "$base/auth/login" -Body @{ email="disabled@altrium.test"; password="password123" }
Check "Disabled account blocked" ($disabled.__error -eq $true -and $disabled.__status -eq 401)

$wrongPw = Invoke-Api POST "$base/auth/login" -Body @{ email="hr@altrium.test"; password="wrongpassword" }
Check "Wrong password blocked" ($wrongPw.__error -eq $true -and $wrongPw.__status -eq 401)

$me = Invoke-Api GET "$base/auth/me" -Headers @{Authorization="Bearer $hrToken"}
Check "/me returns correct role" ($me.user.role -eq "HR")

$forgotReal = Invoke-Api POST "$base/auth/forgot-password" -Body @{ email="hr@altrium.test" }
$forgotFake = Invoke-Api POST "$base/auth/forgot-password" -Body @{ email="doesnotexist@altrium.test" }
Check "Forgot-password message identical for real/fake email" ($forgotReal.message -eq $forgotFake.message)

$badReset = Invoke-Api POST "$base/auth/reset-password" -Body @{ token="not-a-real-token"; newPassword="newpassword123" }
Check "Reset with invalid token blocked" ($badReset.__error -eq $true -and $badReset.__status -eq 400)

Write-Host "`n=== 2. VACANCIES ===`n"

$vacBody = @{ title="Regression Test Role $suffix"; department="Engineering"; description="Auto-created by regression script" }
$vac = Invoke-Api POST "$base/vacancies" -Headers @{Authorization="Bearer $hrToken"} -Body $vacBody
Check "HR creates vacancy" ($null -ne $vac.id)
$vacId = $vac.id

$vacByNonHr = Invoke-Api POST "$base/vacancies" -Headers @{Authorization="Bearer $interviewerToken"} -Body $vacBody
Check "Non-HR blocked from creating vacancy" ($vacByNonHr.__error -eq $true -and $vacByNonHr.__status -eq 403)

$vacList = Invoke-Api GET "$base/vacancies" -Headers @{Authorization="Bearer $interviewerToken"}
Check "Any role can list vacancies" ($vacList.Count -gt 0)

$vacOne = Invoke-Api GET "$base/vacancies/$vacId" -Headers @{Authorization="Bearer $managementToken"}
Check "Get single vacancy" ($vacOne.id -eq $vacId)

$vacUpdate = Invoke-Api PATCH "$base/vacancies/$vacId" -Headers @{Authorization="Bearer $hrToken"} -Body @{ description="Updated by regression script" }
Check "HR updates vacancy" ($vacUpdate.description -eq "Updated by regression script")

$stage1 = Invoke-Api POST "$base/vacancies/$vacId/stages" -Headers @{Authorization="Bearer $hrToken"} -Body @{ name="Technical Interview"; order=1 }
Check "HR adds stage" ($null -ne $stage1.id)
$stageId = $stage1.id

$stageUpdate = Invoke-Api PATCH "$base/vacancies/$vacId/stages/$stageId" -Headers @{Authorization="Bearer $hrToken"} -Body @{ name="Tech Interview (Updated)" }
Check "HR updates stage" ($stageUpdate.name -eq "Tech Interview (Updated)")

Write-Host "`n=== 3. CANDIDATES ===`n"

$candBody = @{ name="Regression Candidate $suffix"; email="regression.$suffix@example.com"; phoneNumber="0123456789"; cvUrl="http://example.com/cv.pdf" }
$cand = Invoke-Api POST "$base/candidates" -Headers @{Authorization="Bearer $hrToken"} -Body $candBody
Check "HR creates candidate" ($null -ne $cand.id)
$candId = $cand.id

$candByNonHr = Invoke-Api POST "$base/candidates" -Headers @{Authorization="Bearer $interviewerToken"} -Body $candBody
Check "Non-HR blocked from creating candidate" ($candByNonHr.__error -eq $true -and $candByNonHr.__status -eq 403)

$searchTerm = [uri]::EscapeDataString("Regression Candidate $suffix")
$candSearch = Invoke-Api GET "$base/candidates?search=$searchTerm" -Headers @{Authorization="Bearer $hrToken"}
Check "Search finds new candidate" ($candSearch.Count -eq 1)

$candGet1 = Invoke-Api GET "$base/candidates/$candId" -Headers @{Authorization="Bearer $hrToken"}
Check "HR views candidate (CV review tracked)" ($candGet1.lastCvReviewedBy.role -eq "HR")

$candGet2 = Invoke-Api GET "$base/candidates/$candId" -Headers @{Authorization="Bearer $interviewerToken"}
Check "Interviewer views candidate, overwrites last reviewer" ($candGet2.lastCvReviewedBy.role -eq "INTERVIEWER")

Write-Host "`n=== 4. APPLICATIONS ===`n"

$app = Invoke-Api POST "$base/vacancies/$vacId/applications" -Headers @{Authorization="Bearer $hrToken"} -Body @{ candidateId=$candId }
Check "HR applies candidate to vacancy" ($null -ne $app.id)
$appId = $app.id

$dupApp = Invoke-Api POST "$base/vacancies/$vacId/applications" -Headers @{Authorization="Bearer $hrToken"} -Body @{ candidateId=$candId }
Check "Duplicate application blocked" ($dupApp.__error -eq $true -and $dupApp.__status -eq 409)

$appList = Invoke-Api GET "$base/vacancies/$vacId/applications" -Headers @{Authorization="Bearer $hrToken"}
Check "List applications for vacancy" ($appList.Count -eq 1)

$appGet = Invoke-Api GET "$base/applications/$appId" -Headers @{Authorization="Bearer $hrToken"}
Check "Get single application (nested candidate+vacancy)" ($appGet.candidate.id -eq $candId -and $appGet.vacancy.id -eq $vacId)

$statusUpdate = Invoke-Api PATCH "$base/applications/$appId/status" -Headers @{Authorization="Bearer $hrToken"} -Body @{ status="SHORTLISTED" }
Check "HR shortlists application" ($statusUpdate.status -eq "SHORTLISTED")

$statusByManagement = Invoke-Api PATCH "$base/applications/$appId/status" -Headers @{Authorization="Bearer $managementToken"} -Body @{ status="IN_PROGRESS" }
Check "Management blocked from changing status" ($statusByManagement.__error -eq $true -and $statusByManagement.__status -eq 403)

Write-Host "`n=== 5. INTERVIEWS & PANELISTS ===`n"

$interview = Invoke-Api POST "$base/applications/$appId/interviews" -Headers @{Authorization="Bearer $hrToken"} -Body @{ stageId=$stageId; scheduledAt="2026-09-01T10:00:00.000Z"; panelistUserIds=@($interviewerId) }
Check "HR schedules interview with panelist" ($null -ne $interview.id)
$interviewId = $interview.id

$interviewList = Invoke-Api GET "$base/applications/$appId/interviews" -Headers @{Authorization="Bearer $hrToken"}
Check "List interviews for application" ($interviewList.Count -eq 1)

$interviewGet = Invoke-Api GET "$base/interviews/$interviewId" -Headers @{Authorization="Bearer $hrToken"}
Check "Get single interview" ($interviewGet.id -eq $interviewId)

$myInterviews = Invoke-Api GET "$base/interviews/mine" -Headers @{Authorization="Bearer $interviewerToken"}
Check "Interviewer sees it in /mine" ((($myInterviews | Where-Object { $_.id -eq $interviewId }) | Measure-Object).Count -eq 1)

Write-Host "`n=== 6. FEEDBACK + AUDIT TRAIL ===`n"

$feedback = Invoke-Api POST "$base/interviews/$interviewId/feedback" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ score=7; comments="Solid technical answers." }
Check "Interviewer submits feedback" ($null -ne $feedback.id)
$feedbackId = $feedback.id

$feedbackDup = Invoke-Api POST "$base/interviews/$interviewId/feedback" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ score=8; comments="Second attempt" }
Check "Duplicate feedback from same interviewer blocked" ($feedbackDup.__error -eq $true -and $feedbackDup.__status -eq 409)

$feedbackEdit = Invoke-Api PATCH "$base/feedback/$feedbackId" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ score=8; reason="Reconsidered after reviewing notes" }
Check "Interviewer edits own feedback with reason" ($feedbackEdit.score -eq 8)

$feedbackEditNoReason = Invoke-Api PATCH "$base/feedback/$feedbackId" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ score=9 }
Check "Feedback edit without reason blocked" ($feedbackEditNoReason.__error -eq $true -and $feedbackEditNoReason.__status -eq 400)

$auditLog = Invoke-Api GET "$base/feedback/$feedbackId/audit-log" -Headers @{Authorization="Bearer $hrToken"}
Check "Audit log recorded the edit" ((($auditLog | Measure-Object).Count -eq 1) -and ($auditLog[0].newScore -eq 8))

$feedbackByVacancy = Invoke-Api GET "$base/vacancies/$vacId/feedback" -Headers @{Authorization="Bearer $hmToken"}
Check "HM views feedback for vacancy" ($feedbackByVacancy.Count -eq 1)

Write-Host "`n=== 7. STAGE PROGRESSION ===`n"

$stageProgress = Invoke-Api PATCH "$base/applications/$appId/stage" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ stageId=$stageId }
Check "Interviewer updates application stage" ($stageProgress.currentStage.id -eq $stageId)

$stageProgressByHr = Invoke-Api PATCH "$base/applications/$appId/stage" -Headers @{Authorization="Bearer $hrToken"} -Body @{ stageId=$stageId }
Check "HR blocked from updating stage" ($stageProgressByHr.__error -eq $true -and $stageProgressByHr.__status -eq 403)

Write-Host "`n=== 8. HIRING DECISION + COMPARISON ===`n"

$decision = Invoke-Api PATCH "$base/applications/$appId/decision" -Headers @{Authorization="Bearer $hmToken"} -Body @{ hiringDecision="HIRE" }
Check "HM records hire decision" ($decision.hiringDecision -eq "HIRE" -and $decision.status -eq "HIRED")

$decisionByHr = Invoke-Api PATCH "$base/applications/$appId/decision" -Headers @{Authorization="Bearer $hrToken"} -Body @{ hiringDecision="REJECT" }
Check "HR blocked from recording decision" ($decisionByHr.__error -eq $true -and $decisionByHr.__status -eq 403)

Write-Host "`n=== 9. REPORTS ===`n"

$dashboard = Invoke-Api GET "$base/reports/dashboard" -Headers @{Authorization="Bearer $managementToken"}
Check "Dashboard returns active vacancies" ($dashboard.Count -gt 0)

$stageMonitoring = Invoke-Api GET "$base/reports/stage-monitoring?vacancyId=$vacId" -Headers @{Authorization="Bearer $managementToken"}
Check "Stage monitoring returns data" ($null -ne $stageMonitoring.stages)

$kpis = Invoke-Api GET "$base/reports/kpis?vacancyId=$vacId" -Headers @{Authorization="Bearer $managementToken"}
Check "KPIs reflect the hire" ($kpis.hires -eq 1 -and $kpis.applicationsReceived -eq 1)

$vacReport = Invoke-Api GET "$base/vacancies/$vacId/report" -Headers @{Authorization="Bearer $managementToken"}
Check "Per-vacancy report reflects hire + feedback score" ($vacReport.statusCounts.HIRED -eq 1 -and $vacReport.averageFeedbackScore -eq 8)

Write-Host "`n=== SUMMARY ===`n"
Write-Host "Passed: $pass" -ForegroundColor Green
Write-Host "Failed: $fail" -ForegroundColor Red
if ($fail -gt 0) {
    Write-Host "`nFailed checks:"
    $failures | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
}
Write-Host "`nRegression vacancy created: id=$vacId (title: Regression Test Role $suffix) - safe to leave, or close it via HR UI when done.`n"
