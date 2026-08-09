import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mocks = vi.hoisted(() => ({
  randomUUID: vi.fn(() => "lease-test"),

  reconciliationFindUnique: vi.fn(),
  reconciliationFindMany: vi.fn(),
  reconciliationUpdateMany: vi.fn(),
  reconciliationUpsert: vi.fn(),

  txReconciliationUpdateMany: vi.fn(),
  txTeacherVideoUpdateMany: vi.fn(),
  transaction: vi.fn(),

  retrieveAsset: vi.fn(),
  createPlaybackId: vi.fn(),
  deletePlaybackId: vi.fn(),
}));

vi.mock("node:crypto", () => ({
  randomUUID: mocks.randomUUID,
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    muxPlaybackReconciliation: {
      findUnique: mocks.reconciliationFindUnique,
      findMany: mocks.reconciliationFindMany,
      updateMany: mocks.reconciliationUpdateMany,
      upsert: mocks.reconciliationUpsert,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/video/mux-client", () => ({
  getMuxClient: () => ({
    video: {
      assets: {
        retrieve: mocks.retrieveAsset,
        createPlaybackId: mocks.createPlaybackId,
        deletePlaybackId: mocks.deletePlaybackId,
      },
    },
  }),
}));

import {
  processDueMuxPlaybackReconciliations,
  queueMuxPlaybackIntent,
  reconcileMuxPlayback,
} from "@/lib/services/mux-playback-reconciliation.service";

const NOW = new Date("2026-08-09T09:30:00.000Z");

function makeClaimedRecord(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "reconciliation-1",
    introVideoId: "video-1",
    videoRevision: 4,
    assetId: "asset-1",
    playbackId: null,

    desiredState: "ENABLED",
    intentGeneration: 7,

    status: "PROCESSING",
    attemptCount: 1,

    nextAttemptAt: NOW,
    leaseToken: "lease-test",
    leaseExpiresAt: new Date(
      NOW.getTime() + 60_000,
    ),

    lastErrorCode: null,
    lastAttemptAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,

    introVideo: {
      id: "video-1",
      revision: 4,
      status: "APPROVED",

      teacherProfile: {
        applicationStatus: "APPROVED",
        profileCompletedAt: NOW,

        user: {
          accountStatus: "ACTIVE",
        },
      },
    },

    ...overrides,
  };
}

function prepareSuccessfulClaim(
  recordOverrides: Record<string, unknown> = {},
) {
  const record = makeClaimedRecord(recordOverrides);

  mocks.reconciliationFindUnique
    .mockResolvedValueOnce({
      intentGeneration: 7,
      nextAttemptAt: new Date(
        NOW.getTime() - 1_000,
      ),
    })
    .mockResolvedValueOnce(record);

  mocks.reconciliationUpdateMany.mockResolvedValueOnce({
    count: 1,
  });

  return record;
}

