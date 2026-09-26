import {
  Prisma,
} from "@/lib/generated/prisma/client";

export function makePrismaKnownRequestError(
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError {
  const error = Object.create(
    Prisma.PrismaClientKnownRequestError.prototype,
  ) as Prisma.PrismaClientKnownRequestError;

  Object.assign(error, {
    name: "PrismaClientKnownRequestError",
    message: "Synthetic Prisma request failure.",
    code,
    clientVersion: "test",
    meta,
  });

  return error;
}

export function makeUniqueConstraintError(
  constraint: string,
  modelName: string,
  target: string[],
): Prisma.PrismaClientKnownRequestError {
  return makePrismaKnownRequestError("P2002", {
    modelName,
    target,
    driverAdapterError: {
      cause: {
        originalCode: "23505",
        constraint,
      },
    },
  });
}
