# Altrium HR — Selenium Automated Test Coverage: What Exists vs. What's Missing

## Progress update — 5 new test files written, NOT YET RUN

Five new `sprint2/test_*.py` files were written against this gap list, grounded in the actual current frontend source (not guessed selectors):

- `test_cv_duplicate_and_history_removed.py` — same-vacancy re-upload duplicate modal + profile link, cross-vacancy re-upload duplicate modal with no link, a rejected candidate re-uploaded stays rejected, and a regression check that CV History / Review Notes History are gone from the candidate detail page.
- `test_cv_review_gate_and_reconsider.py` — Shortlist/Reject disabled with no review note, saving a note enables them, reject-then-Reconsider returns the candidate to Unreviewed.
- `test_vacancy_on_hold_freeze.py` — ON_HOLD freezes Shortlist/Reject and Hiring Manager assignment and hides the vacancy from the Upload CV dropdown; reopening restores all three.
- `test_interview_panels.py` — create a named panel and see it offered for reuse in Schedule Interview, Hiring Managers excluded from the panel staff checklist, the same interviewer addable to two different panels.
- `test_forced_password_change.py` — a freshly created user is redirected to `/change-password` on first login and not redirected again after changing it.

**These have not been executed.** They were written by reading `CandidatesPage.tsx`, `CandidateDetailPage.tsx`, `VacanciesPage.tsx`, `InterviewsPage.tsx`, and `ChangePasswordPage.tsx` directly for real selectors/classes/ids, but there's no substitute for actually running them against the live app — treat any PASS/FAIL they print as provisional until you've run them yourself and fixed whatever breaks. Run with both dev servers up: `cd automated-tests/selenium/sprint2 && python test_<name>.py`.

Still not scripted (selectors not yet grounded against source, or need fixtures Selenium can't set up alone): per-round interview stage locking, current-version Hiring Manager/Management/Leadership dashboard filtering and scoping, System Monitoring KPI styling, Active Users/Backups tables, notification-bell-on-assignment, and Email History content-capture. These remain exactly as described below.

---


I inventoried `automated-tests/selenium/` directly (file names + every `def test_...` in each file) rather than guessing — this reflects what's actually scripted right now, not what's implied by folder names.

## What's already automated

**`sprint1/`** — login (all roles, IT Admin admin-route gating, forgot-password notice, disabled-account handling), HR Vacancies (department grid, create/edit, status filters, stages+panelist), HR Interviews (calendar, panel assignment, schedule flow, add-candidate, Esc navigation), HR Candidates upload (search, extract → review → confirm, validation), Hiring Manager flow (vacancy filters, decision page, comparison ranking panel), Interviewer feedback (score/comment validation, My Candidates grouping).

**`sprint2/`** — Audit Logs (filters, login generates an entry), Email History + Candidate Comparison (score distribution, branding), HR Follow Ups (all sections, reminder/invite/call modals), IT Admin Users (create-user password gate, role-change restrictions, deactivate gate, filters), Leadership Reports (all 4 report pages load, nav, export), Login/Forgot Password (toggle, reset-token validation), Management Reports (KPIs, filter bar, all 4 department reports), Notification bell + templates (position, dropdown behaviour, template edit/reset).

That `sprint2` suite was written well before most of this session's later Sprint 2 work landed, so a large amount of what actually shipped afterward has **zero** automated coverage. Below is that gap, organized so each row is ready to become a real Selenium test once the sandbox is back (I can't write and actually run/debug Python against a live browser without it).

## Gap list — proposed new test scenarios, none of these exist yet

### CV upload / duplicate detection (current, post-revert, behaviour)
- Same-vacancy re-upload shows the plain "existing candidate found" modal with a working profile link, and does **not** change the existing application's stage.
- Cross-vacancy re-upload of the same email silently reuses the candidate and creates a second application with no modal blocking it.
- A previously-REJECTED candidate re-uploaded to the same vacancy stays REJECTED (no auto-reconsider).
- Candidate detail page has no "View CV History" / "View Review Notes History" elements anywhere in the DOM.

### CV review gate & Reconsider
- Shortlist/Reject buttons are `disabled` on a fresh Unreviewed candidate with no note.
- Saving a note via the textarea + Save Note enables both buttons.
- Reconsider banner only renders when `stage === REJECTED && hiringDecision === null`.
- Clicking Reconsider lands the candidate back on Unreviewed (assert the stage badge / status pill text), not Shortlisted.

### Interview Panels
- Creating a named panel and reusing it in a second Schedule Interview flow.
- Hiring Managers are absent from the assignable-staff list when building a panel.
- Same staff member addable to two different named panels on one vacancy.
- Scheduling a panelist already booked at the identical timestamp is rejected.

### ON_HOLD vacancy freeze
- An ON_HOLD vacancy is absent from the "apply to vacancy" dropdown on Upload CV.
- Shortlist/Reject controls show the on-hold locked-hint and are disabled for a candidate on an ON_HOLD vacancy.
- Assign Hiring Manager is blocked with the on-hold message.
- Reopening to OPEN restores all of the above.

### Per-round interview stage locking
- Scheduling into a round other than the candidate's current round is rejected.
- HIRE is rejected unless the candidate's current round is the vacancy's last configured round.

### Hiring Manager screens (current versions)
- Dashboard's Date/Vacancy/Department filters actually change the rendered KPI numbers.
- Decision History row navigates to the correct candidate profile.
- Proceed / Do Not Proceed shows a confirmation and the outcome then appears in Decision History.

### Management screens (current versions)
- My Candidates tab: submitting feedback from a candidate row persists it.
- Dashboard is scoped to the logged-in manager's own department only (assert a different department's vacancy titles are absent).
- Management-must-attend-final-round rule blocks scheduling the final round without a Management panelist.

### Leadership screens (current versions)
- Needs Attention panel renders on the Dashboard (not the separate Follow Ups tab it was moved to and then back from).
- Department Performance fill rate reflects a closed vacancy, not stuck at 0%.
- Hiring Trends chart's rendered SVG width tracks the panel's width after a browser resize (regression test for tonight's ResizeObserver fix).

### IT Admin
- Forced password change: log in as a freshly created user, assert redirect to the change-password screen before any other route is reachable.
- After changing the password once, logging in again does NOT redirect to change-password.
- System Monitoring KPI tiles render with the shared white-card/accent-bar classes (not the old flat style).
- Active Users table shows a just-logged-in user with a recent timestamp.
- Backups table shows at least one row after a backup run.

### Notifications & Email
- An interviewer-pool assignment produces a new bell notification for that user.
- Email History entry expands to show non-null subject/body for an email sent after the content-capture fix.

### Backend jobs (not really Selenium's job — flag as integration/manual instead)
- Interview reminder cron and the mysqldump backup job are backend-scheduled processes with no UI surface to click through; these belong in a backend integration test (or a manual runbook check) rather than Selenium. Noting here so they aren't silently assumed "covered" just because they're automated.

## Recommended next step once the sandbox is back

Script the gaps above sprint-2-additions-style, one file per module (mirroring the existing `sprint2/test_*.py` naming), reusing `automated-tests/selenium/helpers.py`. I'd want to actually run each new test against the live app before calling it done — writing Selenium scripts I can't execute is the same fabrication risk as marking manual cases "Pass" without running them.
