import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
];

export async function proxy(request: NextRequest) {
  // Auth/session handling for private routes.
  const response = await updateSession(request);

  // Persist UTM params for the whole session (public funnel entry).
  const params = request.nextUrl.searchParams;
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value) {
      response.cookies.set(key, value, {
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
        sameSite: "lax",
      });
    }
  }

  // Stable anonymous session id for lead tracking.
  if (!request.cookies.get("pl_sid")) {
    response.cookies.set("pl_sid", crypto.randomUUID(), {
      maxAge: 60 * 60 * 24 * 180,
      path: "/",
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
