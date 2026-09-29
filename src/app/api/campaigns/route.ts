import { NextResponse } from "next/server";
import { guarded } from "@/lib/auth";
import { callStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/* All campaigns (active and paused) for any signed-in user; pages filter as needed. */
export const GET = guarded(async () => NextResponse.json(await callStore("listCampaigns")));
