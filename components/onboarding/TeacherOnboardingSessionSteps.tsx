"use client";

import { BOOKING_WEEKDAYS } from "@/lib/domain/booking";
import { PROFILE_LANGUAGE_CODES, PROFILE_TIMEZONES } from "@/lib/domain/profile";
import {
  CERTIFICATE_OPTIONS,
  DEGREE_TYPES,
  emptyCertificate,
  emptyEducation,
  type TeacherOnboardingDraft,
  type TeacherOnboardingStep,
} from "@/lib/onboarding/teacher-draft";
import {
  authInputClassName,
  authSecondaryButtonClassName,
} from "@/lib/ui/auth-styles";

function formatMinute(minute: number) {
  const hours = Math.floor(minute / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (minute % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

const TIME_OPTIONS = Array.from({ length: 24 * 4 + 1 }, (_, index) => index * 15);

export type TeacherOnboardingPanelProps = {
  step: TeacherOnboardingStep;
  draft: TeacherOnboardingDraft;
  updateDraft: (patch: Partial<TeacherOnboardingDraft>) => void;
  t: (key: string) => string;
  common: (key: string) => string;
  openDescription: 1 | 2 | 3 | 4;
  setOpenDescription: (section: 1 | 2 | 3 | 4) => void;
  weekdayLabels: Record<string, string>;
  setError: (value: string | null) => void;
};

export function TeacherOnboardingSessionSteps({
  step,
  draft,
  updateDraft,
  t,
  openDescription,
  setOpenDescription,
  weekdayLabels,
}: TeacherOnboardingPanelProps) {
  return (
    <>
      {step === "description" ? (
        <section className="space-y-5">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">{t("descTitle")}</h1>
          <p className="text-sm leading-6 text-zinc-600">{t("descDescription")}</p>
          {([1, 2, 3, 4] as const).map((section) => (
            <div key={section} className="border-b border-[#edddd4] pb-4">
              <button
                type="button"
                className="flex w-full items-center justify-between text-start font-semibold text-zinc-950"
                onClick={() => setOpenDescription(section)}
              >
                {t(`descSection${section}Title`)}
              </button>
              {openDescription === section ? (
                <div className="mt-3 space-y-3">
                  <p className="text-sm text-zinc-600">{t(`descSection${section}Help`)}</p>
                  {section === 4 ? (
                    <input
                      value={draft.description.headline}
                      maxLength={120}
                      onChange={(event) =>
                        updateDraft({
                          description: { ...draft.description, headline: event.target.value },
                        })
                      }
                      className={authInputClassName}
                    />
                  ) : (
                    <textarea
                      rows={4}
                      maxLength={400}
                      value={
                        section === 1
                          ? draft.description.intro
                          : section === 2
                            ? draft.description.experience
                            : draft.description.motivate
                      }
                      placeholder={t(`descSection${section}Placeholder`)}
                      onChange={(event) => {
                        const key =
                          section === 1 ? "intro" : section === 2 ? "experience" : "motivate";
                        updateDraft({
                          description: { ...draft.description, [key]: event.target.value },
                        });
                      }}
                      className={`${authInputClassName} resize-y`}
                    />
                  )}
                  <p className="rounded-xl bg-[#fff4ed] px-3 py-2 text-xs text-[#9a3412]">
                    {t("descWarning")}
                  </p>
                </div>
              ) : null}
            </div>
          ))}
        </section>
      ) : null}

      {step === "video" ? (
        <section className="space-y-5">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">{t("videoTitle")}</h1>
          <p className="text-sm leading-6 text-zinc-600">{t("videoDescription")}</p>
          <div className="rounded-2xl border border-[#edddd4] bg-white p-5">
            <p className="text-sm font-medium text-zinc-700">{t("mentionLabel")}</p>
            <p className="mt-2 font-mono text-xl tracking-wide text-[#c2410c]">
              {draft.mentionCode}
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">{t("mentionHelp")}</p>
          </div>
          <label className="block space-y-2 text-sm font-medium text-zinc-900">
            {t("aparatLabel")}
            <input
              dir="ltr"
              value={draft.aparatUrl}
              placeholder="https://www.aparat.com/v/..."
              onChange={(event) => updateDraft({ aparatUrl: event.target.value })}
              className={`${authInputClassName} text-left`}
            />
          </label>
        </section>
      ) : null}

      {step === "availability" ? (
        <section className="space-y-5">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            {t("availabilityTitle")}
          </h1>
          <p className="text-sm leading-6 text-zinc-600">{t("availabilityDescription")}</p>
          <div className="overflow-x-auto rounded-2xl border border-[#edddd4] bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-[#fff4ed] text-[#9a3412]">
                <tr>
                  <th className="px-3 py-2 text-start">{t("day")}</th>
                  <th className="px-3 py-2 text-start">{t("available")}</th>
                  <th className="px-3 py-2 text-start">{t("from")}</th>
                  <th className="px-3 py-2 text-start">{t("to")}</th>
                </tr>
              </thead>
              <tbody>
                {BOOKING_WEEKDAYS.map((weekday) => {
                  const row = draft.availability.find((item) => item.weekday === weekday);

                  if (!row) {
                    return null;
                  }

                  return (
                    <tr key={weekday} className="border-t border-[#edddd4]">
                      <td className="px-3 py-2 font-medium">{weekdayLabels[weekday]}</td>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={row.enabled}
                          onChange={(event) =>
                            updateDraft({
                              availability: draft.availability.map((item) =>
                                item.weekday === weekday
                                  ? { ...item, enabled: event.target.checked }
                                  : item,
                              ),
                            })
                          }
                          className="size-4 rounded border-zinc-300 text-[#c2410c]"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <select
                          dir="ltr"
                          disabled={!row.enabled}
                          value={row.startMinute}
                          onChange={(event) =>
                            updateDraft({
                              availability: draft.availability.map((item) =>
                                item.weekday === weekday
                                  ? { ...item, startMinute: Number(event.target.value) }
                                  : item,
                              ),
                            })
                          }
                          className={`${authInputClassName} text-left`}
                        >
                          {TIME_OPTIONS.map((minute) => (
                            <option key={minute} value={minute}>
                              {formatMinute(minute)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          dir="ltr"
                          disabled={!row.enabled}
                          value={row.endMinute}
                          onChange={(event) =>
                            updateDraft({
                              availability: draft.availability.map((item) =>
                                item.weekday === weekday
                                  ? { ...item, endMinute: Number(event.target.value) }
                                  : item,
                              ),
                            })
                          }
                          className={`${authInputClassName} text-left`}
                        >
                          {TIME_OPTIONS.map((minute) => (
                            <option key={minute} value={minute}>
                              {formatMinute(minute)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {step === "pricing" ? (
        <section className="space-y-5">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">{t("pricingTitle")}</h1>
          <p className="text-sm leading-6 text-zinc-600">{t("pricingDescription")}</p>
          <div className="rounded-2xl border border-[#edddd4] bg-white p-5">
            <p className="text-sm font-medium text-zinc-500">{t("priceRangeLabel")}</p>
            <div className="mt-4 h-2 rounded-full bg-[#edddd4]">
              <div className="h-2 w-1/2 rounded-full bg-[#c2410c]/40" />
            </div>
            <p className="mt-3 text-sm text-zinc-500">{t("priceRangeSoon")}</p>
          </div>
          <label className="flex items-start gap-3 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={draft.pricingAcknowledged}
              onChange={(event) => updateDraft({ pricingAcknowledged: event.target.checked })}
              className="mt-1 size-4 rounded border-zinc-300 text-[#c2410c]"
            />
            {t("pricingAcknowledge")}
          </label>
        </section>
      ) : null}

    </>
  );
}
