import { NextResponse } from "next/server";
import { getSession, isAuthRequired } from "@/lib/auth";
import { COMPANY_COOKIE } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (isAuthRequired()) {
    const session = await getSession();
    const response = NextResponse.redirect(new URL(session ? "/dashboard" : "/login", request.url));
    response.cookies.set(COMPANY_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  const formData = await request.formData();
  const companyId = String(formData.get("companyId") ?? "").trim();
  if (!companyId) return NextResponse.redirect(new URL("/select-company", request.url));

  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set(COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return response;
}
