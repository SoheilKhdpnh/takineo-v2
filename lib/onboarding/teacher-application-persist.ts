import { authClient } from "@/lib/auth/auth-client";
import type { TeacherOnboardingDraft } from "@/lib/onboarding/teacher-draft";

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

  const applicationResponse = await fetch("/api/profile/teacher/application", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
  });

  if (!applicationResponse.ok) {
    throw new Error("save");
  }
}
