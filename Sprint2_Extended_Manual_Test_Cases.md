# Altrium HR — Sprint 2 Extended Manual Test Cases

**Scope:** functional features built after the existing `Sprint2_Manual_Test_Cases.docx` / `Sprint2_Additions_Manual_Test_Cases.docx` files were last updated (business-rule changes, not pure visual/copy tweaks).

**Result column policy:** every row below is marked **Not yet executed**. Nothing in this document has actually been run — the sandbox used to build this session's changes has been unreachable (a Windows-update-related mount issue), so there has been no way to click through the app or run the automated suites. Fill in **Actual Result** and flip **Status** to Pass/Fail only after someone has genuinely walked through the steps. Do not mark a row Pass without doing that — it defeats the point of the document.

ID prefix `TC-S2X` (Sprint 2 Extended) is used throughout to avoid colliding with IDs already used in the existing Sprint 1/2 docs.

---

## 1. CV Upload & Duplicate Detection (current behaviour, post-revert)

| TC ID | Objective | Preconditions | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| TC-S2X-001 | Uploading a brand-new candidate's CV creates the candidate and applies them | Logged in as HR; an OPEN vacancy exists with no existing applicant of this email | Candidates > Upload CV > select vacancy > upload a PDF for a new name/email > confirm | Candidate is created, CV saved, and a new application appears against the selected vacancy with status Unreviewed | Not yet executed | Pending |
| TC-S2X-002 | Re-uploading a CV for someone who already applied to the **same** vacancy is blocked, not silently reconsidered | A candidate already has an application (any stage) on vacancy V | Upload a CV using that candidate's email against vacancy V again | A plain "existing candidate found" notice appears naming the candidate and linking to their existing application; their stage/CV do **not** change; no new application is created | Not yet executed | Pending |
| TC-S2X-003 | Re-uploading a CV for the same person against a **different** vacancy is not treated as a conflict | Candidate has an application on vacancy V, but never applied to vacancy W | Upload a CV for that email against vacancy W | The existing candidate record is reused, their CV/name/phone are updated silently, and a new application is created on vacancy W; an informational "already has a profile" notice appears with a working link to the new application | Not yet executed | Pending |
| TC-S2X-004 | A REJECTED candidate re-uploaded to the same vacancy is NOT auto-reconsidered | Candidate is REJECTED (CV-stage, no hiring decision) on vacancy V | Upload a new CV for that candidate's email against vacancy V | Same as TC-S2X-002 — blocked as an existing-application match; stage stays REJECTED; no popup asking to "review the new CV" | Not yet executed | Pending |
| TC-S2X-005 | Candidate profile page shows no CV History or Review Notes History sections | Open any candidate's detail page | Scroll the CV card and the Review Notes card | Neither a "View CV History" nor a "View Review Notes History" toggle appears anywhere on the page | Not yet executed | Pending |
| TC-S2X-006 | Non-PDF files in a bulk upload are reported individually, not silently dropped | Prepare a batch with one .docx and two .pdf files | Upload all three in one Upload CV action | The two PDFs proceed to the review step; the non-PDF appears in a "Failed" table with reason "Not a PDF file" | Not yet executed | Pending |

## 2. CV Review Gate & Reconsider

