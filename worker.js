const UPSTREAM_ORIGIN = "https://jeloura.hatchable.site";

const ADMIN_FILES = new Set([
  "/admin",
  "/admin/",
  "/admin-login",
  "/admin-login.htm",
  "/admin-login.html",
  "/admin-setup",
  "/admin-setup.html",
  "/admin.html",
  "/admin.js",
  "/admin-auth.js",
  "/admin-image-upload.js",
  "/admin-style.css",
  "/__hatchable/config.js",
  "/__hatchable/badge.js",
]);

function isAdminProxyPath(pathname) {
  return ADMIN_FILES.has(pathname) ||
    pathname === "/api/admin" ||
    pathname.startsWith("/api/admin/");
}

function upstreamPath(pathname) {
  if (pathname === "/admin" || pathname === "/admin/" ||
      pathname === "/admin-login" || pathname === "/admin-login.htm") {
    return "/admin-login.html";
  }
  if (pathname === "/admin-setup") return "/admin-setup.html";
  if (pathname === "/admin-style.css") return "/style.css";
  return pathname;
}

function removeCookieDomain(cookie) {
  return cookie
    .split(";")
    .filter((part, index) => index === 0 || !part.trim().toLowerCase().startsWith("domain="))
    .join(";");
}

function forbidden() {
  return new Response(JSON.stringify({ error: "Forbidden" }), {
    status: 403,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function proxyAdmin(request) {
  const incomingUrl = new URL(request.url);
  const path = incomingUrl.pathname;

  // Admin API calls are same-origin only. This preserves the API's Origin
  // protection while keeping the browser on the Workers hostname.
  if (path === "/api/admin" || path.startsWith("/api/admin/")) {
    const origin = request.headers.get("Origin");
    if (origin) {
      try {
        if (new URL(origin).origin !== incomingUrl.origin) return forbidden();
      } catch {
        return forbidden();
      }
    }
  }

  const targetUrl = new URL(UPSTREAM_ORIGIN);
  targetUrl.pathname = upstreamPath(path);
  targetUrl.search = incomingUrl.search;

  try {
    const initialRequest = new Request(targetUrl.toString(), request);
    const requestHeaders = new Headers(initialRequest.headers);
    requestHeaders.set("X-Forwarded-Host", incomingUrl.host);
    requestHeaders.set("X-Forwarded-Proto", incomingUrl.protocol.slice(0, -1));

    const upstreamRequest = new Request(initialRequest, {
      headers: requestHeaders,
      redirect: "manual",
    });

    const upstreamResponse = await fetch(upstreamRequest);
    const responseHeaders = new Headers(upstreamResponse.headers);

    // Never redirect the browser from Workers back to the Hatchable hostname.
    const location = responseHeaders.get("Location");
    if (location) {
      try {
        const destination = new URL(location, UPSTREAM_ORIGIN);
        if (destination.origin === UPSTREAM_ORIGIN) {
          responseHeaders.set(
            "Location",
            new URL(
              destination.pathname + destination.search + destination.hash,
              incomingUrl.origin
            ).toString()
          );
        }
      } catch {
        // Leave non-URL Location values unchanged.
      }
    }

    // Admin sessions remain host-only on jeloura.beauty1.workers.dev.
    const cookies = typeof upstreamResponse.headers.getSetCookie === "function"
      ? upstreamResponse.headers.getSetCookie()
      : [];
    if (cookies.length) {
      responseHeaders.delete("Set-Cookie");
      for (const cookie of cookies) {
        responseHeaders.append("Set-Cookie", removeCookieDomain(cookie));
      }
    } else {
      const cookie = responseHeaders.get("Set-Cookie");
      if (cookie) responseHeaders.set("Set-Cookie", removeCookieDomain(cookie));
    }

    let body = upstreamResponse.body;
    const contentType = responseHeaders.get("Content-Type") || "";

    // The Hatchable runtime injects its own origin into HTML. Repoint that
    // metadata to the public Workers origin and give the admin its own CSS path.
    if (contentType.includes("text/html")) {
      const html = await upstreamResponse.text();
      body = html
        .split(UPSTREAM_ORIGIN).join(incomingUrl.origin)
        .split('href="/style.css?').join('href="/admin-style.css?')
        .split('href="/style.css"').join('href="/admin-style.css"');
      responseHeaders.delete("Content-Length");
      responseHeaders.delete("Content-Encoding");
      responseHeaders.delete("ETag");
      responseHeaders.delete("Last-Modified");
    } else if (path === "/__hatchable/config.js" &&
               contentType.includes("javascript")) {
      const source = await upstreamResponse.text();
      body = source.split(UPSTREAM_ORIGIN).join(incomingUrl.origin);
      responseHeaders.delete("Content-Length");
      responseHeaders.delete("Content-Encoding");
      responseHeaders.delete("ETag");
      responseHeaders.delete("Last-Modified");
    }

    responseHeaders.set("Cache-Control", "private, no-store, max-age=0");
    responseHeaders.set("Pragma", "no-cache");
    responseHeaders.set("X-Robots-Tag", "noindex, nofollow");
    responseHeaders.set("X-Content-Type-Options", "nosniff");

    return new Response(body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch {
    return new Response("Jeloura admin service is temporarily unavailable.", {
      status: 502,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (isAdminProxyPath(url.pathname)) {
      return proxyAdmin(request);
    }
    return env.ASSETS.fetch(request);
  },
};
