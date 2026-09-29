import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth";
import { callStore } from "@/lib/store";

/* Theme defaults every logged-in user may read. */
export const GET = guarded(async () => {
  const { settings } = await callStore<{ settings: Record<string, string> }>("getSettings");
  return NextResponse.json({ defaultPalette: settings.defaultPalette ?? "aurora", defaultMode: settings.defaultMode ?? "light" });
});
