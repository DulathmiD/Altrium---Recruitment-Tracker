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

$hr = Invoke-Api POST "$base/auth/login" -Body @{ email="hr@altrium.com"; password="password123" }
Check "HR login" ($null -ne $hr.token)
$hrToken = $hr.token

$interviewer = Invoke-Api POST "$base/auth/login" -Body @{ email="interviewer@altrium.com"; password="password123" }
Check "Interviewer login" ($null -ne $interviewer.token)
$interviewerToken = $interviewer.token
$interviewerId = $interviewer.user.id

$management = Invoke-Api POST "$base/auth/login" -Body @{ email="management@altrium.com"; password="password123" }
Check "Management login" ($null -ne $management.token)
$managementToken = $management.token

$hm = Invoke-Api POST "$base/auth/login" -Body @{ email="hiringmanager@altrium.com"; password="password123" }
Check "Hiring Manager login" ($null -ne $hm.token)
$hmToken = $hm.token
$hmId = $hm.user.id

$leadership = Invoke-Api POST "$base/auth/login" -Body @{ email="leadership@altrium.com"; password="password123" }
Check "Leadership Management login" ($null -ne $leadership.token)
$leadershipToken = $leadership.token

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

$targetDate = (Get-Date).ToUniversalTime().AddDays(30).ToString("yyyy-MM-dd")
$vacWithTarget = Invoke-Api PATCH "$base/vacancies/$vacId" -Headers @{Authorization="Bearer $hrToken"} -Body @{ targetFillDate=$targetDate }
Check "HR sets a vacancy's target fill date" ($null -ne $vacWithTarget.targetFillDate)

$vacBadTarget = Invoke-Api PATCH "$base/vacancies/$vacId" -Headers @{Authorization="Bearer $hrToken"} -Body @{ targetFillDate="not-a-date" }
Check "Invalid target fill date rejected" ($vacBadTarget.__error -eq $true -and $vacBadTarget.__status -eq 400)

$vacClearedTarget = Invoke-Api PATCH "$base/vacancies/$vacId" -Headers @{Authorization="Bearer $hrToken"} -Body @{ targetFillDate=$null }
Check "Target fill date can be explicitly cleared" ($null -eq $vacClearedTarget.targetFillDate)

Write-Host "`n=== 3. VACANCY INTERVIEWER POOL (US-10) ===`n"

$assignInt = Invoke-Api POST "$base/vacancies/$vacId/interviewers" -Headers @{Authorization="Bearer $hrToken"} -Body @{ userId=$interviewerId }
Check "HR assigns interviewer to vacancy pool" ($null -ne $assignInt.id)

$assignHmToPool = Invoke-Api POST "$base/vacancies/$vacId/interviewers" -Headers @{Authorization="Bearer $hrToken"} -Body @{ userId=$hmId }
Check "HR assigns HM to vacancy pool (management/HM eligible too)" ($null -ne $assignHmToPool.id)

$dupAssign = Invoke-Api POST "$base/vacancies/$vacId/interviewers" -Headers @{Authorization="Bearer $hrToken"} -Body @{ userId=$interviewerId }
Check "Duplicate pool assignment blocked" ($dupAssign.__error -eq $true -and $dupAssign.__status -eq 409)

$poolList = Invoke-Api GET "$base/vacancies/$vacId/interviewers" -Headers @{Authorization="Bearer $hrToken"}
Check "List vacancy interviewer pool" ($poolList.Count -eq 2)

Write-Host "`n=== 3b. STAFF LOOKUP (HR-facing, for panel/HM assignment) ===`n"

$staffAll = Invoke-Api GET "$base/staff" -Headers @{Authorization="Bearer $hrToken"}
Check "HR lists assignable staff (Interviewer/Management/Hiring Manager only)" ($staffAll.Count -ge 2 -and (($staffAll | Where-Object { $_.role -eq "HR" }).Count -eq 0))

$staffHmOnly = Invoke-Api GET "$base/staff?role=HIRING_MANAGER" -Headers @{Authorization="Bearer $hrToken"}
Check "Staff lookup filters by role" (($staffHmOnly | Where-Object { $_.role -ne "HIRING_MANAGER" }).Count -eq 0)

$staffByNonHr = Invoke-Api GET "$base/staff" -Headers @{Authorization="Bearer $interviewerToken"}
Check "Non-HR blocked from staff lookup" ($staffByNonHr.__error -eq $true -and $staffByNonHr.__status -eq 403)

Write-Host "`n=== 4. CANDIDATES (real CV upload -- US-06/US-07, old JSON/CSV endpoints removed) ===`n"

# The old JSON single-candidate and CSV bulk-upload endpoints are gone.
# Guaranteed seeding path for the rest of this script: copy the fixture PDF
# straight into the backend's storage directory (exactly what saveFile()
# would do from a real multipart upload) and go straight to cv-confirm.
# This works on any PowerShell version since it never needs multipart.
$fixturePdf = Join-Path $PSScriptRoot "regression-fixtures\sample-cv.pdf"
$cvDir = Join-Path $PSScriptRoot "backend\uploads\cvs"
New-Item -ItemType Directory -Force -Path $cvDir | Out-Null

$seedFileId = "$([guid]::NewGuid().ToString()).pdf"
Copy-Item -Path $fixturePdf -Destination (Join-Path $cvDir $seedFileId) -Force

$candEmail = "regression.$suffix@example.com"
$confirmBody = @{ candidates = @(@{ fileId = $seedFileId; name = "Regression Candidate $suffix"; email = $candEmail; phoneNumber = "0123456789" }) }
$confirmResult = Invoke-Api POST "$base/candidates/cv-confirm" -Headers @{Authorization="Bearer $hrToken"} -Body $confirmBody
Check "HR confirms CV upload -> candidate created" ($confirmResult.createdCount -eq 1 -and $confirmResult.created[0].email -eq $candEmail)
$candId = $confirmResult.created[0].candidateId

$oldSingle = Invoke-Api POST "$base/candidates" -Headers @{Authorization="Bearer $hrToken"} -Body @{ name="x"; email="x@example.com" }
Check "Old JSON single-candidate endpoint removed (404)" ($oldSingle.__error -eq $true -and $oldSingle.__status -eq 404)

$oldBulk = Invoke-Api POST "$base/candidates/bulk" -Headers @{Authorization="Bearer $hrToken"}
Check "Old CSV bulk-upload endpoint removed (404)" ($oldBulk.__error -eq $true -and $oldBulk.__status -eq 404)

if ($PSVersionTable.PSVersion.Major -ge 6) {
    Write-Host "`n--- 4b. Real multipart cv-extract, end to end (PS $($PSVersionTable.PSVersion.Major)+ supports -Form) ---`n"

    $extractResult = Invoke-RestMethod -Method POST -Uri "$base/candidates/cv-extract" -Headers @{Authorization="Bearer $hrToken"} -Form @{ files = Get-Item $fixturePdf }
    $extractedFile = $extractResult.files[0]
    Check "cv-extract parses name from a real uploaded PDF" ($extractedFile.extractedName -eq "Jordan RegressionCandidate")
    Check "cv-extract parses email from a real uploaded PDF" ($extractedFile.extractedEmail -eq "jordan.fixture@example.com")
    Check "cv-extract parses phone from a real uploaded PDF" ($null -ne $extractedFile.extractedPhone)

    $multipartEmail = "regression.multipart.$suffix@example.com"
    $confirmBody2 = @{ candidates = @(@{ fileId = $extractedFile.fileId; name = $extractedFile.extractedName; email = $multipartEmail; phoneNumber = $extractedFile.extractedPhone }) }
    $confirmResult2 = Invoke-Api POST "$base/candidates/cv-confirm" -Headers @{Authorization="Bearer $hrToken"} -Body $confirmBody2
    Check "Real multipart upload -> extract -> confirm creates a candidate" ($confirmResult2.createdCount -eq 1)
    $multipartCandId = $confirmResult2.created[0].candidateId

    $download = Invoke-WebRequest -Uri "$base/candidates/$multipartCandId/cv" -Headers @{Authorization="Bearer $hrToken"} -UseBasicParsing
    Check "CV download endpoint serves a real PDF" ($download.Headers["Content-Type"] -eq "application/pdf" -and $download.Content.Length -gt 0)
} else {
    Write-Host "PowerShell $($PSVersionTable.PSVersion.Major) detected -- Invoke-RestMethod has no -Form support here, so the real multipart cv-extract path can't be automated. Covered by the filesystem-seed path above (exercises cv-confirm's create/rename/audit-log logic) plus manual testing of the actual file-upload UI." -ForegroundColor Yellow
}

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

