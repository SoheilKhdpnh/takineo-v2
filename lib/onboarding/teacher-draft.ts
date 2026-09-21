import type { BookingWeekday } from "@/lib/domain/booking";
import { BOOKING_WEEKDAYS } from "@/lib/domain/booking";
import { PROFILE_LANGUAGE_CODES, PROFILE_TIMEZONES } from "@/lib/domain/profile";

const STORAGE_KEY = "talkinu.teacher.onboarding.draft";

export const TEACHER_ONBOARDING_STEPS = [
  "about",
  "photo",
  "certification",
  "education",
  "description",
  "video",
  "availability",
  "pricing",
] as const;

export const TEACHER_PROFILE_PANEL_STEPS = [
  "about",
  "photo",
  "certification",
  "education",
] as const;

export const TEACHER_SESSION_PANEL_STEPS = [
  "description",
  "video",
  "availability",
  "pricing",
] as const;

export type TeacherOnboardingStep = (typeof TEACHER_ONBOARDING_STEPS)[number];

export type TeacherOnboardingErrorKey =
  | "name"
  | "experience"
  | "photo"
  | "certificate"
  | "education"
  | "intro"
  | "experienceText"
  | "motivate"
  | "headline"
  | "aparat"
  | "availability"
  | "pricing";

export type TeacherCertificateDraft = {
  id: string;
  subject: string;
  name: string;
  fileName: string | null;
};

export type TeacherEducationDraft = {
  id: string;
  university: string;
  degree: string;
  degreeType: string;
  specialization: string;
  fromYear: string;
  toYear: string;
  diplomaFileName: string | null;
};

export type TeacherAvailabilityDayDraft = {
  weekday: BookingWeekday;
  enabled: boolean;
  startMinute: number;
  endMinute: number;
};

export type TeacherOnboardingDraft = {
  about: {
    name: string;
    nativeLanguage: (typeof PROFILE_LANGUAGE_CODES)[number];
    timezone: (typeof PROFILE_TIMEZONES)[number];
    experienceYears: string;
  };
  photoDataUrl: string | null;
  noCertificate: boolean;
  certificates: TeacherCertificateDraft[];
  noEducation: boolean;
  education: TeacherEducationDraft[];
  description: {
    intro: string;
    experience: string;
    motivate: string;
    headline: string;
  };
  aparatUrl: string;
  mentionCode: string;
  availability: TeacherAvailabilityDayDraft[];
  pricingAcknowledged: boolean;
};

export const CERTIFICATE_OPTIONS = [
  "Gatehouse Awards Ltd • GA Level 5 Diploma in Teaching English to Speakers of Other Languages (TESOL)",
  "Highfield Qualifications • Highfield Level 5 Advanced Diploma in Teaching English as a Foreign Language (TEFL) (Premier TEFL)",
  "Highfield Qualifications • Highfield Level 5 Advanced Diploma in Teaching English as a Foreign Language (TEFL) (The TEFL Institute)",
  "Cambridge CELTA",
  "Trinity CertTESOL",
] as const;

export const DEGREE_TYPES = [
  "bachelor",
  "master",
  "doctorate",
  "associate",
  "other",
] as const;

function createMentionCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "TALKINU-";

  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function emptyCertificate(): TeacherCertificateDraft {
  return {
    id: createId(),
    subject: "English",
    name: "",
    fileName: null,
  };
}

export function emptyEducation(): TeacherEducationDraft {
  return {
    id: createId(),
    university: "",
    degree: "",
    degreeType: "",
    specialization: "",
    fromYear: "",
    toYear: "",
    diplomaFileName: null,
  };
}

export function createTeacherOnboardingDraft(name: string): TeacherOnboardingDraft {
  return {
    about: {
      name,
      nativeLanguage: "fa",
      timezone: "Asia/Tehran",
      experienceYears: "1",
    },
    photoDataUrl: null,
    noCertificate: false,
    certificates: [emptyCertificate()],
    noEducation: false,
    education: [emptyEducation()],
    description: {
      intro: "",
      experience: "",
      motivate: "",
      headline: "",
    },
    aparatUrl: "",
    mentionCode: createMentionCode(),
    availability: BOOKING_WEEKDAYS.map((weekday) => ({
      weekday,
      enabled: weekday !== "FRIDAY",
      startMinute: 9 * 60,
      endMinute: 12 * 60,
    })),
    pricingAcknowledged: false,
  };
}

export function readTeacherOnboardingDraft(name: string): TeacherOnboardingDraft {
  const fallback = createTeacherOnboardingDraft(name);

  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as TeacherOnboardingDraft;

    if (!parsed?.about || !parsed.mentionCode) {
      return fallback;
    }

    return {
      ...fallback,
      ...parsed,
      about: {
        ...fallback.about,
        ...parsed.about,
        name: parsed.about.name || name,
      },
    };
  } catch {
    return fallback;
  }
}

export function writeTeacherOnboardingDraft(draft: TeacherOnboardingDraft) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
}

export function validateTeacherOnboardingStep(
  draft: TeacherOnboardingDraft,
  step: TeacherOnboardingStep,
): TeacherOnboardingErrorKey | null {
  if (step === "about") {
    if (draft.about.name.trim().length < 2) {
      return "name";
    }

    const experienceYears = Number(draft.about.experienceYears);

    if (
      draft.about.experienceYears.trim() === "" ||
      !Number.isInteger(experienceYears) ||
      experienceYears < 0 ||
      experienceYears > 60
    ) {
      return "experience";
    }
  }

  if (step === "photo" && !draft.photoDataUrl) {
    return "photo";
  }

  if (step === "certification" && !draft.noCertificate) {
    if (draft.certificates.some((item) => !item.name)) {
      return "certificate";
    }
  }

  if (step === "education" && !draft.noEducation) {
    if (
      draft.education.some(
        (item) => !item.university.trim() || !item.degree.trim() || !item.degreeType,
      )
    ) {
      return "education";
    }
  }

  if (step === "description") {
    if (draft.description.intro.trim().length < 30) return "intro";
    if (draft.description.experience.trim().length < 30) return "experienceText";
    if (draft.description.motivate.trim().length < 30) return "motivate";
    if (draft.description.headline.trim().length < 10) return "headline";
  }

  if (step === "video") {
    if (!/^https?:\/\/(www\.)?aparat\.com\//i.test(draft.aparatUrl.trim())) {
      return "aparat";
    }
  }

  if (step === "availability" && !draft.availability.some((day) => day.enabled)) {
    return "availability";
  }

  if (step === "pricing" && !draft.pricingAcknowledged) {
    return "pricing";
  }

  return null;
}