| TC ID | Objective | Preconditions | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| TC-S2X-007 | Shortlist/Reject are disabled until a review note is saved | Open a candidate at stage Unreviewed (Applied) with no saved review note | Attempt to click Shortlist and Reject without typing/saving a note | Both buttons are disabled with a hint: "Write and save a CV review note above before shortlisting or rejecting this candidate." | Not yet executed | Pending |
| TC-S2X-008 | Saving a note unlocks the decision buttons | Same candidate as above | Type a note, click Save Note | Shortlist and Reject both become enabled | Not yet executed | Pending |
| TC-S2X-009 | Backend rejects a Shortlist/Reject call with no saved note even if the UI is bypassed | As above | Call `PATCH` shortlist/reject directly (e.g. via devtools) with no note saved | 400 response: "Write and save a CV review note before shortlisting or rejecting this candidate." | Not yet executed | Pending |
| TC-S2X-010 | Reconsider banner appears only for an early CV-stage rejection | Candidate is REJECTED with no final hiring decision on this vacancy | Open the candidate's profile | A banner reads "This candidate was rejected before being shortlisted for this vacancy. Would you like to reconsider them?" with a Reconsider button | Not yet executed | Pending |
| TC-S2X-011 | Reconsider moves the candidate to Unreviewed, not Shortlisted | As above | Click Reconsider | Stage becomes Unreviewed (Applied); the saved review note is cleared; Shortlist/Reject are disabled again until a new note is saved | Not yet executed | Pending |
| TC-S2X-012 | Reconsider is not offered for a real final hiring decision | Candidate has a real HIRED/REJECTED outcome via `recordHiringDecision` (post-interview) | Open the candidate's profile | No Reconsider banner appears anywhere on the page | Not yet executed | Pending |

## 3. Interview Panels

| TC ID | Objective | Preconditions | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| TC-S2X-013 | A named panel can be created and reused across interviews | Logged in as HR, on a vacancy with shortlisted candidates | Assign Panel > create a new named panel with 2+ staff (excluding any Hiring Manager) > save | Panel appears in the vacancy's panel list and can be selected again from Schedule Interview | Not yet executed | Pending |
| TC-S2X-014 | Hiring Managers cannot be added to an interview panel | Creating/editing a panel | Attempt to add a user with role HIRING_MANAGER to the panel | That user does not appear in the assignable staff list for panels | Not yet executed | Pending |
| TC-S2X-015 | The same staff member can be on two different panels for one vacancy | Two named panels exist for the same vacancy | Add the same staff member to both panels | Both assignments succeed — no "already on a panel" error | Not yet executed | Pending |
| TC-S2X-016 | Double-booking a panelist at the exact same time is blocked | Panelist P is already scheduled for an interview at 10:00 on some vacancy | Schedule a new interview for P at exactly 10:00 on a different vacancy | The schedule action is rejected with a conflict error naming P | Not yet executed | Pending |

## 4. Vacancy ON_HOLD Freeze

| TC ID | Objective | Preconditions | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| TC-S2X-017 | An ON_HOLD vacancy cannot receive a new candidate | Set a vacancy's status to ON_HOLD | Try Upload CV / Add Candidate against it | The vacancy does not appear in the "apply to vacancy" dropdown at all | Not yet executed | Pending |
| TC-S2X-018 | Existing applications on an ON_HOLD vacancy cannot change stage | Vacancy V is ON_HOLD with an Unreviewed candidate | Try to Shortlist/Reject that candidate | Action is blocked with "This vacancy is on hold. Reopen it before adding or progressing candidates." (backend) and the UI shows a matching disabled-state hint | Not yet executed | Pending |
| TC-S2X-019 | A Hiring Manager cannot be assigned while ON_HOLD | Vacancy V is ON_HOLD | Try to assign a Hiring Manager to a candidate on V | Blocked with a locked-hint: "This vacancy is on hold, so a Hiring Manager can't be assigned until it's reopened." | Not yet executed | Pending |
| TC-S2X-020 | Reopening the vacancy resumes everything | Vacancy V is ON_HOLD | Set status back to OPEN | Upload/Shortlist/Reject/Assign HM all work again for V | Not yet executed | Pending |

## 5. Per-Round Interview Stage Locking

