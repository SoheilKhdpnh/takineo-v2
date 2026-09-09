"use client";

import { useTranslations } from "next-intl";
import {
  type FormEvent,
  useState,
} from "react";

import {
  ENGLISH_LEVELS,
  PROFILE_TIMEZONES,
  type EnglishLevel,
  type ProfileLanguageCode,
  type ProfileTimezone,
} from "@/lib/domain/profile";
import { useRouter } from "@/i18n/navigation";

interface StudentProfileFormProps {
  initialValue: {
    englishLevel: EnglishLevel | null;
    learningGoal: string;
    nativeLanguage: ProfileLanguageCode;
    timezone: ProfileTimezone;
  };
}

export function StudentProfileForm({
  initialValue,
}: StudentProfileFormProps) {
  const router = useRouter();
  const t = useTranslations(
    "StudentProfile",
  );
  const common = useTranslations(
    "ProfileCommon",
  );

  const [error, setError] =
    useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const languageOptions = [
    {
      value: "fa",
      label: common("languages.fa"),
    },
    {
      value: "en",
      label: common("languages.en"),
    },
    {
      value: "ar",
      label: common("languages.ar"),
    },
    {
      value: "tr",
      label: common("languages.tr"),
    },
    {
      value: "ku",
      label: common("languages.ku"),
    },
  ] as const;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);
    setIsSubmitting(true);

    const formData = new FormData(
      event.currentTarget,
    );

    const payload = {
      englishLevel: String(
        formData.get("englishLevel") ?? "",
      ),

      learningGoal: String(
        formData.get("learningGoal") ?? "",
      ).trim(),

      nativeLanguage: String(
        formData.get("nativeLanguage") ?? "",
      ),

      timezone: String(
        formData.get("timezone") ?? "",
      ),
    };

    try {
      const response = await fetch(
        "/api/profile/student",
        {
          method: "PUT",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(payload),
        },
      );

      if (response.status === 401) {
        router.push("/sign-in");
        router.refresh();
        return;
      }

      if (!response.ok) {
        setError(common("saveError"));
        return;
      }

      router.push("/student/dashboard");
      router.refresh();
    } catch {
      setError(common("networkError"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6"
    >
      <div className="space-y-2">
        <label
          htmlFor="englishLevel"
          className="text-sm font-medium text-zinc-900"
        >
          {t("englishLevel")}
        </label>

        <select
          id="englishLevel"
          name="englishLevel"
          required
          defaultValue={
            initialValue.englishLevel ?? ""
          }
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-950 outline-none transition focus:border-zinc-950"
        >
          <option value="" disabled>
            {t("selectLevel")}
          </option>

          {ENGLISH_LEVELS.map((level) => (
            <option
              key={level}
              value={level}
            >
              {level}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="learningGoal"
          className="text-sm font-medium text-zinc-900"
        >
          {t("learningGoal")}
        </label>

        <textarea
          id="learningGoal"
          name="learningGoal"
          required
          minLength={10}
          maxLength={500}
          rows={6}
          defaultValue={
            initialValue.learningGoal
          }
          placeholder={t("goalPlaceholder")}
          className="w-full resize-y rounded-lg border border-zinc-300 px-3 py-2.5 text-zinc-950 outline-none transition focus:border-zinc-950"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="nativeLanguage"
          className="text-sm font-medium text-zinc-900"
        >
          {common("nativeLanguage")}
        </label>

        <select
          id="nativeLanguage"
          name="nativeLanguage"
          required
          defaultValue={
            initialValue.nativeLanguage
          }
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-zinc-950 outline-none transition focus:border-zinc-950"
        >
          {languageOptions.map((language) => (
            <option
              key={language.value}
              value={language.value}
            >
              {language.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="timezone"
          className="text-sm font-medium text-zinc-900"
        >
          {common("timezone")}
        </label>

        <select
          id="timezone"
          name="timezone"
          dir="ltr"
          required
          defaultValue={initialValue.timezone}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-left text-zinc-950 outline-none transition focus:border-zinc-950"
        >
          {PROFILE_TIMEZONES.map(
            (timezone) => (
              <option
                key={timezone}
                value={timezone}
              >
                {timezone}
              </option>
            ),
          )}
        </select>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-zinc-950 px-4 py-3 font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting
          ? common("saving")
          : common("save")}
      </button>
    </form>
  );
}