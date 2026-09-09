"use client";

import { useTranslations } from "next-intl";
import {
  type FormEvent,
  useState,
} from "react";

import {
  PROFILE_TIMEZONES,
  type ProfileLanguageCode,
  type ProfileTimezone,
} from "@/lib/domain/profile";
import { useRouter } from "@/i18n/navigation";

interface TeacherProfileFormProps {
  initialValue: {
    headline: string;
    bio: string;
    experienceYears: number | null;
    nativeLanguage: ProfileLanguageCode;
    timezone: ProfileTimezone;
  };
}

export function TeacherProfileForm({
  initialValue,
}: TeacherProfileFormProps) {
  const router = useRouter();
  const t = useTranslations(
    "TeacherProfile",
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
      headline: String(
        formData.get("headline") ?? "",
      ).trim(),

      bio: String(
        formData.get("bio") ?? "",
      ).trim(),

      experienceYears: Number(
        formData.get("experienceYears"),
      ),

      nativeLanguage: String(
        formData.get("nativeLanguage") ?? "",
      ),

      teachingLanguage: "en",

      timezone: String(
        formData.get("timezone") ?? "",
      ),
    };

    try {
      const response = await fetch(
        "/api/profile/teacher",
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

      router.push("/teacher/dashboard");
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
          htmlFor="headline"
          className="text-sm font-medium text-zinc-900"
        >
          {t("headline")}
        </label>

        <input
          id="headline"
          name="headline"
          type="text"
          required
          minLength={10}
          maxLength={120}
          defaultValue={initialValue.headline}
          placeholder={t("headlinePlaceholder")}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-zinc-950 outline-none transition focus:border-zinc-950"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="bio"
          className="text-sm font-medium text-zinc-900"
        >
          {t("bio")}
        </label>

        <textarea
          id="bio"
          name="bio"
          required
          minLength={80}
          maxLength={2000}
          rows={9}
          defaultValue={initialValue.bio}
          placeholder={t("bioPlaceholder")}
          className="w-full resize-y rounded-lg border border-zinc-300 px-3 py-2.5 text-zinc-950 outline-none transition focus:border-zinc-950"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="experienceYears"
          className="text-sm font-medium text-zinc-900"
        >
          {t("experienceYears")}
        </label>

        <input
          id="experienceYears"
          name="experienceYears"
          type="number"
          dir="ltr"
          required
          min={0}
          max={60}
          step={1}
          defaultValue={
            initialValue.experienceYears ?? 0
          }
          className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-left text-zinc-950 outline-none transition focus:border-zinc-950"
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