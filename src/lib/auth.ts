import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
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
        if (devPassword && process.env.NODE_ENV !== "development") {
          console.warn("AUTH_DEV_PASSWORD is set but ignored because NODE_ENV is not 'development'");
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
