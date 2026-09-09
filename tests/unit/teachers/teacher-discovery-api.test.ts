import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  listPublicTeachers:
    vi.fn(),
}));

vi.mock(
  "@/lib/services/teacher-discovery.service",
  () => ({
    TEACHER_DISCOVERY_MAX_PAGE_SIZE:
      40,
    listPublicTeachers:
      mocks.listPublicTeachers,
  }),
);

import {
  GET as getTeachers,
} from "@/app/api/teachers/route";
import {
  buildTeacherDiscoveryUrl,
  getTeacherDiscoveryRange,
  parseTeacherDiscoveryResponse,
} from "@/components/teachers/teacher-discovery-api";

beforeEach(() => {
  vi.clearAllMocks();
});

describe(
  "teacher discovery transport",
  () => {
    it("accepts the actual Track A public discovery JSON shape", async () => {
      mocks
        .listPublicTeachers
        .mockResolvedValue({
          teachers: [
            {
              teacherProfileId:
                "teacher-profile-a",
              name:
                "Teacher A",
              image:
                null,
              headline:
                "Conversation teacher",
              experienceYears:
                6,
              nativeLanguage:
                "fa",
              teachingLanguage:
                "en",
              nextAvailableAt:
                new Date(
                  "2026-08-20T14:30:00.000Z",
                ),
            },
          ],
          nextCursor:
            "teacher-profile-a",
        });

      const response =
        await getTeachers(
          new Request(
            "http://localhost:3000/api/teachers" +
              "?fromDate=2026-08-18" +
              "&toDate=2026-09-17",
          ),
        );

      expect(response.status).toBe(200);

      expect(
        parseTeacherDiscoveryResponse(
          await response.json(),
        ),
      ).toEqual({
        teachers: [
          {
            teacherProfileId:
              "teacher-profile-a",
            name:
              "Teacher A",
            image:
              null,
            headline:
              "Conversation teacher",
            experienceYears:
              6,
            nativeLanguage:
              "fa",
            teachingLanguage:
              "en",
            nextAvailableAt:
              "2026-08-20T14:30:00.000Z",
          },
        ],
        nextCursor:
          "teacher-profile-a",
      });
    });

    it("derives the discovery range from Track A's shared Tehran booking window", () => {
      expect(
        getTeacherDiscoveryRange(
          new Date(
            "2026-08-17T22:00:00.000Z",
          ),
        ),
      ).toEqual({
        fromDate:
          "2026-08-18",
        toDate:
          "2026-09-17",
      });
    });

    it("builds one bounded page URL and preserves Track A cursor semantics", () => {
      const range = {
        fromDate:
          "2026-08-18",
        toDate:
          "2026-09-17",
      };

      expect(
        buildTeacherDiscoveryUrl(
          range,
        ),
      ).toBe(
        "/api/teachers?fromDate=2026-08-18&toDate=2026-09-17",
      );

      expect(
        buildTeacherDiscoveryUrl(
          range,
          "teacher-profile-a",
        ),
      ).toBe(
        "/api/teachers?fromDate=2026-08-18&toDate=2026-09-17&cursor=teacher-profile-a",
      );
    });

    it("rejects malformed public DTOs instead of guessing missing fields", () => {
      expect(
        parseTeacherDiscoveryResponse({
          teachers: [
            {
              teacherProfileId:
                "teacher-a",
              name:
                "Teacher A",
              image:
                null,
              headline:
                null,
              experienceYears:
                3,
              nativeLanguage:
                "fa",
              teachingLanguage:
                "en",
              nextAvailableAt:
                "not-a-date",
            },
          ],
          nextCursor:
            null,
        }),
      ).toBeNull();

      expect(
        parseTeacherDiscoveryResponse({
          teachers: [],
          nextCursor:
            "teacher-a",
        }),
      ).toBeNull();

      expect(
        parseTeacherDiscoveryResponse({
          teachers: [
            {
              teacherProfileId:
                "teacher-a",
              name:
                "Teacher A",
              image:
                null,
              headline:
                null,
              experienceYears:
                null,
              nativeLanguage:
                "fa",
              teachingLanguage:
                "en",
              nextAvailableAt:
                null,
            },
          ],
          nextCursor:
            "teacher-b",
        }),
      ).toBeNull();
    });

    it("rejects unknown language codes until the localized public contract is updated", () => {
      expect(
        parseTeacherDiscoveryResponse({
          teachers: [
            {
              teacherProfileId:
                "teacher-a",
              name:
                "Teacher A",
              image:
                null,
              headline:
                null,
              experienceYears:
                null,
              nativeLanguage:
                "unknown",
              teachingLanguage:
                "en",
              nextAvailableAt:
                null,
            },
          ],
          nextCursor:
            null,
        }),
      ).toBeNull();
    });
  },
);