Write-Host "`n=== 5b. CONFIGURABLE INTERVIEW ROUNDS (US-05) ===`n"

# Empty-rounds dead end, checked BEFORE any round exists on this vacancy: a
# shortlisted candidate cannot be advanced into the interview process at all
# yet. No default round is auto-seeded per the decided design.
$advanceWithNoRounds = Invoke-Api POST "$base/applications/$appId/recommendation" -Headers @{Authorization="Bearer $hmToken"} -Body @{ recommendation="ADVANCE" }
Check "ADVANCE blocked when vacancy has zero interview rounds configured" ($advanceWithNoRounds.__error -eq $true -and $advanceWithNoRounds.__status -eq 400)

$stagesInitial = Invoke-Api GET "$base/vacancies/$vacId/stages" -Headers @{Authorization="Bearer $hrToken"}
Check "New vacancy starts with zero rounds, unlocked" ($stagesInitial.stages.Count -eq 0 -and $stagesInitial.locked -eq $false)

$round1 = Invoke-Api POST "$base/vacancies/$vacId/stages" -Headers @{Authorization="Bearer $hrToken"} -Body @{ name="Interview 1" }
Check "HR creates round 1" ($null -ne $round1.id -and $round1.order -eq 1)
$round2 = Invoke-Api POST "$base/vacancies/$vacId/stages" -Headers @{Authorization="Bearer $hrToken"} -Body @{ name="Interview 2" }
Check "HR creates round 2" ($round2.order -eq 2)
$round3 = Invoke-Api POST "$base/vacancies/$vacId/stages" -Headers @{Authorization="Bearer $hrToken"} -Body @{ name="Final Interview" }
Check "HR creates round 3" ($round3.order -eq 3)

$roundRename = Invoke-Api PATCH "$base/vacancies/$vacId/stages/$($round2.id)" -Headers @{Authorization="Bearer $hrToken"} -Body @{ name="Technical Interview" }
Check "HR renames a round while unlocked" ($roundRename.name -eq "Technical Interview")
$roundRename2 = Invoke-Api PATCH "$base/vacancies/$vacId/stages/$($round2.id)" -Headers @{Authorization="Bearer $hrToken"} -Body @{ name="Interview 2" }
Check "Round renamed back for the rest of the script's assumptions" ($roundRename2.name -eq "Interview 2")

Write-Host "`n=== 6. INTERVIEW SCHEDULING + CONFLICT CHECK (US-11) ===`n"

# Was a hardcoded literal -- every other piece of test data in this script is
# suffixed to stay unique across re-runs, but this one wasn't, so repeated runs
# collided with a real leftover interview row from a previous run (same
# interviewer, same exact timestamp -> the US-11 conflict check correctly
# rejected it as a genuine conflict, not a bug). Derived from the real current
# time instead so it's unique per run, same as everything else here.
# Must be in the PAST (not future, as originally written): section 9 submits
# real feedback against interview1Id right after this, and submitFeedback now
# gates on interview.scheduledAt <= now (added alongside the Interviewer
# screens build) -- a future-dated interview here would make that submission
# 400 instead of succeeding.
$scheduledTime = (Get-Date).ToUniversalTime().AddDays(-14).ToString("yyyy-MM-ddTHH:mm:ss.000Z")
$interview1 = Invoke-Api POST "$base/applications/$appId/interviews" -Headers @{Authorization="Bearer $hrToken"} -Body @{ vacancyStageId=$round1.id; scheduledAt=$scheduledTime; panelistUserIds=@($interviewerId) }
Check "HR schedules round 1 interview with assigned panelist" ($null -ne $interview1.id)
$interview1Id = $interview1.id

$notInPool = Invoke-Api POST "$base/applications/$appId/interviews" -Headers @{Authorization="Bearer $hrToken"} -Body @{ vacancyStageId=$round1.id; scheduledAt="2026-09-11T10:00:00.000Z"; panelistUserIds=@(999999) }
Check "Scheduling with a panelist not in the vacancy pool blocked" ($notInPool.__error -eq $true -and $notInPool.__status -eq 400)

# Second application, same panelist, same exact time -> should conflict
$seedFileId2 = "$([guid]::NewGuid().ToString()).pdf"
Copy-Item -Path $fixturePdf -Destination (Join-Path $cvDir $seedFileId2) -Force
$cand2Email = "regressionb.$suffix@example.com"
$cand2ConfirmBody = @{ candidates = @(@{ fileId = $seedFileId2; name = "Regression Candidate B $suffix"; email = $cand2Email; phoneNumber = "0123456789" }) }
$cand2Confirm = Invoke-Api POST "$base/candidates/cv-confirm" -Headers @{Authorization="Bearer $hrToken"} -Body $cand2ConfirmBody
$cand2 = [PSCustomObject]@{ id = $cand2Confirm.created[0].candidateId }
$app2 = Invoke-Api POST "$base/vacancies/$vacId/applications" -Headers @{Authorization="Bearer $hrToken"} -Body @{ candidateId=$cand2.id }

$scheduleBeforeShortlist = Invoke-Api POST "$base/applications/$($app2.id)/interviews" -Headers @{Authorization="Bearer $hrToken"} -Body @{ vacancyStageId=$round1.id; scheduledAt=$scheduledTime; panelistUserIds=@($interviewerId) }
Check "Scheduling blocked for a still-APPLIED (not yet shortlisted) application" ($scheduleBeforeShortlist.__error -eq $true -and $scheduleBeforeShortlist.__status -eq 400)

Invoke-Api PATCH "$base/applications/$($app2.id)/status" -Headers @{Authorization="Bearer $hrToken"} -Body @{ status="SHORTLISTED" } | Out-Null
$conflictInterview = Invoke-Api POST "$base/applications/$($app2.id)/interviews" -Headers @{Authorization="Bearer $hrToken"} -Body @{ vacancyStageId=$round1.id; scheduledAt=$scheduledTime; panelistUserIds=@($interviewerId) }
Check "Scheduling conflict (same panelist, same exact time) blocked" ($conflictInterview.__error -eq $true -and $conflictInterview.__status -eq 409)

Write-Host "`n=== 7. STAGE PROGRESSION VIA HM RECOMMENDATION (US-19/US-31, binding model) ===`n"
# The old PATCH /applications/:id/stage endpoint (Interviewer/HR-driven) was
# removed earlier this project when the model changed to "HM's recommendation
# IS the decision" -- see docs/project-decisions-log.md, "Correction:
# HR-authority version above was itself superseded". The only way to advance
# an application's stage now is POST /:id/recommendation (HIRING_MANAGER only),
# and ADVANCE always moves exactly one round forward -- there's no way to
# specify an arbitrary target round anymore, so "no skip" is structural.
#
# Under the US-05 redesign, `stage` no longer changes while a candidate moves
# through interview rounds -- it stays SHORTLISTED, and
# currentVacancyStageId/currentVacancyStage is what actually tracks round
# progression. See docs/project-decisions-log.md, "Built: IT Admin frontend"
# entry's sibling US-05 sections for the full design.

