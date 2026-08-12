import {
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

const mocks =
  vi.hoisted(() => ({
    prisma: {
      $transaction:
        vi.fn(),
    },
  }));

vi.mock(
  "@/lib/db/prisma",
  () => ({
    prisma:
      mocks.prisma,
  }),
);

import {
  Prisma,
} from "@/lib/generated/prisma/client";
import {
  runSerializableTransaction,
} from "@/lib/services/serializable-transaction";

function makeKnownRequestError(
  code:
    string,
  meta?:
    Record<
      string,
      unknown
    >,
): unknown {
  /*
   * We intentionally construct an object with
   * Prisma's real error prototype.
   *
   * This keeps the production instanceof guard
   * under test without depending on the
   * constructor signature of generated Prisma
   * runtime internals.
   */
  const error =
    Object.create(
      Prisma
        .PrismaClientKnownRequestError
        .prototype,
    );

  Object.assign(
    error,
    {
      name:
        "PrismaClientKnownRequestError",

      message:
        "Synthetic Prisma request failure.",

      code,

      clientVersion:
        "test",

      meta,
    },
  );

  return error;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe(
  "runSerializableTransaction",
  () => {
    test(
    "retries PostgreSQL 40001 from Prisma driver-adapter metadata",
    async () => {
        const driverAdapterFailure = {
        name:
            "PrismaClientKnownRequestError",

        message:
            "Raw query failed. Code: `40001`.",

        code:
            "P2010",

        clientVersion:
            "test",

        meta: {
            driverAdapterError: {
            cause: {
                originalCode:
                "40001",

                originalMessage:
                "could not serialize access due to concurrent update",

                kind:
                "TransactionWriteConflict",
            },
            },
        },
        };

        mocks.prisma
        .$transaction
        .mockRejectedValueOnce(
            driverAdapterFailure,
        )
        .mockResolvedValueOnce(
            "committed",
        );

        const result =
        await runSerializableTransaction(
            async () =>
            "unused",
            {
            maxAttempts:
                2,
            },
        );

        expect(
        result,
        ).toBe(
        "committed",
        );

        expect(
        mocks.prisma
            .$transaction,
        ).toHaveBeenCalledTimes(
        2,
        );
    },
    );
    test(
    "retries a raw serialization failure from a different Prisma module graph",
    async () => {
            /*
            * Deliberately use a plain object rather
            * than the locally imported Prisma error
            * prototype.
            *
            * This simulates a genuine Prisma error
            * created by another isolated module
            * instance, where instanceof is false.
            */
            const crossModuleFailure = {
            name:
                "PrismaClientKnownRequestError",

            message:
                "Raw query failed. Code: `40001`.",

            code:
                "P2010",

            clientVersion:
                "test",

            meta: {
                code:
                "40001",

                message:
                "could not serialize access due to concurrent update",
            },
            };

            expect(
            crossModuleFailure instanceof
                Prisma.PrismaClientKnownRequestError,
            ).toBe(
            false,
            );

            mocks.prisma
            .$transaction
            .mockRejectedValueOnce(
                crossModuleFailure,
            )
            .mockResolvedValueOnce(
                "committed",
            );

            const result =
            await runSerializableTransaction(
                async () =>
                "unused",
                {
                maxAttempts:
                    2,
                },
            );

            expect(
            result,
            ).toBe(
            "committed",
            );

            expect(
            mocks.prisma
                .$transaction,
            ).toHaveBeenCalledTimes(
            2,
            );
        },
        );

    test(
      "retries Prisma P2034 conflicts",
      async () => {
        const conflict =
          makeKnownRequestError(
            "P2034",
          );

        mocks.prisma
          .$transaction
          .mockRejectedValueOnce(
            conflict,
          )
          .mockResolvedValueOnce(
            "committed",
          );

        const result =
          await runSerializableTransaction(
            async () =>
              "unused",
            {
              maxAttempts:
                2,
            },
          );

        expect(
          result,
        ).toBe(
          "committed",
        );

        expect(
          mocks.prisma
            .$transaction,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
    );

    test(
      "retries PostgreSQL 40001 surfaced through Prisma P2010",
      async () => {
        const serializationFailure =
          makeKnownRequestError(
            "P2010",
            {
              code:
                "40001",

              message:
                "could not serialize access due to concurrent update",
            },
          );

        mocks.prisma
          .$transaction
          .mockRejectedValueOnce(
            serializationFailure,
          )
          .mockResolvedValueOnce(
            "committed",
          );

        const result =
          await runSerializableTransaction(
            async () =>
              "unused",
            {
              maxAttempts:
                2,
            },
          );

        expect(
          result,
        ).toBe(
          "committed",
        );

        expect(
          mocks.prisma
            .$transaction,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
    );

    test(
      "retries PostgreSQL 40P01 surfaced through Prisma P2010",
      async () => {
        const deadlock =
          makeKnownRequestError(
            "P2010",
            {
              code:
                "40P01",

              message:
                "deadlock detected",
            },
          );

        mocks.prisma
          .$transaction
          .mockRejectedValueOnce(
            deadlock,
          )
          .mockResolvedValueOnce(
            "committed",
          );

        const result =
          await runSerializableTransaction(
            async () =>
              "unused",
            {
              maxAttempts:
                2,
            },
          );

        expect(
          result,
        ).toBe(
          "committed",
        );

        expect(
          mocks.prisma
            .$transaction,
        ).toHaveBeenCalledTimes(
          2,
        );
      },
    );

    test(
      "does not retry non-transactional raw PostgreSQL failures",
      async () => {
        const uniqueViolation =
          makeKnownRequestError(
            "P2010",
            {
              code:
                "23505",

              message:
                "duplicate key value violates unique constraint",
            },
          );

        mocks.prisma
          .$transaction
          .mockRejectedValue(
            uniqueViolation,
          );

        await expect(
          runSerializableTransaction(
            async () =>
              "unused",
            {
              maxAttempts:
                3,
            },
          ),
        ).rejects.toBe(
          uniqueViolation,
        );

        expect(
          mocks.prisma
            .$transaction,
        ).toHaveBeenCalledTimes(
          1,
        );
      },
    );

    test(
      "maps an exhausted raw serialization failure through conflictErrorFactory",
      async () => {
        const serializationFailure =
          makeKnownRequestError(
            "P2010",
            {
              code:
                "40001",
            },
          );

        const domainConflict =
          new Error(
            "Domain transaction conflict",
          );

        mocks.prisma
          .$transaction
          .mockRejectedValue(
            serializationFailure,
          );

        await expect(
          runSerializableTransaction(
            async () =>
              "unused",
            {
              maxAttempts:
                3,

              conflictErrorFactory:
                () =>
                  domainConflict,
            },
          ),
        ).rejects.toBe(
          domainConflict,
        );

        expect(
          mocks.prisma
            .$transaction,
        ).toHaveBeenCalledTimes(
          3,
        );
      },
    );

    test(
      "rejects invalid retry configuration before opening a transaction",
      async () => {
        await expect(
          runSerializableTransaction(
            async () =>
              "unused",
            {
              maxAttempts:
                0,
            },
          ),
        ).rejects.toThrow(
          "maxAttempts must be an integer between 1 and 5.",
        );

        expect(
          mocks.prisma
            .$transaction,
        ).not.toHaveBeenCalled();
      },
    );
  },
);
