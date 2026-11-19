import "server-only";
import { PrismaClient } from "@prisma/client";

/** Un seul client Prisma par processus (le rechargement du développement en créerait un à chaque modification). */
const global = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = global.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") global.prisma = prisma;
