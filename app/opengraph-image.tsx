import { ImageResponse } from "next/og";

import { SITE_NAME } from "@/lib/site";

export const alt = `${SITE_NAME} — 15-minute English speaking with human teachers`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          backgroundColor: "#f4f0e8",
          backgroundImage:
            "radial-gradient(ellipse 70% 80% at 100% 0%, rgba(15, 110, 102, 0.18), transparent 55%), radial-gradient(ellipse 50% 60% at 0% 100%, rgba(201, 107, 47, 0.12), transparent 50%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg
            width="72"
            height="72"
            viewBox="0 0 32 32"
            fill="none"
          >
            <rect width="32" height="32" rx="8" fill="#0F6E66" />
            <rect x="14" y="6" width="12.5" height="9.5" rx="3.5" fill="#FFFDF8" />
            <rect
              x="5.5"
              y="11.5"
              width="18"
              height="12.5"
              rx="4"
              fill="#FFFDF8"
            />
            <path fill="#FFFDF8" d="M8 23.5v4.4L13.2 23.5H8Z" />
          </svg>
          <div
            style={{
              fontSize: 44,
              fontWeight: 700,
              color: "#14221f",
              letterSpacing: "-0.04em",
            }}
          >
            {SITE_NAME}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 58,
              fontWeight: 700,
              color: "#14221f",
              letterSpacing: "-0.035em",
              lineHeight: 1.15,
              maxWidth: 920,
            }}
          >
            Speak English for 15 focused minutes with a real teacher.
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#4d5f59",
              lineHeight: 1.4,
              maxWidth: 820,
            }}
          >
            Teachers teach. AI assists. talkinu.com
          </div>
        </div>
      </div>
    ),
    size,
  );
}
