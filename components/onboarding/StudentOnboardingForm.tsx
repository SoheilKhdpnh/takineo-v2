"use client";

import { useTranslations } from "next-intl";
import {
  type FormEvent,
  useState,
} from "react";

import { useRouter } from "@/i18n/navigation";
import { authClient } from "@/lib/auth/auth-client";
import { ENGLISH_LEVELS } from "@/lib/domain/profile";
import {
  authInputClassName,
  authPrimaryButtonClassName,
} from "@/lib/ui/auth-styles";

interface StudentOnboardingFormProps {
  initialName: string;
  initialBio: string;
  initialLevel: string | null;
}

export function StudentOnboardingForm({
  initialName,
  initialBio,
  initialLevel,
}: StudentOnboardingFormProps) {
  const router = useRouter();
  const t = useTranslations("StudentOnboarding");
  const [name, setName] = useState(initialName);
  const [age, setAge] = useState("");
  const [bio, setBio] = useState(initialBio);
  const [englishLevel, setEnglishLevel] = useState(initialLevel ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const parsedAge = Number(age);
    const trimmedBio = bio.trim();

    if (trimmedName.length < 2) {
      setError(t("nameInvalid"));
      return;
    }

    if (!Number.isInteger(parsedAge) || parsedAge < 8 || parsedAge > 100) {
      setError(t("ageInvalid"));
      return;
    }

    if (trimmedBio.length < 10) {
      setError(t("bioInvalid"));
      return;
    }

    setIsSubmitting(true);

    try {
      const nameResult = await authClient.updateUser({
        name: trimmedName,
      });

      if (nameResult.error) {
        setError(t("saveError"));
        return;
      }

      const response = await fetch("/api/profile/student", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          englishLevel,
          learningGoal: trimmedBio,
          nativeLanguage: "fa",
          timezone: "Asia/Tehran",
        }),
      });

      if (response.status === 401) {
        router.push("/sign-in");
        router.refresh();
        return;
      }

      if (!response.ok) {
        setError(t("saveError"));
        return;
      }

      router.push("/student/dashboard");
      router.refresh();
    } catch {
      setError(t("networkError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label htmlFor="student-name" className="text-sm font-medium text-zinc-900">
          {t("name")}
        </label>
        <input
          id="student-name"
          name="name"
          value={name}
          required
          minLength={2}
          maxLength={80}
          onChange={(event) => setName(event.target.value)}
          className={authInputClassName}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="student-age" className="text-sm font-medium text-zinc-900">
          {t("age")}
        </label>
        <input
          id="student-age"
          name="age"
          type="number"
          inputMode="numeric"
          min={8}
          max={100}
          required
          value={age}
          onChange={(event) => setAge(event.target.value)}
          className={authInputClassName}
        />
        <p className="text-xs text-zinc-500">{t("ageHint")}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="student-bio" className="text-sm font-medium text-zinc-900">
          {t("bio")}
        </label>
        <textarea
          id="student-bio"
          name="bio"
          required
          minLength={10}
          maxLength={500}
          rows={5}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          placeholder={t("bioPlaceholder")}
          className={`${authInputClassName} resize-y`}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="student-level" className="text-sm font-medium text-zinc-900">
          {t("englishLevel")}
        </label>
        <select
          id="student-level"
          name="englishLevel"
          required
          value={englishLevel}
          onChange={(event) => setEnglishLevel(event.target.value)}
          className={authInputClassName}
        >
          <option value="" disabled>
            {t("selectLevel")}
          </option>
          {ENGLISH_LEVELS.map((level) => (
            <option key={level} value={level}>
              {t(`levels.${level}`)}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={isSubmitting} className={`w-full ${authPrimaryButtonClassName}`}>
        {isSubmitting ? t("saving") : t("continue")}
      </button>
    </form>
  );
}
