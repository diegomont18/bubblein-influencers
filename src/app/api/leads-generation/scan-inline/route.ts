// Inline fallback for local dev (when Netlify functions aren't available)
export const maxDuration = 300;

export async function POST(request: Request) {
  const { handler } = await import("../../../../../netlify/functions/lg-scan-background");

  const body = await request.text();
  const event = {
    body,
    headers: {},
    httpMethod: "POST",
    isBase64Encoded: false,
    path: "",
    queryStringParameters: {},
    multiValueQueryStringParameters: {},
    multiValueHeaders: {},
    pathParameters: {},
    stageVariables: {},
    requestContext: {} as never,
    resource: "",
  };

  try {
    const result = await handler(event as never, {} as never);
    return new Response(JSON.stringify(result), {
      status: result?.statusCode ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[lg-scan-inline] Error:", err);
    return new Response(JSON.stringify({ error: "Inline scan failed" }), { status: 500 });
  }
}
