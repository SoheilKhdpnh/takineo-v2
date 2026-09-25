"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { useEffect, useRef, type ReactNode } from "react";

import { TeacherProfileForm } from "@/components/profiles/TeacherProfileForm";
import {
  CameraIcon,
  CloseIcon,
} from "@/components/ui/WorkspaceIcons";
import type {
  ProfileLanguageCode,
  ProfileTimezone,
} from "@/lib/domain/profile";

export const TEACHER_DEFAULT_COVER = "/images/teacher-cover-default.png";

export type TeacherProfileEditSection = "photos" | "details" | "credentials";

function DialogSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-4 rounded-2xl border border-[#edddd4] bg-white p-5"
    >
      <h3
        id={`${id}-title`}
        className="text-base font-semibold text-zinc-950"
      >
        {title}
      </h3>
      <p className="mt-1 text-sm leading-6 text-zinc-600">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function TeacherProfileEditDialog({
  open,
  focusSection,
  onClose,
  displayName,
  userImage,
  canEditDetails,
  initialValue,
}: {
  open: boolean;
  focusSection: TeacherProfileEditSection;
  onClose: () => void;
  displayName: string;
  userImage: string | null;
  canEditDetails: boolean;
  initialValue: {
    headline: string;
    bio: string;
    experienceYears: number | null;
    nativeLanguage: ProfileLanguageCode;
    timezone: ProfileTimezone;
  };
}) {
  const t = useTranslations("TeacherProfile");
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      document
        .getElementById(`teacher-edit-${focusSection}`)
        ?.scrollIntoView({ block: "start" });
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [focusSection, open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="teacher-edit-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      className="m-auto max-h-[92vh] w-[min(46rem,calc(100vw-1.5rem))] overflow-hidden rounded-[1.75rem] border border-[#edddd4] bg-[#fffaf6] p-0 text-ink shadow-[0_40px_120px_-40px_rgba(28,20,16,0.6)] backdrop:bg-[#1c1410]/45 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex max-h-[92vh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-[#edddd4] bg-white px-6 py-5">
          <div>
            <h2
              id="teacher-edit-title"
              className="text-xl font-semibold tracking-tight text-zinc-950"
            >
              {t("editorTitle")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600">
              {t("editorDescription")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("editorClose")}
            onClick={onClose}
            className="grid size-9 shrink-0 place-items-center rounded-xl text-zinc-500 transition hover:bg-[#fff4ed] hover:text-[#9a3412]"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <DialogSection
            id="teacher-edit-photos"
            title={t("editorPhotosTitle")}
            description={t("editorPhotosDescription")}
          >
            <div className="overflow-hidden rounded-xl border border-[#edddd4]">
              <div className="relative h-28">
                <Image
                  src={TEACHER_DEFAULT_COVER}
                  alt=""
                  fill
                  sizes="44rem"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-wrap items-center gap-4 bg-[#fffaf6] px-4 py-3">
                <span className="relative -mt-10 grid size-16 place-items-center overflow-hidden rounded-full border-4 border-white bg-[#fff4ed] text-xl font-semibold text-[#c2410c]">
                  {userImage ? (
                    // Better Auth profile images may come from arbitrary provider URLs.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={userImage}
                      alt=""
                      width={64}
                      height={64}
                      className="size-full object-cover"
                    />
                  ) : (
                    displayName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled
                    aria-describedby="teacher-edit-photos-pending"
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#edddd4] bg-white px-3 text-sm font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CameraIcon className="size-4" />
                    {t("changeProfilePhoto")}
                  </button>
                  <button
                    type="button"
                    disabled
                    aria-describedby="teacher-edit-photos-pending"
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#edddd4] bg-white px-3 text-sm font-semibold text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <CameraIcon className="size-4" />
                    {t("changeCoverPhoto")}
                  </button>
                </div>
              </div>
            </div>
            <p
              id="teacher-edit-photos-pending"
              className="mt-3 rounded-xl bg-[#fff4ed] px-3 py-2 text-xs leading-5 text-[#9a3412]"
            >
              {t("photosPending")}
            </p>
          </DialogSection>

          <DialogSection
            id="teacher-edit-details"
            title={t("editorDetailsTitle")}
            description={t("editorDetailsDescription")}
          >
            {canEditDetails ? (
              <TeacherProfileForm initialValue={initialValue} />
            ) : (
              <p className="rounded-xl border border-[#edddd4] bg-[#fffaf6] px-4 py-3 text-sm leading-6 text-zinc-600">
                {t("readOnlyNotice")}
              </p>
            )}
          </DialogSection>

          <DialogSection
            id="teacher-edit-credentials"
            title={t("editorCredentialsTitle")}
            description={t("editorCredentialsDescription")}
          >
            <p className="rounded-xl bg-[#fff4ed] px-3 py-2 text-xs leading-5 text-[#9a3412]">
              {t("credentialsPending")}
            </p>
          </DialogSection>
        </div>
      </div>
    </dialog>
  );
}
