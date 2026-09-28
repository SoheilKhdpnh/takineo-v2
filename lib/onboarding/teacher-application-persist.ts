import { authClient } from "@/lib/auth/auth-client";
import type { TeacherOnboardingDraft } from "@/lib/onboarding/teacher-draft";
import { uploadProfilePhoto } from "@/lib/profile/profile-photo-client";

export async function persistTeacherOnboardingApplication(
  draft: TeacherOnboardingDraft,
) {
  const experienceYears = Number(draft.about.experienceYears);
  const bio = [
    draft.description.intro.trim(),
    draft.description.experience.trim(),
    draft.description.motivate.trim(),
  ].join("\n\n");

  const nameResult = await authClient.updateUser({
    name: draft.about.name.trim(),
  });

  if (nameResult.error) {
    throw new Error("name");
  }

  if (draft.photoDataUrl) {
    await uploadProfilePhoto(draft.photoDataUrl);
  }

  const certifications = draft.noCertificate
    ? []
    : draft.certificates
        .map((certificate) => ({
          subject: certificate.subject.trim(),
          name: certificate.name.trim(),
        }))
        .filter(
          (certificate) =>
            certificate.subject.length > 0 &&
            certificate.name.length > 0,
        );

  const education = draft.noEducation
    ? []
    : draft.education
        .map((row) => {
          const startYear = Number(row.fromYear);
          const endYearRaw = row.toYear.trim();
          const endYear =
            endYearRaw.length === 0 ? null : Number(endYearRaw);

          return {
            university: row.university.trim(),
            degree: row.degree.trim(),
            degreeType: row.degreeType.trim(),
            specialization: row.specialization.trim(),
            startYear,
            endYear:
              endYear !== null && Number.isFinite(endYear)
                ? endYear
                : null,
          };
        })
        .filter(
          (row) =>
            row.university.length > 0 &&
            row.degree.length > 0 &&
            row.degreeType.length > 0 &&
            row.specialization.length > 0 &&
            Number.isFinite(row.startYear),
        );

  const profileResponse = await fetch("/api/profile/teacher", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      headline: draft.description.headline.trim(),
      bio,
      experienceYears,
      nativeLanguage: draft.about.nativeLanguage,
      teachingLanguage: "en",
      timezone: draft.about.timezone,
      certifications,
      education,
    }),
  });

  if (!profileResponse.ok) {
    throw new Error("profile");
  }

  const videoResponse = await fetch("/api/profile/teacher/intro-video", {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      aparatUrl: draft.aparatUrl.trim(),
    }),
  });

  if (!videoResponse.ok) {
    throw new Error("aparat");
  }

  const availabilityRules = draft.availability
    .filter((day) => day.enabled)
    .map((day) => ({
      weekday: day.weekday,
      startMinute: day.startMinute,
      endMinute: day.endMinute,
      isActive: true,
    }));

  if (availabilityRules.length > 0) {
    const availabilityResponse = await fetch(
      "/api/profile/teacher/availability",
      {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: availabilityRules,
        }),
      },
    );

    // Availability can fail closed for unapproved teachers; profile/video still count.
    if (
      !availabilityResponse.ok &&
      availabilityResponse.status !== 403 &&
      availabilityResponse.status !== 409
    ) {
      throw new Error("availability");
    }
  }

  const applicationResponse = await fetch("/api/profile/teacher/application", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  });

  if (!applicationResponse.ok) {
    throw new Error("save");
  }
}
