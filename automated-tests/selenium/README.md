# Altrium HR - Automated (Selenium) Test Suite

This is the automated, end-to-end companion to the manual test case documents
(`Sprint1_Manual_Test_Cases.docx`, `Sprint2_Additions_Manual_Test_Cases.docx`).
It drives a real Chrome browser against the running app the same way a human
tester would, using [Selenium WebDriver](https://www.selenium.dev/) in
Python -- the same approach used in the lecture (`WebDriverWait`, explicit
`By.ID` / `By.CSS_SELECTOR` locators, PASS/FAIL console output).

## Folder layout

```
automated-tests/selenium/
  helpers.py               shared login, waits, PASS/FAIL reporting, PDF fixture generator
  requirements.txt
  fixtures/                auto-generated test CV PDFs (created on first run)
  sprint1/
    test_login.py                    US-01 login, role redirects, IT Admin route
    test_hr_vacancies.py             US-04/05 vacancies, interview stages, panel
    test_hr_candidates_upload.py     US-06/07/08 CV upload/extraction, US-09/13/14 search
    test_hr_interviews.py            US-10/11/12 assign panel, schedule, add candidates
    test_hiring_manager_flow.py      US-13/14/17/25 HM review, decisions, comparison
    test_interviewer_feedback.py     US-17/22/25 feedback submission + validation
  sprint2/
    test_it_admin_users.py           US-02/03 user management + RBAC, password-gated actions
    test_audit_logs.py               US-21/43 audit log filtering
    test_hr_follow_ups.py            US-26/29/39 reminders, invites, real email delivery
    test_management_reports.py       US-31/32/33/37/38 dashboard, drill-downs, PDF reports
    test_leadership_reports.py       US-35/36/37/38 org-wide reports
    test_email_history_and_comparison.py   #43/#44 email history, comparison rework, branding
```

## One-time setup

```
pip install -r requirements.txt
```

You need Google Chrome installed. Selenium 4.6+ downloads a matching
`chromedriver` automatically the first time you run a script (via Selenium
Manager) -- you don't need to install chromedriver by hand.

## Before every run

Both servers must already be running, in two separate terminals:

```
# terminal 1
cd backend
npm run dev

# terminal 2
cd frontend
npm run dev
```

Every script calls `check_servers_are_up()` first and will stop immediately
with a clear message if either one isn't reachable, instead of failing every
single test with confusing "element not found" errors.

## Running the tests

Each file is runnable on its own, same as the lecture example:

```
cd automated-tests/selenium/sprint1
python test_login.py
```

Or run everything in a sprint back-to-back:

```
cd automated-tests/selenium/sprint1
for f in test_*.py; do python "$f"; done
```

(On Windows PowerShell: `Get-ChildItem test_*.py | ForEach-Object { python $_.FullName }`)

Each script opens and closes its own Chrome window per test (so one test's
leftover state can't bleed into the next one), prints `[PASS]`/`[FAIL]` per
test as it goes with a short pause in between so it's easy to watch and
narrate, and finishes with a `N/M passed` summary line.

## Seeded test accounts

All accounts use the password `password123` and already exist from
`backend/prisma/seed.ts`:

| Role | Email |
|---|---|
| HR | hr@altrium.com |
| Interviewer | interviewer@altrium.com |
| Management | management@altrium.com |
| Hiring Manager | hiringmanager@altrium.com |
| IT Admin (signs in at `/admin`, not `/login`) | itadmin@altrium.com |
| Leadership | leadership@altrium.com |
| Disabled account (negative-test fixture) | disabled@altrium.com |

## Evidence for the report

For the "automated testing evidence" section of your report, a **screen
recording of a script running** (console PASS/FAIL output + the browser
visibly clicking through each screen) is what a video would show; since the
report can't embed video, take a few screenshots instead: the terminal
output showing `N/M passed`, plus 1-2 screenshots of the browser mid-test on
a page that's clearly a UI, not just code. A plain screenshot of the *source
code* is weaker evidence on its own -- it proves the test exists, not that it
ran and passed.

## Notes on test design

- Where a test's outcome depends on specific seed data that may or may not
  exist (e.g. "a vacancy with no panel yet", "a candidate who was already
  emailed"), the script checks for that precondition at runtime and reports
  a **skip with an explanation** rather than a false failure. This keeps the
  suite meaningful regardless of exactly what's in the database when it's
  run, while still exercising the real UI flow whenever the data allows it.
- `helpers.make_test_pdf()` hand-builds a minimal valid PDF (with a correct
  xref table) so the CV upload tests have a real file to feed to the file
  input -- no extra PDF-generation library needed.
- These tests assume the seed data in `backend/prisma/seed.ts` hasn't been
  wiped. If your team reset the database, re-run the seed script first:
  `cd backend && npx prisma db seed`.
