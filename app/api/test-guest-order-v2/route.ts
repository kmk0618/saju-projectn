import { NextResponse } from "next/server";
function disabled() {
  return NextResponse.json({ ok: false, error: "TEST_ORDERS_DISABLED" }, { status: 404, headers: { "Cache-Control": "no-store" } });
}
export const POST = disabled;
export const GET = disabled;