$recommendByHr = Invoke-Api POST "$base/applications/$appId/recommendation" -Headers @{Authorization="Bearer $hrToken"} -Body @{ recommendation="ADVANCE" }
Check "HR blocked from submitting recommendation (HM only)" ($recommendByHr.__error -eq $true -and $recommendByHr.__status -eq 403)

$recommendByInterviewer = Invoke-Api POST "$base/applications/$appId/recommendation" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ recommendation="ADVANCE" }
Check "Interviewer blocked from submitting recommendation (HM only)" ($recommendByInterviewer.__error -eq $true -and $recommendByInterviewer.__status -eq 403)

$advance1 = Invoke-Api POST "$base/applications/$appId/recommendation" -Headers @{Authorization="Bearer $hmToken"} -Body @{ recommendation="ADVANCE"; comments="Good first-round performance" }
Check "HM submits ADVANCE recommendation" ($null -ne $advance1.id)

$appAfterAdvance1 = Invoke-Api GET "$base/applications/$appId" -Headers @{Authorization="Bearer $hrToken"}
Check "ADVANCE is binding: enters round 1, stage stays SHORTLISTED" ($appAfterAdvance1.stage -eq "SHORTLISTED" -and $appAfterAdvance1.currentVacancyStage.id -eq $round1.id)

$stagesAfterFirstEntry = Invoke-Api GET "$base/vacancies/$vacId/stages" -Headers @{Authorization="Bearer $hrToken"}
Check "Round list locks once a candidate has entered a round" ($stagesAfterFirstEntry.locked -eq $true)
$blockedCreate = Invoke-Api POST "$base/vacancies/$vacId/stages" -Headers @{Authorization="Bearer $hrToken"} -Body @{ name="Extra Round" }
Check "Creating a round is blocked once locked" ($blockedCreate.__error -eq $true -and $blockedCreate.__status -eq 400)
$blockedRename = Invoke-Api PATCH "$base/vacancies/$vacId/stages/$($round1.id)" -Headers @{Authorization="Bearer $hrToken"} -Body @{ name="Renamed" }
Check "Renaming a round is blocked once locked" ($blockedRename.__error -eq $true -and $blockedRename.__status -eq 400)
$blockedDelete = Invoke-Api DELETE "$base/vacancies/$vacId/stages/$($round3.id)" -Headers @{Authorization="Bearer $hrToken"}
Check "Deleting a round is blocked once locked" ($blockedDelete.__error -eq $true -and $blockedDelete.__status -eq 400)

Invoke-Api POST "$base/applications/$appId/recommendation" -Headers @{Authorization="Bearer $hmToken"} -Body @{ recommendation="ADVANCE" } | Out-Null
$appAfterAdvance2 = Invoke-Api GET "$base/applications/$appId" -Headers @{Authorization="Bearer $hrToken"}
Check "Second ADVANCE: round 1 -> round 2" ($appAfterAdvance2.currentVacancyStage.id -eq $round2.id)

Invoke-Api POST "$base/applications/$appId/recommendation" -Headers @{Authorization="Bearer $hmToken"} -Body @{ recommendation="ADVANCE" } | Out-Null
$appAfterAdvance3 = Invoke-Api GET "$base/applications/$appId" -Headers @{Authorization="Bearer $hrToken"}
Check "Third ADVANCE: round 2 -> round 3 (final)" ($appAfterAdvance3.currentVacancyStage.id -eq $round3.id)

$advanceBeyondFinal = Invoke-Api POST "$base/applications/$appId/recommendation" -Headers @{Authorization="Bearer $hmToken"} -Body @{ recommendation="ADVANCE" }
Check "ADVANCE from the final round blocked (must use hiring decision endpoint instead)" ($advanceBeyondFinal.__error -eq $true -and $advanceBeyondFinal.__status -eq 400)

$appFinalRecommendations = Invoke-Api GET "$base/applications/$appId" -Headers @{Authorization="Bearer $hrToken"}
Check "All 3 successful recommendations visible to HR (the blocked 4th call never created a row)" ($appFinalRecommendations.recommendations.Count -eq 3)

Write-Host "`n=== 8. HM RECOMMENDATION -- REJECTION PATH (DO_NOT_PROGRESS) ===`n"

# Bug found while adding US-14/US-25 coverage: this section used to reject
# $app2 itself via DO_NOT_PROGRESS, but $app2 is reused from section 10b
# onward (past-dated interview, feedback, HM assignment/ADVANCE, Pending
# Decisions, Candidate Comparison) under the assumption it's still
# SHORTLISTED -- rejecting it here would make every one of those downstream
# checks fail for real once this script is actually run (scheduleInterview's
# stage gate 400s on a REJECTED application). Fixed by giving the rejection
# path its own dedicated application instead of reusing $app2.
$seedFileIdReject = "$([guid]::NewGuid().ToString()).pdf"
Copy-Item -Path $fixturePdf -Destination (Join-Path $cvDir $seedFileIdReject) -Force
$candRejectEmail = "regressionreject.$suffix@example.com"
$candRejectConfirm = Invoke-Api POST "$base/candidates/cv-confirm" -Headers @{Authorization="Bearer $hrToken"} -Body @{ candidates = @(@{ fileId = $seedFileIdReject; name = "Regression Candidate Reject $suffix"; email = $candRejectEmail }) }
$candRejectId = $candRejectConfirm.created[0].candidateId
$appReject = Invoke-Api POST "$base/vacancies/$vacId/applications" -Headers @{Authorization="Bearer $hrToken"} -Body @{ candidateId=$candRejectId }
Invoke-Api PATCH "$base/applications/$($appReject.id)/status" -Headers @{Authorization="Bearer $hrToken"} -Body @{ status="SHORTLISTED" } | Out-Null

$doNotProgress = Invoke-Api POST "$base/applications/$($appReject.id)/recommendation" -Headers @{Authorization="Bearer $hmToken"} -Body @{ recommendation="DO_NOT_PROGRESS" }
Check "HM submits DO_NOT_PROGRESS recommendation" ($null -ne $doNotProgress.id)

$appRejectAfterReject = Invoke-Api GET "$base/applications/$($appReject.id)" -Headers @{Authorization="Bearer $hrToken"}
Check "DO_NOT_PROGRESS is binding: moves straight to REJECTED" ($appRejectAfterReject.stage -eq "REJECTED")

$recommendOnRejected = Invoke-Api POST "$base/applications/$($appReject.id)/recommendation" -Headers @{Authorization="Bearer $hmToken"} -Body @{ recommendation="ADVANCE" }
Check "Recommendation blocked on an application that already reached a final outcome" ($recommendOnRejected.__error -eq $true -and $recommendOnRejected.__status -eq 400)

Write-Host "`n=== 9. FEEDBACK ===`n"

# Score range validation (flagged in wireframe review round 1, never actually
# built until now) -- checked before the real submission so a rejected
# attempt can't collide with the later valid one (Feedback has a unique
# interviewId+interviewerId constraint).
$feedbackTooHigh = Invoke-Api POST "$base/interviews/$interview1Id/feedback" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ score=11; comments="x" }
Check "Feedback score above 10 rejected" ($feedbackTooHigh.__error -eq $true -and $feedbackTooHigh.__status -eq 400)

$feedbackTooLow = Invoke-Api POST "$base/interviews/$interview1Id/feedback" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ score=0; comments="x" }
Check "Feedback score below 1 rejected" ($feedbackTooLow.__error -eq $true -and $feedbackTooLow.__status -eq 400)

