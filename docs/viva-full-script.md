# Full Product Demonstration Script — Sprint 01 Viva

Word-for-word narration and exact click sequence for every screen, role by role. Say the SAY lines close to as written — they're phrased to be specific on purpose (exact screen names, exact button labels) so there's no vague wording for the lecturer to poke at. Do CLICK actions in order. Run the full reset sequence from the runbook the night before so the data matches what's described here.

---

## How to answer "how does X work" follow-ups

Your lecturer will not accept a vague answer to a mechanism question — she'll keep asking until you name the actual steps. Here's the login example fully worked out, as a template for any other "how does X work" question she throws at you:

**Q: How does login work?**

"When I click Log In, the frontend sends my email and password to the backend over an API call. The backend looks up a user account by that email. If no account matches, it returns a generic 'incorrect username or password' error — it never says whether the email itself was wrong, so no one can use the login form to check which emails exist in the system. If the email does match, the backend compares the password I typed against a hashed password stored in the database — the real password is never stored anywhere, only a hash of it. If the hash matches, the backend creates a signed token (a JWT) that proves who I am, sends it back to the frontend, and the frontend stores that token and uses it to prove my identity on every future request. The token also carries my role, which is what decides which screens and buttons I'm allowed to see next."

Use the same pattern for anything else she asks about — name the actual step order, name what's being checked, name what happens on both the success and failure path. Don't say "it checks the database and comes back" — say what it checks, and what "comes back" actually means (an error message, a redirect, a token).

---

## Before you start

Log out of any existing session. Have the credentials sheet open on a second screen or printed — you will be switching accounts constantly.

---

## 1. HR — Sharon Whitfield (sharon@altrium.com / Sharon@2026)

SAY: "I'll start by showing you the HR Officer screens. First, I'll log in as Sharon Whitfield, who holds the HR role."

CLICK: Go to the login page. Type the email and password. Click **Log In**.

SAY: "After logging in, I land on the Vacancies screen. This is organized by department — each card here is one of Altrium's eight departments."

### Vacancies

CLICK: Land on **Vacancies**.

SAY: "I'll click into the IT department to see the vacancies inside it."

CLICK: Click the **IT** department card.

SAY: "Now I see every vacancy currently open under IT. I'll open Backend Engineer specifically."

CLICK: Click the **Backend Engineer** vacancy.

SAY: "This vacancy has three interview rounds configured: Technical Interview, Panel Interview, and Final Interview. HR sets these rounds up when the vacancy is created. Once any candidate has actually entered a round, this list locks — HR can no longer add, rename, reorder, or delete rounds on this vacancy."

CLICK: Click **← IT** to go back to the department's vacancy list, then **← Departments** to go back to the department grid.

### Candidates

CLICK: Click **Candidates** in the sidebar.

SAY: "This screen shows one row per candidate application — not per candidate. If the same person applied to two different vacancies, they show up as two separate rows here, one per vacancy, each with its own stage and status."

SAY: "At the top I can filter by status, vacancy, or a minimum interview score."

CLICK: Click **View** next to any candidate's CV.

SAY: "That opens the actual CV file in a new tab, without needing to open the candidate's full profile first."

CLICK: Click directly on a candidate's name (use Elias Vogt) to open their full profile.

SAY: "Now I'll open a candidate's full profile page."

### Candidate Detail Page

SAY: "At the top is the CV section. Clicking View CV opens the file, and this exact click is what marks the CV as reviewed — the timestamp only updates when this button is clicked, not just from opening this page."

CLICK: Click **View CV**.

SAY: "Below that is Review Notes, showing who last reviewed this CV and when, along with a free-text note HR can leave while screening. Once this candidate is shortlisted or rejected, this note locks and can no longer be edited."

SAY: "Next is Applicant History, which lists every vacancy this exact person has applied to, in case they've applied more than once."

SAY: "Below that is Email History — every automated email actually sent to this candidate, pulled from the system's real send log, not a static list."

SAY: "Then Hiring Manager — this is where HR assigns a Hiring Manager to the application. This control is locked until the candidate has actually been shortlisted, so a Hiring Manager can't be attached to someone who hasn't cleared CV screening yet."

SAY: "Further down are Upcoming Interviews and Completed Interviews, showing any interview slots this candidate is part of."

SAY: "And at the very bottom are the Shortlist and Reject buttons — this is where HR makes the CV-screening decision."

