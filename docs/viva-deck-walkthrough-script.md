# Sprint 1 Review Deck — Presentation Script

Scoped to the actual 11-slide deck ("Blue Beige Geometry Group Project Presentation"), matched to the current page order. Speaker assignment per your split: pages 1-2 = Scrum Master (Dimanthi), pages 3-5 = Business Analyst (Diheli), page 6 = Developer (Dulathmi), product demo + page 7 = Developer (Dulathmi), pages 8-10 = each person's own retrospective, page 11 = whoever closes.

One open item before you present: **page 3 (Sprint 1 Backlog) still has a full paragraph of literal Lorem Ipsum placeholder text sitting above the "Sprint 1 Backlog" heading**, in the version you last uploaded. It wasn't removed. Delete it before the viva — a lecturer catches that instantly and it undercuts everything else. Everything else flagged in the last review (Use Case Diagram, ERD) has been fixed by honest retitling ("Entire Workflow" / plain "ER Diagram" instead of claiming a narrower scope they didn't have) rather than redrawing — that's a legitimate fix, not a shortcut, and the script below explains why below each of those slides in case she asks.

---

## Pages 1-2 — Dimanthi (Scrum Master)

### Page 1 — Cover

SAY: "Good [morning/afternoon]. We're presenting our Sprint 1 Review for the Recruitment Tracking System we're building for Altrium HR. I'm Dimanthi, the Scrum Master this sprint. With me are Diheli, our Business Analyst, and Dulathmi, our Developer and QA."

### Page 2 — Agile Roles and Sprint Goal

SAY: "Quickly, our roles this sprint: I led stand-ups, coordinated the schedule, and kept the sprint on track as Scrum Master. Diheli gathered and documented requirements and communicated scope across the team as Business Analyst. Dulathmi designed the schema, built the authentication system, and tested it end to end as Developer and QA."

SAY: "Our sprint goal was to identify Altrium's recruitment-tracking needs, analyze their existing manual process, and deliver the Sprint 1 foundation — the product backlog, acceptance criteria, test cases, our use case, activity, and sequence diagrams, an ERD, and low-fidelity wireframes."

SAY: "The core feature we're demonstrating today is CV Uploads and Last-Reviewed Tracking."

---

## Pages 3-5 — Diheli (Business Analyst)

### Page 3 — Sprint 1 Backlog

SAY: "Thanks, Dimanthi. I'm Diheli, the Business Analyst this sprint. This is our full 30-item Sprint 1 backlog, covering every role in the system — IT Admin, HR, Interviewer, Hiring Manager, Management, and Leadership. It ranges from foundational items like secure login and role-based permissions, through HR's core workflow — creating vacancies, uploading and screening CVs, scheduling interviews — up to reporting for Management and Leadership."

*If asked why the backlog is broader than the one core feature demoed today:* "The sprint goal required us to analyze the whole system first, so the backlog reflects everything Altrium needs — the core feature we're demonstrating is the one piece we took all the way from requirement to a working, tested build this sprint."

### Page 4 — Use Case Diagram

SAY: "This is our use case diagram for the entire system, not just the core feature — it shows every actor: HR, Interviewer, Management, Hiring Manager, Leadership Management, and IT Admin, and how each of their actions relate to one another across Candidate Management, Interview Management, Recruitment and Approval, and Administration."

*If asked why it's the whole system and not scoped to just CV uploads:* "Because analyzing the full workflow was part of the sprint goal, so this diagram documents the complete picture we analyzed — the core feature we built and tested this sprint is one part of it, which the next diagram zooms into specifically."

### Page 5 — Activity Diagram (Core Feature)

SAY: "This activity diagram is scoped specifically to our core feature — CV Uploads and Last-Reviewed Tracking."

SAY: "Walking through it: HR navigates to the vacancy list, selects a vacancy, views its candidate list, and selects a CV to review. HR reviews the candidate's qualifications against the job requirements. If minimum requirements aren't met, the CV is rejected and archived. If they are met, the candidate is shortlisted, and the system records the last-reviewed status — who reviewed it and when."

SAY: "The key mechanism, on the right: marking a CV as reviewed is a separate action from the Reject or Shortlist decision. The system only records a CV as reviewed when HR clicks View CV, specifically from the candidate's own page — opening the file and being on that candidate's page together. It can happen before, during, or even without a Reject or Shortlist decision ever being made."

---

## Page 6 — Dulathmi (Developer)

SAY: "I'll take it from here for the technical side. This is our ER diagram, covering the schema that supports the full system — Vacancy, User, Candidate, and the tables tracking applications, interview history, feedback, and audit logs."

