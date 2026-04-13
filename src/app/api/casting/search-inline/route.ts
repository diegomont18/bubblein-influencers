import { notifyError } from "@/lib/error-notifier";
// This route runs the casting search inline (for local dev where Netlify functions aren't available)
// It imports the same logic as the background function

export const maxDuration = 300; // 5 minutes timeout

export async function POST(request: Request) {
  // Dynamically import to avoid loading the heavy module on every request
  const { handler } = await import("../../../../../netlify/functions/casting-search-background");

  const body = await request.text();

  // Simulate the Netlify function handler
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
    console.error("[casting-inline] Error:", err);
    notifyError("casting-search-inline", err);
    return new Response(JSON.stringify({ error: "Inline search failed" }), { status: 500 });
  }
}