| TC ID | Objective | Preconditions | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| TC-S2X-021 | A candidate can only be scheduled for their current round | Candidate's `currentVacancyStageId` is Round 1 | Try to schedule them directly into Round 2 | Blocked — scheduling only succeeds against the candidate's actual current round | Not yet executed | Pending |
| TC-S2X-022 | Advancing after feedback moves the candidate to the next configured round | Candidate completed Round 1 with a Proceed-eligible outcome | Submit the stage recommendation to advance | `currentVacancyStageId` updates to Round 2; Round 2 becomes schedulable for them | Not yet executed | Pending |
| TC-S2X-023 | HIRE requires the candidate to already be on the vacancy's last configured round | Candidate is on Round 1 of a 3-round vacancy | Attempt `recordHiringDecision` HIRE directly | Rejected — HIRE only succeeds once the candidate's current round is the last one configured | Not yet executed | Pending |

## 6. Hiring Manager Dashboard, Comparison & Decision History

| TC ID | Objective | Preconditions | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| TC-S2X-024 | HM Dashboard KPI tiles and Recruitment Progress load with live filters | Logged in as Hiring Manager with assigned vacancies | Open Dashboard, apply Date/Vacancy/Department filters | KPI tiles and the Recruitment Progress bar list update to match the filtered scope | Not yet executed | Pending |
| TC-S2X-025 | Candidate Comparison ranks and highlights the top candidate | Open Candidate Comparison for a vacancy with 5+ scored candidates | View the Top Candidate Score Ranking panel | Top 5 shown, rank #1 visually distinguished (bigger/green), scores are whole numbers | Not yet executed | Pending |
| TC-S2X-026 | Proceed / Do Not Proceed produces a confirmed outcome | On a candidate's Decision page | Click Proceed (or Do Not Proceed) and confirm | A confirmation of the outcome is shown, and the decision appears afterward in Decision History | Not yet executed | Pending |
| TC-S2X-027 | Decision History links back to the candidate profile | Open Decision History tab | Click a past decision row | Navigates to that candidate's profile page | Not yet executed | Pending |
| TC-S2X-028 | HM sees interviewer + management feedback only once the final round is reached | Candidate mid-pipeline (not yet at final round) | Open their feedback view | Only the current round's own feedback is visible; earlier-round detail is not conflated with the final-round-only view | Not yet executed | Pending |

## 7. Management Dashboard, My Candidates & Reports

| TC ID | Objective | Preconditions | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| TC-S2X-029 | Management must attend the final interview round | A vacancy's final round is being scheduled | Attempt to schedule the final round without a Management panelist | Blocked/flagged — the rule requiring Management attendance at the final round is enforced | Not yet executed | Pending |
| TC-S2X-030 | My Candidates tab lists candidates and accepts feedback | Open Management > My Candidates | Click a candidate, submit feedback | Feedback is saved and reflected on the candidate's record | Not yet executed | Pending |
| TC-S2X-031 | Management Dashboard is scoped to the manager's department | Log in as a Management user tied to Department D | Open Dashboard | Only Department D's vacancies/KPIs are shown, not org-wide data | Not yet executed | Pending |
| TC-S2X-032 | Export Report produces a valid, openable PDF | Open Reports, click View Report for any of the 4 department reports | Open the generated PDF | PDF opens in a new tab without a corrupt-file / ERR_FAILED error | Not yet executed | Pending |

## 8. Leadership Dashboard, Reports & Needs Attention

| TC ID | Objective | Preconditions | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| TC-S2X-033 | Recruitment Overview dashboard loads org-wide KPIs and Needs Attention | Logged in as Leadership | Open Dashboard | KPI tiles, Recruitment Progress, and a Needs Attention panel all render with org-wide data | Not yet executed | Pending |
| TC-S2X-034 | Department Performance shows correct fill rates after a vacancy is closed | A vacancy was closed with a real hire | Open Department Performance for that department | Fill rate reflects the closed vacancy (not stuck at 0%) | Not yet executed | Pending |
| TC-S2X-035 | Hiring Trends chart fills the width of its panel | Open Hiring Trends | Resize the browser window wider | The plotted line/area visibly stretches to match the panel's new width, not staying fixed at a smaller size (this was a real bug fixed tonight — see decision log, Eighty-seventh pass) | Not yet executed | Pending |
| TC-S2X-036 | Hiring Trends filters (date range / department / vacancy) narrow the chart and KPIs together | Open Hiring Trends | Apply a department filter | Both the KPI tiles and the chart update to the filtered scope | Not yet executed | Pending |
| TC-S2X-037 | All 4 org-wide reports are listed and export correctly | Open Leadership Reports | View/export each of the 4 reports | Each opens as a valid PDF in a new tab | Not yet executed | Pending |

