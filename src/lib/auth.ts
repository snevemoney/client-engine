import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { compare, hash } from "bcryptjs";
import { db } from "./db";

const authSecret = process.env.AUTH_SECRET || (process.env.NODE_ENV === "production" ? undefined : "dev-secret-change-in-production");
if (!authSecret && process.env.NODE_ENV === "production") {
  console.warn("[auth] AUTH_SECRET is not set in production");
}

const googleClientId = process.env.GOOGLE_CLIENT_ID || process.env.AUTH_GOOGLE_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.AUTH_GOOGLE_SECRET;
const hasGoogleOAuth = !!(googleClientId && googleClientSecret);

const oauthSimulation = process.env.OAUTH_SIMULATION === "1";

function buildAuthorizeCredentials() {
  return async function authorize(
    credentials: Partial<Record<"email" | "password", unknown>> | undefined
  ): Promise<{ id: string; email: string; name: string | null } | null> {
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
      return { id: user.id, email: user.email, name: user.name };
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
  };
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
      authorize: buildAuthorizeCredentials(),
    }),
    ...(hasGoogleOAuth
      ? [
          Google({
            clientId: googleClientId!,
            clientSecret: googleClientSecret!,
          }),
        ]
      : []),
    ...(oauthSimulation
      ? [
          Credentials({
            id: "google-simulation",
            name: "Simulate Google (dev)",
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            authorize: buildAuthorizeCredentials(),
          }),
        ]
      : []),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        // OAuth: ensure we have a User record and use our DB id
        if (account?.provider === "google" && user.email) {
          const existing = await db.user.findFirst({
            where: { email: { equals: user.email, mode: "insensitive" } },
          });
          if (existing) {
            token.id = existing.id;
          } else {
            const placeholderHash = await hash("oauth-no-password-" + user.id, 12);
            const created = await db.user.create({
              data: {
                email: user.email,
                password: placeholderHash,
                name: user.name ?? user.email.split("@")[0],
              },
            });
            token.id = created.id;
          }
        }
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
