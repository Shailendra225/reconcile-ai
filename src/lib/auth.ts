import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { db } from "@/lib/db";

export const auth = betterAuth({
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await db.business.create({
            data: {
              name: `${user.name}'s Business`,
              email: user.email,
              ownerId: user.id,
            },
          });
        },
      },
    },
  },
});