CLICK: Scroll to the bottom, point at **Shortlist** and **Reject** without clicking (don't change real demo data unless you mean to).

### Upload CV

CLICK: Go back to **Candidates**. Click **Upload CV** (top right).

SAY: "This opens the Upload CV flow. First I choose which vacancy this CV is for."

CLICK: Select a vacancy from the **Apply to Vacancy** dropdown.

SAY: "Then I select the CV file. This same flow handles both a single file and multiple files at once — there's no separate bulk upload screen."

CLICK: Choose the CV file (or files). Click **Extract**.

SAY: "The system attempts to read the candidate's name, email, and phone number straight out of the PDF. On the Review step, I can check and correct those fields before confirming."

CLICK: Point at the Name/Email/Phone fields on the Review step.

SAY: "Once I click Confirm & Apply, a new candidate record is created and linked to this vacancy."

CLICK: Click **Confirm & Apply** (or close the modal without submitting if you don't want to create test data live).

### Interviews

CLICK: Click **Interviews** in the sidebar.

SAY: "This is a calendar view of every interview scheduled across all vacancies. I can click into any day to see the interviews scheduled for it, and schedule a new one from here — picking a date, time, interview panel, and which round it's for."

### Follow Ups

CLICK: Click **Follow Ups** in the sidebar.

SAY: "This page groups together everything currently waiting on HR's action, in five sections."

SAY: "Pending CV Review — candidates who've applied but haven't been screened yet."

SAY: "Pending Feedback — interviews that have already happened, where a panelist still hasn't submitted their feedback. HR can send a reminder email directly from this row."

SAY: "Interview Invites - Interviewers and Interview Invites - Candidates — people who haven't received their invitation for an upcoming interview yet."

SAY: "And Calls — upcoming interviews coming up soon."

---

## 2. Interviewer — Marcus Feldman (marcus@altrium.com / Marcus@2026)

SAY: "Now I'll log out and log in as an Interviewer."

CLICK: Log out. Log in as Marcus.

SAY: "Interviewers land on My Interviews, a calendar of interviews they're a panelist on."

### My Interviews

CLICK: Land on **My Interviews**.

SAY: "Clicking a past day shows a completed interview and lets me open its feedback form. Clicking a future day shows the interview details but not a feedback form yet, since it hasn't happened."

CLICK: Click a past day with an interview, then a future one, to show the contrast.

### My Candidates

CLICK: Click **My Candidates** in the sidebar.

SAY: "This lists every candidate assigned to interviews I'm on. Clicking a candidate whose interview hasn't happened yet shows a CV-only view. Clicking one whose interview has already happened opens the feedback form directly."

CLICK: Click a candidate with a completed interview.

SAY: "Here I enter a numeric score and written comments, and submit."

SAY: "If I try to edit feedback someone else submitted, the system blocks it — I can only edit feedback I personally authored, and even then I have to give a reason, which gets recorded in an audit trail."

---

## 3. Hiring Manager — Victor Adeyemi (victor@altrium.com / Victor@2026)

SAY: "Next, the Hiring Manager role."

CLICK: Log out. Log in as Victor.

### Dashboard

CLICK: Land on **Dashboard**.

SAY: "This shows KPI tiles for the vacancies I'm responsible for, plus filters by date, vacancy, and department."

### Vacancies

CLICK: Click **Vacancies**.

SAY: "This lists the vacancies assigned to me. Clicking into one shows every candidate on that vacancy and their current stage."

CLICK: Click into a vacancy, then click a candidate.

SAY: "From here I can view their interview feedback and record a decision — Proceed to the next round, Do Not Proceed, or at the final round, Hire or Reject."

### Candidate Comparison

CLICK: Click **Candidate Comparison**.

SAY: "I select a vacancy, and the system automatically pulls the top 5 shortlisted candidates by their latest-round feedback score — there's no manual selection step. It shows a ranking chart, score distribution, and comments for each."

### Pending Decisions

CLICK: Click **Pending Decisions**.

SAY: "This lists every candidate currently waiting on a decision from me, with a comments field alongside the Proceed / Do Not Proceed action."

### Decision History

CLICK: Click **Decision History**.

SAY: "This is a log of every hire and reject decision I've made, each with the comment I gave at the time."

---

## 4. Management — Elena Torres (elena@altrium.com / Elena@2026)

SAY: "Now the Management role — I'll log in as Elena, who covers the IT department."

CLICK: Log out. Log in as Elena.

### Dashboard

CLICK: Land on **Dashboard**.

SAY: "This shows KPI tiles for the department — open vacancies, total applicants, time to hire — plus a Needs Attention section flagging anything overdue."

### Department Vacancies

CLICK: Click **Department Vacancies**.

SAY: "This lists every vacancy in my department, IT, with its recruitment progress."

### Candidates

CLICK: Click **Candidates**.

SAY: "This shows candidate progress across the department, grouped by stage."

### My Interviews

CLICK: Click **My Interviews**.

SAY: "A calendar of upcoming interviews in my department. Management is required to attend the final interview round for any candidate, so this is how I keep track of those."

### Reports

CLICK: Click **Reports**.

SAY: "I can generate a report for any vacancy, open or closed, and export it as a PDF."

CLICK: Click **Export as PDF** on a report.

---

## 5. Leadership — Daniel Osei (daniel@altrium.com / Daniel@2026)

SAY: "Now Leadership Management."

CLICK: Log out. Log in as Daniel.

### Recruitment Overview

CLICK: Land on **Recruitment Overview**.

SAY: "This is the organization-wide dashboard — recruitment data from every department in one place, with a Needs Attention section for anything overdue across the whole company."

### Department Performance

CLICK: Click **Department Performance**.

SAY: "This compares fill rate, average time to hire, and other KPIs across every department, so leadership can see which departments are ahead and which are falling behind."

### Hiring Trends

CLICK: Click **Hiring Trends**.

SAY: "This is an 8-month rolling chart of hiring activity across the organization."

### Export Reports

CLICK: Click **Export Reports**.

SAY: "Same PDF export capability as Management, but scoped to the whole organization instead of one department."

---

## 6. IT Admin — Naomi Clarke (naomi@altrium.com / Naomi@2026)

SAY: "Finally, IT Admin."

CLICK: Log out. Log in as Naomi.

### Users

CLICK: Land on **Users**.

SAY: "This lists every account in the system. I can create a new user, or open an existing one to edit their role, department, or deactivate them."

CLICK: Click **Create User**.

SAY: "Creating a user needs a name, contact number, email, an initial password, a role, and a department. Submitting asks me to re-enter my own IT Admin password before the account is actually created, as a confirmation step."

CLICK: Cancel out, or fill it in with the demo values from the credentials doc.

### Audit Logs

CLICK: Click **Audit Logs**.

SAY: "Every meaningful action in the system — creating a vacancy, uploading a CV, submitting feedback, deactivating an account — gets logged here with who did it and when. Regular users can't modify or delete these entries; only the log itself records what happened."

### System

CLICK: Click **System**.

SAY: "This shows live server metrics — load, response time, active users — and further down, real database backups. Each row here is a real file on disk, not a simulated one."

CLICK: Click **Run Backup Now**.

SAY: "That triggers a real backup immediately, and a new row appears with today's date. This same backup also runs automatically every night at 3 AM without anyone clicking anything, and either way, every run — manual or automatic — leaves a matching entry on the Audit Logs page as proof it actually happened."

### Notification Templates

CLICK: Click **Notification Templates**.

SAY: "This lists every automated email the system sends — interview invitations, hiring decisions, password resets, reminders — and IT Admin can edit the subject and body text of each one without touching any code."

---

## Likely "why" follow-up questions

These are prepared answers for the kind of question she won't let go of until you name the actual reasoning — not just what the system does, but why it was built that way. Checked against the real code, not guessed.

**Q: Why is the password only stored as a hash, never the real password?**

"If the database were ever compromised and passwords were stored as plain text, every account is exposed instantly — and since people reuse passwords across sites, that exposure spreads beyond just this system. Storing a hash instead means even a stolen copy of the database only contains hashes, not passwords. Bcrypt is one-way — you can't reverse a hash back into the original password — so the only way to check a login is to hash the attempt the same way and compare the two hashes. Bcrypt also has a built-in cost factor, 10 in this system, which controls how many internal rounds it runs — that makes each hash slow enough that guessing passwords at scale is impractical, without making one real login noticeably slow. And bcrypt generates a random salt per hash, so two users with the same password don't produce the same hash — you can't just scan the database and spot who shares a password."

**Q: Why email instead of a username?**

"Usernames can collide — two people can want the same one. Email addresses already have to be unique in this system regardless, because the system uses them to send notifications, interview invites, and password resets. Reusing that already-unique field as the login identifier means there's no separate username to register or remember, and it matches how candidates are identified too — by email, not a name someone typed in. It's one less field to manage and one less way for two records to quietly be the same person."

**Q: Why restrict CV uploads to PDF only?**

"The system needs to reliably extract name/email/phone out of the file and reliably render it back when HR clicks View CV. PDF is the one format that supports both consistently, and it's already the standard format CVs come in, so restricting to it keeps extraction and viewing predictable instead of trying to support every file type."

**Q: Why a 5MB / 20-file limit?**

"A real CV is well under a megabyte or two even with formatting, so 5MB comfortably covers one while still blocking something that isn't actually a CV. The 20-file cap keeps a single upload request from processing an unbounded number of files at once, since every file in the batch gets extracted in that same request."

**Q: Why does clicking View CV specifically count as the review, not a separate checkbox?**

"The goal was to record something actually true — that a person opened the file — rather than adding a second step HR could tick without ever looking. Tying the record to the same button that opens the file means it can't drift out of sync: there's no way to mark it reviewed without opening it, and no way to open it without it being recorded."

**Q: Why track who/when instead of just a reviewed yes/no flag?**

"A flag only says it's been looked at once, ever. Tracking who and when means if two HR officers work the same vacancy, either one can see who already looked at it and when, instead of duplicating work — and it's literally what the story asked for, not just yes/no."

**Q: Why can bulk upload skip one bad file instead of failing the whole batch?**

"If one file out of ten is the wrong format, failing the entire batch means re-uploading nine good files all over again. Letting the good ones succeed and only flagging the bad one matches how HR would actually want to work."

---

## After the demo

Per the brief, the demo happens after Slide 5 (ERD) and before Slide 6 (Test Cases) — don't forget to pause the deck there, run through this script, then go back to the deck for Test Cases.
