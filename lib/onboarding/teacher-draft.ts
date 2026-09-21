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

export type TeacherOnboardingStep = (typeof TEACHER_ONBOARDING_STEPS)[number];

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
    degreeType: "bachelor",
    specialization: "",
    fromYear: "",
    toYear: "",
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
