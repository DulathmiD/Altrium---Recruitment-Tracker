// One-off utility for retesting the CV-review-on-view flow (View CV +
// opening the candidate's row, both required -- see markCvReviewed in
// candidate.controller.ts). Clears lastCvReviewedByUserId/lastCvReviewedAt/
// lastCvReviewNote on every candidate back to "Not yet reviewed", so you can
// re-run the test from a clean slate instead of the existing seeded/test
// review stamps (e.g. "Reviewed by Sharon Whitfield") getting in the way.
//
// By default this resets EVERY candidate. Pass a candidate id (the C-XXXX
// number from the Candidates list, without the "C-" prefix and leading
// zeros) to reset just one:
//   npx tsx scripts/reset-cv-review-flags.ts          (resets everyone)
//   npx tsx scripts/reset-cv-review-flags.ts 59        (resets only C-0059)
//
// Run from the backend folder. Safe to run more than once -- it's just
// setting fields back to null, not deleting anything.
import "dotenv/config";
import { prisma } from "../src/prisma.js";

async function main() {
  const idArg = process.argv[2];
  const where = idArg ? { id: Number(idArg) } : {};

  if (idArg && Number.isNaN(Number(idArg))) {
    throw new Error(`"${idArg}" isn't a valid candidate id -- pass just the number, e.g. 59 for C-0059.`);
  }

  const result = await prisma.candidate.updateMany({
    where,
    data: {
      lastCvReviewedByUserId: null,
      lastCvReviewedAt: null,
      lastCvReviewNote: null,
    },
  });

  console.log(`Reset review status on ${result.count} candidate(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
