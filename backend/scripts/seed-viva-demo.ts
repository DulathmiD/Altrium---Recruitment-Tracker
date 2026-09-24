// Curated Sprint 1 viva dataset, covering all 8 of HR's canonical
// departments (HR, Finance and Accounting, Operations, Marketing, Sales,
// IT, Customer Service, Legal) -- one vacancy each, 2-3 candidates per
// vacancy. Wider than the first version of this script (which only covered
// 4 departments) because a lecturer clicking into any department should see
// real data, not an empty list. Still deliberately far short of
// seed-full-demo.ts's 16-vacancy/117-candidate sweep, which exists to
// exercise every corner of every page for dev/testing, not to be watched
// live -- every candidate here exists to demonstrate one specific,
// nameable thing, chosen so that every section of every page that can show
// an empty state has real content instead:
//   - HR's Follow Ups page has FIVE independently-computed sections
//     (Pending CV Review, Pending Feedback, Interview Invites - Candidates,
//     Interview Invites - Interviewers, Upcoming Calls) -- each one needed
//     its own specific candidate/interview state to not read "Nothing
//     pending", see the per-candidate notes below.
//   - Candidate Comparison needs 2+ candidates with submitted feedback on
//     the SAME vacancy -- Finance and IT each get two.
//
// Also generates a real PDF CV per candidate (scripts/lib/generateCv.ts),
// saved via the same fileStorage.saveFile() the real upload endpoint uses,
// so "View CV" always opens a real, properly laid-out document.
//
// Run from the backend folder, in this order (see chat for the full
// sequence including the DB reset step):
//   npx prisma db seed
//   npx tsx scripts/seed-viva-demo.ts
//
// Idempotent (find-or-create throughout, guarded email sends) -- safe to
// re-run if something goes wrong partway through.
import "dotenv/config";
import { prisma } from "../src/prisma.js";
import { sendEmail } from "../src/utils/mailer.js";
import { renderTemplate, type TemplateKey } from "../src/utils/notificationTemplates.js";
import { writeAuditLog } from "../src/utils/auditLog.js";
import { saveFile, sanitizeForFilename, deleteFile } from "../src/utils/fileStorage.js";
import { buildCvPdf, type CvProfile } from "./lib/generateCv.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Wipes every candidate/vacancy (and everything that hangs off either) before
// seeding, so this script always produces the exact curated Sprint 1 viva
// dataset described at the top of this file, never a mix of this run's data
// layered on top of whatever was in the DB before (e.g. leftovers from
// seed-full-demo.ts's 16-vacancy sweep, or a half-finished previous run).
// Adapted directly from wipe-candidates.ts -- same deletion order (children
// before parents, since most of these relations aren't onDelete: Cascade)
// and the same CV-file cleanup, just folded into this script's own main()
// instead of being a separate manual step. User accounts are deliberately
// never touched here -- staff logins must survive a re-seed.
async function wipeExistingData() {
  const candidates = await prisma.candidate.findMany({ select: { id: true, cvUrl: true } });
  const vacancyCount = await prisma.vacancy.count();

  const counts = {
    feedbackAuditLog: await prisma.feedbackAuditLog.deleteMany({}),
    feedback: await prisma.feedback.deleteMany({}),
    interviewPanelist: await prisma.interviewPanelist.deleteMany({}),
    interview: await prisma.interview.deleteMany({}),
    interviewSlot: await prisma.interviewSlot.deleteMany({}),
    stageRecommendation: await prisma.stageRecommendation.deleteMany({}),
    applicationStageHistory: await prisma.applicationStageHistory.deleteMany({}),
    candidateApplication: await prisma.candidateApplication.deleteMany({}),
    candidate: await prisma.candidate.deleteMany({}),
    vacancyInterviewer: await prisma.vacancyInterviewer.deleteMany({}),
    vacancyStage: await prisma.vacancyStage.deleteMany({}),
    // InterviewPanel (and InterviewPanelMember, which cascades from it via
    // onDelete: Cascade in schema.prisma) also holds a vacancyId FK -- added
    // to the schema after wipe-candidates.ts (the script this wipe order was
    // copied from) was written, so it was missing here and blocked the
    // vacancy delete below with a real foreign-key-constraint error the
    // first time this actually ran against production. Must come before
    // vacancy since InterviewPanel -> Vacancy has no cascade of its own.
    interviewPanel: await prisma.interviewPanel.deleteMany({}),
    vacancy: await prisma.vacancy.deleteMany({}),
  };

  for (const c of candidates) {
    if (c.cvUrl) await deleteFile(c.cvUrl);
  }

  console.log(
    `Wiped ${candidates.length} candidate(s), ${vacancyCount} vacancy(ies), ${counts.candidateApplication.count} application(s), ` +
      `${counts.interview.count} interview(s), and ${candidates.length} CV file(s). User accounts were left untouched.\n`
  );
}

async function requireUser(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`Could not find seeded user ${email} -- run "npx prisma db seed" first.`);
  return user;
}

async function ensureVacancy(title: string, department: string, description: string) {
  // NOTE: title+department is no longer a DB-level unique key (migration
  // 20260920000000_drop_vacancy_title_department_unique -- see the comment
  // on Vacancy in schema.prisma and assertNoActiveDuplicate() in
  // vacancy.controller.ts, which now scopes the real duplicate check to
  // active/OPEN+ON_HOLD vacancies only). This script only ever creates each
  // of its own known vacancies once, so a plain findFirst is sufficient here
  // for find-or-create purposes -- it doesn't need to replicate the
  // controller's active-only scoping.
  const existing = await prisma.vacancy.findFirst({ where: { title, department } });
  if (existing) return existing;
  const created = await prisma.vacancy.create({ data: { title, department, description, status: "OPEN" } });
  console.log(`Created vacancy "${created.title}" (${department}, id ${created.id})`);
  return created;
}

async function ensureStage(vacancyId: number, name: string, order: number) {
  const existing = await prisma.vacancyStage.findUnique({ where: { vacancyId_order: { vacancyId, order } } });
  if (existing) return existing;
  return prisma.vacancyStage.create({ data: { vacancyId, name, order } });
}

async function ensurePoolMember(vacancyId: number, userId: number) {
  const existing = await prisma.vacancyInterviewer.findUnique({ where: { vacancyId_userId: { vacancyId, userId } } });
  if (!existing) await prisma.vacancyInterviewer.create({ data: { vacancyId, userId } });
}

type CandidateSpec = {
  name: string;
  email: string;
  phoneNumber: string;
  cv: CvProfile;
  // daysAgo backdates the review so a candidate who later gets updated via
  // ensureUpdatedCvAndReview has a sensible chronological order -- the
  // original submission needs an earlier timestamp than the update, not
  // "now" for both just because they happened in the same script run.
  reviewed?: { byUserId: number; note: string; daysAgo?: number };
};

async function ensureCandidate(spec: CandidateSpec) {
  const existing = await prisma.candidate.findUnique({ where: { email: spec.email } });
  if (existing) return existing;

  const filename = `${sanitizeForFilename(spec.name)}.pdf`;
  const pdfBytes = await buildCvPdf(spec.cv);
  await saveFile(pdfBytes, filename);
  const reviewedAt = spec.reviewed ? new Date(Date.now() - (spec.reviewed.daysAgo ?? 0) * DAY_MS) : null;

  const candidate = await prisma.candidate.create({
    data: {
      name: spec.name,
      email: spec.email,
      phoneNumber: spec.phoneNumber,
      cvUrl: filename,
      ...(spec.reviewed
        ? { lastCvReviewedByUserId: spec.reviewed.byUserId, lastCvReviewedAt: reviewedAt!, lastCvReviewNote: spec.reviewed.note }
        : {}),
    },
  });

  console.log(`Created candidate "${candidate.name}" <${candidate.email}> with a real CV (${filename})`);
  return candidate;
}

// Per direct user feedback ("make test data ... so that i can check all
// dashboards and see all values"): a handful of already-created candidates
// get their CV and review note overwritten here, simulating a later
// re-upload/re-review. CV History and Review Notes History (the features
// this used to also populate, via CandidateCvVersion/CandidateReviewNote)
// were removed in a later revert, and those two tables were dropped -- this
// now just updates the live Candidate fields. Idempotent: skips straight
// through if this candidate's cvUrl already shows the updated filename.
async function ensureUpdatedCvAndReview(opts: {
  candidate: { id: number; name: string };
  cv: CvProfile;
  vacancyTitle: string;
  reviewedByUserId: number;
  note: string;
  daysAgo: number;
}) {
  const filename = `${sanitizeForFilename(opts.candidate.name)}_updated.pdf`;
  const current = await prisma.candidate.findUnique({ where: { id: opts.candidate.id }, select: { cvUrl: true } });
  if (current?.cvUrl === filename) return;

  const pdfBytes = await buildCvPdf(opts.cv);
  await saveFile(pdfBytes, filename);
  const uploadedAt = new Date(Date.now() - opts.daysAgo * DAY_MS);

  await prisma.candidate.update({
    where: { id: opts.candidate.id },
    data: {
      cvUrl: filename,
      lastCvReviewedByUserId: opts.reviewedByUserId,
      lastCvReviewedAt: uploadedAt,
      lastCvReviewNote: opts.note,
    },
  });
  console.log(`  Updated CV + review note for "${opts.candidate.name}" (${filename})`);
}

async function ensureApplication(
  candidateId: number,
  vacancyId: number,
  hiringManagerId: number,
  stage: "APPLIED" | "SHORTLISTED" | "HIRED" | "REJECTED",
  currentVacancyStageId: number | null,
  appliedDaysAgo: number,
  extra: { hiringDecision?: "HIRE" | "REJECT"; decidedByUserId?: number; decidedAt?: Date } = {}
) {
  const existing = await prisma.candidateApplication.findUnique({
    where: { candidateId_vacancyId: { candidateId, vacancyId } },
  });
  if (existing) return existing;
  const application = await prisma.candidateApplication.create({
    data: {
      candidateId,
      vacancyId,
      hiringManagerId,
      stage,
      currentVacancyStageId,
      appliedAt: new Date(Date.now() - appliedDaysAgo * DAY_MS),
      ...extra,
    },
  });
  console.log(`  Applied to application id ${application.id} (stage ${stage})`);
  return application;
}

async function ensureInterviewAt(
  applicationId: number,
  vacancyStageId: number,
  scheduledAt: Date,
  panelistUserIds: number[],
  feedback: { userId: number; score: number; comments: string }[] = []
) {
  const existing = await prisma.interview.findFirst({ where: { applicationId, slot: { vacancyStageId } } });
  if (existing) return existing;

  const slot = await prisma.interviewSlot.create({
    data: { vacancyStageId, scheduledAt, panelists: { create: panelistUserIds.map((userId) => ({ userId })) } },
  });
  const interview = await prisma.interview.create({ data: { slotId: slot.id, applicationId } });
  for (const f of feedback) {
    await prisma.feedback.create({ data: { interviewId: interview.id, interviewerId: f.userId, score: f.score, comments: f.comments } });
  }
  return interview;
}

// Sends through the exact production path (renderTemplate + sendEmail +
// writeAuditLog) so Email History shows genuine content, guarded so a
// re-run never re-sends.
async function sendOnceAndLog(opts: {
  actorUserId: number;
  entityType: string;
  entityId: number;
  recipient: string;
  reason: TemplateKey;
  vars: Record<string, string>;
}) {
  // Matches followUp.controller.ts's wasNotified() dedup key exactly
  // (entityId + metadata.reason + metadata.recipient, not just entityId) --
  // an earlier version of this guard only checked entityType+entityId, which
  // silently swallowed every second-and-later send for the same interview
  // (e.g. the candidate invite blocking the panelist invite right after it).
  // Real production code hits the same shape: interview.controller.ts writes
  // one NOTIFICATION_SENT row per recipient, all sharing entityId=interview.id.
  const existingLogs = await prisma.auditLog.findMany({
    where: { action: "NOTIFICATION_SENT", entityType: opts.entityType, entityId: opts.entityId },
    select: { metadata: true },
  });
  const already = existingLogs.some(
    (log) => (log.metadata as any)?.reason === opts.reason && (log.metadata as any)?.recipient === opts.recipient
  );
  if (already) return;
  const { subject, body } = await renderTemplate(opts.reason, opts.vars);
  await sendEmail({ to: opts.recipient, subject, body });
  await writeAuditLog(opts.actorUserId, "NOTIFICATION_SENT", opts.entityType, opts.entityId, {
    recipient: opts.recipient,
    channel: "email",
    reason: opts.reason,
    subject,
    body,
  });
  console.log(`  Sent + logged "${opts.reason}" email to ${opts.recipient}`);
}

// Realistic, hand-voiced review-note pools for ensureFillerCandidate --
// previously every filler candidate got the exact same hardcoded
// "Solid background, moved to interview." note regardless of whether they
// were ultimately SHORTLISTED or REJECTED, which read as an obvious
// templated note the moment two candidates with different outcomes sat next
// to each other on the same Candidates list. Picked deterministically per
// candidate (see pickReviewNote below) so the script stays reproducible on
// re-runs rather than picking a new note at random each time.
const SHORTLISTED_REVIEW_NOTES = [
  "Solid background, moved to interview.",
  "Relevant experience for this role, worth a first-round conversation.",
  "Good fit on paper, moved to shortlist.",
  "CV shows the right mix of skills for this role -- progressing to interview.",
  "Clear, relevant track record. Moving forward to the next stage.",
  "Nothing standout yet, but solid enough fundamentals to shortlist.",
  "Background lines up well with what this role needs. Shortlisted.",
  "Reasonable experience for the level -- worth seeing in an interview.",
  "Strong enough CV to warrant a closer look. Shortlisted for interview.",
];
const REJECTED_REVIEW_NOTES = [
  "Doesn't have quite enough directly relevant experience for this role. Not progressing at this time.",
  "Background is a bit too junior for what this role needs right now.",
  "Some relevant experience, but not a strong enough match against the other applicants. Not progressing.",
  "CV doesn't show the specific experience this role calls for. Not moving forward.",
  "Thin on the core skills we're looking for here. Not progressing this one.",
  "Reasonable generalist background, but not a close enough fit for this specific role.",
  "Experience skews toward a different specialism than this role needs. Not progressing.",
  "Not enough evidence of the track record this role requires. Passing for now.",
  "Good candidate on paper, but outmatched by stronger applicants for this particular role.",
];

// Deterministic pick (sum of the candidate's email char codes, mod pool
// length) so the same candidate always gets the same note on every re-run of
// this script, rather than a runtime-random pick that would make diffs
// between runs meaningless.
function pickReviewNote(email: string, outcome: "SHORTLISTED" | "REJECTED"): string {
  const pool = outcome === "REJECTED" ? REJECTED_REVIEW_NOTES : SHORTLISTED_REVIEW_NOTES;
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash += email.charCodeAt(i);
  return pool[hash % pool.length]!;
}

async function ensureNotification(userId: number, type: string, message: string, link: string | null, daysAgo: number, read: boolean) {
  const existing = await prisma.notification.findFirst({ where: { userId, message } });
  if (existing) return;
  await prisma.notification.create({ data: { userId, type, message, link, read, createdAt: new Date(Date.now() - daysAgo * DAY_MS) } });
}

// Mirrors interview.controller.ts's round-1-only auto-invite exactly (same
// reason strings/vars) so Email History on the Candidate Detail page shows
// genuine content that scales with how far each candidate has progressed --
// a candidate with a scheduled round-1 interview has one real email on
// file, one who's also been rejected/hired afterward has two, and so on.
// Round 2+ deliberately does NOT call this (that's the manual-send path
// demoed live from Follow Ups' "Interview Invites" sections instead).
async function sendRound1Invites(opts: {
  actorUserId: number;
  interviewId: number;
  candidate: { name: string; email: string; cvUrl: string };
  vacancyTitle: string;
  stageLabel: string;
  scheduledAt: Date;
  panelists: { id: number; name: string; email: string }[];
}) {
  const when = opts.scheduledAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  for (const p of opts.panelists) {
    await sendOnceAndLog({
      actorUserId: opts.actorUserId, entityType: "Interview", entityId: opts.interviewId, recipient: p.email,
      reason: "interview_scheduled_panelist",
      vars: { panelistName: p.name, candidateName: opts.candidate.name, vacancyTitle: opts.vacancyTitle, stageLabel: opts.stageLabel, when, cvUrl: opts.candidate.cvUrl },
    });
  }
  await sendOnceAndLog({
    actorUserId: opts.actorUserId, entityType: "Interview", entityId: opts.interviewId, recipient: opts.candidate.email,
    reason: "interview_scheduled_candidate",
    vars: { candidateName: opts.candidate.name, vacancyTitle: opts.vacancyTitle, stageLabel: opts.stageLabel, when },
  });
}

// SHORTLISTED, one completed+scored round-1 interview (interviewer only --
// management still only attends the final round), real generated CV. Exists
// purely to give Candidate Comparison a genuine Top 5 on every vacancy
// instead of the 1-2 candidates each one had before -- deliberately terser
// than the named candidates above (one experience entry, a generic reviewed
// note) since these don't carry their own empty-state story, unlike Elias/
// Camille/Naledi/Tomas/Priyanka etc.
async function ensureFillerCandidate(opts: {
  actorUserId: number;
  hrId: number;
  interviewerId: number;
  interviewerName: string;
  interviewerEmail: string;
  hiringManagerId: number;
  name: string;
  email: string;
  phone: string;
  location: string;
  headline: string;
  company: string;
  bullet: string;
  degree: string;
  school: string;
  skills: string[];
  vacancy: { id: number; title: string };
  stage: { id: number; name: string };
  score: number;
  comment: string;
  appliedDaysAgo: number;
  interviewDaysAgo: number;
  // Almost every filler candidate ends up SHORTLISTED (the default) -- this
  // only needs overriding for the rare filler that should read as an actual
  // rejection, so its review note picks from the REJECTED-flavored pool
  // instead of the SHORTLISTED one. Doesn't change the application's own
  // stage below (still driven by the call site), just which note pool
  // pickReviewNote draws from.
  outcome?: "SHORTLISTED" | "REJECTED";
}) {
  const candidate = await ensureCandidate({
    name: opts.name, email: opts.email, phoneNumber: opts.phone,
    cv: {
      name: opts.name, email: opts.email, phone: opts.phone, location: opts.location,
      headline: opts.headline,
      summary: `${opts.headline} with solid, directly relevant experience for this role.`,
      experience: [{ title: opts.headline, company: opts.company, period: "2021 – Present", bullets: [opts.bullet] }],
      education: { degree: opts.degree, school: opts.school, period: "2015 – 2018" },
      skills: opts.skills,
    },
    reviewed: { byUserId: opts.hrId, note: pickReviewNote(opts.email, opts.outcome ?? "SHORTLISTED") },
  });
  const app = await ensureApplication(candidate.id, opts.vacancy.id, opts.hiringManagerId, "SHORTLISTED", opts.stage.id, opts.appliedDaysAgo);
  const slot = new Date(Date.now() - opts.interviewDaysAgo * DAY_MS);
  slot.setHours(10, 0, 0, 0);
  const iv = await ensureInterviewAt(app.id, opts.stage.id, slot, [opts.interviewerId], [
    { userId: opts.interviewerId, score: opts.score, comments: opts.comment },
  ]);
  await sendRound1Invites({
    actorUserId: opts.actorUserId, interviewId: iv.id, candidate, vacancyTitle: opts.vacancy.title, stageLabel: opts.stage.name, scheduledAt: slot,
    panelists: [{ id: opts.interviewerId, name: opts.interviewerName, email: opts.interviewerEmail }],
  });
  return candidate;
}