$feedbackNonInteger = Invoke-Api POST "$base/interviews/$interview1Id/feedback" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ score=7.5; comments="x" }
Check "Non-integer feedback score rejected" ($feedbackNonInteger.__error -eq $true -and $feedbackNonInteger.__status -eq 400)

$feedback = Invoke-Api POST "$base/interviews/$interview1Id/feedback" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ score=8; comments="Strong technical answers." }
Check "Interviewer submits feedback" ($null -ne $feedback.id)
$feedbackId = $feedback.id

$feedbackEditBadScore = Invoke-Api PATCH "$base/feedback/$feedbackId" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ score=15; reason="x" }
Check "Editing feedback to an out-of-range score rejected" ($feedbackEditBadScore.__error -eq $true -and $feedbackEditBadScore.__status -eq 400)

$feedbackEdit = Invoke-Api PATCH "$base/feedback/$feedbackId" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ score=9; reason="Reconsidered after reviewing notes" }
Check "Interviewer edits own feedback with reason" ($feedbackEdit.score -eq 9)

$auditLog = Invoke-Api GET "$base/feedback/$feedbackId/audit-log" -Headers @{Authorization="Bearer $hrToken"}
Check "Audit log recorded the edit" ((($auditLog | Measure-Object).Count -eq 1) -and ($auditLog[0].newScore -eq 9))

Write-Host "`n=== 9b. FEEDBACK TIME GATE + VISIBILITY SCOPING (Interviewer screens build) ===`n"

# Time gate: submitFeedback now requires the interview to already have taken
# place ("can't have a valid opinion on an interview that hasn't happened
# yet") -- self-identified while building the Interviewer Feedback screen,
# not previously covered. A future-dated interview must reject feedback 400.
$futureTime = (Get-Date).ToUniversalTime().AddDays(10).ToString("yyyy-MM-ddTHH:mm:ss.000Z")

# Dedicated VACANCY (not $vacId) for this section and 10f below -- not just a
# dedicated candidate. Bug found on the first live run: $appScope originally
# reused $vacId, and giving it feedback there silently changed $app2's
# Candidate Comparison rank (section 10c asserts $app2 is rank 1 with the
# vacancy's highest score) instead of testing anything new. A fully separate
# vacancy keeps this section's data from touching any of $vacId's existing
# exact-value assertions.
$vacScopeBody = @{ title="Regression Scope Role $suffix"; department="Engineering"; description="Auto-created for Interviewer screens regression coverage" }
$vacScope = Invoke-Api POST "$base/vacancies" -Headers @{Authorization="Bearer $hrToken"} -Body $vacScopeBody
Check "HR creates a dedicated vacancy for the feedback-scoping tests" ($null -ne $vacScope.id)

$vacScopeRound1 = Invoke-Api POST "$base/vacancies/$($vacScope.id)/stages" -Headers @{Authorization="Bearer $hrToken"} -Body @{ name="Interview 1" }
$vacScopeRound2 = Invoke-Api POST "$base/vacancies/$($vacScope.id)/stages" -Headers @{Authorization="Bearer $hrToken"} -Body @{ name="Interview 2" }
Check "HR creates rounds on the scope vacancy" ($null -ne $vacScopeRound1.id -and $null -ne $vacScopeRound2.id)

Invoke-Api POST "$base/vacancies/$($vacScope.id)/interviewers" -Headers @{Authorization="Bearer $hrToken"} -Body @{ userId=$interviewerId } | Out-Null

$seedFileIdScope = "$([guid]::NewGuid().ToString()).pdf"
Copy-Item -Path $fixturePdf -Destination (Join-Path $cvDir $seedFileIdScope) -Force
$candScopeEmail = "regressionscope.$suffix@example.com"
$candScopeConfirm = Invoke-Api POST "$base/candidates/cv-confirm" -Headers @{Authorization="Bearer $hrToken"} -Body @{ candidates = @(@{ fileId = $seedFileIdScope; name = "Regression Candidate Scope $suffix"; email = $candScopeEmail }) }
$candScopeId = $candScopeConfirm.created[0].candidateId
$appScope = Invoke-Api POST "$base/vacancies/$($vacScope.id)/applications" -Headers @{Authorization="Bearer $hrToken"} -Body @{ candidateId=$candScopeId }
Invoke-Api PATCH "$base/applications/$($appScope.id)/status" -Headers @{Authorization="Bearer $hrToken"} -Body @{ status="SHORTLISTED" } | Out-Null

$futureInterview = Invoke-Api POST "$base/applications/$($appScope.id)/interviews" -Headers @{Authorization="Bearer $hrToken"} -Body @{ vacancyStageId=$vacScopeRound2.id; scheduledAt=$futureTime; panelistUserIds=@($interviewerId) }
Check "HR schedules a future-dated interview for the time-gate test" ($null -ne $futureInterview.id)

$futureFeedback = Invoke-Api POST "$base/interviews/$($futureInterview.id)/feedback" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ score=8; comments="Too soon" }
Check "Feedback blocked for an interview that hasn't happened yet" ($futureFeedback.__error -eq $true -and $futureFeedback.__status -eq 400)

# Second interviewer, for the peer-visibility scoping test below (only one
# interviewer exists in the seed data).
$adminForScope = Invoke-Api POST "$base/auth/admin-login" -Body @{ email="itadmin@altrium.com"; password="password123" }
$adminScopeToken = $adminForScope.token
$interviewer2Email = "regression.interviewer2.$suffix@example.com"
$interviewer2 = Invoke-Api POST "$base/users" -Headers @{Authorization="Bearer $adminScopeToken"} -Body @{ name="Regression Interviewer 2 $suffix"; email=$interviewer2Email; password="password123"; role="INTERVIEWER" }
Check "Second interviewer account created for visibility scoping test" ($null -ne $interviewer2.id)
$interviewer2Login = Invoke-Api POST "$base/auth/login" -Body @{ email=$interviewer2Email; password="password123" }
$interviewer2Token = $interviewer2Login.token
$interviewer2Id = $interviewer2Login.user.id

Invoke-Api POST "$base/vacancies/$($vacScope.id)/interviewers" -Headers @{Authorization="Bearer $hrToken"} -Body @{ userId=$interviewer2Id } | Out-Null

$pastTimeScope = (Get-Date).ToUniversalTime().AddDays(-5).ToString("yyyy-MM-ddTHH:mm:ss.000Z")
$panelInterview = Invoke-Api POST "$base/applications/$($appScope.id)/interviews" -Headers @{Authorization="Bearer $hrToken"} -Body @{ vacancyStageId=$vacScopeRound1.id; scheduledAt=$pastTimeScope; panelistUserIds=@($interviewerId, $interviewer2Id) }
Check "HR schedules a two-panelist past interview for the visibility test" ($null -ne $panelInterview.id)

Invoke-Api POST "$base/interviews/$($panelInterview.id)/feedback" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ score=6; comments="Panelist A view" } | Out-Null
Invoke-Api POST "$base/interviews/$($panelInterview.id)/feedback" -Headers @{Authorization="Bearer $interviewer2Token"} -Body @{ score=9; comments="Panelist B view" } | Out-Null

$feedbackAsInterviewer1 = Invoke-Api GET "$base/interviews/$($panelInterview.id)/feedback" -Headers @{Authorization="Bearer $interviewerToken"}
Check "Interviewer only sees their own feedback on a shared interview (US-25 is HM-only)" (@($feedbackAsInterviewer1).Count -eq 1 -and $feedbackAsInterviewer1[0].score -eq 6)

$feedbackAsInterviewer2 = Invoke-Api GET "$base/interviews/$($panelInterview.id)/feedback" -Headers @{Authorization="Bearer $interviewer2Token"}
Check "The other interviewer likewise only sees their own feedback" (@($feedbackAsInterviewer2).Count -eq 1 -and $feedbackAsInterviewer2[0].score -eq 9)