## 9. IT Admin: Forced Password Change, System Monitoring, Notification Templates

| TC ID | Objective | Preconditions | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| TC-S2X-038 | A newly created user is forced to change their password on first login | IT Admin creates a new user via Create User | Log in as that new user with the generated password | Redirected to a forced Change Password page before reaching any other screen; cannot navigate around it | Not yet executed | Pending |
| TC-S2X-039 | After the forced change, `mustChangePassword` no longer blocks login | As above, password just changed | Log out and log back in with the new password | Goes straight to the normal dashboard, no forced-change redirect | Not yet executed | Pending |
| TC-S2X-040 | System Monitoring KPI tiles render with the sitewide white-card/accent-bar style | Open IT Admin > System | Look at Server Load / Response Time / Concurrent Users tiles | All three match the same white-card, gold-accent-bar look used elsewhere, laid out in one row, not wrapped or off-center | Not yet executed | Pending |
| TC-S2X-041 | Active Users list on System page reflects real recent activity | A user performs an authenticated action | Open System page shortly after | That user appears in Active Users with a recent "last active" time | Not yet executed | Pending |
| TC-S2X-042 | Backups list shows real backup runs | A scheduled/manual backup has executed | Open System page's Backups section | A row appears with a real timestamp and file reference, not placeholder data | Not yet executed | Pending |
| TC-S2X-043 | Notification Templates can be edited and reset to default | Open Notification Templates, edit one, save | Reload the page | Edited content persists; a Reset option restores the original default text | Not yet executed | Pending |
| TC-S2X-044 | Audit Logs show specific, categorized event descriptions | Perform a few different actions (login, create user, reject candidate) | Open Audit Logs | Each entry has a specific category/description, not a generic catch-all label | Not yet executed | Pending |

## 10. Notifications & Email History

| TC ID | Objective | Preconditions | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| TC-S2X-045 | A relevant action triggers a real in-app notification | E.g. assign a user to a vacancy's interviewer pool | Check that user's notification bell | A new notification appears in the bell dropdown for that event | Not yet executed | Pending |
| TC-S2X-046 | The notification bell is fixed top-right on every role's layout | Log in as each role in turn | Navigate a few pages per role | Bell stays fixed top-right, doesn't scroll away or shift position | Not yet executed | Pending |
| TC-S2X-047 | Email History on a candidate shows real subject/body for emails sent after the content-capture fix | Trigger a hiring decision or interview invite email | Open that candidate's Email History | The entry expands to show the real subject and body, not "Content not available" | Not yet executed | Pending |
| TC-S2X-048 | Interview reminder cron actually sends reminders ahead of a scheduled interview | An interview is scheduled for the near future, reminder window reached | Wait for/trigger the cron job | A reminder email is sent and logged (`NOTIFICATION_SENT` audit entry), `reminderSentAt` is stamped so it isn't sent twice | Not yet executed | Pending |

---

## Automated System Backups (manual verification — not something Selenium exercises)

| TC ID | Objective | Preconditions | Steps | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|---|
| TC-S2X-049 | Scheduled backup job runs and produces a valid MySQL dump | Backend running with the backup cron active | Wait for/trigger a scheduled run | A `.sql` dump file is created under `backend/backups/` with a current timestamp and non-zero size | Not yet executed | Pending |
| TC-S2X-050 | A backup file can actually restore the database | A backup file exists | Restore it into a scratch database | Restore completes without error and data matches what was backed up | Not yet executed | Pending |