describe("Mux playback reconciliation fencing", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    mocks.randomUUID.mockReset();
    mocks.randomUUID.mockReturnValue("lease-test");

    mocks.reconciliationFindUnique.mockReset();
    mocks.reconciliationFindMany.mockReset();
    mocks.reconciliationUpdateMany.mockReset();
    mocks.reconciliationUpsert.mockReset();

    mocks.txReconciliationUpdateMany.mockReset();
    mocks.txTeacherVideoUpdateMany.mockReset();
    mocks.transaction.mockReset();

    mocks.retrieveAsset.mockReset();
    mocks.createPlaybackId.mockReset();
    mocks.deletePlaybackId.mockReset();

    mocks.transaction.mockImplementation(
      async (
        callback: (tx: {
          muxPlaybackReconciliation: {
            updateMany: typeof mocks.txReconciliationUpdateMany;
          };
          teacherIntroVideo: {
            updateMany: typeof mocks.txTeacherVideoUpdateMany;
          };
        }) => unknown,
      ) =>
        callback({
          muxPlaybackReconciliation: {
            updateMany:
              mocks.txReconciliationUpdateMany,
          },
          teacherIntroVideo: {
            updateMany:
              mocks.txTeacherVideoUpdateMany,
          },
        }),
    );

    mocks.txReconciliationUpdateMany.mockResolvedValue({
      count: 1,
    });

    mocks.txTeacherVideoUpdateMany.mockResolvedValue({
      count: 1,
    });

    mocks.retrieveAsset.mockResolvedValue({
      playback_ids: [],
    });

    mocks.createPlaybackId.mockResolvedValue({
      id: "public-new",
    });

    mocks.deletePlaybackId.mockResolvedValue(
      undefined,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("queues a new intent generation and clears stale lease state", async () => {
    const tx = {
      muxPlaybackReconciliation: {
        upsert: mocks.reconciliationUpsert,
      },
    };

    mocks.reconciliationUpsert.mockResolvedValue({
      id: "reconciliation-1",
    });

    await queueMuxPlaybackIntent(
      tx as never,
      {
        introVideoId: "video-1",
        videoRevision: 4,
        assetId: "asset-1",
        playbackId: "public-old",
        desiredState: "REVOKED",
      },
    );

    expect(
      mocks.reconciliationUpsert,
    ).toHaveBeenCalledWith({
      where: {
        introVideoId_videoRevision: {
          introVideoId: "video-1",
          videoRevision: 4,
        },
      },

      create: expect.objectContaining({
        introVideoId: "video-1",
        videoRevision: 4,
        assetId: "asset-1",
        playbackId: "public-old",
        desiredState: "REVOKED",
        status: "PENDING",
      }),

      update: expect.objectContaining({
        assetId: "asset-1",
        playbackId: "public-old",
        desiredState: "REVOKED",

        intentGeneration: {
          increment: 1,
        },

        status: "PENDING",
        attemptCount: 0,
        leaseToken: null,
        leaseExpiresAt: null,
        lastErrorCode: null,
      }),
    });
  });

  it("skips an intent that is not due", async () => {
    mocks.reconciliationFindUnique.mockResolvedValue({
      intentGeneration: 7,
      nextAttemptAt: new Date(
        NOW.getTime() + 60_000,
      ),
    });

    await expect(
      reconcileMuxPlayback("reconciliation-1"),
    ).resolves.toEqual({
      outcome: "SKIPPED",
    });

    expect(
      mocks.reconciliationUpdateMany,
    ).not.toHaveBeenCalled();

    expect(
      mocks.retrieveAsset,
    ).not.toHaveBeenCalled();
  });

  it("skips when the atomic lease claim loses the race", async () => {
    mocks.reconciliationFindUnique.mockResolvedValueOnce({
      intentGeneration: 7,
      nextAttemptAt: new Date(
        NOW.getTime() - 1_000,
      ),
    });

    mocks.reconciliationUpdateMany.mockResolvedValueOnce({
      count: 0,
    });

    await expect(
      reconcileMuxPlayback("reconciliation-1"),
    ).resolves.toEqual({
      outcome: "SKIPPED",
    });

    const claim =
      mocks.reconciliationUpdateMany.mock.calls[0][0];

    expect(claim.where).toEqual(
      expect.objectContaining({
        id: "reconciliation-1",
        intentGeneration: 7,

        status: {
          in: [
            "PENDING",
            "FAILED",
            "PROCESSING",
            "SUCCEEDED",
          ],
        },

        OR: [
          { leaseToken: null },
          { leaseExpiresAt: null },
          {
            leaseExpiresAt: {
              lte: NOW,
            },
          },
        ],
      }),
    );

    expect(
      mocks.retrieveAsset,
    ).not.toHaveBeenCalled();
  });

  it.each([
    [
      "generation changed",
      {
        intentGeneration: 8,
      },
    ],
    [
      "lease token changed",
      {
        leaseToken: "newer-worker-lease",
      },
    ],
  ])(
    "stops before provider work when post-claim ownership is stale: %s",
    async (_label, overrides) => {
      mocks.reconciliationFindUnique
        .mockResolvedValueOnce({
          intentGeneration: 7,
          nextAttemptAt: new Date(
            NOW.getTime() - 1_000,
          ),
        })
        .mockResolvedValueOnce(
          makeClaimedRecord(overrides),
        );

      mocks.reconciliationUpdateMany.mockResolvedValueOnce({
        count: 1,
      });

      await expect(
        reconcileMuxPlayback("reconciliation-1"),
      ).resolves.toEqual({
        outcome: "SKIPPED",
      });

      expect(
        mocks.retrieveAsset,
      ).not.toHaveBeenCalled();

      expect(
        mocks.createPlaybackId,
      ).not.toHaveBeenCalled();

      expect(
        mocks.deletePlaybackId,
      ).not.toHaveBeenCalled();
    },
  );

  it("does not create provider playback after losing the exact lease fence", async () => {
    prepareSuccessfulClaim();

    mocks.retrieveAsset.mockResolvedValue({
      playback_ids: [],
    });

    mocks.reconciliationUpdateMany.mockResolvedValueOnce({
      count: 0,
    });

    await expect(
      reconcileMuxPlayback("reconciliation-1"),
    ).resolves.toEqual({
      outcome: "SKIPPED",
    });

    const renewal =
      mocks.reconciliationUpdateMany.mock.calls[1][0];

    expect(renewal.where).toEqual(
      expect.objectContaining({
        id: "reconciliation-1",
        intentGeneration: 7,
        videoRevision: 4,
        leaseToken: "lease-test",
        status: "PROCESSING",
        leaseExpiresAt: {
          gt: NOW,
        },
      }),
    );

    expect(
      mocks.createPlaybackId,
    ).not.toHaveBeenCalled();
  });

  it("does not delete duplicate provider playback after losing the exact lease fence", async () => {
    prepareSuccessfulClaim({
      playbackId: "public-primary",
    });

    mocks.retrieveAsset.mockResolvedValue({
      playback_ids: [
        {
          id: "public-primary",
          policy: "public",
        },
        {
          id: "public-duplicate",
          policy: "public",
        },
      ],
    });

    mocks.reconciliationUpdateMany.mockResolvedValueOnce({
      count: 0,
    });

    await expect(
      reconcileMuxPlayback("reconciliation-1"),
    ).resolves.toEqual({
      outcome: "SKIPPED",
    });

    expect(
      mocks.deletePlaybackId,
    ).not.toHaveBeenCalled();
  });

  it("finalizes only with the exact generation, revision, and lease token", async () => {
    prepareSuccessfulClaim({
      playbackId: "public-existing",
    });

    mocks.retrieveAsset.mockResolvedValue({
      playback_ids: [
        {
          id: "public-existing",
          policy: "public",
        },
      ],
    });

    await expect(
      reconcileMuxPlayback("reconciliation-1"),
    ).resolves.toEqual({
      outcome: "SUCCEEDED",
    });

    expect(
      mocks.txReconciliationUpdateMany,
    ).toHaveBeenCalledTimes(1);

    const finalize =
      mocks.txReconciliationUpdateMany.mock.calls[0][0];

    expect(finalize.where).toEqual({
      id: "reconciliation-1",
      intentGeneration: 7,
      videoRevision: 4,
      leaseToken: "lease-test",
      status: "PROCESSING",
    });

    expect(finalize.data).toEqual(
      expect.objectContaining({
        playbackId: "public-existing",
        status: "SUCCEEDED",
        attemptCount: 0,
        leaseToken: null,
        leaseExpiresAt: null,
        lastErrorCode: null,
      }),
    );

    expect(
      finalize.data.nextAttemptAt,
    ).toEqual(
      new Date(
        NOW.getTime() + 300_000,
      ),
    );

    expect(
      mocks.txTeacherVideoUpdateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: "video-1",
        revision: 4,
        status: "APPROVED",

        teacherProfile: {
          applicationStatus: "APPROVED",
          profileCompletedAt: {
            not: null,
          },

          user: {
            accountStatus: "ACTIVE",
          },
        },
      },

      data: {
        publicPlaybackId: "public-existing",
      },
    });
  });

  it("can reclaim an expired lease through the atomic claim predicate", async () => {
    prepareSuccessfulClaim({
      playbackId: "public-existing",
      status: "PROCESSING",
      leaseToken: "lease-test",
    });

    mocks.retrieveAsset.mockResolvedValue({
      playback_ids: [
        {
          id: "public-existing",
          policy: "public",
        },
      ],
    });

    await expect(
      reconcileMuxPlayback("reconciliation-1"),
    ).resolves.toEqual({
      outcome: "SUCCEEDED",
    });

    const claim =
      mocks.reconciliationUpdateMany.mock.calls[0][0];

    expect(claim.where.OR).toContainEqual({
      leaseExpiresAt: {
        lte: NOW,
      },
    });
  });
});