$feedbackAsHr = Invoke-Api GET "$base/interviews/$($panelInterview.id)/feedback" -Headers @{Authorization="Bearer $hrToken"}
Check "HR (non-Interviewer) still sees both panelists' feedback" (@($feedbackAsHr).Count -eq 2)

$vacFeedbackAsInterviewer1 = Invoke-Api GET "$base/vacancies/$($vacScope.id)/feedback" -Headers @{Authorization="Bearer $interviewerToken"}
Check "Vacancy-level feedback listing is scoped the same way for an Interviewer" (@($vacFeedbackAsInterviewer1 | Where-Object { $_.interviewId -eq $panelInterview.id -and $_.interviewerId -ne $interviewerId }).Count -eq 0)

Write-Host "`n=== 10. HIRING DECISION ===`n"

$decision = Invoke-Api PATCH "$base/applications/$appId/decision" -Headers @{Authorization="Bearer $hmToken"} -Body @{ hiringDecision="HIRE" }
Check "HM records hire decision" ($decision.hiringDecision -eq "HIRE" -and $decision.stage -eq "HIRED")

$appFinal = Invoke-Api GET "$base/applications/$appId" -Headers @{Authorization="Bearer $hrToken"}
Check "Stage history has 6 entries (Applied/Shortlisted/Int1/Int2/Final/Hired)" ($appFinal.stageHistory.Count -eq 6)
Check "All but the last history entry are closed (exitedAt set)" ((($appFinal.stageHistory | Select-Object -First 5) | Where-Object { $null -eq $_.exitedAt }).Count -eq 0)

Write-Host "`n=== 10a. CANDIDATES LIST + FILTERS (US-13/US-14) ===`n"

# GET /candidates had zero regression coverage before this -- found while
# wiring up the frontend's Status/Score filters. $appId is now HIRED with a
# feedback score of 9 (from section 9/10 above); used as the positive case
# for stage/score filtering below.
$allCandidates = Invoke-Api GET "$base/candidates" -Headers @{Authorization="Bearer $hrToken"}
Check "Candidates list returns one row per candidate-application, not per candidate" (@($allCandidates | Where-Object { $_.id -eq $appId }).Count -eq 1)

$candidatesBySearch = Invoke-Api GET "$base/candidates?search=$candEmail" -Headers @{Authorization="Bearer $hrToken"}
Check "Search filter matches by email" (@($candidatesBySearch | Where-Object { $_.id -eq $appId }).Count -eq 1)

$candidatesByStage = Invoke-Api GET "$base/candidates?stage=HIRED" -Headers @{Authorization="Bearer $hrToken"}
Check "Stage filter returns only HIRED applications, including appId" (@($candidatesByStage | Where-Object { $_.id -eq $appId }).Count -eq 1 -and @($candidatesByStage | Where-Object { $_.stage -ne "HIRED" }).Count -eq 0)

$candidatesByVacancy = Invoke-Api GET "$base/candidates?vacancyId=$vacId" -Headers @{Authorization="Bearer $hrToken"}
Check "Vacancy filter scopes to the regression vacancy" (@($candidatesByVacancy | Where-Object { $_.vacancyId -ne $vacId }).Count -eq 0 -and @($candidatesByVacancy).Count -ge 1)

$candidatesByMinScore = Invoke-Api GET "$base/candidates?minScore=9" -Headers @{Authorization="Bearer $hrToken"}
Check "Score filter (minScore=9) includes appId (feedback score 9)" (@($candidatesByMinScore | Where-Object { $_.id -eq $appId }).Count -eq 1)

$candidatesByHighMinScore = Invoke-Api GET "$base/candidates?minScore=10" -Headers @{Authorization="Bearer $hrToken"}
Check "Score filter (minScore=10) excludes appId (no feedback scored 10)" (@($candidatesByHighMinScore | Where-Object { $_.id -eq $appId }).Count -eq 0)

$candidatesByNonHr = Invoke-Api GET "$base/candidates" -Headers @{Authorization="Bearer $interviewerToken"}
Check "Interviewer can also list candidates (not HR-exclusive)" ($candidatesByNonHr.__error -ne $true)

Write-Host "`n=== 10b. FOLLOW-UPS (US-26/US-29) ===`n"

# Pending CV Review: a fresh candidate applied but never shortlisted/rejected.
$seedFileId3 = "$([guid]::NewGuid().ToString()).pdf"
Copy-Item -Path $fixturePdf -Destination (Join-Path $cvDir $seedFileId3) -Force
$cand3Email = "regressionc.$suffix@example.com"
$cand3Confirm = Invoke-Api POST "$base/candidates/cv-confirm" -Headers @{Authorization="Bearer $hrToken"} -Body @{ candidates = @(@{ fileId = $seedFileId3; name = "Regression Candidate C $suffix"; email = $cand3Email }) }
$cand3Id = $cand3Confirm.created[0].candidateId
$app3 = Invoke-Api POST "$base/vacancies/$vacId/applications" -Headers @{Authorization="Bearer $hrToken"} -Body @{ candidateId=$cand3Id }

$followUpsBeforeReview = Invoke-Api GET "$base/follow-ups" -Headers @{Authorization="Bearer $hrToken"}
Check "Pending CV review list includes a fresh APPLIED application" (@($followUpsBeforeReview.pendingCvReviews | Where-Object { $_.applicationId -eq $app3.id }).Count -eq 1)

Invoke-Api PATCH "$base/applications/$($app3.id)/status" -Headers @{Authorization="Bearer $hrToken"} -Body @{ status="SHORTLISTED" } | Out-Null
$followUpsAfterReview = Invoke-Api GET "$base/follow-ups" -Headers @{Authorization="Bearer $hrToken"}
Check "Shortlisting removes it from the pending CV review list" (@($followUpsAfterReview.pendingCvReviews | Where-Object { $_.applicationId -eq $app3.id }).Count -eq 0)

# Pending Feedback: a new interview deliberately scheduled in the past for
# app2 (still SHORTLISTED), with no feedback submitted yet.
$pastTime = (Get-Date).ToUniversalTime().AddDays(-3).ToString("yyyy-MM-ddTHH:mm:ss.000Z")
$pastInterview = Invoke-Api POST "$base/applications/$($app2.id)/interviews" -Headers @{Authorization="Bearer $hrToken"} -Body @{ vacancyStageId=$round1.id; scheduledAt=$pastTime; panelistUserIds=@($interviewerId) }
Check "HR schedules a past-dated interview for follow-up testing" ($null -ne $pastInterview.id)

$followUpsWithPending = Invoke-Api GET "$base/follow-ups" -Headers @{Authorization="Bearer $hrToken"}
$pendingRow = $followUpsWithPending.pendingFeedback | Where-Object { $_.interviewId -eq $pastInterview.id }
Check "Past interview with no feedback shows up as Pending Feedback" ($null -ne $pendingRow -and @($pendingRow.pendingFrom | Where-Object { $_.id -eq $interviewerId }).Count -eq 1)

Check "Already-hired application's interview (feedback submitted) is not in the pending list" (($followUpsWithPending.pendingFeedback | Where-Object { $_.interviewId -eq $interview1Id }).Count -eq 0)

$reminderSend = Invoke-Api POST "$base/interviews/$($pastInterview.id)/panelists/$interviewerId/remind" -Headers @{Authorization="Bearer $hrToken"} -Body @{ subject="Reminder"; message="Please submit your feedback." }
Check "HR sends a manual feedback reminder" ($reminderSend.sent -eq $true)

$reminderByNonHr = Invoke-Api POST "$base/interviews/$($pastInterview.id)/panelists/$interviewerId/remind" -Headers @{Authorization="Bearer $managementToken"} -Body @{ subject="x"; message="x" }
Check "Non-HR blocked from sending reminders" ($reminderByNonHr.__error -eq $true -and $reminderByNonHr.__status -eq 403)

