import { PrismaClient } from "@prisma/client";
import { logSlow, PERF } from "@/lib/perf";

const SLOW_DB_MS = PERF.SLOW_DB_MS;

const base = new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["query"] : [] });
const extended = base.$extends({
  name: "perf",
  query: {
    $allOperations({ model, operation, args, query }) {
      const start = Date.now();
      return query(args).then((result) => {
        const ms = Date.now() - start;
        if (ms > SLOW_DB_MS) {
          const name = model ? `${model}.${operation}` : operation;
          logSlow("db", name, ms);
        }
        return result;
      });
    },
  },
});

type ExtendedPrisma = typeof extended;
const globalForPrisma = globalThis as unknown as { prisma: ExtendedPrisma };

export const db = globalForPrisma.prisma ?? extended;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
