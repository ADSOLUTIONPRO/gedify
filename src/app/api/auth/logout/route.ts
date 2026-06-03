import { NextResponse } from "next/server";
import { clearCookieOpts } from "@/lib/auth/session";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearCookieOpts());
  return res;
}