Invoke-Api POST "$base/interviews/$($pastInterview.id)/feedback" -Headers @{Authorization="Bearer $interviewerToken"} -Body @{ score=7; comments="Solid, no major concerns." } | Out-Null
$followUpsAfterFeedback = Invoke-Api GET "$base/follow-ups" -Headers @{Authorization="Bearer $hrToken"}
Check "Submitting feedback removes it from the pending feedback list" (($followUpsAfterFeedback.pendingFeedback | Where-Object { $_.interviewId -eq $pastInterview.id }).Count -eq 0)

$reminderAfterSubmitted = Invoke-Api POST "$base/interviews/$($pastInterview.id)/panelists/$interviewerId/remind" -Headers @{Authorization="Bearer $hrToken"} -Body @{ subject="x"; message="x" }
Check "Reminding an interviewer who already submitted feedback blocked" ($reminderAfterSubmitted.__error -eq $true -and $reminderAfterSubmitted.__status -eq 400)

Write-Host "`n=== 10c. HIRING MANAGER DASHBOARD/VACANCIES/PENDING DECISIONS ===`n"

# app2 has no formal HM assignment yet (regression never called assign-hm on
# it) -- assign one, then advance it into round1 so it has a
# currentVacancyStageId. round1's only interview for app2 (pastInterview,
# from the Follow-ups section above) already has feedback submitted, so it
# should immediately qualify as "ready for decision".
Invoke-Api PATCH "$base/applications/$($app2.id)/assign-hm" -Headers @{Authorization="Bearer $hrToken"} -Body @{ hiringManagerId=$hmId } | Out-Null
Invoke-Api POST "$base/applications/$($app2.id)/recommendation" -Headers @{Authorization="Bearer $hmToken"} -Body @{ recommendation="ADVANCE" } | Out-Null

$hmVacancies = Invoke-Api GET "$base/hiring-manager/vacancies" -Headers @{Authorization="Bearer $hmToken"}
$hmVac = $hmVacancies | Where-Object { $_.id -eq $vacId }
Check "HM's vacancies list includes a vacancy they have an assigned application on" ($null -ne $hmVac)
Check "HM vacancy row's Current Stage reflects the furthest active round" ($hmVac.currentStage -like "Round 1*")

$hmDashboard = Invoke-Api GET "$base/hiring-manager/dashboard" -Headers @{Authorization="Bearer $hmToken"}
Check "HM dashboard counts this as an open vacancy" ($hmDashboard.openVacancies -ge 1)
Check "HM dashboard shows at least 1 application awaiting decision" ($hmDashboard.awaitingMyDecision -ge 1)

$hmPending = Invoke-Api GET "$base/hiring-manager/pending-decisions" -Headers @{Authorization="Bearer $hmToken"}
$pendingApp2 = $hmPending | Where-Object { $_.applicationId -eq $app2.id }
Check "Pending decisions includes app2, ready because round1's feedback is complete" ($null -ne $pendingApp2)
Check "Pending decision score reflects the latest round's feedback only" ($pendingApp2.score -eq 7)
Check "Pending decision correctly flags round1 as not the final round (3 rounds configured)" ($pendingApp2.isFinalRound -eq $false)
Check "Pending decision surfaces the interviewer's comment" ($pendingApp2.commentsAvailable -eq $true -and $pendingApp2.comments -contains "Solid, no major concerns.")

# US-25: shared interview feedback visibility -- feedbackHistory attributes
# round1's feedback to the actual interviewer who gave it (not anonymized).
$round1History = $pendingApp2.feedbackHistory | Where-Object { $_.round.order -eq 1 }
Check "Pending decision's feedback history includes round 1" ($null -ne $round1History)
$ianEntry = $round1History.entries | Where-Object { $_.interviewerName -eq "Ian Interviewer" }
Check "Feedback history attributes round 1's feedback to the interviewer by name" ($null -ne $ianEntry -and $ianEntry.score -eq 7 -and $ianEntry.comments -eq "Solid, no major concerns.")

$hmEndpointByNonHm = Invoke-Api GET "$base/hiring-manager/dashboard" -Headers @{Authorization="Bearer $hrToken"}
Check "Non-Hiring-Manager blocked from HM dashboard" ($hmEndpointByNonHm.__error -eq $true -and $hmEndpointByNonHm.__status -eq 403)

# Candidate Comparison -- app2 (score 7 from round1's feedback) is the only
# shortlisted candidate with any feedback on this vacancy right now.
$comparison = Invoke-Api GET "$base/hiring-manager/vacancies/$vacId/comparison" -Headers @{Authorization="Bearer $hmToken"}
$comparisonApp2 = $comparison.topCandidates | Where-Object { $_.applicationId -eq $app2.id }
Check "Comparison includes the scored shortlisted candidate, auto-selected into the top ranking" ($null -ne $comparisonApp2 -and $comparisonApp2.rank -eq 1)
Check "Comparison score distribution buckets the 7.0-7.9 candidate correctly" (($comparison.distribution | Where-Object { $_.label -eq "7.0-7.9" }).count -ge 1)
Check "Comparison summary's highest score matches the top candidate" ($comparison.summary.highestScore -eq $comparisonApp2.score)

$comparisonUnassignedVacancy = Invoke-Api GET "$base/hiring-manager/vacancies/999999/comparison" -Headers @{Authorization="Bearer $hmToken"}
Check "HM blocked from comparing a vacancy they have no assigned application on" ($comparisonUnassignedVacancy.__error -eq $true -and $comparisonUnassignedVacancy.__status -eq 403)

$comparisonByNonHm = Invoke-Api GET "$base/hiring-manager/vacancies/$vacId/comparison" -Headers @{Authorization="Bearer $hrToken"}
Check "Non-Hiring-Manager blocked from candidate comparison" ($comparisonByNonHm.__error -eq $true -and $comparisonByNonHm.__status -eq 403)

Write-Host "`n=== 10d. MANAGEMENT DASHBOARD (minimal KPI screen) ===`n"

# Mary Management's seeded department is "Engineering", matching the
# department the main regression vacancy ($vacId) was created under -- so
# her dashboard should pick it up without any extra setup.
$mgmtDashboard = Invoke-Api GET "$base/management/dashboard" -Headers @{Authorization="Bearer $managementToken"}
Check "Management dashboard resolves the account's department" ($mgmtDashboard.hasDepartment -eq $true -and $mgmtDashboard.department -eq "Engineering")

$mgmtVac = $mgmtDashboard.vacancies | Where-Object { $_.id -eq $vacId }
Check "Management dashboard's Department Vacancies includes the Engineering vacancy" ($null -ne $mgmtVac)
Check "Management dashboard counts at least 1 open vacancy" ($mgmtDashboard.openVacancies -ge 1)
Check "Management dashboard counts the earlier hire" ($mgmtDashboard.hires -ge 1)

$mgmtDashboardByHr = Invoke-Api GET "$base/management/dashboard" -Headers @{Authorization="Bearer $hrToken"}
Check "Non-Management blocked from Management dashboard" ($mgmtDashboardByHr.__error -eq $true -and $mgmtDashboardByHr.__status -eq 403)

Write-Host "`n=== 10e. LEADERSHIP RECRUITMENT OVERVIEW ===`n"

# Sprint 1 scope: KPIs + round-by-round breakdown, reusing the existing
# org-wide /reports/kpis and /reports/stage-monitoring endpoints -- no new
# backend surface for this tab, so this just confirms Leadership can reach
# the same endpoints Management's regression coverage already exercises.
$leadershipKpis = Invoke-Api GET "$base/reports/kpis" -Headers @{Authorization="Bearer $leadershipToken"}
Check "Leadership can read org-wide KPIs" ($null -ne $leadershipKpis.openVacancies -and $null -ne $leadershipKpis.averageTimeToHireDays)
Check "Org-wide KPIs reflect the regression hire" ($leadershipKpis.hires -ge 1)