*If asked why it's broader than just CV-review fields:* "The CV-review feature specifically only touches four fields on the Candidate table — the CV file reference, who last reviewed it, when, and an optional review note — but I've included the full schema here since it's what the whole system runs on, and it shows how those four fields connect to the rest: which vacancy and application they belong to, and which user reviewed them."

SAY: "Now I'll switch over and show you the actual feature running."

---

## Product Demo (live, alongside Page 7 — Test Cases)

Do this live in the app. Reset your demo data beforehand so it matches. Narrate each step as you click — don't click silently.

SAY: "I'll demonstrate the core feature end to end, matching the four test cases on the next slide."

### TCI-84 — Valid test case

CLICK: Log in as HR (Sharon Whitfield). Go to **Candidates**, click **Upload CV**.

SAY: "First, the valid case. I select which vacancy this CV is for, then pick the file."

CLICK: Select a vacancy from **Apply to Vacancy**. Choose a PDF CV. Click **Extract**.

SAY: "The system attempts to read the candidate's name, email, and phone straight out of the PDF. I can review and correct those before confirming."

CLICK: Point at the Name/Email/Phone fields, then click **Confirm & Apply**.

SAY: "That creates the candidate and links their CV to this vacancy. Now I'll open their profile and click View CV."

CLICK: Go back to **Candidates**, click into the new candidate's row, then click **View CV** on their page.

SAY: "That's the CV linked to the candidate, and now the reviewer's name and today's date are recorded — this is the exact moment the review gets stamped, not when the row was opened."

### TCI-85 — Invalid data

SAY: "Second case: an unsupported file type."

CLICK: Open **Upload CV** again, pick a non-PDF file (e.g. a .docx or .jpg), attempt to extract.

SAY: "The system rejects it and shows an error — the file is never uploaded."

### TCI-86 — Validation

SAY: "Third: what happens if required fields are missing."

CLICK: Upload a valid PDF, then on the review step, clear the Name and Email fields, click **Confirm**.

SAY: "It's blocked server-side — no candidate gets created without a name and email, even if the file itself uploaded fine."

### TCI-87 — Non-functional

SAY: "Last: an oversized file."

CLICK: Attempt to upload a file over 5MB.

SAY: "Rejected instantly, with no crash — there's a hard 5MB-per-file limit enforced before the file is ever processed."

SAY: "That's all four test cases, matching what's on the slide."

---

## Page 7 — Dulathmi (Developer), narrated alongside or right after the demo

SAY: "These are the four test cases I just demonstrated: TCI-84, a valid upload through to a recorded review; TCI-85, an invalid file type, rejected with an error; TCI-86, missing required data, blocked before a candidate is created; and TCI-87, an oversized file, rejected instantly with no crash."

---

## Pages 8-10 — Individual Retrospectives

Each person presents their own slide, in whatever order matches how you're standing/seated.

### Page 8 — Dimanthi (Scrum Master)

SAY: "For my retrospective: regular meetings kept the team connected, we contributed well to the required Sprint 1 activities, and we made steady progress toward the sprint goal. The main challenge was miscommunication during our MS Teams calls — sometimes the same information got interpreted differently by different team members, so we'd occasionally have to re-discuss a requirement. Next sprint, I'd use diagrams or examples where necessary to explain requirements more clearly, and summarise the main decisions to confirm everyone has the same understanding before moving forward."

### Page 9 — Diheli (Business Analyst)

SAY: "Client requirements were explicitly identified and communicated to the developer, and I drew clear UML diagrams — use case, sequence, and activity — to visualize the workflow the client described. I gave clear feedback to the developer during weekly meetings so client requirements stayed prioritized. The challenge was that the use case diagram needed multiple corrections and updates, and certain aspects of the activity diagrams needed multiple clarifications between myself and the developer. Next sprint, I'd make my specifications clearer by giving more detailed descriptions."

### Page 10 — Dulathmi (Developer and QA)

SAY: "I successfully built the features the BA specified from the requirements and diagrams, tested each one to confirm it matched what was asked, and fixed bugs found during testing before they reached the viva. The challenge was that the BA's diagrams didn't always specify enough detail for development — missing details surfaced while I was building the flow, so I identified them and passed them back to the BA along the way. Next sprint, I'd test every feature individually right after finishing it instead of leaving testing for later, and update the Jira board as each feature is completed instead of in a batch afterward."

---

## Page 11 — Thank You

SAY (whoever closes): "That's our Sprint 1 Review. Thank you — happy to take any questions."
