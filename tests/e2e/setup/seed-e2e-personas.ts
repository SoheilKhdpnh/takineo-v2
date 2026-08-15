import { pathToFileURL } from "node:url";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/lib/generated/prisma/client";
import { getE2EDatabaseUrl } from "@/tests/e2e/support/e2e-database-url";
import { e2ePersonas } from "@/tests/e2e/support/personas";

const baseUrl = "http://127.0.0.1:3100";
const authSecret = "takineo-e2e-only-auth-secret-2026-08-15";

async function createAuthUser(
  auth: typeof import("@/lib/auth/auth").auth,
  persona: { name: string; email: string; password: string },
) {
  const result = await auth.api.signUpEmail({
    body: persona,
    returnHeaders: true,
  });

  return result.response.user.id;
}

async function createReviewApplication(
  prisma: PrismaClient,
  userId: string,
  submittedAt: Date,
  headline: string,
) {
  const profile = await prisma.teacherProfile.create({
    data: {
      userId,
      headline,
      bio: "E2E teacher biography used only in the isolated browser database.",
      experienceYears: 6,
      nativeLanguage: "fa",
      teachingLanguage: "en",
      timezone: "Asia_Tehran",
      profileCompletedAt: submittedAt,
      applicationStatus: "DRAFT",
      profileRevision: 3,
      reviewCycle: 1,
    },
  });

  const video = await prisma.teacherIntroVideo.create({
    data: {
      teacherProfileId: profile.id,
      provider: "mux",
      uploadId: `e2e-upload-${profile.id}`,
      assetId: `e2e-asset-${profile.id}`,
      revision: 2,
      status: "APPROVED",
      durationSeconds: 90,
      submittedAt,
      reviewedAt: submittedAt,
    },
  });

  await prisma.teacherProfile.update({
    where: { id: profile.id },
    data: {
      applicationStatus: "PENDING_REVIEW",
      applicationSubmittedAt: submittedAt,
      submittedProfileRevision: profile.profileRevision,
      submittedVideoId: video.id,
      submittedVideoRevision: video.revision,
      submittedVideoUploadId: video.uploadId,
      submittedVideoAssetId: video.assetId,
    },
  });
}

export async function seedE2EPersonas() {
  const connectionString = getE2EDatabaseUrl();

  process.env.PLAYWRIGHT_TEST = "1";
  process.env.TAKINEO_E2E_RUNTIME = "1";
  process.env.DATABASE_URL = connectionString;
  process.env.DIRECT_URL = connectionString;
  process.env.BETTER_AUTH_URL = baseUrl;
  process.env.BETTER_AUTH_SECRET = authSecret;

  const adapter = new PrismaPg({ connectionString, options: "-c timezone=UTC" });
  const prisma = new PrismaClient({ adapter });
  const { auth } = await import("@/lib/auth/auth");
  const { prisma: applicationPrisma } = await import("@/lib/db/prisma");

  try {
    const reviewerId = await createAuthUser(auth, e2ePersonas.reviewer);
    const superAdminId = await createAuthUser(auth, e2ePersonas.superAdmin);
    const studentId = await createAuthUser(auth, e2ePersonas.student);
    const reviewApplicantId = await createAuthUser(
      auth,
      e2ePersonas.reviewApplicant,
    );
    const errorApplicantId = await createAuthUser(
      auth,
      e2ePersonas.errorApplicant,
    );
    const approvedTeacherId = await createAuthUser(
      auth,
      e2ePersonas.approvedTeacher,
    );

    await prisma.adminAccess.createMany({
      data: [
        { userId: reviewerId, permission: "REVIEWER" },
        { userId: superAdminId, permission: "SUPER_ADMIN" },
      ],
    });

    await prisma.user.update({
      where: { id: studentId },
      data: {
        role: "STUDENT",
        onboardingCompletedAt: new Date(),
      },
    });
    await prisma.studentProfile.create({
      data: {
        userId: studentId,
        englishLevel: "B2",
        nativeLanguage: "fa",
        timezone: "Asia_Tehran",
        profileCompletedAt: new Date(),
      },
    });

    for (const userId of [
      reviewApplicantId,
      errorApplicantId,
      approvedTeacherId,
    ]) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          role: "TEACHER",
          onboardingCompletedAt: new Date(),
        },
      });
    }

    await createReviewApplication(
      prisma,
      reviewApplicantId,
      new Date("2026-08-15T04:00:00.000Z"),
      "E2E review candidate",
    );
    await createReviewApplication(
      prisma,
      errorApplicantId,
      new Date("2026-08-15T04:05:00.000Z"),
      "E2E conflict candidate",
    );

    const approvedProfile = await prisma.teacherProfile.create({
      data: {
        userId: approvedTeacherId,
        headline: "E2E approved teacher",
        bio: "Approved E2E teacher record.",
        experienceYears: 8,
        nativeLanguage: "fa",
        teachingLanguage: "en",
        timezone: "Asia_Tehran",
        profileCompletedAt: new Date("2026-08-14T08:00:00.000Z"),
        applicationStatus: "APPROVED",
        applicationSubmittedAt: new Date("2026-08-14T08:00:00.000Z"),
        applicationReviewedAt: new Date("2026-08-14T09:00:00.000Z"),
        reviewCycle: 2,
        profileRevision: 4,
        submittedProfileRevision: 4,
      },
    });

    const approvedVideo = await prisma.teacherIntroVideo.create({
      data: {
        teacherProfileId: approvedProfile.id,
        provider: "mux",
        uploadId: `e2e-upload-${approvedProfile.id}`,
        assetId: `e2e-asset-${approvedProfile.id}`,
        revision: 3,
        status: "APPROVED",
        durationSeconds: 95,
        submittedAt: new Date("2026-08-14T08:00:00.000Z"),
        reviewedAt: new Date("2026-08-14T09:00:00.000Z"),
      },
    });

    await prisma.teacherProfile.update({
      where: { id: approvedProfile.id },
      data: {
        submittedVideoId: approvedVideo.id,
        submittedVideoRevision: approvedVideo.revision,
        submittedVideoUploadId: approvedVideo.uploadId,
        submittedVideoAssetId: approvedVideo.assetId,
      },
    });
  } finally {
    await applicationPrisma.$disconnect();
    await prisma.$disconnect();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await seedE2EPersonas();
}
