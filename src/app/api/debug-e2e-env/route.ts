import { NextResponse } from "next/server";

/** Temporary: verify e2e env on prod without exposing secrets. Remove after fixing e2e login. */
export async function GET() {
  const e2eAllow = process.env.E2E_ALLOW_DEV_PASSWORD;
  const e2eEmail = process.env.E2E_EMAIL?.trim().toLowerCase();
  const devPassword = process.env.AUTH_DEV_PASSWORD;
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    e2eAllow: !!e2eAllow,
    e2eEmailSet: !!e2eEmail,
    e2eEmailLength: e2eEmail?.length ?? 0,
    authDevSet: !!devPassword,
    authDevLength: devPassword?.length ?? 0,
  });
}
