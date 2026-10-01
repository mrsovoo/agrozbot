import { cookies } from "next/headers";
import { createHash } from "crypto";

const COOKIE_NAME = "admin_session";

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || "admin123";
}

function tokenFor(password: string): string {
  return createHash("sha256")
    .update(`arena-agro-admin::${password}`)
    .digest("hex");
}

export function expectedToken(): string {
  return tokenFor(getAdminPassword());
}

export async function isAuthed(): Promise<boolean> {
  const store = await cookies();
  const val = store.get(COOKIE_NAME)?.value;
  return !!val && val === expectedToken();
}

export async function setSession() {
  const store = await cookies();
  store.set(COOKIE_NAME, expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export { COOKIE_NAME };