async function main() {
  await wipeExistingData();

  const hr = await requireUser("sharon@altrium.com");
  const interviewer = await requireUser("marcus@altrium.com");
  // `management` (Elena) is IT's own Management account -- kept as the bare
  // name since IT is Backend Engineer's department and was the original
  // single global account. Every other department now has its own real
  // Management login (see prisma/seed.ts's rationale comment) so each one's
  // own Reports/Dashboard actually reflects their own department, and no
  // Management account is a panelist outside their own department's
  // vacancies.
  const management = await requireUser("elena@altrium.com");
  const mgmtMarketing = await requireUser("bianca@altrium.com");
  const mgmtSales = await requireUser("derek@altrium.com");
  const mgmtCustService = await requireUser("fatima@altrium.com");
  const mgmtHR = await requireUser("callum@altrium.com");
  const mgmtFinance = await requireUser("nadia@altrium.com");
  const mgmtOps = await requireUser("owen@altrium.com");
  const mgmtLegal = await requireUser("miriam@altrium.com");
  const hiringManager = await requireUser("victor@altrium.com");
  // Real-inbox account (see prisma/seed.ts) -- now role INTERVIEWER so it's
  // a valid panelist. Deliberately added as an EXTRA panelist below (never
  // replacing marcus/elena) on exactly the interview that becomes each Follow
  // Ups section's first (soonest/only) row, so clicking "send" on that live
  // top row during the viva produces a checkable real email.
  const jordan = await requireUser("dulzxitzy@gmail.com");

  // ------------------------------------------------------------------ IT --
  // Three rounds, not two -- Backend Engineer is the flagship "reached the
  // final round" vacancy (Elias below), so its pipeline has a middle Panel
  // Interview round between Technical and Final rather than jumping straight
  // there, giving that story more completed history to show. NOTE: this
  // renames what used to be order-2 "Final Interview" -- a DB that already
  // has the old 2-round version seeded needs a full wipe (prisma migrate
  // reset + db seed) before re-running this script, not just a re-run on top
  // of existing data, since VacancyStage rows are matched by (vacancyId,
  // order) and won't retroactively rename themselves.
  const backendEng = await ensureVacancy("Backend Engineer", "IT", "Help scale our core platform services and mentor junior engineers on the team.");
  const beStage1 = await ensureStage(backendEng.id, "Technical Interview", 1);
  const beStage2 = await ensureStage(backendEng.id, "Panel Interview", 2);
  const beStage3 = await ensureStage(backendEng.id, "Final Interview", 3);
  await ensurePoolMember(backendEng.id, interviewer.id);
  await ensurePoolMember(backendEng.id, management.id);

  const isabelle = await ensureCandidate({
    name: "Isabelle Marchetti", email: "isabelle.marchetti@example.com", phoneNumber: "+44 7700 900112",
    cv: {
      name: "Isabelle Marchetti", email: "isabelle.marchetti@example.com", phone: "+44 7700 900112", location: "Manchester, UK",
      headline: "Backend Software Engineer",
      summary: "Backend engineer with five years' experience building and scaling REST APIs and event-driven services in Node.js and Go. Comfortable owning a service end to end, from schema design through production monitoring.",
      experience: [
        { title: "Backend Engineer", company: "Fenwick Logistics", period: "2022 – Present", bullets: ["Rebuilt the order-tracking service into independently deployable modules, cutting deploy time from 40 to 6 minutes.", "Introduced structured logging and alerting that reduced mean time to detect incidents by 60%."] },
        { title: "Software Engineer", company: "Northgate Systems", period: "2019 – 2022", bullets: ["Built and maintained internal billing APIs serving 200+ enterprise clients.", "Migrated the primary datastore from MySQL to PostgreSQL with zero downtime."] },
      ],
      education: { degree: "BSc Computer Science", school: "University of Leeds", period: "2015 – 2019" },
      skills: ["Node.js", "TypeScript", "Go", "PostgreSQL", "Docker", "AWS"],
    },
  });
  await ensureApplication(isabelle.id, backendEng.id, hiringManager.id, "APPLIED", null, 1);

  const tomas = await ensureCandidate({
    name: "Tomas Reyes", email: "tomas.reyes@example.com", phoneNumber: "+44 7700 900113",
    cv: {
      name: "Tomas Reyes", email: "tomas.reyes@example.com", phone: "+44 7700 900113", location: "Birmingham, UK",
      headline: "Backend Software Engineer",
      summary: "Backend-focused engineer with a strong background in distributed systems and API design, having spent the last three years building high-throughput services for a fintech platform.",
      experience: [
        { title: "Backend Engineer", company: "Pryce Financial", period: "2021 – Present", bullets: ["Designed the payments-reconciliation service handling 2M+ transactions daily.", "Led adoption of contract testing across 12 microservices, cutting integration bugs by a third."] },
        { title: "Junior Developer", company: "Hallow Digital", period: "2019 – 2021", bullets: ["Built internal tooling for QA automation used across three product teams."] },
      ],
      education: { degree: "BSc Software Engineering", school: "University of Nottingham", period: "2016 – 2019" },
      skills: ["Node.js", "PostgreSQL", "Kafka", "Kubernetes", "System Design"],
    },
    reviewed: { byUserId: hr.id, note: "Strong distributed-systems background, moved to shortlist for the Technical Interview round.", daysAgo: 4 },
  });
  const tomasApp = await ensureApplication(tomas.id, backendEng.id, hiringManager.id, "SHORTLISTED", beStage1.id, 4);
  const tomasSlot = new Date(Date.now() + 3 * DAY_MS); tomasSlot.setHours(10, 30, 0, 0);
  const tomasIv = await ensureInterviewAt(tomasApp.id, beStage1.id, tomasSlot, [interviewer.id]);
  await sendRound1Invites({
    actorUserId: hr.id, interviewId: tomasIv.id, candidate: tomas, vacancyTitle: backendEng.title, stageLabel: beStage1.name, scheduledAt: tomasSlot,
    panelists: [{ id: interviewer.id, name: interviewer.name, email: interviewer.email }],
  });

  // Direct user request: a candidate who scores a perfect 10 in interview
  // feedback but is still ultimately REJECTED -- demonstrates live that a
  // top interview score doesn't automatically mean Hired, since the Hiring
  // Manager's decision is a real, separate human judgment call, not a rule
  // derived from the score. Rejected here for a genuine, defensible business
  // reason (the team already had a stronger overall fit for this specific
  // opening), not because the interview went badly.
  const raphael = await ensureCandidate({
    name: "Raphael Song", email: "raphael.song@example.com", phoneNumber: "+44 7700 900199",
    cv: {
      name: "Raphael Song", email: "raphael.song@example.com", phone: "+44 7700 900199", location: "Manchester, UK",
      headline: "Backend Software Engineer",
      summary: "Backend engineer with six years' experience designing and scaling distributed systems, with deep expertise in event-driven architecture and platform reliability.",
      experience: [
        { title: "Senior Backend Engineer", company: "Ferrow Digital", period: "2020 – Present", bullets: ["Redesigned the core event-processing pipeline to handle 5x traffic growth with no added infrastructure cost.", "Mentored three junior engineers, two of whom were since promoted."] },
        { title: "Backend Engineer", company: "Holloway Systems", period: "2017 – 2020", bullets: ["Built the notification service now handling over 10 million messages a day."] },
      ],
      education: { degree: "MEng Computer Science", school: "University of Manchester", period: "2013 – 2017" },
      skills: ["Node.js", "Go", "Kafka", "PostgreSQL", "System Design", "Mentoring"],
    },
    reviewed: { byUserId: hr.id, note: "Excellent, senior-level background -- moved straight to the Technical Interview round.", daysAgo: 6 },
  });
  const raphaelApp = await ensureApplication(raphael.id, backendEng.id, hiringManager.id, "REJECTED", beStage1.id, 9, {
    hiringDecision: "REJECT", decidedByUserId: hiringManager.id, decidedAt: new Date(Date.now() - 1 * DAY_MS),
  });
  const raphaelSlot = new Date(Date.now() - 5 * DAY_MS); raphaelSlot.setHours(14, 0, 0, 0);
  const raphaelIv = await ensureInterviewAt(raphaelApp.id, beStage1.id, raphaelSlot, [interviewer.id], [
    { userId: interviewer.id, score: 10, comments: "Exceptional -- the strongest system-design answers we've seen for this role, clearly senior-level thinking throughout." },
  ]);
  await sendRound1Invites({
    actorUserId: hr.id, interviewId: raphaelIv.id, candidate: raphael, vacancyTitle: backendEng.title, stageLabel: beStage1.name, scheduledAt: raphaelSlot,
    panelists: [{ id: interviewer.id, name: interviewer.name, email: interviewer.email }],
  });
  await writeAuditLog(hiringManager.id, "HM_DECISION_COMMENT", "CandidateApplication", raphaelApp.id, {
    decision: "REJECT",
    // Was `note:` -- getMyDecisionHistory() only reads `metadata.comments`
    // (hiringManager.controller.ts), so the wrong key silently dropped this
    // comment and the Decision History page showed "--" for the one row
    // where it mattered most.
    comments: "Outstanding interview and a perfect score, but the team ultimately prioritised a candidate whose recent experience matched this specific role's on-call and infrastructure focus more closely. A strong score alone doesn't decide a hire -- the Hiring Manager's judgment call does.",
  });

  const aiko = await ensureCandidate({
    name: "Aiko Nakamura", email: "aiko.nakamura@example.com", phoneNumber: "+44 7700 900114",
    cv: {
      name: "Aiko Nakamura", email: "aiko.nakamura@example.com", phone: "+44 7700 900114", location: "Leeds, UK",
      headline: "Backend Software Engineer",
      summary: "Backend engineer specialising in cloud infrastructure and API reliability, with four years' experience across startups and scale-ups.",
      experience: [{ title: "Backend Engineer", company: "Cordwell Health", period: "2021 – Present", bullets: ["Owned the appointments-scheduling API used by 40,000+ patients monthly.", "Reduced infrastructure cost by 30% through right-sizing and autoscaling policy changes."] }],
      education: { degree: "MEng Computer Science", school: "University of Manchester", period: "2017 – 2021" },
      skills: ["Node.js", "TypeScript", "AWS", "Terraform", "PostgreSQL"],
    },
    reviewed: { byUserId: hr.id, note: "Solid infrastructure experience, moved to shortlist." },
  });
  // Round 1 -- interviewer only. Management is deliberately never a round-1
  // panelist anywhere in this dataset (see Camille/Elias below for why):
  // checkFinalRoundHasManagement only REQUIRES management on the vacancy's
  // last configured round, it doesn't forbid her elsewhere, but "management
  // only attends the final round" is this system's intended convention, not
  // just its enforced minimum -- an earlier version of this script put her
  // on every round, which is real, fixable data.
  const aikoApp = await ensureApplication(aiko.id, backendEng.id, hiringManager.id, "SHORTLISTED", beStage1.id, 6);
  const aikoSlot = new Date(Date.now() - 2 * DAY_MS); aikoSlot.setHours(14, 0, 0, 0);
  const aikoIv = await ensureInterviewAt(aikoApp.id, beStage1.id, aikoSlot, [interviewer.id], [
    { userId: interviewer.id, score: 8, comments: "Strong technical depth, clear communicator. Would advance to final round." },
  ]);
  await sendRound1Invites({
    actorUserId: hr.id, interviewId: aikoIv.id, candidate: aiko, vacancyTitle: backendEng.title, stageLabel: beStage1.name, scheduledAt: aikoSlot,
    panelists: [{ id: interviewer.id, name: interviewer.name, email: interviewer.email }],
  });

  // Second scored candidate on the same vacancy -- Candidate Comparison needs 2+.
  const rasheed = await ensureCandidate({
    name: "Rasheed Coker", email: "rasheed.coker@example.com", phoneNumber: "+44 7700 900120",
    cv: {
      name: "Rasheed Coker", email: "rasheed.coker@example.com", phone: "+44 7700 900120", location: "Sheffield, UK",
      headline: "Backend Software Engineer",
      summary: "Backend engineer with six years' experience in API design and data pipeline reliability across e-commerce platforms.",
      experience: [{ title: "Senior Backend Engineer", company: "Marrow Retail", period: "2020 – Present", bullets: ["Led the checkout-service rewrite handling Black Friday peak load without incident.", "Mentored two junior engineers through their first production on-call rotations."] }],
      education: { degree: "BSc Computer Science", school: "University of Sheffield", period: "2014 – 2018" },
      skills: ["Node.js", "TypeScript", "Redis", "AWS", "System Design"],
    },
    reviewed: { byUserId: hr.id, note: "Strong e-commerce scale experience, moved to shortlist." },
  });
  const rasheedApp = await ensureApplication(rasheed.id, backendEng.id, hiringManager.id, "SHORTLISTED", beStage1.id, 7);
  const rasheedSlot = new Date(Date.now() - 3 * DAY_MS); rasheedSlot.setHours(9, 30, 0, 0);
  const rasheedIv = await ensureInterviewAt(rasheedApp.id, beStage1.id, rasheedSlot, [interviewer.id], [
    { userId: interviewer.id, score: 6, comments: "Solid fundamentals, less exposure to distributed systems than we'd like at this level." },
  ]);
  await sendRound1Invites({
    actorUserId: hr.id, interviewId: rasheedIv.id, candidate: rasheed, vacancyTitle: backendEng.title, stageLabel: beStage1.name, scheduledAt: rasheedSlot,
    panelists: [{ id: interviewer.id, name: interviewer.name, email: interviewer.email }],
  });

  // Advanced to round 2 -- interview scheduled, invite NOT yet sent (only
  // round 1 auto-sends). Populates Follow Ups' "Interview Invites -
  // Candidates" AND "Interview Invites - Interviewers" sections.
  // Candidate email is the real viva inbox on purpose (see `jordan` above) --
  // Elias is the one candidate who reaches round 2 with its invite still
  // unsent, so his row is the (only, hence "first") Interview Invites -
  // Candidates entry in Follow Ups; sending it live during the viva lands in
  // a real, checkable inbox.
  const elias = await ensureCandidate({
    name: "Elias Vogt", email: "dulzxitzy@gmail.com", phoneNumber: "+44 7700 900121",
    cv: {
      name: "Elias Vogt", email: "dulzxitzy@gmail.com", phone: "+44 7700 900121", location: "Liverpool, UK",
      headline: "Backend Software Engineer",
      summary: "Backend engineer with strong distributed-systems fundamentals, four years' experience shipping production services at scale.",
      experience: [{ title: "Backend Engineer", company: "Thornbury Systems", period: "2021 – Present", bullets: ["Designed an event-sourcing pipeline processing 5M+ events per day.", "Cut P99 API latency by 45% through targeted caching and query optimisation."] }],
      education: { degree: "BSc Computer Science", school: "University of Liverpool", period: "2017 – 2021" },
      skills: ["Node.js", "Go", "Kafka", "PostgreSQL", "AWS"],
    },
    reviewed: { byUserId: hr.id, note: "Excellent technical round, advanced straight to Final Interview." },
  });
  const eliasApp = await ensureApplication(elias.id, backendEng.id, hiringManager.id, "SHORTLISTED", beStage3.id, 12);
  const eliasR1 = new Date(Date.now() - 5 * DAY_MS); eliasR1.setHours(11, 0, 0, 0);
  const eliasR1Iv = await ensureInterviewAt(eliasApp.id, beStage1.id, eliasR1, [interviewer.id], [
    { userId: interviewer.id, score: 9, comments: "Excellent technical round, clear ahead-of-the-curve system design instincts. Fast-track to the Panel round." },
  ]);
  await sendRound1Invites({
    actorUserId: hr.id, interviewId: eliasR1Iv.id, candidate: elias, vacancyTitle: backendEng.title, stageLabel: beStage1.name, scheduledAt: eliasR1,
    panelists: [{ id: interviewer.id, name: interviewer.name, email: interviewer.email }],
  });
  // Round 2 (Panel Interview) -- also completed and scored, interviewer only
  // (management still doesn't attend before the final round). Gives the
  // "reached the final round" story two rounds of real completed history
  // behind it, not just one.
  const eliasR2 = new Date(Date.now() - 1 * DAY_MS); eliasR2.setHours(13, 30, 0, 0);
  const eliasR2Iv = await ensureInterviewAt(eliasApp.id, beStage2.id, eliasR2, [interviewer.id], [
    { userId: interviewer.id, score: 9, comments: "Held up just as well under a full panel format -- consistent, confident, no red flags. Straight through to Final." },
  ]);
  await sendRound1Invites({
    actorUserId: hr.id, interviewId: eliasR2Iv.id, candidate: elias, vacancyTitle: backendEng.title, stageLabel: beStage2.name, scheduledAt: eliasR2,
    panelists: [{ id: interviewer.id, name: interviewer.name, email: interviewer.email }],
  });
  // Round 3 (Final Interview) -- deliberately left un-invited. Jordan is
  // added here as a THIRD panelist (marcus + elena stay, so the Management-
  // must-attend-final-interview rule is unaffected) purely so the real inbox
  // is among the recipients once HR sends this round's panelist invites live
  // from Follow Ups' "Interview Invites - Interviewers" section.
  const eliasR3 = new Date(Date.now() + 4 * DAY_MS); eliasR3.setHours(15, 0, 0, 0);
  await ensureInterviewAt(eliasApp.id, beStage3.id, eliasR3, [interviewer.id, management.id, jordan.id]);

  // ------------------------------------------------------------ Marketing --
  const marketing = await ensureVacancy("Content Marketing Specialist", "Marketing", "Plan and produce content across blog, social, and email to drive qualified pipeline.");
  const marketingStage1 = await ensureStage(marketing.id, "Portfolio Review", 1);
  const marketingStage2 = await ensureStage(marketing.id, "Final Interview", 2);
  await ensurePoolMember(marketing.id, interviewer.id);
  await ensurePoolMember(marketing.id, mgmtMarketing.id);

  const baptiste = await ensureCandidate({
    name: "Baptiste Laurent", email: "baptiste.laurent@example.com", phoneNumber: "+44 7700 900115",
    cv: {
      name: "Baptiste Laurent", email: "baptiste.laurent@example.com", phone: "+44 7700 900115", location: "London, UK",
      headline: "Content Marketing Specialist",
      summary: "Content marketer with six years' experience growing organic pipeline through editorial strategy, SEO, and lifecycle email programmes for B2B SaaS companies.",
      experience: [
        { title: "Content Marketing Lead", company: "Verity Software", period: "2020 – Present", bullets: ["Grew organic blog traffic 3x over two years, contributing 25% of inbound pipeline.", "Built and ran a monthly newsletter reaching 18,000 subscribers with a 42% open rate."] },
        { title: "Content Marketer", company: "Bellhaven Media", period: "2018 – 2020", bullets: ["Produced weekly long-form content and managed a freelance writer pool of six."] },
      ],
      education: { degree: "BA Marketing", school: "University of Bristol", period: "2014 – 2018" },
      skills: ["SEO", "Content Strategy", "Email Marketing", "HubSpot", "Analytics"],
    },
    reviewed: { byUserId: hr.id, note: "Excellent portfolio, clear pipeline impact. Fast-tracked through both rounds." },
  });
  // A real HIRE requires currentVacancyStageId to already be the vacancy's
  // last configured round (application.controller.ts's hire-decision guard)
  // -- previously seeded with currentVacancyStageId: null and no interviews
  // at all, which is a HIRED status that could never have actually happened
  // through this system's own rules (and left the Candidates table's
  // Interview Stage column blank for him, which is what surfaced this).
  // Fixed with a real round-1-then-round-2 history, management included on
  // the final round per the enforced rule.
  const baptisteApp = await ensureApplication(baptiste.id, marketing.id, hiringManager.id, "SHORTLISTED", marketingStage2.id, 20);
  const baptisteR1 = new Date(Date.now() - 9 * DAY_MS); baptisteR1.setHours(10, 0, 0, 0);
  const baptisteR1Iv = await ensureInterviewAt(baptisteApp.id, marketingStage1.id, baptisteR1, [interviewer.id], [
    { userId: interviewer.id, score: 9, comments: "Outstanding portfolio, clear evidence of pipeline impact. Fast-track to Final Interview." },
  ]);
  await sendRound1Invites({
    actorUserId: hr.id, interviewId: baptisteR1Iv.id, candidate: baptiste, vacancyTitle: marketing.title, stageLabel: marketingStage1.name, scheduledAt: baptisteR1,
    panelists: [{ id: interviewer.id, name: interviewer.name, email: interviewer.email }],
  });
  const baptisteR2 = new Date(Date.now() - 2 * DAY_MS); baptisteR2.setHours(15, 30, 0, 0);
  await ensureInterviewAt(baptisteApp.id, marketingStage2.id, baptisteR2, [interviewer.id, mgmtMarketing.id], [
    { userId: interviewer.id, score: 9, comments: "Consistently sharp in the final round too -- confident, well-prepared, clear content strategy for the role." },
    { userId: mgmtMarketing.id, score: 8, comments: "Strong final-round showing, good culture fit. Recommend hire." },
  ]);
  await prisma.candidateApplication.update({ where: { id: baptisteApp.id }, data: { stage: "HIRED", hiringDecision: "HIRE", decidedByUserId: hiringManager.id, decidedAt: new Date(Date.now() - 1 * DAY_MS) } });
  await sendOnceAndLog({
    actorUserId: hiringManager.id, entityType: "CandidateApplication", entityId: baptisteApp.id, recipient: baptiste.email,
    reason: "hiring_decision_hire", vars: { candidateName: baptiste.name, vacancyTitle: marketing.title },
  });
  // HM Decision History's Comments column reads this back (getMyDecisionHistory
  // in hiringManager.controller.ts) -- recordHiringDecision's real endpoint
  // writes exactly this shape (action "HM_DECISION_COMMENT") when the HM
  // types a comment while confirming Hire/Reject, so this mirrors a real
  // decision comment rather than fabricating a new data path.
  await writeAuditLog(hiringManager.id, "HM_DECISION_COMMENT", "CandidateApplication", baptisteApp.id, {
    decision: "HIRE", comments: "Strong final round, easy hire.",
  });
  // Baptiste's HIRE above always implied this role was filled, but nothing
  // ever transitioned the vacancy itself to CLOSED -- Department Performance
  // computes fillRate purely from vacancy.status, so Marketing was reading
  // as 0% filled despite already having a hired candidate. Closing it here
  // reflects the outcome that already existed.
  await prisma.vacancy.update({ where: { id: marketing.id }, data: { status: "CLOSED" } });

  // Second Marketing candidate, still SHORTLISTED (not yet decided) with a
  // completed, scored round-1 interview -- without this, Candidate
  // Comparison for Marketing has nobody to rank (Baptiste is HIRED, Freya is
  // REJECTED, both excluded from the SHORTLISTED-only comparison query) and
  // hits its "No shortlisted candidates have any interview feedback yet"
  // empty state.
  const priya = await ensureCandidate({
    name: "Priya Chandrasekaran", email: "priya.chandrasekaran@example.com", phoneNumber: "+44 7700 900130",
    cv: {
      name: "Priya Chandrasekaran", email: "priya.chandrasekaran@example.com", phone: "+44 7700 900130", location: "Southampton, UK",
      headline: "Content Marketing Specialist",
      summary: "Content marketer with three years' experience across SEO-led blog strategy and lifecycle email for B2B SaaS.",
      experience: [{ title: "Content Marketer", company: "Ferrow Digital", period: "2022 – Present", bullets: ["Grew organic search traffic 65% year-on-year through a refreshed content cluster strategy.", "Ran a 6-email onboarding sequence that lifted trial-to-paid conversion by 12%."] }],
      education: { degree: "BA Marketing Communications", school: "University of Southampton", period: "2018 – 2021" },
      skills: ["SEO", "Content Strategy", "Email Marketing", "Analytics"],
    },
    reviewed: { byUserId: hr.id, note: "Strong portfolio, moved to Portfolio Review round.", daysAgo: 6 },
  });
  const priyaApp = await ensureApplication(priya.id, marketing.id, hiringManager.id, "SHORTLISTED", marketingStage1.id, 6);
  const priyaSlot = new Date(Date.now() - 3 * DAY_MS); priyaSlot.setHours(11, 0, 0, 0);
  const priyaIv = await ensureInterviewAt(priyaApp.id, marketingStage1.id, priyaSlot, [interviewer.id], [
    { userId: interviewer.id, score: 6, comments: "Good fundamentals, portfolio leaned heavily on one channel (SEO) with less evidence of the broader mix this role needs." },
  ]);
  await sendRound1Invites({
    actorUserId: hr.id, interviewId: priyaIv.id, candidate: priya, vacancyTitle: marketing.title, stageLabel: marketingStage1.name, scheduledAt: priyaSlot,
    panelists: [{ id: interviewer.id, name: interviewer.name, email: interviewer.email }],
  });

  const freya = await ensureCandidate({
    name: "Freya Lindqvist", email: "freya.lindqvist@example.com", phoneNumber: "+44 7700 900116",
    cv: {
      name: "Freya Lindqvist", email: "freya.lindqvist@example.com", phone: "+44 7700 900116", location: "Sheffield, UK",
      headline: "Content Marketing Specialist",
      summary: "Early-career marketer with two years' experience in social media content and community management.",
      experience: [{ title: "Social Media Coordinator", company: "Millrace Studio", period: "2023 – Present", bullets: ["Managed day-to-day posting and community replies across three social channels."] }],
      education: { degree: "BA Communications", school: "Sheffield Hallam University", period: "2019 – 2022" },
      skills: ["Social Media", "Canva", "Copywriting"],
    },
    reviewed: { byUserId: hr.id, note: "Limited long-form content experience relative to what this role needs. Not progressing at this time." },
  });
  await ensureApplication(freya.id, marketing.id, hiringManager.id, "REJECTED", null, 15);

  // ----------------------------------------------------------------- Sales --
  const sales = await ensureVacancy("Account Executive", "Sales", "Own the full sales cycle for mid-market accounts, from first call to close.");
  const salesStage1 = await ensureStage(sales.id, "Role Play Interview", 1);
  await ensureStage(sales.id, "Final Interview", 2);
  await ensurePoolMember(sales.id, interviewer.id);
  await ensurePoolMember(sales.id, mgmtSales.id);

  // SHORTLISTED with a completed, scored round-1 -- without this, Comparison
  // for Sales has nobody to rank (Dimitri below ends REJECTED, Naledi's Sales
  // application deliberately has zero feedback so it can populate the
  // Interviewer's genuinely-overdue Pending case) and hits its empty state.
  const felix = await ensureCandidate({
    name: "Felix Adeyinka", email: "felix.adeyinka@example.com", phoneNumber: "+44 7700 900131",
    cv: {
      name: "Felix Adeyinka", email: "felix.adeyinka@example.com", phone: "+44 7700 900131", location: "Manchester, UK",
      headline: "Account Executive",
      summary: "Sales professional with five years of full-cycle B2B sales experience, consistently over quota in the mid-market segment.",
      experience: [{ title: "Account Executive", company: "Corven Systems", period: "2021 – Present", bullets: ["Carried a £900k annual quota, closing at 112% of target for two consecutive years.", "Built a repeatable discovery-call framework since adopted by the wider sales team."] }],
      education: { degree: "BA Business Management", school: "Manchester Metropolitan University", period: "2015 – 2018" },
      skills: ["Salesforce", "Consultative Selling", "Negotiation", "Pipeline Management"],
    },
    reviewed: { byUserId: hr.id, note: "Consistently strong quota history, moved to Role Play round." },
  });
  const felixApp = await ensureApplication(felix.id, sales.id, hiringManager.id, "SHORTLISTED", salesStage1.id, 7);
  const felixSlot = new Date(Date.now() - 5 * DAY_MS); felixSlot.setHours(10, 0, 0, 0);
  const felixIv = await ensureInterviewAt(felixApp.id, salesStage1.id, felixSlot, [interviewer.id], [
    { userId: interviewer.id, score: 8, comments: "Confident, consultative approach in the role play -- handled objections well without over-discounting." },
  ]);
  await sendRound1Invites({
    actorUserId: hr.id, interviewId: felixIv.id, candidate: felix, vacancyTitle: sales.title, stageLabel: salesStage1.name, scheduledAt: felixSlot,
    panelists: [{ id: interviewer.id, name: interviewer.name, email: interviewer.email }],
  });

  const dimitri = await ensureCandidate({
    name: "Dimitri Popescu", email: "dimitri.popescu@example.com", phoneNumber: "+44 7700 900117",
    cv: {
      name: "Dimitri Popescu", email: "dimitri.popescu@example.com", phone: "+44 7700 900117", location: "Nottingham, UK",
      headline: "Account Executive",
      summary: "Sales professional with three years of full-cycle B2B sales experience in the mid-market segment.",
      experience: [{ title: "Account Executive", company: "Redlin Group", period: "2022 – Present", bullets: ["Carried a £600k annual quota, closing at 78% of target."] }],
      education: { degree: "BA Business", school: "Nottingham Trent University", period: "2017 – 2020" },
      skills: ["Salesforce", "Negotiation", "Pipeline Management"],
    },
    // Was previously "Solid quota history, moved to Role Play round." --
    // read like an advance even though this candidate is REJECTED below
    // (audit finding: a rejection with an advance-sounding review note).
    reviewed: { byUserId: hr.id, note: "Quota history is below what we'd want at this level relative to other applicants. Moved to Role Play round to confirm, but not expecting a strong outcome." },
  });
  const dimitriApp = await ensureApplication(dimitri.id, sales.id, hiringManager.id, "REJECTED", salesStage1.id, 10, {
    hiringDecision: "REJECT", decidedByUserId: hiringManager.id, decidedAt: new Date(Date.now() - 2 * DAY_MS),
  });
  const dimitriSlot = new Date(Date.now() - 4 * DAY_MS); dimitriSlot.setHours(11, 0, 0, 0);
  const dimitriIv = await ensureInterviewAt(dimitriApp.id, salesStage1.id, dimitriSlot, [interviewer.id], [
    { userId: interviewer.id, score: 4, comments: "Struggled to handle objections in the role play, relied heavily on discounting." },
  ]);
  await sendRound1Invites({
    actorUserId: hr.id, interviewId: dimitriIv.id, candidate: dimitri, vacancyTitle: sales.title, stageLabel: salesStage1.name, scheduledAt: dimitriSlot,
    panelists: [{ id: interviewer.id, name: interviewer.name, email: interviewer.email }],
  });
  // Rejected after interview -- two real emails on file by the time this
  // candidate is decided (round-1 invite, then the decision itself), unlike
  // the still-in-progress candidates above who only have the first.
  await sendOnceAndLog({
    actorUserId: hiringManager.id, entityType: "CandidateApplication", entityId: dimitriApp.id, recipient: dimitri.email,
    reason: "hiring_decision_reject", vars: { candidateName: dimitri.name, vacancyTitle: sales.title },
  });
  // Same HM_DECISION_COMMENT pattern as Baptiste's HIRE above.
  await writeAuditLog(hiringManager.id, "HM_DECISION_COMMENT", "CandidateApplication", dimitriApp.id, {
    decision: "REJECT", comments: "Not ready for the role yet.",
  });

  const naledi = await ensureCandidate({
    name: "Naledi Khumalo", email: "naledi.khumalo@example.com", phoneNumber: "+44 7700 900118",
    cv: {
      name: "Naledi Khumalo", email: "naledi.khumalo@example.com", phone: "+44 7700 900118", location: "Leicester, UK",
      headline: "Sales & Customer Success",
      summary: "Versatile revenue professional with experience spanning both new-business sales and post-sale account management, comfortable working either side of the handoff.",
      experience: [
        { title: "Business Development Representative", company: "Marlow Tech", period: "2022 – Present", bullets: ["Generated £1.2M in qualified pipeline over 18 months, exceeding target every quarter."] },
        { title: "Customer Support Specialist", company: "Harrow & Vale", period: "2020 – 2022", bullets: ["Maintained a 96% customer satisfaction score across 300+ monthly tickets."] },
      ],
      education: { degree: "BA Business Management", school: "De Montfort University", period: "2016 – 2019" },
      skills: ["Salesforce", "Account Management", "Cold Outreach", "Customer Retention"],
    },
    reviewed: { byUserId: hr.id, note: "Well-rounded background spanning sales and support -- worth considering for either open role." },
  });
  const naledisSalesApp = await ensureApplication(naledi.id, sales.id, hiringManager.id, "SHORTLISTED", salesStage1.id, 3);
  // Genuinely overdue, not just "hasn't happened yet": past-dated interview,
  // zero feedback submitted by its one panelist (marcus). Distinct from
  // Camille below (whose interview is also overdue, but for elena, and
  // already has partial feedback) so the Interviewer's own Pending filter
  // isn't 100% future-dated placeholders -- scheduled slightly more recently
  // than Camille's so Camille (the earlier of the two) stays the Follow Ups
  // "first row" for Pending Feedback.
  const naledisSalesSlot = new Date(Date.now() - 1 * DAY_MS); naledisSalesSlot.setHours(9, 0, 0, 0);
  const naledisSalesIv = await ensureInterviewAt(naledisSalesApp.id, salesStage1.id, naledisSalesSlot, [interviewer.id]);
  await sendRound1Invites({
    actorUserId: hr.id, interviewId: naledisSalesIv.id, candidate: naledi, vacancyTitle: sales.title, stageLabel: salesStage1.name, scheduledAt: naledisSalesSlot,
    panelists: [{ id: interviewer.id, name: interviewer.name, email: interviewer.email }],
  });

  // ------------------------------------------------------- Customer Service --
  const custService = await ensureVacancy("Customer Success Manager", "Customer Service", "Own renewal and expansion relationships for our largest accounts.");
  const csStage1 = await ensureStage(custService.id, "Screening Call", 1);
  await ensureStage(custService.id, "Final Interview", 2);
  await ensurePoolMember(custService.id, interviewer.id);
  await ensurePoolMember(custService.id, mgmtCustService.id);

  await ensureApplication(naledi.id, custService.id, hiringManager.id, "SHORTLISTED", csStage1.id, 2);

  // SHORTLISTED with a completed, scored round-1 -- without this, Comparison
  // for Customer Service has nobody to rank (Naledi's application here has
  // no interview at all, Oscar below is still APPLIED) and hits its empty
  // state.
  const ravi = await ensureCandidate({
    name: "Ravi Chowdhury", email: "ravi.chowdhury@example.com", phoneNumber: "+44 7700 900133",
    cv: {
      name: "Ravi Chowdhury", email: "ravi.chowdhury@example.com", phone: "+44 7700 900133", location: "Bradford, UK",
      headline: "Customer Success Manager",
      summary: "Customer success professional with five years' experience owning renewal and expansion for enterprise SaaS accounts.",
      experience: [{ title: "Customer Success Manager", company: "Wrenfield Software", period: "2020 – Present", bullets: ["Owned a book of 38 enterprise accounts with a 97% gross renewal rate.", "Ran quarterly business reviews that drove a 15% expansion uplift year-on-year."] }],
      education: { degree: "BA Business Management", school: "University of Bradford", period: "2016 – 2019" },
      skills: ["Account Management", "Renewals", "Gainsight", "Stakeholder Management"],
    },
    reviewed: { byUserId: hr.id, note: "Strong renewal track record, moved to Screening Call." },
  });
  const raviApp = await ensureApplication(ravi.id, custService.id, hiringManager.id, "SHORTLISTED", csStage1.id, 5);
  const raviSlot = new Date(Date.now() - 2 * DAY_MS); raviSlot.setHours(10, 30, 0, 0);
  const raviIv = await ensureInterviewAt(raviApp.id, csStage1.id, raviSlot, [interviewer.id], [
    { userId: interviewer.id, score: 8, comments: "Clear examples of driving both renewal and expansion, strong stakeholder-management instincts." },
  ]);
  await sendRound1Invites({
    actorUserId: hr.id, interviewId: raviIv.id, candidate: ravi, vacancyTitle: custService.title, stageLabel: csStage1.name, scheduledAt: raviSlot,
    panelists: [{ id: interviewer.id, name: interviewer.name, email: interviewer.email }],
  });

  const oscar = await ensureCandidate({
    name: "Oscar Lindberg", email: "oscar.lindberg@example.com", phoneNumber: "+44 7700 900119",
    cv: {
      name: "Oscar Lindberg", email: "oscar.lindberg@example.com", phone: "+44 7700 900119", location: "Coventry, UK",
      headline: "Customer Success Manager",
      summary: "Customer success professional with four years' experience managing enterprise renewal and expansion.",
      experience: [{ title: "Customer Success Manager", company: "Ashgrove Software", period: "2021 – Present", bullets: ["Managed a book of 45 enterprise accounts with a 94% gross renewal rate."] }],
      education: { degree: "BA International Business", school: "Coventry University", period: "2017 – 2020" },
      skills: ["Account Management", "Renewals", "Gainsight", "Stakeholder Management"],
    },
  });
  await ensureApplication(oscar.id, custService.id, hiringManager.id, "APPLIED", null, 1);

  // -------------------------------------------------------------------- HR --
  const hrBp = await ensureVacancy("HR Business Partner", "HR", "Partner with department leads on hiring plans, performance processes, and employee relations.");
  const hrStage1 = await ensureStage(hrBp.id, "Screening Call", 1);
  await ensureStage(hrBp.id, "Final Interview", 2);
  await ensurePoolMember(hrBp.id, interviewer.id);
  await ensurePoolMember(hrBp.id, mgmtHR.id);

  // Completed interview, only ONE of two panelists has submitted --
  // populates Follow Ups' "Pending Feedback" section.
  const camille = await ensureCandidate({
    name: "Camille Dupont", email: "camille.dupont@example.com", phoneNumber: "+44 7700 900122",
    cv: {
      name: "Camille Dupont", email: "camille.dupont@example.com", phone: "+44 7700 900122", location: "Bristol, UK",
      headline: "HR Business Partner",
      summary: "HR generalist with five years' experience partnering with department leads on workforce planning, performance management, and employee relations.",
      experience: [{ title: "HR Business Partner", company: "Ashford Retail Group", period: "2021 – Present", bullets: ["Partnered with three department heads on annual headcount planning and performance calibration.", "Reduced average time-to-resolution on employee relations cases by 35%."] }],
      education: { degree: "BA Human Resource Management", school: "University of the West of England", period: "2015 – 2018" },
      skills: ["Employee Relations", "Workforce Planning", "Performance Management", "Stakeholder Management"],
    },
    reviewed: { byUserId: hr.id, note: "Strong generalist background, moved to Screening Call.", daysAgo: 5 },
  });
  const camilleApp = await ensureApplication(camille.id, hrBp.id, hiringManager.id, "SHORTLISTED", hrStage1.id, 5);
  const camilleSlot = new Date(Date.now() - 2 * DAY_MS); camilleSlot.setHours(13, 0, 0, 0);
  // Round 1 -- management deliberately excluded here too (see the note on
  // Aiko above). Jordan (role Interviewer, not Management, so this doesn't
  // touch the final-round rule) is the second panelist, still pending -- this
  // is the oldest/only currently-outstanding Pending Feedback interview, so
  // it's Follow Ups' "first row" for that section, and its one pending
  // recipient is the real inbox once a reminder is sent live from there.
  const camilleIv = await ensureInterviewAt(camilleApp.id, hrStage1.id, camilleSlot, [interviewer.id, jordan.id], [
    { userId: interviewer.id, score: 7, comments: "Good stakeholder-management examples, comfortable handling a difficult ER scenario we posed." },
  ]);
  await sendRound1Invites({
    actorUserId: hr.id, interviewId: camilleIv.id, candidate: camille, vacancyTitle: hrBp.title, stageLabel: hrStage1.name, scheduledAt: camilleSlot,
    panelists: [{ id: interviewer.id, name: interviewer.name, email: interviewer.email }, { id: jordan.id, name: jordan.name, email: jordan.email }],
  });

  const noah = await ensureCandidate({
    name: "Noah Whitaker", email: "noah.whitaker@example.com", phoneNumber: "+44 7700 900123",
    cv: {
      name: "Noah Whitaker", email: "noah.whitaker@example.com", phone: "+44 7700 900123", location: "Cardiff, UK",
      headline: "HR Business Partner",
      summary: "HR professional with three years' experience across recruitment and generalist HR functions in mid-sized organisations.",
      experience: [{ title: "HR Advisor", company: "Kestrel Manufacturing", period: "2022 – Present", bullets: ["Supported 200+ employees across two sites on policy, onboarding, and performance queries."] }],
      education: { degree: "BA Business Management", school: "Cardiff Metropolitan University", period: "2018 – 2021" },
      skills: ["Recruitment", "Onboarding", "HR Policy", "Employee Engagement"],
    },
  });
  await ensureApplication(noah.id, hrBp.id, hiringManager.id, "APPLIED", null, 1);

  // ------------------------------------------------ Finance and Accounting --
  const finance = await ensureVacancy("Senior Financial Analyst", "Finance and Accounting", "Lead monthly forecasting and variance analysis, partnering closely with department heads.");
  const financeStage1 = await ensureStage(finance.id, "Case Study Interview", 1);
  await ensureStage(finance.id, "Final Interview", 2);
  await ensurePoolMember(finance.id, interviewer.id);
  await ensurePoolMember(finance.id, mgmtFinance.id);

  const ingrid = await ensureCandidate({
    name: "Ingrid Solberg", email: "ingrid.solberg@example.com", phoneNumber: "+44 7700 900124",
    cv: {
      name: "Ingrid Solberg", email: "ingrid.solberg@example.com", phone: "+44 7700 900124", location: "Edinburgh, UK",
      headline: "Senior Financial Analyst",
      summary: "Finance professional with six years' experience in FP&A, leading monthly forecasting cycles and variance analysis for multi-department budgets.",
      experience: [{ title: "Financial Analyst", company: "Birchgate Holdings", period: "2020 – Present", bullets: ["Owned the monthly forecasting cycle across 5 departments, improving forecast accuracy by 18%.", "Built a variance-analysis dashboard adopted company-wide."] }],
      education: { degree: "BSc Accounting and Finance", school: "University of Edinburgh", period: "2015 – 2018" },
      skills: ["FP&A", "Excel", "Variance Analysis", "Forecasting", "SQL"],
    },
    reviewed: { byUserId: hr.id, note: "Strong FP&A track record, moved to Case Study round." },
  });
  const ingridApp = await ensureApplication(ingrid.id, finance.id, hiringManager.id, "SHORTLISTED", financeStage1.id, 6);
  const ingridSlot = new Date(Date.now() - 3 * DAY_MS); ingridSlot.setHours(10, 0, 0, 0);
  const ingridIv = await ensureInterviewAt(ingridApp.id, financeStage1.id, ingridSlot, [interviewer.id], [
    { userId: interviewer.id, score: 8, comments: "Excellent case study walkthrough, clear and structured reasoning under time pressure." },
  ]);
  await sendRound1Invites({
    actorUserId: hr.id, interviewId: ingridIv.id, candidate: ingrid, vacancyTitle: finance.title, stageLabel: financeStage1.name, scheduledAt: ingridSlot,
    panelists: [{ id: interviewer.id, name: interviewer.name, email: interviewer.email }],
  });

  const julian = await ensureCandidate({
    name: "Julian Ostrowski", email: "julian.ostrowski@example.com", phoneNumber: "+44 7700 900125",
    cv: {
      name: "Julian Ostrowski", email: "julian.ostrowski@example.com", phone: "+44 7700 900125", location: "Glasgow, UK",
      headline: "Senior Financial Analyst",
      summary: "Financial analyst with four years' experience in budgeting and cost analysis within the manufacturing sector.",
      experience: [{ title: "Financial Analyst", company: "Kilbride Manufacturing", period: "2021 – Present", bullets: ["Managed the annual budgeting process for a £40M cost centre.", "Identified cost-saving opportunities totalling £250k annually."] }],
      education: { degree: "BA Economics", school: "University of Glasgow", period: "2017 – 2020" },
      skills: ["Budgeting", "Cost Analysis", "Excel", "Power BI"],
    },
    reviewed: { byUserId: hr.id, note: "Solid budgeting background, moved to Case Study round.", daysAgo: 6 },
  });
  const julianApp = await ensureApplication(julian.id, finance.id, hiringManager.id, "SHORTLISTED", financeStage1.id, 6);
  const julianSlot = new Date(Date.now() - 3 * DAY_MS); julianSlot.setHours(14, 30, 0, 0);
  const julianIv = await ensureInterviewAt(julianApp.id, financeStage1.id, julianSlot, [interviewer.id], [
    { userId: interviewer.id, score: 6, comments: "Solid on budgeting mechanics, less confident when asked to defend assumptions under scrutiny." },
  ]);
  await sendRound1Invites({
    actorUserId: hr.id, interviewId: julianIv.id, candidate: julian, vacancyTitle: finance.title, stageLabel: financeStage1.name, scheduledAt: julianSlot,
    panelists: [{ id: interviewer.id, name: interviewer.name, email: interviewer.email }],
  });

  // ------------------------------------------------------------ Operations --
  const operations = await ensureVacancy("Operations Manager", "Operations", "Own day-to-day operational performance across our fulfilment and logistics teams.");
  const opsStage1 = await ensureStage(operations.id, "Initial Interview", 1);
  await ensureStage(operations.id, "Final Interview", 2);
  await ensurePoolMember(operations.id, interviewer.id);
  await ensurePoolMember(operations.id, mgmtOps.id);

  const priyanka = await ensureCandidate({
    name: "Priyanka Deshmukh", email: "priyanka.deshmukh@example.com", phoneNumber: "+44 7700 900126",
    cv: {
      name: "Priyanka Deshmukh", email: "priyanka.deshmukh@example.com", phone: "+44 7700 900126", location: "Milton Keynes, UK",
      headline: "Operations Manager",
      summary: "Operations leader with seven years' experience managing fulfilment and logistics teams across multi-site distribution networks.",
      experience: [{ title: "Operations Manager", company: "Grantham Distribution", period: "2019 – Present", bullets: ["Managed a 60-person fulfilment team across two warehouses, hitting 99.2% on-time dispatch.", "Led a process-redesign project that cut average order-processing time by 22%."] }],
      education: { degree: "BSc Logistics and Supply Chain Management", school: "Cranfield University", period: "2013 – 2016" },
      skills: ["Operations Management", "Logistics", "Process Improvement", "Team Leadership"],
    },
    reviewed: { byUserId: hr.id, note: "Strong multi-site operations background, moved to Initial Interview." },
  });
  const priyankaApp = await ensureApplication(priyanka.id, operations.id, hiringManager.id, "SHORTLISTED", opsStage1.id, 4);
  const priyankaSlot = new Date(Date.now() + 2 * DAY_MS); priyankaSlot.setHours(11, 30, 0, 0);
  const priyankaIv = await ensureInterviewAt(priyankaApp.id, opsStage1.id, priyankaSlot, [interviewer.id]);
  await sendRound1Invites({
    actorUserId: hr.id, interviewId: priyankaIv.id, candidate: priyanka, vacancyTitle: operations.title, stageLabel: opsStage1.name, scheduledAt: priyankaSlot,
    panelists: [{ id: interviewer.id, name: interviewer.name, email: interviewer.email }],
  });

  // SHORTLISTED with a completed, scored round-1 -- Priyanka's interview above
  // is deliberately future-dated (Upcoming Calls demo) so has no feedback
  // yet, and Connor below is still APPLIED, so without this Comparison for
  // Operations has nobody to rank and hits its empty state.
  const wei = await ensureCandidate({
    name: "Wei Zhang", email: "wei.zhang@example.com", phoneNumber: "+44 7700 900132",
    cv: {
      name: "Wei Zhang", email: "wei.zhang@example.com", phone: "+44 7700 900132", location: "Leeds, UK",
      headline: "Operations Manager",
      summary: "Operations leader with five years' experience running multi-site fulfilment operations for mid-market retailers.",
      experience: [{ title: "Operations Manager", company: "Rowcliffe Logistics", period: "2020 – Present", bullets: ["Managed a 40-person team across one distribution centre, hitting 98.5% on-time dispatch.", "Introduced a daily standup and KPI board that cut escalations by a quarter."] }],
      education: { degree: "BSc Business and Management", school: "Leeds Beckett University", period: "2016 – 2019" },
      skills: ["Operations Management", "Team Leadership", "Process Improvement", "Inventory Planning"],
    },
    reviewed: { byUserId: hr.id, note: "Solid multi-site track record, moved to Initial Interview." },
  });
  const weiApp = await ensureApplication(wei.id, operations.id, hiringManager.id, "SHORTLISTED", opsStage1.id, 6);
  const weiSlot = new Date(Date.now() - 4 * DAY_MS); weiSlot.setHours(9, 0, 0, 0);
  const weiIv = await ensureInterviewAt(weiApp.id, opsStage1.id, weiSlot, [interviewer.id], [
    { userId: interviewer.id, score: 7, comments: "Clear, structured answers on process improvement. Good candidate for the next round." },
  ]);
  await sendRound1Invites({
    actorUserId: hr.id, interviewId: weiIv.id, candidate: wei, vacancyTitle: operations.title, stageLabel: opsStage1.name, scheduledAt: weiSlot,
    panelists: [{ id: interviewer.id, name: interviewer.name, email: interviewer.email }],
  });

  const connor = await ensureCandidate({
    name: "Connor Ashby", email: "connor.ashby@example.com", phoneNumber: "+44 7700 900127",
    cv: {
      name: "Connor Ashby", email: "connor.ashby@example.com", phone: "+44 7700 900127", location: "Derby, UK",
      headline: "Operations Manager",
      summary: "Operations professional with four years' experience supervising warehouse teams and coordinating logistics schedules.",
      experience: [{ title: "Operations Supervisor", company: "Blackwell Freight", period: "2021 – Present", bullets: ["Supervised a 25-person shift team, maintaining a 97% pick accuracy rate."] }],
      education: { degree: "BSc Business Management", school: "University of Derby", period: "2017 – 2020" },
      skills: ["Warehouse Management", "Scheduling", "Team Supervision"],
    },
  });
  await ensureApplication(connor.id, operations.id, hiringManager.id, "APPLIED", null, 1);

  // ----------------------------------------------------------------- Legal --
  const legal = await ensureVacancy("Corporate Counsel", "Legal", "Advise the business on commercial contracts, compliance, and risk.");
  const legalStage1 = await ensureStage(legal.id, "Initial Interview", 1);
  await ensureStage(legal.id, "Final Interview", 2);
  await ensurePoolMember(legal.id, interviewer.id);
  await ensurePoolMember(legal.id, mgmtLegal.id);

  const marguerite = await ensureCandidate({
    name: "Marguerite Aubin", email: "marguerite.aubin@example.com", phoneNumber: "+44 7700 900128",
    cv: {
      name: "Marguerite Aubin", email: "marguerite.aubin@example.com", phone: "+44 7700 900128", location: "London, UK",
      headline: "Corporate Counsel",
      summary: "Commercial lawyer with six years' post-qualification experience advising on contracts, compliance, and risk for mid-market technology companies.",
      experience: [{ title: "Commercial Counsel", company: "Ashworth & Reid LLP", period: "2020 – Present", bullets: ["Advised on commercial contracts spanning SaaS licensing, data processing, and vendor agreements.", "Built the company's first standardised contract playbook, cutting average review time by 40%."] }],
      education: { degree: "LLB Law", school: "King's College London", period: "2013 – 2016" },
      skills: ["Commercial Contracts", "Compliance", "Risk Management", "Negotiation"],
    },
    reviewed: { byUserId: hr.id, note: "Strong commercial contracts background, moved to Initial Interview." },
  });
  const margueriteApp = await ensureApplication(marguerite.id, legal.id, hiringManager.id, "SHORTLISTED", legalStage1.id, 5);
  const margueriteSlot = new Date(Date.now() - 4 * DAY_MS); margueriteSlot.setHours(10, 0, 0, 0);
  const margueriteIv = await ensureInterviewAt(margueriteApp.id, legalStage1.id, margueriteSlot, [interviewer.id], [
    { userId: interviewer.id, score: 8, comments: "Excellent grasp of commercial risk trade-offs, gave sharp, practical answers throughout." },
  ]);
  await sendRound1Invites({
    actorUserId: hr.id, interviewId: margueriteIv.id, candidate: marguerite, vacancyTitle: legal.title, stageLabel: legalStage1.name, scheduledAt: margueriteSlot,
    panelists: [{ id: interviewer.id, name: interviewer.name, email: interviewer.email }],
  });

  const theo = await ensureCandidate({
    name: "Theo Bergmann", email: "theo.bergmann@example.com", phoneNumber: "+44 7700 900129",
    cv: {
      name: "Theo Bergmann", email: "theo.bergmann@example.com", phone: "+44 7700 900129", location: "Reading, UK",
      headline: "Corporate Counsel",
      summary: "Early-career commercial lawyer with two years' post-qualification experience in contract review and compliance support.",
      experience: [{ title: "Associate Solicitor", company: "Hartwell Legal", period: "2023 – Present", bullets: ["Reviewed and negotiated NDAs and vendor agreements for a portfolio of SME clients."] }],
      education: { degree: "LLB Law", school: "University of Reading", period: "2018 – 2021" },
      skills: ["Contract Review", "Compliance", "Legal Research"],
    },
  });
  await ensureApplication(theo.id, legal.id, hiringManager.id, "APPLIED", null, 1);

  // -------------------------------------------------- Comparison filler --
  // Every vacancy above already has its own hand-written, story-carrying
  // candidates (Elias, Baptiste, Camille, etc). But most only had 2-4
  // SHORTLISTED-with-feedback candidates, so Candidate Comparison's Top 5
  // ranking read as mostly empty rows on 6 of the 8 vacancies. These are
  // terser (one experience entry, no distinct narrative) on purpose --
  // ensureFillerCandidate() exists specifically so this block stays compact.
  const fillerPanelist = { interviewerId: interviewer.id, interviewerName: interviewer.name, interviewerEmail: interviewer.email };

  // IT (Backend Engineer) already has 4 (Tomas, Aiko, Rasheed, Elias) -- 2 more for a clean 6.
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Hassan Malik", email: "hassan.malik@example.com", phone: "+44 7700 900134", location: "Bristol, UK",
    headline: "Backend Engineer", company: "Northgate Systems", bullet: "Built and maintained REST APIs serving 2M+ daily requests.",
    degree: "BSc Computer Science", school: "University of Bristol", skills: ["Node.js", "PostgreSQL", "Docker"],
    vacancy: backendEng, stage: beStage1, score: 7, comment: "Solid fundamentals, good grasp of API design trade-offs.",
    appliedDaysAgo: 9, interviewDaysAgo: 4,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Lena Fischer", email: "lena.fischer@example.com", phone: "+44 7700 900135", location: "Newcastle, UK",
    headline: "Software Engineer", company: "Coppergate Digital", bullet: "Led migration of a monolith to microservices, cutting deploy time 60%.",
    degree: "BEng Software Engineering", school: "Newcastle University", skills: ["TypeScript", "Kubernetes", "AWS"],
    vacancy: backendEng, stage: beStage1, score: 8, comment: "Strong systems thinking, asked sharp questions about our architecture.",
    appliedDaysAgo: 8, interviewDaysAgo: 3,
  });

  // Finance (Senior Financial Analyst) had 2 (Ingrid, Julian) -- 3 more for 5.
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Grace Farnham", email: "grace.farnham@example.com", phone: "+44 7700 900136", location: "Edinburgh, UK",
    headline: "Financial Analyst", company: "Larchmont Capital", bullet: "Built the rolling 13-week cash forecast model used across 3 business units.",
    degree: "BSc Finance", school: "University of Edinburgh", skills: ["Financial Modelling", "Excel", "SQL"],
    vacancy: finance, stage: financeStage1, score: 8, comment: "Excellent case study walkthrough, clear on variance drivers.",
    appliedDaysAgo: 10, interviewDaysAgo: 5,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Samuel Okoro", email: "samuel.okoro@example.com", phone: "+44 7700 900137", location: "Cardiff, UK",
    headline: "Senior Financial Analyst", company: "Redbridge Holdings", bullet: "Owned monthly variance analysis for a £40M departmental budget.",
    degree: "MSc Accounting and Finance", school: "Cardiff University", skills: ["Forecasting", "Power BI", "SAP"],
    vacancy: finance, stage: financeStage1, score: 7, comment: "Good technical depth, slightly light on stakeholder-facing examples.",
    appliedDaysAgo: 11, interviewDaysAgo: 6,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Anya Petrenko", email: "anya.petrenko@example.com", phone: "+44 7700 900138", location: "Glasgow, UK",
    headline: "Financial Analyst", company: "Kestrel Partners", bullet: "Automated the quarterly board reporting pack, saving 2 days per cycle.",
    degree: "BA Economics", school: "University of Glasgow", skills: ["Financial Modelling", "Python", "Tableau"],
    vacancy: finance, stage: financeStage1, score: 9, comment: "Best case study of the round -- crisp, structured, owned the numbers.",
    appliedDaysAgo: 7, interviewDaysAgo: 2,
  });

  // Marketing (Content Marketing Specialist) had 2 (Baptiste, Priya) -- 4 more for 6.
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Leo Bennett", email: "leo.bennett@example.com", phone: "+44 7700 900139", location: "Brighton, UK",
    headline: "Content Marketing Specialist", company: "Fernbank Media", bullet: "Grew organic blog traffic 3x in 12 months through an SEO-led content calendar.",
    degree: "BA Marketing", school: "University of Sussex", skills: ["SEO", "Content Strategy", "HubSpot"],
    vacancy: marketing, stage: marketingStage1, score: 7, comment: "Solid portfolio, good instinct for audience segmentation.",
    appliedDaysAgo: 12, interviewDaysAgo: 6,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Zara Ahmed", email: "zara.ahmed@example.com", phone: "+44 7700 900140", location: "Nottingham, UK",
    headline: "Marketing Specialist", company: "Willowmere Brands", bullet: "Ran email nurture campaigns lifting MQL-to-SQL conversion by 18%.",
    degree: "BSc Marketing Management", school: "University of Nottingham", skills: ["Email Marketing", "Copywriting", "Analytics"],
    vacancy: marketing, stage: marketingStage1, score: 8, comment: "Confident presenter, strong grasp of the funnel metrics that matter.",
    appliedDaysAgo: 9, interviewDaysAgo: 4,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Tobias Lindgren", email: "tobias.lindgren@example.com", phone: "+44 7700 900141", location: "York, UK",
    headline: "Content Strategist", company: "Northwold Agency", bullet: "Built a content calendar spanning blog, social, and email across 4 product lines.",
    degree: "BA English and Media", school: "University of York", skills: ["Content Strategy", "Social Media", "Canva"],
    vacancy: marketing, stage: marketingStage1, score: 6, comment: "Decent writing samples, less experienced with paid channels than others.",
    appliedDaysAgo: 14, interviewDaysAgo: 7,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Chidi Obi", email: "chidi.obi@example.com", phone: "+44 7700 900142", location: "Leicester, UK",
    headline: "Content Marketing Specialist", company: "Ashgrove Studio", bullet: "Launched a customer-story video series that became the top-performing content format.",
    degree: "BA Communications", school: "De Montfort University", skills: ["Video Content", "Storytelling", "SEO"],
    vacancy: marketing, stage: marketingStage1, score: 7, comment: "Creative range stood out, good sense of what makes content shareable.",
    appliedDaysAgo: 8, interviewDaysAgo: 3,
  });

  // Sales (Account Executive) had 2 (Felix, Naledi) -- 4 more for 6.
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Morgan Wells", email: "morgan.wells@example.com", phone: "+44 7700 900143", location: "Reading, UK",
    headline: "Account Executive", company: "Silverline Solutions", bullet: "Closed $1.2M in new-business ARR against a $900K quota.",
    degree: "BA Business Management", school: "University of Reading", skills: ["Consultative Selling", "Salesforce", "Negotiation"],
    vacancy: sales, stage: salesStage1, score: 8, comment: "Confident role play, handled objections smoothly.",
    appliedDaysAgo: 10, interviewDaysAgo: 5,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Selin Aydin", email: "selin.aydin@example.com", phone: "+44 7700 900144", location: "Southampton, UK",
    headline: "Mid-Market Account Executive", company: "Hartwell Growth", bullet: "Ran full-cycle deals from first call to close, averaging a 45-day sales cycle.",
    degree: "BSc Business Economics", school: "University of Southampton", skills: ["Full-Cycle Sales", "HubSpot", "Discovery Calls"],
    vacancy: sales, stage: salesStage1, score: 9, comment: "Best role play of the round -- sharp discovery questions, natural close.",
    appliedDaysAgo: 7, interviewDaysAgo: 3,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Declan Murphy", email: "declan.murphy@example.com", phone: "+44 7700 900145", location: "Belfast, UK",
    headline: "Account Executive", company: "Cloverfield Sales Group", bullet: "Consistently ranked top 3 rep on a 12-person mid-market team for 4 straight quarters.",
    degree: "BA Marketing", school: "Queen's University Belfast", skills: ["Pipeline Management", "Cold Outreach", "Salesforce"],
    vacancy: sales, stage: salesStage1, score: 7, comment: "Strong track record, role play was good but a little script-heavy.",
    appliedDaysAgo: 12, interviewDaysAgo: 6,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Ines Duarte", email: "ines.duarte@example.com", phone: "+44 7700 900146", location: "Portsmouth, UK",
    headline: "Account Executive", company: "Brightfield Partners", bullet: "Built and ran an outbound playbook that sourced 30% of team pipeline.",
    degree: "BSc International Business", school: "University of Portsmouth", skills: ["Outbound Prospecting", "Negotiation", "CRM Hygiene"],
    vacancy: sales, stage: salesStage1, score: 6, comment: "Good energy, needs more polish on the negotiation stage of the role play.",
    appliedDaysAgo: 9, interviewDaysAgo: 4,
  });

  // Customer Service (Customer Success Manager) had 2 (Naledi, Ravi) -- 4 more for 6.
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Yuki Tanaka", email: "yuki.tanaka@example.com", phone: "+44 7700 900147", location: "Oxford, UK",
    headline: "Customer Success Manager", company: "Thornbury SaaS", bullet: "Owned a $3M renewal book at 96% gross retention.",
    degree: "BA Business Administration", school: "Oxford Brookes University", skills: ["Account Management", "Renewals", "Zendesk"],
    vacancy: custService, stage: csStage1, score: 8, comment: "Calm, structured screening call -- clearly done this before.",
    appliedDaysAgo: 11, interviewDaysAgo: 5,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Femi Adewale", email: "femi.adewale@example.com", phone: "+44 7700 900148", location: "Coventry, UK",
    headline: "Customer Success Manager", company: "Maplewood CX", bullet: "Reduced churn in an at-risk account segment from 14% to 6% in two quarters.",
    degree: "BSc Business Management", school: "Coventry University", skills: ["Churn Reduction", "QBRs", "HubSpot"],
    vacancy: custService, stage: csStage1, score: 9, comment: "Excellent screening call -- specific, metrics-led answers throughout.",
    appliedDaysAgo: 8, interviewDaysAgo: 3,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Nora Kaminski", email: "nora.kaminski@example.com", phone: "+44 7700 900149", location: "Derby, UK",
    headline: "Client Success Manager", company: "Ashford Renewals", bullet: "Managed onboarding-to-renewal lifecycle for 40+ mid-market accounts.",
    degree: "BA Communications", school: "University of Derby", skills: ["Onboarding", "Relationship Management", "Salesforce"],
    vacancy: custService, stage: csStage1, score: 6, comment: "Reasonable answers, less depth on expansion/upsell than others.",
    appliedDaysAgo: 13, interviewDaysAgo: 6,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Ali Hassan", email: "ali.hassan@example.com", phone: "+44 7700 900150", location: "Wolverhampton, UK",
    headline: "Customer Success Manager", company: "Ridgeway Client Services", bullet: "Built the team's first structured QBR template, adopted org-wide.",
    degree: "BSc Business Studies", school: "University of Wolverhampton", skills: ["QBRs", "Process Design", "Account Management"],
    vacancy: custService, stage: csStage1, score: 7, comment: "Good process instincts, solid but not standout screening call.",
    appliedDaysAgo: 10, interviewDaysAgo: 4,
  });

  // HR (HR Business Partner) had 1 (Camille) -- 4 more for 5.
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Beatrice Lund", email: "beatrice.lund@example.com", phone: "+44 7700 900151", location: "Norwich, UK",
    headline: "HR Business Partner", company: "Elmswood Group", bullet: "Partnered with 3 department heads on headcount planning and performance cycles.",
    degree: "BA Human Resource Management", school: "University of East Anglia", skills: ["Employee Relations", "Workforce Planning", "Workday"],
    vacancy: hrBp, stage: hrStage1, score: 8, comment: "Strong stakeholder-management examples, clearly done this at scale.",
    appliedDaysAgo: 9, interviewDaysAgo: 4,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Marcel Dubois", email: "marcel.dubois@example.com", phone: "+44 7700 900152", location: "Swansea, UK",
    headline: "HR Generalist", company: "Castlebridge People", bullet: "Ran the annual performance review cycle for a 200-person org.",
    degree: "BSc Psychology", school: "Swansea University", skills: ["Performance Management", "Employee Relations", "ATS Systems"],
    vacancy: hrBp, stage: hrStage1, score: 6, comment: "Solid generalist background, less BP-specific stakeholder experience.",
    appliedDaysAgo: 12, interviewDaysAgo: 6,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Sofia Novak", email: "sofia.novak@example.com", phone: "+44 7700 900153", location: "Plymouth, UK",
    headline: "HR Business Partner", company: "Grovemount Ltd", bullet: "Led a restructuring process across 2 teams with zero grievance escalations.",
    degree: "MA Human Resource Management", school: "University of Plymouth", skills: ["Change Management", "Employee Relations", "Coaching"],
    vacancy: hrBp, stage: hrStage1, score: 9, comment: "Excellent judgment on a tricky restructuring scenario question.",
    appliedDaysAgo: 7, interviewDaysAgo: 2,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Ewan Fraser", email: "ewan.fraser@example.com", phone: "+44 7700 900154", location: "Dundee, UK",
    headline: "HR Business Partner", company: "Kinross Partners", bullet: "Advised department leads on hiring plans across 5 open roles simultaneously.",
    degree: "BA Business with HR", school: "University of Dundee", skills: ["Hiring Plans", "Workforce Planning", "Stakeholder Management"],
    vacancy: hrBp, stage: hrStage1, score: 7, comment: "Good breadth, a bit generic on the performance-management questions.",
    appliedDaysAgo: 10, interviewDaysAgo: 5,
  });

  // Operations (Operations Manager) had 2 (Priyanka, Wei) -- 4 more for 6.
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Ada Okonkwo", email: "ada.okonkwo@example.com", phone: "+44 7700 900155", location: "Luton, UK",
    headline: "Operations Manager", company: "Redcliffe Logistics", bullet: "Cut average order-fulfilment time by 22% through a warehouse workflow redesign.",
    degree: "BEng Industrial Engineering", school: "University of Bedfordshire", skills: ["Process Improvement", "Logistics", "Lean"],
    vacancy: operations, stage: opsStage1, score: 8, comment: "Concrete, metrics-led examples throughout -- strong process instincts.",
    appliedDaysAgo: 11, interviewDaysAgo: 5,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Piotr Kowalski", email: "piotr.kowalski@example.com", phone: "+44 7700 900156", location: "Slough, UK",
    headline: "Fulfilment Operations Lead", company: "Bramwell Distribution", bullet: "Managed a 40-person fulfilment shift, hitting SLA 98%+ for 6 straight months.",
    degree: "BSc Operations Management", school: "University of West London", skills: ["Team Leadership", "SLA Management", "WMS Systems"],
    vacancy: operations, stage: opsStage1, score: 7, comment: "Strong people-management track record, solid but not exceptional answers.",
    appliedDaysAgo: 8, interviewDaysAgo: 3,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Layla Hussain", email: "layla.hussain@example.com", phone: "+44 7700 900157", location: "Watford, UK",
    headline: "Operations Manager", company: "Ferngate Supply Co", bullet: "Led the rollout of a new WMS across 2 sites with zero fulfilment downtime.",
    degree: "BSc Business Operations", school: "University of Hertfordshire", skills: ["Systems Rollout", "Change Management", "Six Sigma"],
    vacancy: operations, stage: opsStage1, score: 9, comment: "Best interview of the round -- calm under pressure, clear ownership of outcomes.",
    appliedDaysAgo: 6, interviewDaysAgo: 2,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Magnus Berg", email: "magnus.berg@example.com", phone: "+44 7700 900158", location: "Milton Keynes, UK",
    headline: "Operations Manager", company: "Hollowfield Freight", bullet: "Owned the daily ops dashboard used by leadership to track fulfilment KPIs.",
    degree: "BSc Supply Chain Management", school: "Cranfield University", skills: ["KPI Reporting", "Supply Chain", "Excel"],
    vacancy: operations, stage: opsStage1, score: 6, comment: "Good reporting instincts, less hands-on floor-management experience.",
    appliedDaysAgo: 13, interviewDaysAgo: 7,
  });

  // Legal (Corporate Counsel) had 1 (Marguerite) -- 4 more for 5.
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Clara Jensen", email: "clara.jensen@example.com", phone: "+44 7700 900159", location: "Bath, UK",
    headline: "Corporate Counsel", company: "Ashcombe Legal", bullet: "Negotiated and closed 50+ commercial contracts annually across SaaS and services deals.",
    degree: "LLB Law", school: "University of Bath", skills: ["Contract Negotiation", "SaaS Agreements", "Compliance"],
    vacancy: legal, stage: legalStage1, score: 8, comment: "Sharp on contract risk, gave a great example of pushing back on a bad clause.",
    appliedDaysAgo: 9, interviewDaysAgo: 4,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Youssef El-Amin", email: "youssef.el-amin@example.com", phone: "+44 7700 900160", location: "Exeter, UK",
    headline: "Commercial Counsel", company: "Foxglove Partners LLP", bullet: "Built the company's first standardized contract playbook, cutting review time 30%.",
    degree: "LLB Law with Business", school: "University of Exeter", skills: ["Contract Review", "Playbook Design", "Compliance"],
    vacancy: legal, stage: legalStage1, score: 9, comment: "Excellent -- practical, business-minded legal thinking, not just theory.",
    appliedDaysAgo: 6, interviewDaysAgo: 2,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Astrid Solheim", email: "astrid.solheim@example.com", phone: "+44 7700 900161", location: "Canterbury, UK",
    headline: "Corporate Counsel", company: "Ravensworth & Co", bullet: "Advised on regulatory compliance for a multi-jurisdiction expansion.",
    degree: "LLM International Law", school: "University of Kent", skills: ["Regulatory Compliance", "Risk Advisory", "Legal Research"],
    vacancy: legal, stage: legalStage1, score: 7, comment: "Good regulatory depth, a little less commercial-contract experience.",
    appliedDaysAgo: 11, interviewDaysAgo: 5,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Kwame Mensah", email: "kwame.mensah@example.com", phone: "+44 7700 900162", location: "Colchester, UK",
    headline: "Corporate Counsel", company: "Brookfield Legal Services", bullet: "Managed the legal side of vendor onboarding for a 300+ supplier portfolio.",
    degree: "LLB Law", school: "University of Essex", skills: ["Vendor Contracts", "Risk Advisory", "Compliance"],
    vacancy: legal, stage: legalStage1, score: 6, comment: "Reasonable interview, answers ran a bit generic under follow-up questions.",
    appliedDaysAgo: 14, interviewDaysAgo: 7,
  });

  // -------------------------------------- Second vacancy per department --
  // User's ask: each department's Management account was looking at a
  // single vacancy, which made Dashboard/Reports/Candidate Progress read as
  // a one-role company rather than an ongoing pipeline. One new vacancy per
  // department, each with one SHORTLISTED-and-scored candidate (via
  // ensureFillerCandidate, same as the Comparison-depth batch above) plus
  // one fresh APPLIED-only candidate for CV-review variety -- deliberately
  // small (2 candidates each, not a second full department build-out) since
  // the point is a second data point on each screen, not a second dataset.
  // Management's Dashboard/Reports/Candidate Progress are scoped by
  // `Vacancy.department` directly (getDepartmentVacancies), not by panel
  // membership, so these don't need ensurePoolMember calls to show up there.
  const qaEng = await ensureVacancy("QA Engineer", "IT", "Own manual and automated test coverage across our core platform releases.");
  const qaEngStage1 = await ensureStage(qaEng.id, "Technical Interview", 1);
  // Second configured round -- previously this vacancy only had one round
  // total, so Jonas's HIRE (below) had exactly one interview behind it, like
  // 4 of the other 5 single-round hires in this file. Giving QA Engineer a
  // real second round lets Jonas be one of the 2 (of those 5) that get a
  // genuine multi-round history before being hired, same spirit as Baptiste/
  // Elias above -- not "inventing" a round, this vacancy is configured with
  // it from here on, same as any other two-round vacancy in this dataset.
  const qaEngStage2 = await ensureStage(qaEng.id, "Final Interview", 2);
  const jonas = await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Jonas Kessler", email: "jonas.kessler@example.com", phone: "+44 7700 900163", location: "Sheffield, UK",
    headline: "QA Engineer", company: "Millbrook Software", bullet: "Built the team's first automated regression suite, cutting release testing time in half.",
    degree: "BSc Computer Science", school: "Sheffield Hallam University", skills: ["Test Automation", "Selenium", "CI/CD"],
    vacancy: qaEng, stage: qaEngStage1, score: 7, comment: "Good automation instincts, clear about testing trade-offs.",
    appliedDaysAgo: 8, interviewDaysAgo: 3,
  });
  const jonasApp = await prisma.candidateApplication.findUniqueOrThrow({
    where: { candidateId_vacancyId: { candidateId: jonas.id, vacancyId: qaEng.id } },
  });
  // Round 2 (Final Interview) -- completed and scored, management (Elena,
  // IT's own account) included per the enforced "management attends the
  // final round" convention. currentVacancyStageId moves to this round
  // before the HIRE below, which needs it to already be the vacancy's last
  // configured round (application.controller.ts's hire-decision guard).
  await prisma.candidateApplication.update({ where: { id: jonasApp.id }, data: { currentVacancyStageId: qaEngStage2.id } });
  const jonasR2 = new Date(Date.now() - 3 * DAY_MS); jonasR2.setHours(14, 0, 0, 0);
  await ensureInterviewAt(jonasApp.id, qaEngStage2.id, jonasR2, [interviewer.id, management.id], [
    { userId: interviewer.id, score: 8, comments: "Confident in the final round too -- walked through the regression suite's edge-case coverage in real detail." },
    { userId: management.id, score: 8, comments: "Practical, detail-oriented, clearly ready to own this. Recommend hire." },
  ]);
  // Department Performance needs real hired/fill-rate variety across
  // departments (previously every one of these single-stage secondary roles
  // sat SHORTLISTED forever, so fillRate was 0% everywhere). currentVacancyStageId
  // is now the vacancy's last configured round, satisfying the same
  // hire-decision guard used for Baptiste above, so the HIRE is legitimate
  // under the app's own rules.
  await prisma.candidateApplication.update({
    where: { id: jonasApp.id },
    data: { stage: "HIRED", hiringDecision: "HIRE", decidedByUserId: hiringManager.id, decidedAt: new Date(Date.now() - 2 * DAY_MS) },
  });
  await sendOnceAndLog({
    actorUserId: hiringManager.id, entityType: "CandidateApplication", entityId: jonasApp.id, recipient: jonas.email,
    reason: "hiring_decision_hire", vars: { candidateName: jonas.name, vacancyTitle: qaEng.title },
  });
  await writeAuditLog(hiringManager.id, "HM_DECISION_COMMENT", "CandidateApplication", jonasApp.id, {
    decision: "HIRE", comments: "Automation-first mindset, immediately useful for the regression suite. Easy hire.",
  });
  await prisma.vacancy.update({ where: { id: qaEng.id }, data: { status: "CLOSED" } });

  // Now that QA Engineer is filled, this CV-stage applicant gets a real
  // courtesy rejection rather than sitting APPLIED against a closed vacancy
  // forever -- same minimal REJECTED pattern as Freya's CV-stage reject
  // above (no interview, no hiringDecision fields, just an HR review note).
  const bethany = await ensureCandidate({
    name: "Bethany Coleman", email: "bethany.coleman@example.com", phoneNumber: "+44 7700 900164",
    cv: {
      name: "Bethany Coleman", email: "bethany.coleman@example.com", phone: "+44 7700 900164", location: "Hull, UK",
      headline: "QA Engineer",
      summary: "QA engineer with a mix of manual exploratory testing and automation scripting experience.",
      experience: [{ title: "QA Engineer", company: "Riverton Apps", period: "2021 – Present", bullets: ["Owned test planning for 3 major releases a year across web and mobile."] }],
      education: { degree: "BSc Software Engineering", school: "University of Hull", period: "2016 – 2019" },
      skills: ["Manual Testing", "Test Planning", "Jira"],
    },
    reviewed: { byUserId: hr.id, note: "Solid manual testing background, but the role was filled by another candidate before this application progressed." },
  });
  await ensureApplication(bethany.id, qaEng.id, hiringManager.id, "REJECTED", null, 2);

  const socialMedia = await ensureVacancy("Social Media Manager", "Marketing", "Own the brand's voice and growth across all social channels.");
  const socialMediaStage1 = await ensureStage(socialMedia.id, "Portfolio Review", 1);
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Imogen Vance", email: "imogen.vance@example.com", phone: "+44 7700 900165", location: "Chester, UK",
    headline: "Social Media Manager", company: "Larkspur Brands", bullet: "Grew Instagram following from 8K to 60K in 14 months through a consistent short-form video strategy.",
    degree: "BA Media and Communications", school: "University of Chester", skills: ["Short-Form Video", "Community Management", "Analytics"],
    vacancy: socialMedia, stage: socialMediaStage1, score: 8, comment: "Impressive portfolio, clearly understands platform-native content.",
    appliedDaysAgo: 7, interviewDaysAgo: 2,
  });
  const rian = await ensureCandidate({
    name: "Rian Doyle", email: "rian.doyle@example.com", phoneNumber: "+44 7700 900166",
    cv: {
      name: "Rian Doyle", email: "rian.doyle@example.com", phone: "+44 7700 900166", location: "Preston, UK",
      headline: "Social Media Coordinator",
      summary: "Social media coordinator experienced running day-to-day posting and community engagement for a consumer brand.",
      experience: [{ title: "Social Media Coordinator", company: "Hazelmere Co", period: "2022 – Present", bullets: ["Ran daily posting and community replies across Instagram and TikTok."] }],
      education: { degree: "BA Marketing", school: "University of Central Lancashire", period: "2018 – 2021" },
      skills: ["Content Scheduling", "Community Management", "Canva"],
    },
  });
  await ensureApplication(rian.id, socialMedia.id, hiringManager.id, "APPLIED", null, 1);

  const sdr = await ensureVacancy("Sales Development Representative", "Sales", "Generate and qualify new-business pipeline for the Account Executive team.");
  const sdrStage1 = await ensureStage(sdr.id, "Role Play Interview", 1);
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Tariq Osei", email: "tariq.osei@example.com", phone: "+44 7700 900167", location: "Northampton, UK",
    headline: "Sales Development Representative", company: "Brackenfield Growth", bullet: "Booked 25+ qualified meetings a month against a 15-meeting target.",
    degree: "BA Business Studies", school: "University of Northampton", skills: ["Cold Outreach", "Discovery Calls", "Salesforce"],
    vacancy: sdr, stage: sdrStage1, score: 7, comment: "Energetic, handled objections reasonably well in the role play.",
    appliedDaysAgo: 9, interviewDaysAgo: 4,
  });
  const willa = await ensureCandidate({
    name: "Willa Sandberg", email: "willa.sandberg@example.com", phoneNumber: "+44 7700 900168",
    cv: {
      name: "Willa Sandberg", email: "willa.sandberg@example.com", phone: "+44 7700 900168", location: "Peterborough, UK",
      headline: "Sales Development Representative",
      summary: "Entry-level sales professional with a strong internship track record in outbound prospecting.",
      experience: [{ title: "Sales Intern", company: "Fenchurch Partners", period: "2023 – Present", bullets: ["Supported the SDR team with lead research and outbound sequencing."] }],
      education: { degree: "BA Business Management", school: "Anglia Ruskin University", period: "2020 – 2023" },
      skills: ["Lead Research", "Outbound Prospecting", "HubSpot"],
    },
  });
  await ensureApplication(willa.id, sdr.id, hiringManager.id, "APPLIED", null, 2);

  const supportSpec = await ensureVacancy("Support Specialist", "Customer Service", "Frontline technical support for our self-serve customer base.");
  const supportSpecStage1 = await ensureStage(supportSpec.id, "Screening Call", 1);
  const sana = await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Sana Iqbal", email: "sana.iqbal@example.com", phone: "+44 7700 900169", location: "Bradford, UK",
    headline: "Support Specialist", company: "Millrace Software", bullet: "Maintained a 96% CSAT score across 40+ tickets a day.",
    degree: "BSc Information Systems", school: "University of Bradford", skills: ["Zendesk", "Troubleshooting", "Customer Communication"],
    vacancy: supportSpec, stage: supportSpecStage1, score: 8, comment: "Clear communicator, strong troubleshooting examples.",
    appliedDaysAgo: 6, interviewDaysAgo: 2,
  });
  // Same reasoning as Jonas above -- single-stage vacancy, this candidate's
  // stage is already the last one, so a real HIRE is valid here.
  const sanaApp = await prisma.candidateApplication.findUniqueOrThrow({
    where: { candidateId_vacancyId: { candidateId: sana.id, vacancyId: supportSpec.id } },
  });
  await prisma.candidateApplication.update({
    where: { id: sanaApp.id },
    data: { stage: "HIRED", hiringDecision: "HIRE", decidedByUserId: hiringManager.id, decidedAt: new Date(Date.now() - 1 * DAY_MS) },
  });
  await sendOnceAndLog({
    actorUserId: hiringManager.id, entityType: "CandidateApplication", entityId: sanaApp.id, recipient: sana.email,
    reason: "hiring_decision_hire", vars: { candidateName: sana.name, vacancyTitle: supportSpec.title },
  });
  await writeAuditLog(hiringManager.id, "HM_DECISION_COMMENT", "CandidateApplication", sanaApp.id, {
    decision: "HIRE", comments: "Confident troubleshooting and a great customer manner from the first call. Easy yes.",
  });
  await prisma.vacancy.update({ where: { id: supportSpec.id }, data: { status: "CLOSED" } });

  // Same courtesy-rejection reasoning as Bethany above -- Support Specialist
  // is now filled.
  const dexter = await ensureCandidate({
    name: "Dexter Holt", email: "dexter.holt@example.com", phoneNumber: "+44 7700 900170",
    cv: {
      name: "Dexter Holt", email: "dexter.holt@example.com", phone: "+44 7700 900170", location: "Wakefield, UK",
      headline: "Customer Support Representative",
      summary: "Customer support representative with two years handling high-volume ticket queues.",
      experience: [{ title: "Support Representative", company: "Gladwell Retail", period: "2022 – Present", bullets: ["Handled 50+ inbound tickets daily across chat and email."] }],
      education: { degree: "BA Business", school: "Leeds Beckett University", period: "2019 – 2022" },
      skills: ["Zendesk", "Live Chat Support", "Ticket Triage"],
    },
    reviewed: { byUserId: hr.id, note: "Good support experience, but the position was filled by another candidate first." },
  });
  await ensureApplication(dexter.id, supportSpec.id, hiringManager.id, "REJECTED", null, 1);

  const talentCoord = await ensureVacancy("Talent Acquisition Coordinator", "HR", "Coordinate scheduling and candidate communication across the full recruitment pipeline.");
  const talentCoordStage1 = await ensureStage(talentCoord.id, "Screening Call", 1);
  const rosalind = await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Rosalind Pike", email: "rosalind.pike@example.com", phone: "+44 7700 900171", location: "Ipswich, UK",
    headline: "Talent Acquisition Coordinator", company: "Fenmarsh Group", bullet: "Coordinated scheduling for 30+ interviews a month across 4 hiring managers.",
    degree: "BA Human Resource Management", school: "University of Suffolk", skills: ["Interview Coordination", "ATS Systems", "Candidate Communication"],
    vacancy: talentCoord, stage: talentCoordStage1, score: 7, comment: "Organised, personable, good sense of candidate experience.",
    appliedDaysAgo: 8, interviewDaysAgo: 3,
  });
  // Same reasoning as Jonas above -- single-stage vacancy, this candidate's
  // stage is already the last one, so a real HIRE is valid here.
  const rosalindApp = await prisma.candidateApplication.findUniqueOrThrow({
    where: { candidateId_vacancyId: { candidateId: rosalind.id, vacancyId: talentCoord.id } },
  });
  await prisma.candidateApplication.update({
    where: { id: rosalindApp.id },
    data: { stage: "HIRED", hiringDecision: "HIRE", decidedByUserId: hiringManager.id, decidedAt: new Date(Date.now() - 2 * DAY_MS) },
  });
  await sendOnceAndLog({
    actorUserId: hiringManager.id, entityType: "CandidateApplication", entityId: rosalindApp.id, recipient: rosalind.email,
    reason: "hiring_decision_hire", vars: { candidateName: rosalind.name, vacancyTitle: talentCoord.title },
  });
  await writeAuditLog(hiringManager.id, "HM_DECISION_COMMENT", "CandidateApplication", rosalindApp.id, {
    decision: "HIRE", comments: "Organised and personable, exactly the coordination support the team needs.",
  });
  await prisma.vacancy.update({ where: { id: talentCoord.id }, data: { status: "CLOSED" } });

  // Same courtesy-rejection reasoning as Bethany above -- Talent Acquisition
  // Coordinator is now filled.
  const gideon = await ensureCandidate({
    name: "Gideon Marsh", email: "gideon.marsh@example.com", phoneNumber: "+44 7700 900172",
    cv: {
      name: "Gideon Marsh", email: "gideon.marsh@example.com", phone: "+44 7700 900172", location: "Norwich, UK",
      headline: "HR Coordinator",
      summary: "HR coordinator experienced supporting recruitment administration and onboarding.",
      experience: [{ title: "HR Coordinator", company: "Broadgate Partners", period: "2021 – Present", bullets: ["Managed onboarding paperwork and scheduling for 60+ new hires a year."] }],
      education: { degree: "BA Business with HR", school: "University of East Anglia", period: "2017 – 2020" },
      skills: ["Onboarding", "Scheduling", "HRIS"],
    },
    reviewed: { byUserId: hr.id, note: "Relevant HR administration background, but the role was filled before this application could progress." },
  });
  await ensureApplication(gideon.id, talentCoord.id, hiringManager.id, "REJECTED", null, 2);

  const apSpecialist = await ensureVacancy("Accounts Payable Specialist", "Finance and Accounting", "Own the end-to-end accounts payable process, from invoice intake to payment run.");
  const apSpecialistStage1 = await ensureStage(apSpecialist.id, "Case Study Interview", 1);
  // Second configured round -- same reasoning as qaEngStage2 above: this is
  // one of the 2 (of the 5 single-round hires) picked to get a genuine
  // multi-round history before hire, so this vacancy is configured with a
  // real second round rather than Elliot being hired off one interview.
  const apSpecialistStage2 = await ensureStage(apSpecialist.id, "Final Interview", 2);
  const elliot = await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Elliot Nakashima", email: "elliot.nakashima@example.com", phone: "+44 7700 900173", location: "Chelmsford, UK",
    headline: "Accounts Payable Specialist", company: "Crestwood Finance", bullet: "Processed 500+ invoices a month with a 99.5% accuracy rate.",
    degree: "BSc Accounting", school: "Anglia Ruskin University", skills: ["Accounts Payable", "SAP", "Reconciliation"],
    vacancy: apSpecialist, stage: apSpecialistStage1, score: 9, comment: "Meticulous, excellent walkthrough of a three-way-match discrepancy.",
    appliedDaysAgo: 5, interviewDaysAgo: 2,
  });
  const elliotApp = await prisma.candidateApplication.findUniqueOrThrow({
    where: { candidateId_vacancyId: { candidateId: elliot.id, vacancyId: apSpecialist.id } },
  });
  // Round 2 (Final Interview) -- completed and scored, Finance's own
  // Management account (Nadia) included per the enforced "management
  // attends the final round" convention. Moves currentVacancyStageId to this
  // round before the HIRE below, which needs it to already be the vacancy's
  // last configured round (application.controller.ts's hire-decision guard).
  await prisma.candidateApplication.update({ where: { id: elliotApp.id }, data: { currentVacancyStageId: apSpecialistStage2.id } });
  const elliotR2 = new Date(Date.now() - 2 * DAY_MS); elliotR2.setHours(11, 0, 0, 0);
  await ensureInterviewAt(elliotApp.id, apSpecialistStage2.id, elliotR2, [interviewer.id, mgmtFinance.id], [
    { userId: interviewer.id, score: 9, comments: "Just as sharp in the final round -- caught a discrepancy in our own worked example almost immediately." },
    { userId: mgmtFinance.id, score: 9, comments: "Exceptional attention to detail, exactly the reliability this process needs. Recommend hire." },
  ]);
  // Same reasoning as Jonas above -- currentVacancyStageId is now the
  // vacancy's last configured round, so a real HIRE is valid here.
  await prisma.candidateApplication.update({
    where: { id: elliotApp.id },
    data: { stage: "HIRED", hiringDecision: "HIRE", decidedByUserId: hiringManager.id, decidedAt: new Date(Date.now() - 1 * DAY_MS) },
  });
  await sendOnceAndLog({
    actorUserId: hiringManager.id, entityType: "CandidateApplication", entityId: elliotApp.id, recipient: elliot.email,
    reason: "hiring_decision_hire", vars: { candidateName: elliot.name, vacancyTitle: apSpecialist.title },
  });
  await writeAuditLog(hiringManager.id, "HM_DECISION_COMMENT", "CandidateApplication", elliotApp.id, {
    decision: "HIRE", comments: "Meticulous and fast; the three-way-match walkthrough sealed it.",
  });
  await prisma.vacancy.update({ where: { id: apSpecialist.id }, data: { status: "CLOSED" } });

  // Same courtesy-rejection reasoning as Bethany above -- Accounts Payable
  // Specialist is now filled.
  const paloma = await ensureCandidate({
    name: "Paloma Serrano", email: "paloma.serrano@example.com", phoneNumber: "+44 7700 900174",
    cv: {
      name: "Paloma Serrano", email: "paloma.serrano@example.com", phone: "+44 7700 900174", location: "Luton, UK",
      headline: "Accounts Payable Assistant",
      summary: "Accounts payable assistant with solid transactional finance experience.",
      experience: [{ title: "AP Assistant", company: "Oakhurst Ltd", period: "2022 – Present", bullets: ["Handled invoice processing and vendor queries for a 200-supplier ledger."] }],
      education: { degree: "BA Accounting and Finance", school: "University of Bedfordshire", period: "2019 – 2022" },
      skills: ["Invoice Processing", "Excel", "Vendor Management"],
    },
    reviewed: { byUserId: hr.id, note: "Relevant accounts payable experience, but the position was filled by another candidate first." },
  });
  await ensureApplication(paloma.id, apSpecialist.id, hiringManager.id, "REJECTED", null, 1);

  const logisticsCoord = await ensureVacancy("Logistics Coordinator", "Operations", "Coordinate inbound and outbound freight schedules across 2 fulfilment sites.");
  const logisticsCoordStage1 = await ensureStage(logisticsCoord.id, "Initial Interview", 1);
  const reuben = await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Reuben Frost", email: "reuben.frost@example.com", phone: "+44 7700 900175", location: "Doncaster, UK",
    headline: "Logistics Coordinator", company: "Ashfield Freight", bullet: "Coordinated freight scheduling across 3 carriers, reducing late shipments by 18%.",
    degree: "BSc Logistics and Supply Chain Management", school: "University of Huddersfield", skills: ["Freight Scheduling", "Carrier Management", "Excel"],
    vacancy: logisticsCoord, stage: logisticsCoordStage1, score: 7, comment: "Solid coordination experience, practical answers throughout.",
    appliedDaysAgo: 9, interviewDaysAgo: 4,
  });
  // Same reasoning as Jonas above -- single-stage vacancy, this candidate's
  // stage is already the last one, so a real HIRE is valid here.
  const reubenApp = await prisma.candidateApplication.findUniqueOrThrow({
    where: { candidateId_vacancyId: { candidateId: reuben.id, vacancyId: logisticsCoord.id } },
  });
  await prisma.candidateApplication.update({
    where: { id: reubenApp.id },
    data: { stage: "HIRED", hiringDecision: "HIRE", decidedByUserId: hiringManager.id, decidedAt: new Date(Date.now() - 3 * DAY_MS) },
  });
  await sendOnceAndLog({
    actorUserId: hiringManager.id, entityType: "CandidateApplication", entityId: reubenApp.id, recipient: reuben.email,
    reason: "hiring_decision_hire", vars: { candidateName: reuben.name, vacancyTitle: logisticsCoord.title },
  });
  await writeAuditLog(hiringManager.id, "HM_DECISION_COMMENT", "CandidateApplication", reubenApp.id, {
    decision: "HIRE", comments: "Strong freight-scheduling background, ready to start immediately.",
  });
  await prisma.vacancy.update({ where: { id: logisticsCoord.id }, data: { status: "CLOSED" } });

  // Same courtesy-rejection reasoning as Bethany above -- Logistics
  // Coordinator is now filled.
  const vera = await ensureCandidate({
    name: "Vera Lindholm", email: "vera.lindholm@example.com", phoneNumber: "+44 7700 900176",
    cv: {
      name: "Vera Lindholm", email: "vera.lindholm@example.com", phone: "+44 7700 900176", location: "Rotherham, UK",
      headline: "Logistics Assistant",
      summary: "Logistics assistant with hands-on warehouse and dispatch coordination experience.",
      experience: [{ title: "Logistics Assistant", company: "Stonebridge Distribution", period: "2022 – Present", bullets: ["Supported daily dispatch scheduling for a 2-site fulfilment operation."] }],
      education: { degree: "BSc Business Operations", school: "Sheffield Hallam University", period: "2019 – 2022" },
      skills: ["Dispatch Scheduling", "WMS Systems", "Inventory Tracking"],
    },
    reviewed: { byUserId: hr.id, note: "Relevant warehouse dispatch experience, but the role was filled before this application progressed." },
  });
  await ensureApplication(vera.id, logisticsCoord.id, hiringManager.id, "REJECTED", null, 2);

  const complianceOfficer = await ensureVacancy("Compliance Officer", "Legal", "Own regulatory compliance monitoring and reporting across the business.");
  const complianceOfficerStage1 = await ensureStage(complianceOfficer.id, "Initial Interview", 1);
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Anouk Delacroix", email: "anouk.delacroix@example.com", phone: "+44 7700 900177", location: "St Albans, UK",
    headline: "Compliance Officer", company: "Ferngrove Advisory", bullet: "Led the annual regulatory compliance audit with zero findings two years running.",
    degree: "LLB Law", school: "University of Hertfordshire", skills: ["Regulatory Compliance", "Audit", "Risk Reporting"],
    vacancy: complianceOfficer, stage: complianceOfficerStage1, score: 8, comment: "Thorough, calm under scenario-based questioning.",
    appliedDaysAgo: 7, interviewDaysAgo: 3,
  });
  const silas = await ensureCandidate({
    name: "Silas Radcliffe", email: "silas.radcliffe@example.com", phoneNumber: "+44 7700 900178",
    cv: {
      name: "Silas Radcliffe", email: "silas.radcliffe@example.com", phone: "+44 7700 900178", location: "Welwyn Garden City, UK",
      headline: "Compliance Analyst",
      summary: "Compliance analyst with experience supporting regulatory reporting and internal audit cycles.",
      experience: [{ title: "Compliance Analyst", company: "Redbourn Advisory", period: "2021 – Present", bullets: ["Supported quarterly regulatory reporting and internal control testing."] }],
      education: { degree: "LLB Law with Business", school: "University of Hertfordshire", period: "2017 – 2020" },
      skills: ["Regulatory Reporting", "Internal Audit", "Risk Assessment"],
    },
  });
  await ensureApplication(silas.id, complianceOfficer.id, hiringManager.id, "APPLIED", null, 1);

  // Per direct user feedback on Candidate Comparison ("add test so top 5
  // candidates can be seen and their comments ... Numeric Score Distribution
  // this also can be filled in all numbers"): Anouk above was the only
  // scored candidate on this vacancy, so the comparison page only ever
  // showed a Top 1 and a single filled bucket. Four more filler candidates
  // here, scored 6/7/9/10 alongside Anouk's 8, give this vacancy a genuine
  // Top 5 with every Numeric Score Distribution bucket (Below 7 through 10)
  // populated at least once.
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Harriet Voss", email: "harriet.voss@example.com", phone: "+44 7700 900179", location: "Cambridge, UK",
    headline: "Compliance Coordinator", company: "Ashworth Regulatory Group", bullet: "Coordinated cross-team responses to two FCA information requests within tight deadlines.",
    degree: "LLB Law", school: "Anglia Ruskin University", skills: ["Regulatory Compliance", "Policy Review", "Stakeholder Liaison"],
    vacancy: complianceOfficer, stage: complianceOfficerStage1, score: 9, comment: "Excellent grasp of regulatory frameworks, gave the strongest scenario answers of the day.",
    appliedDaysAgo: 10, interviewDaysAgo: 5,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Dominic Ashworth", email: "dominic.ashworth@example.com", phone: "+44 7700 900180", location: "Luton, UK",
    headline: "Compliance Associate", company: "Northgate Financial Services", bullet: "Maintained the compliance monitoring calendar across 4 regulated product lines.",
    degree: "BA Law and Business", school: "University of Bedfordshire", skills: ["Compliance Monitoring", "Policy Drafting", "Excel"],
    vacancy: complianceOfficer, stage: complianceOfficerStage1, score: 7, comment: "Good working knowledge, answers were a little rehearsed under follow-up questioning.",
    appliedDaysAgo: 8, interviewDaysAgo: 4,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Isla Bramwell", email: "isla.bramwell@example.com", phone: "+44 7700 900181", location: "Hertford, UK",
    headline: "Regulatory Compliance Specialist", company: "Colworth Risk Partners", bullet: "Rebuilt the firm's AML monitoring procedure ahead of its most recent external audit.",
    degree: "LLM Regulatory Law", school: "University of Hertfordshire", skills: ["AML", "Regulatory Reporting", "Audit Preparation"],
    vacancy: complianceOfficer, stage: complianceOfficerStage1, score: 10, comment: "Outstanding technical depth and composure -- the clear standout candidate.",
    appliedDaysAgo: 9, interviewDaysAgo: 4,
  });
  await ensureFillerCandidate({
    actorUserId: hr.id, hrId: hr.id, hiringManagerId: hiringManager.id, ...fillerPanelist,
    name: "Callum Whitfield", email: "callum.whitfield@example.com", phone: "+44 7700 900182", location: "Stevenage, UK",
    headline: "Junior Compliance Officer", company: "Redmere Consulting", bullet: "Assisted with quarterly compliance reporting for a mid-sized asset manager.",
    degree: "BA Business Law", school: "University of Hertfordshire", skills: ["Compliance Reporting", "Risk Assessment", "Excel"],
    vacancy: complianceOfficer, stage: complianceOfficerStage1, score: 6, comment: "Junior for the role -- solid fundamentals but light on regulatory-audit experience.",
    appliedDaysAgo: 6, interviewDaysAgo: 2,
  });

  // -------------------------------------------------------- Status coverage --
  // Direct user request: every department should show 2 OPEN, 1 CLOSED, and
  // 1 ON_HOLD vacancy, not just a mix of OPEN/CLOSED. Before this block only
  // 6 of 8 departments had a CLOSED vacancy (Sales and Legal had none), and
  // NO department had an ON_HOLD one anywhere in the dataset -- ON_HOLD
  // exists as a real, enforced status (assertVacancyNotOnHold blocks new
  // applications/interviews/decisions on one) but was never actually
  // demonstrable live. Each new vacancy below gets at least one configured
  // round and one real candidate so it doesn't read as an empty shell.
  async function addStatusCoverageVacancy(opts: {
    title: string;
    department: string;
    description: string;
    status: "CLOSED" | "ON_HOLD";
    stageName: string;
    mgmtUserId: number;
    candidate: {
      name: string; email: string; phone: string; location: string;
      headline: string; company: string; bullet: string; degree: string; school: string; skills: string[];
    };
    outcome: "SHORTLISTED" | "REJECTED";
    reviewNote: string;
    appliedDaysAgo: number;
  }) {
    const vacancy = await ensureVacancy(opts.title, opts.department, opts.description);
    const stage = await ensureStage(vacancy.id, opts.stageName, 1);
    await ensurePoolMember(vacancy.id, interviewer.id);
    await ensurePoolMember(vacancy.id, opts.mgmtUserId);

    const candidate = await ensureCandidate({
      name: opts.candidate.name, email: opts.candidate.email, phoneNumber: opts.candidate.phone,
      cv: {
        name: opts.candidate.name, email: opts.candidate.email, phone: opts.candidate.phone, location: opts.candidate.location,
        headline: opts.candidate.headline,
        summary: `${opts.candidate.headline} with solid, directly relevant experience for this role.`,
        experience: [{ title: opts.candidate.headline, company: opts.candidate.company, period: "2021 – Present", bullets: [opts.candidate.bullet] }],
        education: { degree: opts.candidate.degree, school: opts.candidate.school, period: "2016 – 2019" },
        skills: opts.candidate.skills,
      },
      reviewed: { byUserId: hr.id, note: opts.reviewNote },
    });
    await ensureApplication(candidate.id, vacancy.id, hiringManager.id, opts.outcome, opts.outcome === "SHORTLISTED" ? stage.id : null, opts.appliedDaysAgo);

    await prisma.vacancy.update({ where: { id: vacancy.id }, data: { status: opts.status } });
    return vacancy;
  }

  // A brand-new, still-unreviewed OPEN vacancy per department (paired with
  // each department's existing OPEN vacancy above, so every department shows
  // 2 OPEN roles, not just 1).
  async function addSecondOpenVacancy(opts: {
    title: string; department: string; description: string; stageName: string; mgmtUserId: number;
    candidate: { name: string; email: string; phone: string; location: string; headline: string; company: string; bullet: string; degree: string; school: string; skills: string[] };
    appliedDaysAgo: number;
  }) {
    const vacancy = await ensureVacancy(opts.title, opts.department, opts.description);
    await ensureStage(vacancy.id, opts.stageName, 1);
    await ensurePoolMember(vacancy.id, interviewer.id);
    await ensurePoolMember(vacancy.id, opts.mgmtUserId);

    // Deliberately left unreviewed (no `reviewed` field) -- a fresh APPLIED
    // candidate on a brand-new OPEN vacancy realistically hasn't had HR look
    // at their CV yet, unlike the SHORTLISTED/REJECTED ones above.
    const candidate = await ensureCandidate({
      name: opts.candidate.name, email: opts.candidate.email, phoneNumber: opts.candidate.phone,
      cv: {
        name: opts.candidate.name, email: opts.candidate.email, phone: opts.candidate.phone, location: opts.candidate.location,
        headline: opts.candidate.headline,
        summary: `${opts.candidate.headline} with solid, directly relevant experience for this role.`,
        experience: [{ title: opts.candidate.headline, company: opts.candidate.company, period: "2021 – Present", bullets: [opts.candidate.bullet] }],
        education: { degree: opts.candidate.degree, school: opts.candidate.school, period: "2016 – 2019" },
        skills: opts.candidate.skills,
      },
    });
    await ensureApplication(candidate.id, vacancy.id, hiringManager.id, "APPLIED", null, opts.appliedDaysAgo);
    return vacancy;
  }

  // IT
  await addSecondOpenVacancy({
    title: "Site Reliability Engineer", department: "IT", stageName: "Technical Interview", mgmtUserId: management.id,
    description: "Keep our production systems reliable and fast, owning on-call rotation and incident response alongside the platform team.",
    candidate: { name: "Fenella Okonkwo", email: "fenella.okonkwo@example.com", phone: "+44 7700 900801", location: "Leeds, UK", headline: "Site Reliability Engineer", company: "Northfield Digital", bullet: "Ran the on-call rotation for a 12-service production environment.", degree: "BSc Computer Science", school: "University of Leeds", skills: ["Kubernetes", "Incident Response", "Monitoring"] },
    appliedDaysAgo: 2,
  });
  await addStatusCoverageVacancy({
    title: "Data Platform Engineer", department: "IT", stageName: "Technical Interview", mgmtUserId: management.id, status: "ON_HOLD",
    description: "Build and maintain the data pipelines feeding our internal reporting and analytics tools.",
    candidate: { name: "Marcus Ilunga", email: "marcus.ilunga@example.com", phone: "+44 7700 900802", location: "Sheffield, UK", headline: "Data Engineer", company: "Greymoor Analytics", bullet: "Built ETL pipelines processing several million records a day.", degree: "BSc Data Engineering", school: "University of Sheffield", skills: ["SQL", "Python", "Airflow"] },
    outcome: "SHORTLISTED", reviewNote: "Strong pipeline experience, good fit -- shortlisted pending budget sign-off on this role.", appliedDaysAgo: 6,
  });

  // Marketing
  await addSecondOpenVacancy({
    title: "Marketing Analyst", department: "Marketing", stageName: "Initial Interview", mgmtUserId: mgmtMarketing.id,
    description: "Track and report on campaign performance across channels, helping the team decide where to invest budget next quarter.",
    candidate: { name: "Ruben Castillo", email: "ruben.castillo@example.com", phone: "+44 7700 900803", location: "Bristol, UK", headline: "Marketing Analyst", company: "Fernwood Retail", bullet: "Built the monthly campaign performance dashboard used across the marketing team.", degree: "BSc Marketing Analytics", school: "University of Bristol", skills: ["Google Analytics", "Excel", "Reporting"] },
    appliedDaysAgo: 3,
  });
  await addStatusCoverageVacancy({
    title: "Brand Partnerships Manager", department: "Marketing", stageName: "Initial Interview", mgmtUserId: mgmtMarketing.id, status: "ON_HOLD",
    description: "Identify and manage co-marketing partnerships with complementary brands to expand our reach.",
    candidate: { name: "Sophie Lindqvist", email: "sophie.lindqvist@example.com", phone: "+44 7700 900804", location: "Bath, UK", headline: "Partnerships Manager", company: "Hollowfield Brands", bullet: "Negotiated and ran 6 co-marketing campaigns with partner brands.", degree: "BA Marketing", school: "University of Bath", skills: ["Negotiation", "Campaign Management", "Partnerships"] },
    outcome: "SHORTLISTED", reviewNote: "Good partnership track record -- shortlisted, on hold while budget for this role is reconfirmed.", appliedDaysAgo: 5,
  });

  // Sales (already has 2 OPEN -- needs CLOSED + ON_HOLD)
  await addStatusCoverageVacancy({
    title: "Enterprise Account Manager", department: "Sales", stageName: "Final Interview", mgmtUserId: mgmtSales.id, status: "CLOSED",
    description: "Manage and grow relationships with our largest enterprise accounts.",
    candidate: { name: "Tobias Ferreira", email: "tobias.ferreira@example.com", phone: "+44 7700 900805", location: "Manchester, UK", headline: "Enterprise Account Manager", company: "Ridgeway Solutions", bullet: "Grew an existing enterprise book of business by 18% year over year.", degree: "BA Business", school: "University of Manchester", skills: ["Account Management", "Negotiation", "Salesforce"] },
    outcome: "REJECTED", reviewNote: "Strong candidate, but the role was filled before this application progressed further.", appliedDaysAgo: 20,
  });
  await addStatusCoverageVacancy({
    title: "Sales Operations Analyst", department: "Sales", stageName: "Final Interview", mgmtUserId: mgmtSales.id, status: "ON_HOLD",
    description: "Support the sales team with pipeline reporting, forecasting, and CRM data quality.",
    candidate: { name: "Elodie Marchand", email: "elodie.marchand@example.com", phone: "+44 7700 900806", location: "Manchester, UK", headline: "Sales Operations Analyst", company: "Whitfield & Co", bullet: "Owned CRM data quality across a 40-person sales org.", degree: "BSc Business Analytics", school: "Manchester Metropolitan University", skills: ["Salesforce", "Excel", "Forecasting"] },
    outcome: "SHORTLISTED", reviewNote: "Solid analytical background -- shortlisted, role on hold pending reorg of the sales ops team.", appliedDaysAgo: 4,
  });

  // Customer Service
  await addSecondOpenVacancy({
    title: "Technical Support Engineer", department: "Customer Service", stageName: "Initial Interview", mgmtUserId: mgmtCustService.id,
    description: "Provide hands-on technical troubleshooting for our top-tier customers, escalating product bugs as needed.",
    candidate: { name: "Nadia Kowalski", email: "nadia.kowalski@example.com", phone: "+44 7700 900807", location: "Birmingham, UK", headline: "Technical Support Engineer", company: "Brackenfield Software", bullet: "Resolved an average of 30 technical tickets a week with a 95% satisfaction score.", degree: "BSc Information Technology", school: "Birmingham City University", skills: ["Troubleshooting", "SQL", "Zendesk"] },
    appliedDaysAgo: 2,
  });
  await addStatusCoverageVacancy({
    title: "Customer Onboarding Specialist", department: "Customer Service", stageName: "Initial Interview", mgmtUserId: mgmtCustService.id, status: "ON_HOLD",
    description: "Guide new customers through setup and their first few weeks on the platform.",
    candidate: { name: "Harvey Duclos", email: "harvey.duclos@example.com", phone: "+44 7700 900808", location: "Coventry, UK", headline: "Customer Onboarding Specialist", company: "Millbrook Systems", bullet: "Ran onboarding for over 100 new accounts with a 90%+ activation rate.", degree: "BA Business Management", school: "Coventry University", skills: ["Onboarding", "Customer Success", "Zendesk"] },
    outcome: "SHORTLISTED", reviewNote: "Good onboarding track record -- shortlisted, role on hold while the onboarding process is redesigned.", appliedDaysAgo: 5,
  });

  // HR
  await addSecondOpenVacancy({
    title: "People Operations Coordinator", department: "HR", stageName: "Initial Interview", mgmtUserId: mgmtHR.id,
    description: "Keep core HR processes running smoothly, from onboarding paperwork to benefits administration.",
    candidate: { name: "Amelia Trench", email: "amelia.trench@example.com", phone: "+44 7700 900809", location: "Nottingham, UK", headline: "People Operations Coordinator", company: "Ashgrove Retail", bullet: "Managed onboarding logistics for over 150 new starters in a year.", degree: "BA Human Resource Management", school: "Nottingham Trent University", skills: ["HRIS", "Onboarding", "Benefits Administration"] },
    appliedDaysAgo: 3,
  });
  await addStatusCoverageVacancy({
    title: "Learning & Development Coordinator", department: "HR", stageName: "Initial Interview", mgmtUserId: mgmtHR.id, status: "ON_HOLD",
    description: "Coordinate internal training programmes and track completion across departments.",
    candidate: { name: "Louis Beaumont", email: "louis.beaumont@example.com", phone: "+44 7700 900810", location: "Derby, UK", headline: "L&D Coordinator", company: "Overton Group", bullet: "Coordinated a company-wide training rollout for 300+ staff.", degree: "BA Education and Training", school: "University of Derby", skills: ["Training Coordination", "LMS Systems", "Reporting"] },
    outcome: "SHORTLISTED", reviewNote: "Good training-coordination background -- shortlisted, role on hold pending L&D budget approval.", appliedDaysAgo: 6,
  });

  // Finance and Accounting
  await addSecondOpenVacancy({
    title: "Payroll Specialist", department: "Finance and Accounting", stageName: "Initial Interview", mgmtUserId: mgmtFinance.id,
    description: "Run monthly payroll accurately and on time across multiple pay groups, handling employee queries along the way.",
    candidate: { name: "Ines Dubois", email: "ines.dubois@example.com", phone: "+44 7700 900811", location: "Leicester, UK", headline: "Payroll Specialist", company: "Kingsmill Group", bullet: "Ran monthly payroll for 400+ employees across 3 pay groups with zero errors.", degree: "BA Accounting and Finance", school: "De Montfort University", skills: ["Payroll Software", "Excel", "Compliance"] },
    appliedDaysAgo: 2,
  });
  await addStatusCoverageVacancy({
    title: "Financial Controller Assistant", department: "Finance and Accounting", stageName: "Initial Interview", mgmtUserId: mgmtFinance.id, status: "ON_HOLD",
    description: "Support the Financial Controller with month-end close, reconciliations, and audit preparation.",
    candidate: { name: "Gabriel Voss", email: "gabriel.voss@example.com", phone: "+44 7700 900812", location: "Leicester, UK", headline: "Assistant Financial Controller", company: "Ashworth Manufacturing", bullet: "Supported month-end close for a £40M revenue business unit.", degree: "BSc Accounting", school: "University of Leicester", skills: ["Reconciliations", "Month-End Close", "Excel"] },
    outcome: "SHORTLISTED", reviewNote: "Strong close-process experience -- shortlisted, role on hold pending finance team restructuring.", appliedDaysAgo: 5,
  });

  // Operations
  await addSecondOpenVacancy({
    title: "Warehouse Supervisor", department: "Operations", stageName: "Initial Interview", mgmtUserId: mgmtOps.id,
    description: "Supervise day-to-day warehouse operations, coordinating staff schedules and stock accuracy.",
    candidate: { name: "Callum Reyes", email: "callum.reyes@example.com", phone: "+44 7700 900813", location: "Liverpool, UK", headline: "Warehouse Supervisor", company: "Portside Logistics", bullet: "Supervised a 20-person warehouse team across two shifts.", degree: "BA Operations Management", school: "Liverpool John Moores University", skills: ["Team Scheduling", "Inventory Accuracy", "WMS Systems"] },
    appliedDaysAgo: 3,
  });
  await addStatusCoverageVacancy({
    title: "Procurement Coordinator", department: "Operations", stageName: "Initial Interview", mgmtUserId: mgmtOps.id, status: "ON_HOLD",
    description: "Coordinate purchase orders and supplier relationships across our fulfilment sites.",
    candidate: { name: "Freya Nystrom", email: "freya.nystrom@example.com", phone: "+44 7700 900814", location: "Preston, UK", headline: "Procurement Coordinator", company: "Wexford Supply Co", bullet: "Managed purchase orders across 15 active suppliers.", degree: "BA Supply Chain Management", school: "University of Central Lancashire", skills: ["Procurement", "Supplier Management", "Excel"] },
    outcome: "SHORTLISTED", reviewNote: "Solid supplier-management background -- shortlisted, role on hold pending procurement budget review.", appliedDaysAgo: 4,
  });

  // Legal (already has 2 OPEN -- needs CLOSED + ON_HOLD)
  await addStatusCoverageVacancy({
    title: "Paralegal", department: "Legal", stageName: "Initial Interview", mgmtUserId: mgmtLegal.id, status: "CLOSED",
    description: "Support the legal team with contract review, filing, and research on an ongoing basis.",
    candidate: { name: "Naomi Achterberg", email: "naomi.achterberg@example.com", phone: "+44 7700 900815", location: "St Albans, UK", headline: "Paralegal", company: "Fenwick Legal Partners", bullet: "Supported contract review and filing for a 6-person legal team.", degree: "LLB Law", school: "University of Hertfordshire", skills: ["Contract Review", "Legal Research", "Filing Systems"] },
    outcome: "REJECTED", reviewNote: "Good fundamentals, but the role was filled before this application progressed further.", appliedDaysAgo: 18,
  });
  await addStatusCoverageVacancy({
    title: "Data Privacy Officer", department: "Legal", stageName: "Initial Interview", mgmtUserId: mgmtLegal.id, status: "ON_HOLD",
    description: "Own data protection compliance and respond to privacy-related queries from across the business.",
    candidate: { name: "Theo Marchetti", email: "theo.marchetti@example.com", phone: "+44 7700 900816", location: "Hertford, UK", headline: "Data Privacy Officer", company: "Colworth Legal Group", bullet: "Led GDPR compliance reviews across 3 business units.", degree: "LLM Data Protection Law", school: "University of Hertfordshire", skills: ["GDPR", "Data Protection", "Policy Drafting"] },
    outcome: "SHORTLISTED", reviewNote: "Strong data-protection background -- shortlisted, role on hold pending scope confirmation.", appliedDaysAgo: 6,
  });

  // -------------------------------------------------------- Repeat applicants --
  // Real applicant pools rarely apply to exactly one role. Previously only
  // Naledi (Sales + Customer Service above) applied to a second vacancy out
  // of ~70+ candidates -- a 1.4% repeat rate that doesn't read as a real
  // pipeline. These 8 reuse existing candidates (never brand-new people) and
  // apply each to one further, different vacancy, chosen so the story makes
  // sense: rejected-from-one-role candidates trying an adjacent role in the
  // same department, or a still-APPLIED candidate applying more broadly
  // within their own field. Combined with Naledi, that's 9 repeat applicants
  // out of ~71 candidates (roughly 12%).
  //
  // Dimitri was REJECTED from Account Executive -- tries the more junior SDR
  // opening in the same department instead.
  await ensureApplication(dimitri.id, sdr.id, hiringManager.id, "APPLIED", null, 3);
  // Freya was REJECTED from Content Marketing Specialist for lacking
  // long-form content experience -- Social Media Manager is a closer fit for
  // her actual (social/community) background.
  await ensureApplication(freya.id, socialMedia.id, hiringManager.id, "APPLIED", null, 4);
  // Theo is an early-career lawyer still APPLIED to Corporate Counsel --
  // applying to Compliance Officer too is a natural broadening within Legal.
  await ensureApplication(theo.id, complianceOfficer.id, hiringManager.id, "APPLIED", null, 2);
  // Oscar (still APPLIED to Customer Success Manager) also tried Support
  // Specialist, but that role was filled by Sana before his application
  // progressed -- same minimal courtesy-reject shape as Bethany/Dexter/
  // Gideon/Paloma/Vera above (no interview, no hiringDecision fields).
  await ensureApplication(oscar.id, supportSpec.id, hiringManager.id, "REJECTED", null, 8);
  // Julian (SHORTLISTED for Senior Financial Analyst) also tried Accounts
  // Payable Specialist within the same department, filled by Elliot first.
  await ensureApplication(julian.id, apSpecialist.id, hiringManager.id, "REJECTED", null, 6);
  // Connor (still APPLIED to Operations Manager) also tried the adjacent
  // Logistics Coordinator opening, filled by Reuben first.
  await ensureApplication(connor.id, logisticsCoord.id, hiringManager.id, "REJECTED", null, 7);
  // Noah (still APPLIED to HR Business Partner) also tried Talent Acquisition
  // Coordinator within HR, filled by Rosalind first.
  await ensureApplication(noah.id, talentCoord.id, hiringManager.id, "REJECTED", null, 5);
  // Silas (still APPLIED to Compliance Officer) also applies to Corporate
  // Counsel -- a compliance analyst reasonably casting a wider net in Legal.
  await ensureApplication(silas.id, legal.id, hiringManager.id, "APPLIED", null, 3);

  // ------------------------------------------- CV/Review history examples --
  // Per direct user feedback ("make test data ... so that i can check all
  // dashboards and see all values"): four already-shortlisted candidates,
  // spread across different departments, get a second CV + review a couple
  // of days after their first -- real multi-entry data for CV History and
  // Review Notes History to actually show, rather than every seeded
  // candidate having exactly one of each.
  await ensureUpdatedCvAndReview({
    candidate: tomas,
    cv: {
      name: "Tomas Reyes", email: "tomas.reyes@example.com", phone: "+44 7700 900113", location: "Birmingham, UK",
      headline: "Backend Software Engineer",
      summary: "Backend-focused engineer with a strong background in distributed systems and API design, having spent the last three years building high-throughput services for a fintech platform. Recently completed AWS Solutions Architect certification.",
      experience: [
        { title: "Backend Engineer", company: "Pryce Financial", period: "2021 – Present", bullets: ["Designed the payments-reconciliation service handling 2M+ transactions daily.", "Led adoption of contract testing across 12 microservices, cutting integration bugs by a third.", "Earned AWS Certified Solutions Architect - Associate (2026)."] },
        { title: "Junior Developer", company: "Hallow Digital", period: "2019 – 2021", bullets: ["Built internal tooling for QA automation used across three product teams."] },
      ],
      education: { degree: "BSc Software Engineering", school: "University of Nottingham", period: "2016 – 2019" },
      skills: ["Node.js", "PostgreSQL", "Kafka", "Kubernetes", "System Design", "AWS"],
    },
    vacancyTitle: backendEng.title,
    reviewedByUserId: hr.id,
    note: "Updated CV adds a fresh AWS certification -- keeps him shortlisted for the Technical Interview round.",
    daysAgo: 2,
  });
  await ensureUpdatedCvAndReview({
    candidate: camille,
    cv: {
      name: "Camille Dupont", email: "camille.dupont@example.com", phone: "+44 7700 900122", location: "Bristol, UK",
      headline: "HR Business Partner",
      summary: "HR generalist with five years' experience partnering with department leads on workforce planning, performance management, and employee relations. Now also leading a cross-department engagement survey initiative.",
      experience: [{ title: "HR Business Partner", company: "Ashford Retail Group", period: "2021 – Present", bullets: ["Partnered with three department heads on annual headcount planning and performance calibration.", "Reduced average time-to-resolution on employee relations cases by 35%.", "Led the 2026 company-wide engagement survey, presenting findings to senior leadership."] }],
      education: { degree: "BA Human Resource Management", school: "University of the West of England", period: "2015 – 2018" },
      skills: ["Employee Relations", "Workforce Planning", "Performance Management", "Stakeholder Management", "Engagement Surveys"],
    },
    vacancyTitle: hrBp.title,
    reviewedByUserId: hr.id,
    note: "Updated CV shows she's since led a company-wide engagement survey -- still on track for Screening Call.",
    daysAgo: 2,
  });
  await ensureUpdatedCvAndReview({
    candidate: priya,
    cv: {
      name: "Priya Chandrasekaran", email: "priya.chandrasekaran@example.com", phone: "+44 7700 900130", location: "Southampton, UK",
      headline: "Content Marketing Specialist",
      summary: "Content marketer with three years' experience across SEO-led blog strategy and lifecycle email for B2B SaaS. Recently expanded into paid social to round out channel experience.",
      experience: [{ title: "Content Marketer", company: "Ferrow Digital", period: "2022 – Present", bullets: ["Grew organic search traffic 65% year-on-year through a refreshed content cluster strategy.", "Ran a 6-email onboarding sequence that lifted trial-to-paid conversion by 12%.", "Piloted a paid social campaign that cut cost-per-lead by 20%."] }],
      education: { degree: "BA Marketing Communications", school: "University of Southampton", period: "2018 – 2021" },
      skills: ["SEO", "Content Strategy", "Email Marketing", "Analytics", "Paid Social"],
    },
    vacancyTitle: marketing.title,
    reviewedByUserId: hr.id,
    note: "Updated CV shows new paid social experience, addressing the channel-mix gap flagged after Portfolio Review.",
    daysAgo: 2,
  });
  await ensureUpdatedCvAndReview({
    candidate: julian,
    cv: {
      name: "Julian Ostrowski", email: "julian.ostrowski@example.com", phone: "+44 7700 900125", location: "Glasgow, UK",
      headline: "Senior Financial Analyst",
      summary: "Financial analyst with four years' experience in budgeting and cost analysis within the manufacturing sector. Recently completed a scenario-planning project ahead of the Case Study round.",
      experience: [{ title: "Financial Analyst", company: "Kilbride Manufacturing", period: "2021 – Present", bullets: ["Managed the annual budgeting process for a £40M cost centre.", "Identified cost-saving opportunities totalling £250k annually.", "Built a three-scenario cost model used in the 2027 budget planning cycle."] }],
      education: { degree: "BA Economics", school: "University of Glasgow", period: "2017 – 2020" },
      skills: ["Budgeting", "Cost Analysis", "Excel", "Power BI", "Scenario Planning"],
    },
    vacancyTitle: finance.title,
    reviewedByUserId: hr.id,
    note: "Updated CV shows recent scenario-planning work -- good sign ahead of the Case Study round.",
    daysAgo: 2,
  });

  // --------------------------------------------------------- Notifications --
  // Light, real-looking bell content for each staff account so it never
  // reads empty either -- referencing entities actually created above.
  await ensureNotification(hr.id, "candidate_applied", `New application: ${noah.name} applied to ${hrBp.title}`, null, 1, false);
  await ensureNotification(hr.id, "candidate_applied", `New application: ${theo.name} applied to ${legal.title}`, null, 1, true);
  await ensureNotification(interviewer.id, "interview_scheduled_panelist", `You're on the panel for ${tomas.name}'s ${beStage1.name}`, null, 2, false);
  await ensureNotification(interviewer.id, "manual_feedback_reminder", `Feedback still needed for ${camille.name}'s interview`, null, 1, false);
  await ensureNotification(management.id, "interview_scheduled_panelist", `You're on the panel for ${elias.name}'s ${beStage3.name}`, null, 3, true);
  await ensureNotification(hiringManager.id, "candidate_shortlisted", `${elias.name} was shortlisted for ${backendEng.title}`, null, 5, true);
  await ensureNotification(hiringManager.id, "hiring_decision_hire", `${baptiste.name} was hired for ${marketing.title}`, null, 1, false);

  console.log("\nDone. Log in as sharon@altrium.com (HR) to see the full candidate list across all 8 departments.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