$leadershipStageMonitoring = Invoke-Api GET "$base/reports/stage-monitoring" -Headers @{Authorization="Bearer $leadershipToken"}
Check "Leadership's org-wide stage monitoring returns 4 anchors" ($leadershipStageMonitoring.anchors.Count -eq 4)
Check "Leadership's org-wide stage monitoring includes round-order buckets" ($leadershipStageMonitoring.rounds.Count -ge 3)

Write-Host "`n=== 10f. INTERVIEWER: MY CANDIDATES ===`n"

# Scope locked via wireframe review (Q3): all-time, regardless of outcome --
# not just currently-active candidates. appId is HIRED by now (section 10)
# and interviewerId paneled interview1 on it; appScope (from 9b) is still
# SHORTLISTED and interviewerId paneled panelInterview on it. Both should
# show up for this interviewer, proving the "regardless of outcome" scope.
$myCandidates = Invoke-Api GET "$base/interviewer/candidates" -Headers @{Authorization="Bearer $interviewerToken"}
Check "My Candidates includes a HIRED application (all-time, regardless of outcome)" (@($myCandidates | Where-Object { $_.id -eq $appId }).Count -eq 1)
Check "My Candidates includes the still-in-progress scoping application" (@($myCandidates | Where-Object { $_.id -eq $appScope.id }).Count -eq 1)

$myCandidatesByStage = Invoke-Api GET "$base/interviewer/candidates?stage=HIRED" -Headers @{Authorization="Bearer $interviewerToken"}
Check "My Candidates stage filter narrows to HIRED only" (@($myCandidatesByStage | Where-Object { $_.id -eq $appId }).Count -eq 1 -and @($myCandidatesByStage | Where-Object { $_.stage -ne "HIRED" }).Count -eq 0)

$myCandidatesBySearch = Invoke-Api GET "$base/interviewer/candidates?search=$candScopeEmail" -Headers @{Authorization="Bearer $interviewerToken"}
Check "My Candidates search filter matches by email" (@($myCandidatesBySearch | Where-Object { $_.id -eq $appScope.id }).Count -eq 1)

# Scoped per-interviewer: interviewer2 shares the panel on appScope but never
# sat on interview1, so they should see appScope but not appId.
$myCandidatesForInterviewer2 = Invoke-Api GET "$base/interviewer/candidates" -Headers @{Authorization="Bearer $interviewer2Token"}
Check "My Candidates is scoped per-interviewer" (@($myCandidatesForInterviewer2 | Where-Object { $_.id -eq $appScope.id }).Count -eq 1 -and @($myCandidatesForInterviewer2 | Where-Object { $_.id -eq $appId }).Count -eq 0)

$myCandidatesByNonInterviewer = Invoke-Api GET "$base/interviewer/candidates" -Headers @{Authorization="Bearer $hrToken"}
Check "Non-Interviewer blocked from My Candidates" ($myCandidatesByNonInterviewer.__error -eq $true -and $myCandidatesByNonInterviewer.__status -eq 403)

Write-Host "`n=== 11. REPORTS ===`n"

$dashboard = Invoke-Api GET "$base/reports/dashboard" -Headers @{Authorization="Bearer $managementToken"}
Check "Dashboard returns active vacancies with anchorCounts + rounds" ($dashboard.Count -gt 0 -and $null -ne $dashboard[0].anchorCounts -and $null -ne $dashboard[0].rounds)

$stageMonitoring = Invoke-Api GET "$base/reports/stage-monitoring?vacancyId=$vacId" -Headers @{Authorization="Bearer $managementToken"}
Check "Stage monitoring (scoped to one vacancy) returns 4 anchors + this vacancy's 3 named rounds" ($stageMonitoring.anchors.Count -eq 4 -and $stageMonitoring.rounds.Count -eq 3)
$hiredAnchor = $stageMonitoring.anchors | Where-Object { $_.stage -eq "HIRED" }
Check "Stage monitoring shows 1 HIRED for this vacancy" ($hiredAnchor.candidateCount -eq 1)

$stageMonitoringOrgWide = Invoke-Api GET "$base/reports/stage-monitoring" -Headers @{Authorization="Bearer $managementToken"}
Check "Org-wide stage monitoring aggregates rounds by order index, not name" ($null -ne $stageMonitoringOrgWide.rounds -and $stageMonitoringOrgWide.rounds[0].label -eq "Round 1")

$kpis = Invoke-Api GET "$base/reports/kpis?vacancyId=$vacId" -Headers @{Authorization="Bearer $managementToken"}
Check "KPIs include openVacancies field" ($null -ne $kpis.PSObject.Properties["openVacancies"])
Check "KPIs include averageTimeToHireDays field" ($null -ne $kpis.PSObject.Properties["averageTimeToHireDays"])
Check "KPIs reflect the hire" ($kpis.hires -eq 1)

$vacReport = Invoke-Api GET "$base/vacancies/$vacId/report" -Headers @{Authorization="Bearer $managementToken"}
Check "Vacancy report includes anchorCounts + named rounds" ($null -ne $vacReport.anchorCounts -and $vacReport.rounds.Count -eq 3)
Check "Vacancy report includes anchorTimings (4) + roundTimings (3)" ($vacReport.anchorTimings.Count -eq 4 -and $vacReport.roundTimings.Count -eq 3)

Write-Host "`n=== 12. AUDIT LOG (US-21/US-43) ===`n"

$adminLogin = Invoke-Api POST "$base/auth/admin-login" -Body @{ email="itadmin@altrium.com"; password="password123" }
Check "IT Admin login" ($null -ne $adminLogin.token)
$adminToken = $adminLogin.token
$adminId = $adminLogin.user.id

$auditByNonAdmin = Invoke-Api GET "$base/audit-logs" -Headers @{Authorization="Bearer $hrToken"}
Check "Non-IT-Admin blocked from audit log" ($auditByNonAdmin.__error -eq $true -and $auditByNonAdmin.__status -eq 403)

# Exercise the two vacancy events not already triggered above (create was section 2).
$vacEdit = Invoke-Api PATCH "$base/vacancies/$vacId" -Headers @{Authorization="Bearer $hrToken"} -Body @{ title="$vacTitle (edited)" }
Check "HR edits vacancy (for VACANCY_EDITED check)" ($vacEdit.title -eq "$vacTitle (edited)")

$vacClose = Invoke-Api PATCH "$base/vacancies/$vacId" -Headers @{Authorization="Bearer $hrToken"} -Body @{ status="CLOSED" }
Check "HR closes vacancy (for VACANCY_CLOSED check)" ($vacClose.status -eq "CLOSED")

$auditLogAll = Invoke-Api GET "$base/audit-logs" -Headers @{Authorization="Bearer $adminToken"}

