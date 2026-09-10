# Altrium HR — Sprint 01 Viva Demo Runbook

Everything below assumes the full reset sequence has already been run (see "Before you start"). Log-in credentials, a role-by-role walkthrough referencing real seeded data, and copy-paste-ready values for the three live "create" demos are all here so nothing needs to be improvised on the day.

---

## Before you start

Run in order, from `backend/`:

```
npx prisma migrate reset
npx prisma db seed
npx tsx scripts/seed-viva-demo.ts
npx tsx scripts/seed-notification-templates.ts
```

Then fully stop and restart the backend (Ctrl+C, then `npm run dev` again — don't rely on watch-mode picking up everything). Hard-refresh the frontend tab. Do this the night before or the morning of, not mid-viva.

Quick sanity checks before you walk in:
- Log in as `elena@altrium.com` → Reports → Export any report → confirm it downloads and opens (this was broken twice before, confirm it's clean now).
- Check `backend/backups/` has at least one `.sql` file, or click "Run Backup Now" on the System page once to seed one.
- Have the CV file (`Freddie_Sandhu_CV.pdf`, sent separately) saved somewhere fast to reach — Desktop, not buried in Downloads.

---

## Full credentials list

| Name | Email | Password | Role | Department |
|---|---|---|---|---|
| Sharon Whitfield | sharon@altrium.com | Sharon@2026 | HR | HR |
| Rachel Kim | rachel@altrium.com | Rachel@2026 | HR | Talent Acquisition — **inactive**, use only to show IT Admin's Deactivate control |
| Marcus Feldman | marcus@altrium.com | Marcus@2026 | Interviewer | IT |
| Jordan Blake | dulzxitzy@gmail.com | Jordan@2026 | Interviewer | IT — real inbox, see note below |
| Victor Adeyemi | victor@altrium.com | Victor@2026 | Hiring Manager | IT |
| Naomi Clarke | naomi@altrium.com | Naomi@2026 | IT Admin | IT |
| Daniel Osei | daniel@altrium.com | Daniel@2026 | Leadership Management | Leadership |
| Elena Torres | elena@altrium.com | Elena@2026 | Management | IT |
| Bianca Whitmore | bianca@altrium.com | Bianca@2026 | Management | Marketing |
| Derek Holloway | derek@altrium.com | Derek@2026 | Management | Sales |
| Fatima Rasheed | fatima@altrium.com | Fatima@2026 | Management | Customer Service |
| Callum Ferris | callum@altrium.com | Callum@2026 | Management | HR |
| Nadia Petrov | nadia@altrium.com | Nadia@2026 | Management | Finance and Accounting |
| Owen Sinclair | owen@altrium.com | Owen@2026 | Management | Operations |
| Miriam Cole | miriam@altrium.com | Miriam@2026 | Management | Legal |

**Note on Jordan Blake:** this is the one account with a real, checkable inbox (currently `dulzxitzy@gmail.com` — tell me the replacement address whenever you've got it and I'll update this and the seed data together). Use it to show a live email actually arriving: it's a third panelist on Camille Dupont's HR Business Partner interview (Follow Ups → Pending Feedback, first row) and on Elias Vogt's Final Interview (Follow Ups → Interview Invites - Interviewers, first row).

---

## Recommended run-of-show

### 1. HR (Sharon)

- **Vacancies** → click into IT → point out **Backend Engineer** now has 3 rounds (Technical → Panel → Final), each candidate at a different point in the pipeline.
- **Candidates** → open **Elias Vogt** → show the CV, the locked Review Note (shortlisted, so it's read-only, sized to the note itself, no Save button) → Applicant History → Email History (scales with how far he's progressed).
- **Candidates** → open **Freya Lindqvist** → show her Review Note is *also* locked, but the hint text explains why differently ("rejected at CV review") — contrast the two lock reasons live.
- **Follow Ups** → walk all five sections: Pending CV Review, Pending Feedback (Camille — first row goes to Jordan's real inbox), Interview Invites - Candidates/Interviewers (Elias — same real-inbox routing), Upcoming Calls.

### 2. Interviewer (Marcus, or Jordan for the real-inbox angle)

- **My Interviews** calendar → click a past day → show a completed interview's feedback form.
- **My Candidates** → click a *future* interview → show the CV-only view (no disabled form) with the "View CV" button.
- Log in as Jordan Blake once, check the real inbox on your phone/second screen for the reminder/invite emails that were routed there.

### 3. Hiring Manager (Victor)

- **Candidate Comparison** → switch the vacancy dropdown through a few departments (Legal, Marketing, Sales) → show a genuine Top 5 ranking on each, not a single row.
- **Decision History** → point at **Baptiste Laurent** (Hired) and **Dimitri Popescu** (Rejected) — both now show a real typed comment in the Comments column, not "--". Contrast with **Freya Lindqvist**'s row, which correctly stays blank (CV-stage reject, never reached an HM decision) — good moment to explain the distinction if asked.
- **Pending Decisions** → show a Proceed/Do Not Proceed action with the comments field.

### 4. Management (Elena for IT, or pick a department account)

- **Dashboard** → KPI tiles, stage counts.
- **Vacancies** → now shows 2 vacancies per department (e.g. IT: Backend Engineer + QA Engineer) instead of one.
- **Reports** → Export a report → confirm the download opens (this is the one that broke twice before — worth demonstrating deliberately since it's fixed).
- **My Candidates** → click a final-round candidate → submit/view a score.

### 5. Leadership (Daniel)

- **Department Performance** → fill rate, avg time-to-hire, best/fastest/overdue KPIs.
- **Hiring Trends** → 8-month rolling chart.

### 6. IT Admin (Naomi)

- **Users** → point out Rachel Kim's inactive pill, and department values on Sharon/Daniel/Naomi's own rows (cosmetic, explained if asked).
- **Notification Templates** → show the two new ones (**Pending CV Reviews - Daily Digest**, **Overdue Interview Feedback**) alongside the originals — same page, same mechanism, all email templates.
- **Audit Logs** → filter to today, find a `SYSTEM_BACKUP_RUN` entry if you clicked "Run Backup Now" earlier.
- **System** → Server Load / Response Time / Concurrent Users tiles, Active Users table, then **Backups**: point at a real filename + real KB size in the table, click **"Run Backup Now"** live, watch a new row appear with today's timestamp. This is real — not a simulation — worth saying explicitly.

---

## Live "create new" demo — copy-paste values

### A. Create Vacancy (HR → Vacancies → IT → "Create Vacancy")

The department is set by which department card you're inside when you click Create — go into **IT** first.

| Field | Value |
|---|---|
| Title | `DevOps Engineer` |
| Description | `Own our CI/CD pipeline and cloud infrastructure, working closely with the backend team on deployment reliability.` |
| Requirements | `3+ years' experience with CI/CD pipelines and cloud infrastructure (AWS or equivalent). Comfortable with infrastructure-as-code.` |
| Preferred Skills | `Terraform, Docker, Kubernetes, monitoring/alerting tooling` |
| Expected Hiring Date | leave blank, or pick any date a few weeks out |

Click **Save** — the modal flips into edit mode with an Interview Stages section. Add two rounds, in order:

1. `Technical Interview`
2. `Final Interview`

### B. Upload CV (HR → Candidates → "Upload CV")

1. **Apply to Vacancy** dropdown → select `DevOps Engineer - IT` (the one you just created).
2. Drag in **Freddie_Sandhu_CV.pdf** (sent separately — download it before the viva).
3. Click **Extract** → on the Review step, the Name/Email/Phone fields should auto-fill from the PDF. If any field comes through empty (extraction isn't guaranteed), type in:
   - Name: `Freddie Sandhu`
   - Email: `freddie.sandhu@example.com`
   - Phone: `+44 7700 900200`
4. Click **Confirm & Apply**.

### C. Create User (IT Admin → Users → "Create User")

| Field | Value |
|---|---|
| Name | `Priya Natarajan` |
| Contact Number | `0771234567` (must match `07XXXXXXXX` or `+947XXXXXXXX` — this validation is Sri Lankan format specifically) |
| Email | `priya.natarajan@altrium.com` |
| Initial Password | `Priya@2026` |
| Role | `Interviewer` |
| Department | `IT` |

Submit → you'll be asked for **your own** IT Admin password (Naomi's — `Naomi@2026`) to confirm before the account is actually created.

---

## If something goes wrong live

- **Export Report fails again:** check the backend terminal immediately — the real error prints there. Don't just retry silently.
- **Extraction doesn't fill in Freddie Sandhu's fields:** not a bug, PDF text extraction isn't guaranteed — type the three fields manually and keep going, it's a two-second recovery, not a crash.
- **A screen looks empty that shouldn't:** almost certainly means the reset+reseed sequence wasn't run, or the backend wasn't restarted after it. Don't debug live — note it and move to the next section.
