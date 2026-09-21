"use client";

import { PROFILE_LANGUAGE_CODES, PROFILE_TIMEZONES } from "@/lib/domain/profile";
import {
  CERTIFICATE_OPTIONS,
  DEGREE_TYPES,
  emptyCertificate,
  emptyEducation,
  type TeacherOnboardingDraft,
} from "@/lib/onboarding/teacher-draft";
import {
  authInputClassName,
  authSecondaryButtonClassName,
} from "@/lib/ui/auth-styles";
import type { TeacherOnboardingPanelProps } from "@/components/onboarding/teacher-onboarding-types";

const PHOTO_EXAMPLES = [
  { label: "A", className: "bg-[#fed7aa]" },
  { label: "B", className: "bg-[#fdba74]" },
  { label: "C", className: "bg-[#fb923c]" },
  { label: "D", className: "bg-[#f97316]" },
] as const;

const YEAR_OPTIONS = Array.from({ length: 60 }, (_, index) =>
  String(new Date().getFullYear() + 6 - index),
);

export function TeacherOnboardingProfileSteps({
  step,
  draft,
  updateDraft,
  t,
  common,
  setError,
}: TeacherOnboardingPanelProps) {
  return (
    <>
      {step === "about" ? (
        <section className="space-y-5">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">{t("aboutTitle")}</h1>
          <p className="text-sm leading-6 text-zinc-600">{t("aboutDescription")}</p>
          <label className="block space-y-2 text-sm font-medium text-zinc-900">
            {t("name")}
            <input
              value={draft.about.name}
              onChange={(event) =>
                updateDraft({ about: { ...draft.about, name: event.target.value } })
              }
              className={authInputClassName}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium text-zinc-900">
            {common("nativeLanguage")}
            <select
              value={draft.about.nativeLanguage}
              onChange={(event) =>
                updateDraft({
                  about: {
                    ...draft.about,
                    nativeLanguage: event.target.value as TeacherOnboardingDraft["about"]["nativeLanguage"],
                  },
                })
              }
              className={authInputClassName}
            >
              {PROFILE_LANGUAGE_CODES.map((code) => (
                <option key={code} value={code}>
                  {common(`languages.${code}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2 text-sm font-medium text-zinc-900">
            {common("timezone")}
            <select
              dir="ltr"
              value={draft.about.timezone}
              onChange={(event) =>
                updateDraft({
                  about: {
                    ...draft.about,
                    timezone: event.target.value as TeacherOnboardingDraft["about"]["timezone"],
                  },
                })
              }
              className={`${authInputClassName} text-left`}
            >
              {PROFILE_TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2 text-sm font-medium text-zinc-900">
            {t("experienceYears")}
            <input
              type="number"
              min={0}
              max={60}
              value={draft.about.experienceYears}
              onChange={(event) =>
                updateDraft({ about: { ...draft.about, experienceYears: event.target.value } })
              }
              className={authInputClassName}
            />
          </label>
        </section>
      ) : null}

      {step === "photo" ? (
        <section className="space-y-5">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">{t("photoTitle")}</h1>
          <p className="text-sm leading-6 text-zinc-600">{t("photoDescription")}</p>
          <div className="flex items-center gap-4 rounded-2xl border border-[#edddd4] bg-white p-4">
            <div className="size-16 overflow-hidden rounded-full bg-[#fff4ed]">
              {draft.photoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.photoDataUrl} alt="" className="size-full object-cover" />
              ) : null}
            </div>
            <div>
              <p className="font-semibold text-zinc-950">{draft.about.name || t("photoPreviewName")}</p>
              <p className="text-sm text-zinc-500">{t("photoPreviewRole")}</p>
              <p className="text-sm text-zinc-500">{t("photoPreviewLanguages")}</p>
            </div>
          </div>
          <label className={`${authSecondaryButtonClassName} block cursor-pointer text-center`}>
            {t("uploadPhoto")}
            <input
              type="file"
              accept="image/jpeg,image/png"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 20 * 1024 * 1024) {
                  setError(t("errors.photoSize"));
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  updateDraft({ photoDataUrl: String(reader.result) });
                  setError(null);
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
          <div className="rounded-2xl border border-[#edddd4] bg-white p-5">
            <p className="font-semibold text-zinc-950">{t("photoNeedsTitle")}</p>
            <div className="mt-4 flex gap-3">
              {PHOTO_EXAMPLES.map((example) => (
                <div
                  key={example.label}
                  className={`flex size-16 items-center justify-center rounded-2xl text-sm font-semibold text-[#9a3412] ${example.className}`}
                  aria-hidden="true"
                >
                  {example.label}
                </div>
              ))}
            </div>
            <ul className="mt-4 space-y-2 text-sm text-zinc-700">
              <li>✓ {t("photoNeedOne")}</li>
              <li>✓ {t("photoNeedTwo")}</li>
              <li>✓ {t("photoNeedThree")}</li>
              <li>✓ {t("photoNeedFour")}</li>
              <li>✓ {t("photoNeedFive")}</li>
              <li>✓ {t("photoNeedSix")}</li>
              <li>✓ {t("photoNeedSeven")}</li>
            </ul>
          </div>
        </section>
      ) : null}

      {step === "certification" ? (
        <section className="space-y-5">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">{t("certTitle")}</h1>
          <p className="text-sm leading-6 text-zinc-600">{t("certDescription")}</p>
          <label className="flex items-center gap-3 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={draft.noCertificate}
              onChange={(event) => updateDraft({ noCertificate: event.target.checked })}
              className="size-4 rounded border-zinc-300 text-[#c2410c]"
            />
            {t("noCertificate")}
          </label>
          {!draft.noCertificate
            ? draft.certificates.map((certificate) => (
                <div key={certificate.id} className="space-y-3 rounded-2xl border border-[#edddd4] bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <label className="block min-w-0 flex-1 space-y-2 text-sm font-medium">
                      {t("subject")}
                      <select
                        value={certificate.subject}
                        onChange={(event) => {
                          updateDraft({
                            certificates: draft.certificates.map((item) =>
                              item.id === certificate.id
                                ? { ...item, subject: event.target.value }
                                : item,
                            ),
                          });
                        }}
                        className={authInputClassName}
                      >
                        <option value="English">English</option>
                      </select>
                    </label>
                    {draft.certificates.length > 1 ? (
                      <button
                        type="button"
                        className="mt-7 text-sm text-[#9a3412]"
                        onClick={() =>
                          updateDraft({
                            certificates: draft.certificates.filter((item) => item.id !== certificate.id),
                          })
                        }
                      >
                        {t("remove")}
                      </button>
                    ) : null}
                  </div>
                  <label className="block space-y-2 text-sm font-medium">
                    {t("certificate")}
                    <select
                      value={certificate.name}
                      onChange={(event) => {
                        updateDraft({
                          certificates: draft.certificates.map((item) =>
                            item.id === certificate.id ? { ...item, name: event.target.value } : item,
                          ),
                        });
                      }}
                      className={authInputClassName}
                    >
                      <option value="">{t("selectCertificate")}</option>
                      {CERTIFICATE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={`${authSecondaryButtonClassName} block cursor-pointer text-center text-sm`}>
                    {certificate.fileName ?? t("uploadDocument")}
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        if (file.size > 20 * 1024 * 1024) {
                          setError(t("errors.photoSize"));
                          return;
                        }
                        updateDraft({
                          certificates: draft.certificates.map((item) =>
                            item.id === certificate.id ? { ...item, fileName: file.name } : item,
                          ),
                        });
                      }}
                    />
                  </label>
                  <p className="text-xs text-zinc-500">{t("fileHint")}</p>
                </div>
              ))
            : null}
          {!draft.noCertificate ? (
            <button
              type="button"
              className="text-sm font-medium text-[#9a3412] underline-offset-4 hover:underline"
              onClick={() => updateDraft({ certificates: [...draft.certificates, emptyCertificate()] })}
            >
              {t("addCertificate")}
            </button>
          ) : null}
          <p className="rounded-2xl bg-[#fff4ed] px-4 py-3 text-sm leading-6 text-[#9a3412]">
            {t("certWarning")}
          </p>
        </section>
      ) : null}

      {step === "education" ? (
        <section className="space-y-5">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">{t("eduTitle")}</h1>
          <p className="text-sm leading-6 text-zinc-600">{t("eduDescription")}</p>
          <label className="flex items-center gap-3 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={draft.noEducation}
              onChange={(event) => updateDraft({ noEducation: event.target.checked })}
              className="size-4 rounded border-zinc-300 text-[#c2410c]"
            />
            {t("noEducation")}
          </label>
          {!draft.noEducation
            ? draft.education.map((item) => (
                <div key={item.id} className="space-y-3 rounded-2xl border border-[#edddd4] bg-white p-4">
                  <label className="block space-y-2 text-sm font-medium">
                    {t("university")}
                    <input
                      value={item.university}
                      placeholder={t("universityPlaceholder")}
                      onChange={(event) =>
                        updateDraft({
                          education: draft.education.map((row) =>
                            row.id === item.id ? { ...row, university: event.target.value } : row,
                          ),
                        })
                      }
                      className={authInputClassName}
                    />
                  </label>
                  <label className="block space-y-2 text-sm font-medium">
                    {t("degree")}
                    <input
                      value={item.degree}
                      placeholder={t("degreePlaceholder")}
                      onChange={(event) =>
                        updateDraft({
                          education: draft.education.map((row) =>
                            row.id === item.id ? { ...row, degree: event.target.value } : row,
                          ),
                        })
                      }
                      className={authInputClassName}
                    />
                  </label>
                  <label className="block space-y-2 text-sm font-medium">
                    {t("degreeType")}
                    <select
                      value={item.degreeType}
                      onChange={(event) =>
                        updateDraft({
                          education: draft.education.map((row) =>
                            row.id === item.id ? { ...row, degreeType: event.target.value } : row,
                          ),
                        })
                      }
                      className={authInputClassName}
                    >
                      <option value="">{t("chooseDegreeType")}</option>
                      {DEGREE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t(`degreeTypes.${type}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-2 text-sm font-medium">
                    {t("specialization")}
                    <input
                      value={item.specialization}
                      placeholder={t("specializationPlaceholder")}
                      onChange={(event) =>
                        updateDraft({
                          education: draft.education.map((row) =>
                            row.id === item.id ? { ...row, specialization: event.target.value } : row,
                          ),
                        })
                      }
                      className={authInputClassName}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block space-y-2 text-sm font-medium">
                      {t("fromYear")}
                      <select
                        value={item.fromYear}
                        onChange={(event) =>
                          updateDraft({
                            education: draft.education.map((row) =>
                              row.id === item.id ? { ...row, fromYear: event.target.value } : row,
                            ),
                          })
                        }
                        className={authInputClassName}
                      >
                        <option value="">{t("fromYear")}</option>
                        {YEAR_OPTIONS.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block space-y-2 text-sm font-medium">
                      {t("toYear")}
                      <select
                        value={item.toYear}
                        onChange={(event) =>
                          updateDraft({
                            education: draft.education.map((row) =>
                              row.id === item.id ? { ...row, toYear: event.target.value } : row,
                            ),
                          })
                        }
                        className={authInputClassName}
                      >
                        <option value="">{t("toYear")}</option>
                        {YEAR_OPTIONS.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="rounded-2xl bg-[#fff4ed] p-4">
                    <p className="text-sm font-semibold text-zinc-950">{t("diplomaBadgeTitle")}</p>
                    <p className="mt-1 text-sm leading-6 text-zinc-600">{t("diplomaBadgeBody")}</p>
                    <label className={`${authSecondaryButtonClassName} mt-3 block cursor-pointer text-center text-sm`}>
                      {item.diplomaFileName ?? t("diplomaUpload")}
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          updateDraft({
                            education: draft.education.map((row) =>
                              row.id === item.id ? { ...row, diplomaFileName: file.name } : row,
                            ),
                          });
                        }}
                      />
                    </label>
                    <p className="mt-2 text-xs text-zinc-500">{t("fileHint")}</p>
                  </div>
                  {draft.education.length > 1 ? (
                    <button
                      type="button"
                      className="text-sm text-[#9a3412]"
                      onClick={() =>
                        updateDraft({
                          education: draft.education.filter((row) => row.id !== item.id),
                        })
                      }
                    >
                      {t("remove")}
                    </button>
                  ) : null}
                </div>
              ))
            : null}
          {!draft.noEducation ? (
            <button
              type="button"
              className="text-sm font-medium text-[#9a3412] underline-offset-4 hover:underline"
              onClick={() => updateDraft({ education: [...draft.education, emptyEducation()] })}
            >
              {t("addEducation")}
            </button>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