Check "VACANCY_CREATED logged" ((($auditLogAll | Where-Object { $_.action -eq "VACANCY_CREATED" -and $_.entityId -eq $vacId }) | Measure-Object).Count -eq 1)
# Filtered to fieldsChanged containing "title", not just action+entityId --
# now that the targetFillDate Prisma-client bug is fixed, section 2's
# $vacWithTarget/$vacClearedTarget calls also legitimately reach
# writeAuditLog(VACANCY_EDITED) (they used to die on PrismaClientValidationError
# before ever getting there, which is the only reason a bare count-eq-1 ever
# passed before). $vacId now has 3 real VACANCY_EDITED entries by this point;
# this checks specifically for the title-changing edit below, not just any edit.
Check "VACANCY_EDITED logged (not VACANCY_CLOSED, since status didn't change that call)" ((($auditLogAll | Where-Object { $_.action -eq "VACANCY_EDITED" -and $_.entityId -eq $vacId -and $_.metadata.fieldsChanged -contains "title" }) | Measure-Object).Count -eq 1)
Check "VACANCY_CLOSED logged (not VACANCY_EDITED, since status changed to CLOSED that call)" ((($auditLogAll | Where-Object { $_.action -eq "VACANCY_CLOSED" -and $_.entityId -eq $vacId }) | Measure-Object).Count -eq 1)
Check "CV_UPLOADED logged (real file-upload confirm path)" ((($auditLogAll | Where-Object { $_.action -eq "CV_UPLOADED" -and $_.entityId -eq $candId }) | Measure-Object).Count -eq 1)
Check "FEEDBACK_SUBMITTED logged" ((($auditLogAll | Where-Object { $_.action -eq "FEEDBACK_SUBMITTED" -and $_.entityId -eq $feedbackId }) | Measure-Object).Count -eq 1)
Check "INTERVIEW_SCHEDULED logged" ((($auditLogAll | Where-Object { $_.action -eq "INTERVIEW_SCHEDULED" -and $_.entityId -eq $interview1Id }) | Measure-Object).Count -eq 1)
Check "NOTIFICATION_SENT logged twice for interview scheduling (panelist + candidate email)" ((($auditLogAll | Where-Object { $_.action -eq "NOTIFICATION_SENT" -and $_.entityType -eq "Interview" -and $_.entityId -eq $interview1Id }) | Measure-Object).Count -eq 2)
Check "NOTIFICATION_SENT logged once for hiring decision email" ((($auditLogAll | Where-Object { $_.action -eq "NOTIFICATION_SENT" -and $_.entityType -eq "CandidateApplication" -and $_.entityId -eq $appId }) | Measure-Object).Count -eq 1)
if ($PSVersionTable.PSVersion.Major -ge 6) {
    Check "CV_UPLOADED logged (real multipart upload path)" ((($auditLogAll | Where-Object { $_.action -eq "CV_UPLOADED" -and $_.entityId -eq $multipartCandId }) | Measure-Object).Count -eq 1)
}

Write-Host "`n=== 13. IT ADMIN USER MANAGEMENT (US-02/US-03) ===`n"

$usersByNonAdmin = Invoke-Api GET "$base/users" -Headers @{Authorization="Bearer $hrToken"}
Check "Non-IT-Admin blocked from listing users" ($usersByNonAdmin.__error -eq $true -and $usersByNonAdmin.__status -eq 403)

$newUserEmail = "regression.user.$suffix@example.com"
$newUser = Invoke-Api POST "$base/users" -Headers @{Authorization="Bearer $adminToken"} -Body @{ name="Regression User $suffix"; email=$newUserEmail; password="password123"; role="INTERVIEWER" }
Check "IT Admin creates a user" ($null -ne $newUser.id -and $newUser.email -eq $newUserEmail)
Check "Created user response never includes passwordHash" ($null -eq $newUser.PSObject.Properties["passwordHash"])
$newUserId = $newUser.id

$dupUser = Invoke-Api POST "$base/users" -Headers @{Authorization="Bearer $adminToken"} -Body @{ name="Dup"; email=$newUserEmail; password="password123"; role="HR" }
Check "Duplicate-email user creation blocked" ($dupUser.__error -eq $true -and $dupUser.__status -eq 409)

$badRoleUser = Invoke-Api POST "$base/users" -Headers @{Authorization="Bearer $adminToken"} -Body @{ name="Bad"; email="badrole.$suffix@example.com"; password="password123"; role="NOT_A_REAL_ROLE" }
Check "Invalid role rejected on user creation" ($badRoleUser.__error -eq $true -and $badRoleUser.__status -eq 400)

$fetchedUser = Invoke-Api GET "$base/users/$newUserId" -Headers @{Authorization="Bearer $adminToken"}
Check "IT Admin fetches single user" ($fetchedUser.id -eq $newUserId)

$filteredUsers = Invoke-Api GET "$base/users?role=INTERVIEWER" -Headers @{Authorization="Bearer $adminToken"}
Check "User list filters by role" ((($filteredUsers | Where-Object { $_.id -eq $newUserId }) | Measure-Object).Count -eq 1)

$editedUser = Invoke-Api PATCH "$base/users/$newUserId" -Headers @{Authorization="Bearer $adminToken"} -Body @{ name="Regression User $suffix (edited)" }
Check "IT Admin edits user profile fields" ($editedUser.name -eq "Regression User $suffix (edited)")

# Deactivate -> login blocked -> reactivate -> login works again
$deactivate = Invoke-Api PATCH "$base/users/$newUserId/active" -Headers @{Authorization="Bearer $adminToken"} -Body @{ isActive=$false }
Check "IT Admin deactivates the user" ($deactivate.isActive -eq $false)

$loginWhileDeactivated = Invoke-Api POST "$base/auth/login" -Body @{ email=$newUserEmail; password="password123" }
Check "Deactivated user blocked from logging in" ($loginWhileDeactivated.__error -eq $true -and $loginWhileDeactivated.__status -eq 401)

$reactivate = Invoke-Api PATCH "$base/users/$newUserId/active" -Headers @{Authorization="Bearer $adminToken"} -Body @{ isActive=$true }
Check "IT Admin reactivates the user" ($reactivate.isActive -eq $true)

$loginAfterReactivate = Invoke-Api POST "$base/auth/login" -Body @{ email=$newUserEmail; password="password123" }
Check "Reactivated user can log in again" ($null -ne $loginAfterReactivate.token)

$selfDeactivate = Invoke-Api PATCH "$base/users/$adminId/active" -Headers @{Authorization="Bearer $adminToken"} -Body @{ isActive=$false }
Check "IT Admin cannot deactivate their own account" ($selfDeactivate.__error -eq $true -and $selfDeactivate.__status -eq 400)

$roleChange = Invoke-Api PATCH "$base/users/$newUserId/role" -Headers @{Authorization="Bearer $adminToken"} -Body @{ role="HR" }
Check "IT Admin changes the user's role" ($roleChange.role -eq "HR")

$selfRoleChange = Invoke-Api PATCH "$base/users/$adminId/role" -Headers @{Authorization="Bearer $adminToken"} -Body @{ role="HR" }
Check "IT Admin cannot change their own role" ($selfRoleChange.__error -eq $true -and $selfRoleChange.__status -eq 400)

$auditLogAfterUserMgmt = Invoke-Api GET "$base/audit-logs" -Headers @{Authorization="Bearer $adminToken"}
Check "ACCOUNT_CREATED logged" ((($auditLogAfterUserMgmt | Where-Object { $_.action -eq "ACCOUNT_CREATED" -and $_.entityId -eq $newUserId }) | Measure-Object).Count -eq 1)
Check "ACCOUNT_DEACTIVATED logged" ((($auditLogAfterUserMgmt | Where-Object { $_.action -eq "ACCOUNT_DEACTIVATED" -and $_.entityId -eq $newUserId }) | Measure-Object).Count -eq 1)
Check "ROLE_CHANGED logged" ((($auditLogAfterUserMgmt | Where-Object { $_.action -eq "ROLE_CHANGED" -and $_.entityId -eq $newUserId }) | Measure-Object).Count -eq 1)

Write-Host "`n=== SUMMARY ===`n"
Write-Host "Passed: $pass" -ForegroundColor Green
Write-Host "Failed: $fail" -ForegroundColor Red
if ($fail -gt 0) {
    Write-Host "`nFailed checks:"
    $failures | ForEach-Object { Write-Host " - $_" -ForegroundColor Red }
}
Write-Host "`nRegression vacancy: id=$vacId (title: $vacTitle)`n"
