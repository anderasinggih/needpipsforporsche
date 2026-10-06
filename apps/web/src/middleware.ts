import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Whitelist public assets, static files, login page, and direct /owner/key
  // User explicitly instructed: "untuk url yg owner/key gausah pake halaman admin yaa"
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/public") ||
    pathname === "/login" ||
    pathname.startsWith("/owner/key") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/users") || // accessible from /owner/key
    pathname.startsWith("/api/vault")    // accessible from /owner/key
  ) {
    return NextResponse.next();
  }

  // 2. Check session token in cookie (simple fast payload verification for edge runtime)
  const token = req.cookies.get("npfp_session")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Validate format and expiry of JWT
  try {
    const [data] = token.split(".");
    if (!data) throw new Error("No data");
    const jsonStr = atob(data.replace(/-/g, "+").replace(/_/g, "/"));
    const payload = JSON.parse(jsonStr);
    if (!payload.exp || Date.now() > payload.exp) {
      throw new Error("Expired");
    }

    const response = NextResponse.next();
    response.headers.set("x-user-name", payload.username || "user");
    response.headers.set("x-user-role", payload.role || "member");
    return response;
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized. Token tidak valid atau kadaluarsa." },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
