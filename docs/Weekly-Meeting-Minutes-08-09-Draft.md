# Weekly Meeting Minutes — Meetings 08 & 09

*Note: written to match the format/style of Meetings 01–07 in your existing Weekly Meeting Minutes.docx, for you to paste in. See the note at the end of this file about why it's not delivered as a .docx directly this time.*

---

## Meeting Number: 08

**Date and Time:** 2026/08/31, 12:00PM

**Present:**
Dimanthi Hewagama
Diheli Abeysinghe
Dulathmi Dunuwile

**Items for discussion:**
- Reviewing Sprint 1 finalisation and the Sprint 1 review outcome
- Cross-checking every role's screens against the agreed wireframes/corrections document
- Wiring up real outbound email
- Planning automated testing and Sprint 2 scope

**Record of discussion:**

The team reviewed the corrections carried out across all six role dashboards (HR, Interviewer, Hiring Manager, Management, Leadership Management and IT Administrator) against the agreed wireframes and the team's corrections document, closing out the layout, navigation and data issues identified after Sprint 1 review on 28 August. Screens for candidate review and comparison, progress tracking, and system administration (users, audit logs, system monitoring) were confirmed to be functioning and consistent with the design.

The team noted that outgoing system emails (interview scheduling, hiring decisions, password resets) were still only logging to the console rather than actually sending, and agreed this needed to be wired to a real mail provider before it could be demonstrated convincingly.

For the coming week, the team planned to connect real SMTP email delivery and add an Email History record to the candidate view, set up an automated test suite (unit tests for backend business logic and frontend components, plus end-to-end browser tests covering Sprint 1 and Sprint 2 functionality) so regressions could be caught automatically rather than by manual re-testing, and produce a cloud deployment guide so the system could be hosted outside a local machine as required by the module.

The team also reconciled the Sprint 2 items on the group's backlog board against what had actually been built, and identified four stories genuinely still outstanding: automatic interview reminder emails, explicit duplicate-candidate detection during CV upload, IT-Admin-configurable notification templates, and an in-app notification inbox. The team agreed to build all four during the coming week.

Before concluding the meeting, the team agreed to conduct the next meeting on 7th of September 2026.

**Action table:**

| Action No. | Action Required | Success criteria | By When | By whom | Status |
|---|---|---|---|---|---|
| 1 | Wire real SMTP email delivery and add Email History to the candidate view | Interview, hiring-decision and reset emails are actually delivered and logged | 2026/09/02 | All members | Not Started |
| 2 | Set up an automated test suite (unit + end-to-end) covering Sprint 1 and Sprint 2 | Backend/frontend unit tests and a Selenium E2E suite run and pass | 2026/09/04 | All members | Not Started |
| 3 | Produce a cloud deployment guide and fix any hard-coded local-only assumptions | System can be hosted on a cloud platform, not just localhost | 2026/09/05 | All members | Not Started |
| 4 | Build the four confirmed outstanding Sprint 2 stories (reminders, duplicate detection, notification templates, in-app notifications) | All four stories function end-to-end | 2026/09/06 | All members | Not Started |

---

## Meeting Number: 09

**Date and Time:** 2026/09/07, 12:00PM

**Present:**
Dimanthi Hewagama
Diheli Abeysinghe
Dulathmi Dunuwile

**Items for discussion:**
- Reviewing the delivered Sprint 2 stories and testing infrastructure
- Reviewing a wave of real bugs found during live use
- Adding interview panel management
- Planning final pre-viva preparation

**Record of discussion:**

The team confirmed the four outstanding Sprint 2 stories were completed and working: an automated interview-reminder job, explicit duplicate-candidate detection on CV upload, configurable notification templates for IT Admin, and an in-app notification bell across every role. Real email delivery, the unit-test suites, and the end-to-end test suites covering Sprint 1 and Sprint 2 were also confirmed working, along with the cloud deployment guide.

Live use of the system after these changes surfaced several genuine bugs, which the team reviewed and closed out: a login crash caused by a missing error handler, a server crash from a naming collision that had been silently stopping the backend from starting, and a session bug where logging into a different role in one browser tab silently broke every other open tab — fixed by scoping login sessions per tab instead of sharing them across the whole browser. Styling was also unified across every dashboard's summary tiles so they look and behave consistently regardless of role.

The team agreed to add a forced password-change step for new accounts on first login, and to let HR create and reuse named interview panels instead of re-selecting the same interviewers individually every time.

For the coming week, with the viva presentation approaching, the team planned to reset the system's demo data to a clean, realistic dataset, generate the department-level and organisation-wide PDF reports, add visibility of interview feedback edit history for Hiring Managers and interviewers, and rebuild the ER diagram and supporting documentation to accurately reflect the final schema ahead of the presentation.

Before concluding the meeting, the team agreed to conduct the next meeting on 14th of September 2026.

**Action table:**

| Action No. | Action Required | Success criteria | By When | By whom | Status |
|---|---|---|---|---|---|
| 1 | Reset and rebuild demo/seed data for a clean, realistic viva walkthrough | Every role has consistent, realistic demo data across all screens | 2026/09/09 | All members | Not Started |
| 2 | Generate department-level and organisation-wide PDF reports | Reports produce correct data for every department and role | 2026/09/09 | All members | Not Started |
| 3 | Surface interview feedback edit history to Hiring Managers and interviewers | Edited feedback shows who changed it, when, and why | 2026/09/10 | All members | Not Started |
| 4 | Rebuild the ER diagram and supporting documentation for the viva | Diagram and docs match the current schema exactly | 2026/09/11 | All members | Not Started |

---

### A note on how this was built

The project's decision log records roughly 300 individual work passes but only timestamps a handful of them explicitly (Aug 21, Aug 22, Aug 31). To avoid inventing dates I don't have, I anchored on the one exact date that does appear (Aug 31, matching Meeting 08) and on your own weekly Monday cadence (confirmed by Meetings 01–07) to work out that only two more meetings — Aug 31 and Sep 7 — fit between your last recorded meeting and today (Sep 11, a Friday, before the next Monday). I then grouped the log's actual chronological work into those two meetings by topic and rough position in the log, not by guessing exact per-day dates. Everything named above (the four Sprint 2 stories, the specific bugs, the panel feature, etc.) is real, cross-checked work from the log — nothing here is filler. If you recall this actually spanning more than two calendar weeks, tell me and I'll split it further rather than compress it.
