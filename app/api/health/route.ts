export async function GET() {
  return Response.json({
    ok: true,
    service: "my-saju",
    timestamp: new Date().toISOString(),
  });
}
