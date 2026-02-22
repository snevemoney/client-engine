import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare, hash } from "bcryptjs";
import { db } from "./db";

const authSecret = process.env.AUTH_SECRET || (process.env.NODE_ENV === "production" ? undefined : "dev-secret-change-in-production");
if (!authSecret && process.env.NODE_ENV === "production") {
  console.warn("[auth] AUTH_SECRET is not set in production");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);

        const devPassword = process.env.AUTH_DEV_PASSWORD;
        if (devPassword && process.env.NODE_ENV === "development" && password === devPassword) {
          return { id: "dev-admin", email, name: "Dev Admin" };
        }
        if (devPassword && process.env.NODE_ENV !== "development" && !process.env.E2E_ALLOW_DEV_PASSWORD) {
          console.warn("AUTH_DEV_PASSWORD is set but ignored because NODE_ENV is not 'development'");
        }

        // Production e2e: allow AUTH_DEV_PASSWORD for E2E_EMAIL when E2E_ALLOW_DEV_PASSWORD is set (so Playwright can log in without relying on DB password match).
        const e2eAllow = process.env.E2E_ALLOW_DEV_PASSWORD;
        const e2eEmail = process.env.E2E_EMAIL?.trim().toLowerCase();
        if (
          process.env.NODE_ENV === "production" &&
          e2eAllow &&
          e2eEmail &&
          devPassword &&
          String(password).replace(/\s/g, "").trim() === String(devPassword).replace(/\s/g, "").trim()
        ) {
          // Log in as E2E_EMAIL (ignore client email to avoid encoding/case issues)
          let user = await db.user.findFirst({
            where: { email: { equals: e2eEmail, mode: "insensitive" } },
          });
          if (!user) {
            const hashed = await hash(devPassword, 12);
            user = await db.user.create({
              data: { email: e2eEmail, password: hashed, name: "E2E" },
            });
          }
          return { id: user.id, email: user.email, name: user.name ?? "E2E" };
        }

        const user = await db.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });
        if (!user) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[auth] Login failed: no user for email", email);
          }
          return null;
        }

        const valid = await compare(password, user.password);
        if (!valid) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[auth] Login failed: wrong password for", email);
          }
          return null;
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