describe("Mux playback provider convergence", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    mocks.randomUUID.mockReset();
    mocks.randomUUID.mockReturnValue("lease-test");

    mocks.reconciliationFindUnique.mockReset();
    mocks.reconciliationFindMany.mockReset();
    mocks.reconciliationUpdateMany.mockReset();
    mocks.reconciliationUpsert.mockReset();

    mocks.txReconciliationUpdateMany.mockReset();
    mocks.txTeacherVideoUpdateMany.mockReset();
    mocks.transaction.mockReset();

    mocks.retrieveAsset.mockReset();
    mocks.createPlaybackId.mockReset();
    mocks.deletePlaybackId.mockReset();

    mocks.transaction.mockImplementation(
      async (
        callback: (tx: {
          muxPlaybackReconciliation: {
            updateMany: typeof mocks.txReconciliationUpdateMany;
          };
          teacherIntroVideo: {
            updateMany: typeof mocks.txTeacherVideoUpdateMany;
          };
        }) => unknown,
      ) =>
        callback({
          muxPlaybackReconciliation: {
            updateMany:
              mocks.txReconciliationUpdateMany,
          },
          teacherIntroVideo: {
            updateMany:
              mocks.txTeacherVideoUpdateMany,
          },
        }),
    );

    mocks.txReconciliationUpdateMany.mockResolvedValue({
      count: 1,
    });

    mocks.txTeacherVideoUpdateMany.mockResolvedValue({
      count: 1,
    });

    mocks.retrieveAsset.mockResolvedValue({
      playback_ids: [],
    });

    mocks.createPlaybackId.mockResolvedValue({
      id: "public-new",
    });

    mocks.deletePlaybackId.mockResolvedValue(
      undefined,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates a public playback ID when the provider has none", async () => {
    prepareSuccessfulClaim();

    mocks.reconciliationUpdateMany.mockResolvedValueOnce({
      count: 1,
    });

    const result = await reconcileMuxPlayback(
      "reconciliation-1",
    );

    expect(result).toEqual({
      outcome: "SUCCEEDED",
    });

    expect(
      mocks.createPlaybackId,
    ).toHaveBeenCalledWith(
      "asset-1",
      {
        policy: "public",
      },
    );

    expect(
      mocks.txReconciliationUpdateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          playbackId: "public-new",
          status: "SUCCEEDED",
        }),
      }),
    );
  });

  it("reuses an existing provider public playback without creating another", async () => {
    prepareSuccessfulClaim();

    mocks.retrieveAsset.mockResolvedValue({
      playback_ids: [
        {
          id: "public-existing",
          policy: "public",
        },
      ],
    });

    const result = await reconcileMuxPlayback(
      "reconciliation-1",
    );

    expect(result).toEqual({
      outcome: "SUCCEEDED",
    });

    expect(
      mocks.createPlaybackId,
    ).not.toHaveBeenCalled();

    expect(
      mocks.txReconciliationUpdateMany,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          playbackId: "public-existing",
        }),
      }),
    );
  });

  it("removes duplicate public playback IDs while preserving the selected ID", async () => {
    prepareSuccessfulClaim({
      playbackId: "public-primary",
    });

    mocks.retrieveAsset.mockResolvedValue({
      playback_ids: [
        {
          id: "public-primary",
          policy: "public",
        },
        {
          id: "public-duplicate-1",
          policy: "public",
        },
        {
          id: "public-duplicate-2",
          policy: "public",
        },
        {
          id: "signed-review-id",
          policy: "signed",
        },
      ],
    });

    mocks.reconciliationUpdateMany
      .mockResolvedValueOnce({
        count: 1,
      })
      .mockResolvedValueOnce({
        count: 1,
      });

    const result = await reconcileMuxPlayback(
      "reconciliation-1",
    );

    expect(result).toEqual({
      outcome: "SUCCEEDED",
    });

    expect(
      mocks.deletePlaybackId,
    ).toHaveBeenCalledTimes(2);

    expect(
      mocks.deletePlaybackId,
    ).toHaveBeenNthCalledWith(
      1,
      "asset-1",
      "public-duplicate-1",
    );

    expect(
      mocks.deletePlaybackId,
    ).toHaveBeenNthCalledWith(
      2,
      "asset-1",
      "public-duplicate-2",
    );

    expect(
      mocks.deletePlaybackId,
    ).not.toHaveBeenCalledWith(
      "asset-1",
      "public-primary",
    );
  });

  it("revokes both tracked and provider-discovered public playback IDs", async () => {
    prepareSuccessfulClaim({
      desiredState: "REVOKED",
      playbackId: "public-tracked",
    });

    mocks.retrieveAsset.mockResolvedValue({
      playback_ids: [
        {
          id: "public-discovered",
          policy: "public",
        },
        {
          id: "signed-review-id",
          policy: "signed",
        },
      ],
    });

    mocks.reconciliationUpdateMany
      .mockResolvedValueOnce({
        count: 1,
      })
      .mockResolvedValueOnce({
        count: 1,
      });

    const result = await reconcileMuxPlayback(
      "reconciliation-1",
    );

    expect(result).toEqual({
      outcome: "SUCCEEDED",
    });

    expect(
      mocks.deletePlaybackId,
    ).toHaveBeenCalledTimes(2);

    expect(
      mocks.deletePlaybackId,
    ).toHaveBeenNthCalledWith(
      1,
      "asset-1",
      "public-tracked",
    );

    expect(
      mocks.deletePlaybackId,
    ).toHaveBeenNthCalledWith(
      2,
      "asset-1",
      "public-discovered",
    );

    expect(
      mocks.txTeacherVideoUpdateMany,
    ).toHaveBeenCalledWith({
      where: {
        id: "video-1",
        publicPlaybackId: {
          in: [
            "public-tracked",
            "public-discovered",
          ],
        },
      },
      data: {
        publicPlaybackId: null,
      },
    });
  });

  it("treats provider 404 during revocation as already converged", async () => {
    prepareSuccessfulClaim({
      desiredState: "REVOKED",
      playbackId: "public-gone",
    });

    mocks.retrieveAsset.mockResolvedValue({
      playback_ids: [],
    });

    mocks.reconciliationUpdateMany.mockResolvedValueOnce({
      count: 1,
    });

    mocks.deletePlaybackId.mockRejectedValue({
      status: 404,
    });

    await expect(
      reconcileMuxPlayback("reconciliation-1"),
    ).resolves.toEqual({
      outcome: "SUCCEEDED",
    });
  });

  it("durably marks provider failures FAILED with exponential backoff", async () => {
    prepareSuccessfulClaim();

    const providerError = new Error(
      "Mux timed out",
    );
    providerError.name = "TimeoutError";

    mocks.retrieveAsset.mockRejectedValue(
      providerError,
    );

    mocks.reconciliationUpdateMany.mockResolvedValueOnce({
      count: 1,
    });

    const result = await reconcileMuxPlayback(
      "reconciliation-1",
    );

    expect(result).toEqual({
      outcome: "FAILED",
    });

    const failure =
      mocks.reconciliationUpdateMany.mock.calls[1][0];

    expect(failure.where).toEqual({
      id: "reconciliation-1",
      intentGeneration: 7,
      leaseToken: "lease-test",
      status: "PROCESSING",
    });

    expect(failure.data).toEqual(
      expect.objectContaining({
        status: "FAILED",
        leaseToken: null,
        leaseExpiresAt: null,
        lastErrorCode: "MUX_TIMEOUTERROR",
        nextAttemptAt: new Date(
          NOW.getTime() + 30_000,
        ),
      }),
    );
  });

  it("returns SKIPPED when a failed stale worker can no longer persist failure state", async () => {
    prepareSuccessfulClaim();

    mocks.retrieveAsset.mockRejectedValue(
      new Error("provider failure"),
    );

    mocks.reconciliationUpdateMany.mockResolvedValueOnce({
      count: 0,
    });

    await expect(
      reconcileMuxPlayback("reconciliation-1"),
    ).resolves.toEqual({
      outcome: "SKIPPED",
    });
  });

  it("requeues ENABLED intent as REVOKED when public eligibility is withdrawn", async () => {
    const baseVideo =
      makeClaimedRecord().introVideo;

    prepareSuccessfulClaim({
      introVideo: {
        ...baseVideo,
        status: "REJECTED",
      },
    });

    mocks.reconciliationUpdateMany.mockResolvedValueOnce({
      count: 1,
    });

    const result = await reconcileMuxPlayback(
      "reconciliation-1",
    );

    expect(result).toEqual({
      outcome: "REQUEUED",
    });

    const requeue =
      mocks.reconciliationUpdateMany.mock.calls[1][0];

    expect(requeue.where).toEqual({
      id: "reconciliation-1",
      intentGeneration: 7,
      leaseToken: "lease-test",
    });

    expect(requeue.data).toEqual(
      expect.objectContaining({
        desiredState: "REVOKED",
        intentGeneration: {
          increment: 1,
        },
        status: "PENDING",
        leaseToken: null,
        leaseExpiresAt: null,
        lastErrorCode:
          "PUBLIC_ELIGIBILITY_WITHDRAWN",
      }),
    );

    expect(
      mocks.retrieveAsset,
    ).not.toHaveBeenCalled();

    expect(
      mocks.deletePlaybackId,
    ).not.toHaveBeenCalled();
  });

  it("reports truthful succeeded, failed, requeued, and skipped processor counts", async () => {
    mocks.reconciliationFindMany.mockResolvedValue([
      { id: "skip" },
      { id: "requeue" },
      { id: "success" },
      { id: "fail" },
    ]);

    const ineligibleVideo = {
      ...makeClaimedRecord().introVideo,
      status: "REJECTED",
    };

    mocks.reconciliationFindUnique
      .mockResolvedValueOnce({
        intentGeneration: 1,
        nextAttemptAt: new Date(
          NOW.getTime() + 60_000,
        ),
      })

      .mockResolvedValueOnce({
        intentGeneration: 2,
        nextAttemptAt: new Date(
          NOW.getTime() - 1_000,
        ),
      })
      .mockResolvedValueOnce(
        makeClaimedRecord({
          id: "requeue",
          intentGeneration: 2,
          introVideo: ineligibleVideo,
        }),
      )

      .mockResolvedValueOnce({
        intentGeneration: 3,
        nextAttemptAt: new Date(
          NOW.getTime() - 1_000,
        ),
      })
      .mockResolvedValueOnce(
        makeClaimedRecord({
          id: "success",
          intentGeneration: 3,
          playbackId: "public-existing",
        }),
      )

      .mockResolvedValueOnce({
        intentGeneration: 4,
        nextAttemptAt: new Date(
          NOW.getTime() - 1_000,
        ),
      })
      .mockResolvedValueOnce(
        makeClaimedRecord({
          id: "fail",
          intentGeneration: 4,
        }),
      );

    mocks.reconciliationUpdateMany
      // requeue claim
      .mockResolvedValueOnce({
        count: 1,
      })
      // eligibility withdrawal
      .mockResolvedValueOnce({
        count: 1,
      })
      // success claim
      .mockResolvedValueOnce({
        count: 1,
      })
      // fail claim
      .mockResolvedValueOnce({
        count: 1,
      })
      // durable failure
      .mockResolvedValueOnce({
        count: 1,
      });

    const providerError = new Error(
      "provider unavailable",
    );

    mocks.retrieveAsset
      .mockResolvedValueOnce({
        playback_ids: [
          {
            id: "public-existing",
            policy: "public",
          },
        ],
      })
      .mockRejectedValueOnce(
        providerError,
      );

    const counts =
      await processDueMuxPlaybackReconciliations(
        20,
      );

    expect(counts).toEqual({
      selected: 4,
      succeeded: 1,
      failed: 1,
      requeued: 1,
      skipped: 1,
    });

    expect(
      mocks.reconciliationFindMany,
    ).toHaveBeenCalledWith({
      where: {
        nextAttemptAt: {
          lte: NOW,
        },
        status: {
          in: [
            "PENDING",
            "FAILED",
            "PROCESSING",
            "SUCCEEDED",
          ],
        },
        OR: [
          {
            leaseToken: null,
          },
          {
            leaseExpiresAt: null,
          },
          {
            leaseExpiresAt: {
              lte: NOW,
            },
          },
        ],
      },

      orderBy: [
        {
          nextAttemptAt: "asc",
        },
        {
          id: "asc",
        },
      ],

      take: 20,

      select: {
        id: true,
      },
    });
  });
});
