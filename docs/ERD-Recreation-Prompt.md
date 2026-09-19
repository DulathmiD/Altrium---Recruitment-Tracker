# Prompt: recreate the Altrium HR ERD

Copy everything below into any AI tool or diagramming assistant to regenerate the exact same ERD I built (`docs/Altrium_HR_ERD_Corrected.drawio`) from scratch. It's the full spec pulled directly from `backend/prisma/schema.prisma` — every table, field, type, and relationship — so nothing has to be guessed or re-derived.

---

**PROMPT STARTS HERE**

Create a complete Entity-Relationship Diagram (as a draw.io / .drawio XML file) for a recruitment-tracking system called Altrium HR. Use the exact 18 tables, fields, and relationships below — do not add, remove, or rename anything. For each table, show every field with its data type, and mark primary keys, foreign keys, and unique/index constraints using plain bracket notation — `[PK]`, `[FK]`, `[unique]`, `[index]` — not angle brackets (angle-bracket text like `<PK>` risks being silently swallowed by draw.io's HTML-in-XML rendering and not displaying at all).

Group the 18 tables into these 8 logical clusters when laying out the diagram, left-to-right or top-to-bottom in this order:
1. Identity — User
2. Vacancy setup — Vacancy, VacancyStage
3. Panel staffing — VacancyInterviewer, InterviewPanel, InterviewPanelMember
4. Candidate & pipeline — Candidate, CandidateApplication
5. Pipeline history — ApplicationStageHistory, StageRecommendation
6. Interview execution — InterviewSlot, InterviewPanelist, Interview
7. Feedback — Feedback, FeedbackAuditLog
8. System-level — AuditLog, NotificationTemplate, Notification

### Tables

**User**
- id: Int [PK]
- name: String
- email: String [unique]
- passwordHash: String
- role: Enum(HR, INTERVIEWER, MANAGEMENT, HIRING_MANAGER, IT_ADMIN, LEADERSHIP_MANAGEMENT)
- department: String, nullable
- phoneNumber: String, nullable
- isActive: Boolean, default true
- mustChangePassword: Boolean, default false
- createdAt: DateTime
- resetTokenHash: String, nullable
- resetTokenExpiresAt: DateTime, nullable
- lastActiveAt: DateTime, nullable

**Vacancy**
- id: Int [PK]
- title: String
- department: String
- description: Text
- requirements: Text, nullable
- preferredSkills: Text, nullable
- status: Enum(OPEN, CLOSED, ON_HOLD), default OPEN
- createdAt: DateTime
- targetFillDate: DateTime, nullable
- [unique] on (title, department)

**VacancyStage**
- id: Int [PK]
- vacancyId: Int [FK -> Vacancy.id]
- name: String
- order: Int
- [unique] on (vacancyId, order)

**VacancyInterviewer**
- id: Int [PK]
- vacancyId: Int [FK -> Vacancy.id]
- userId: Int [FK -> User.id]
- [unique] on (vacancyId, userId)

**InterviewPanel**
- id: Int [PK]
- vacancyId: Int [FK -> Vacancy.id]
- name: String
- createdAt: DateTime
- [unique] on (vacancyId, name)

**InterviewPanelMember**
- id: Int [PK]
- panelId: Int [FK -> InterviewPanel.id]
- userId: Int [FK -> User.id]
- [unique] on (panelId, userId)

**Candidate**
- id: Int [PK]
- name: String
- email: String [unique]
- phoneNumber: String, nullable
- cvUrl: String
- createdAt: DateTime
- lastCvReviewedByUserId: Int, nullable [FK -> User.id]
- lastCvReviewedAt: DateTime, nullable
- lastCvReviewNote: Text, nullable

**CandidateApplication**
- id: Int [PK]
- candidateId: Int [FK -> Candidate.id]
- vacancyId: Int [FK -> Vacancy.id]
- stage: Enum(APPLIED, SHORTLISTED, HIRED, REJECTED), default APPLIED
- appliedAt: DateTime
- currentVacancyStageId: Int, nullable [FK -> VacancyStage.id]
- hiringDecision: Enum(HIRE, REJECT), nullable
- decidedByUserId: Int, nullable [FK -> User.id]
- decidedAt: DateTime, nullable
- hiringManagerId: Int, nullable [FK -> User.id]
- [unique] on (candidateId, vacancyId)

**ApplicationStageHistory**
- id: Int [PK]
- applicationId: Int [FK -> CandidateApplication.id]
- stage: Enum(APPLIED, SHORTLISTED, HIRED, REJECTED), nullable
- vacancyStageId: Int, nullable [FK -> VacancyStage.id]
- enteredAt: DateTime
- exitedAt: DateTime, nullable
- changedByUserId: Int, nullable [FK -> User.id]
- (business rule: exactly one of `stage` / `vacancyStageId` is set per row, never both, never neither)

**StageRecommendation**
- id: Int [PK]
- applicationId: Int [FK -> CandidateApplication.id]
- hiringManagerId: Int [FK -> User.id]
- recommendation: Enum(ADVANCE, DO_NOT_PROGRESS)
- comments: Text, nullable
- createdAt: DateTime

**InterviewSlot**
- id: Int [PK]
- vacancyStageId: Int [FK -> VacancyStage.id]
- scheduledAt: DateTime
- roundLabel: String, nullable
- createdAt: DateTime
- reminderSentAt: DateTime, nullable

**InterviewPanelist**
- id: Int [PK]
- slotId: Int [FK -> InterviewSlot.id]
- userId: Int [FK -> User.id]
- [unique] on (slotId, userId)

**Interview**
- id: Int [PK]
- slotId: Int [FK -> InterviewSlot.id]
- applicationId: Int [FK -> CandidateApplication.id]
- createdAt: DateTime
- [unique] on (slotId, applicationId)

**Feedback**
- id: Int [PK]
- interviewId: Int [FK -> Interview.id]
- interviewerId: Int [FK -> User.id]
- score: Int
- comments: Text
- createdAt: DateTime
- [unique] on (interviewId, interviewerId)

**FeedbackAuditLog**
- id: Int [PK]
- feedbackId: Int [FK -> Feedback.id]
- editedByUserId: Int [FK -> User.id]
- previousScore: Int
- previousComments: Text
- newScore: Int
- newComments: Text
- reason: Text
- editedAt: DateTime

**AuditLog**
- id: Int [PK]
- userId: Int [FK -> User.id]
- action: String
- entityType: String
- entityId: Int, nullable
- metadata: JSON, nullable
- createdAt: DateTime
- [index] on (entityType, entityId)
- [index] on (createdAt)

**NotificationTemplate**
- id: Int [PK]
- key: String [unique]
- subject: String
- body: Text
- updatedAt: DateTime
- updatedByUserId: Int, nullable [FK -> User.id]

**Notification**
- id: Int [PK]
- userId: Int [FK -> User.id]
- type: String
- message: Text
- link: String, nullable
- read: Boolean, default false
- createdAt: DateTime
- [index] on (userId, read)
- [index] on (createdAt)

### Relationships to draw (29 edges)

- User 1—many Vacancy interviewers pool (VacancyInterviewer.userId)
- User 1—many InterviewPanelMember.userId
- User 1—many Candidate.lastCvReviewedByUserId
- User 1—many CandidateApplication.decidedByUserId
- User 1—many CandidateApplication.hiringManagerId
- User 1—many ApplicationStageHistory.changedByUserId
- User 1—many StageRecommendation.hiringManagerId
- User 1—many InterviewPanelist.userId
- User 1—many Interview feedback (Feedback.interviewerId)
- User 1—many FeedbackAuditLog.editedByUserId
- User 1—many AuditLog.userId
- User 1—many NotificationTemplate.updatedByUserId
- User 1—many Notification.userId
- Vacancy 1—many VacancyStage
- Vacancy 1—many VacancyInterviewer
- Vacancy 1—many InterviewPanel
- Vacancy 1—many CandidateApplication
- VacancyStage 1—many CandidateApplication (currentVacancyStageId)
- VacancyStage 1—many ApplicationStageHistory
- VacancyStage 1—many InterviewSlot
- InterviewPanel 1—many InterviewPanelMember
- Candidate 1—many CandidateApplication
- CandidateApplication 1—many ApplicationStageHistory
- CandidateApplication 1—many StageRecommendation
- CandidateApplication 1—many Interview
- InterviewSlot 1—many InterviewPanelist
- InterviewSlot 1—many Interview
- Interview 1—many Feedback
- Feedback 1—many FeedbackAuditLog

### Notes to include as diagram annotations (optional but recommended, matches the original)

- `InterviewSlot` is the calendar entry (time/round/panel); `Interview` is one candidate's participation within that slot — a slot can hold several candidates.
- `ApplicationStageHistory`: exactly one of `stage` or `vacancyStageId` is populated per row, never both.
- `VacancyInterviewer` is a standing eligible-panelist pool per vacancy; `InterviewPanel`/`InterviewPanelMember` is a named, reusable subset of that pool.

**PROMPT ENDS HERE**

---

This is grounded directly in `backend/prisma/schema.prisma` as it stands right now — if the schema changes later, re-pull it before reusing this prompt, since it'll otherwise describe an out-of-date system.
