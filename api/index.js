export const config = { runtime: "edge" };

const TARGET_BASE = process.env.TARGET_DOMAIN?.replace(/\/$/, "");

const STRIP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function handler(req) {
  if (!TARGET_BASE) {
    return new Response("Server misconfigured", { status: 500 });
  }

  try {
    const url = new URL(req.url);

    const targetUrl = TARGET_BASE + url.pathname + url.search;

    const headers = new Headers();

    let clientIp;

    for (const [key, value] of req.headers.entries()) {
      const k = key.toLowerCase();

      if (STRIP_HEADERS.has(k)) continue;
      if (k.startsWith("x-vercel-")) continue;

      if (k === "x-real-ip") {
        clientIp = value;
        continue;
      }

      if (k === "x-forwarded-for") {
        clientIp ||= value;
        continue;
      }

      headers.set(k, value);
    }

    if (clientIp) {
      headers.set("x-forwarded-for", clientIp);
    }

    const method = req.method;
    const bodyAllowed = !["GET", "HEAD"].includes(method);

    const response = await fetch(targetUrl, {
      method,
      headers,
      body: bodyAllowed ? req.body : undefined,
      redirect: "manual",
    });

    // Optional: clone response for safety in edge runtime
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });

  } catch (error) {
    console.error("Proxy error:", error);

    return new Response("Bad Gateway", {
      status: 502,
    });
  }
}
