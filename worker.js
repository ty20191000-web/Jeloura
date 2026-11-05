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

    // A proxied response must never send the visitor to the Hatchable host.
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

    // The session cookie is host-only (no Domain attribute), so the browser
    // stores it for jeloura.beauty1.workers.dev rather than Hatchable.
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

    // The storefront's /style.css is different from the admin stylesheet.
    // Serve the latter through its own same-origin proxy path.
    if (path === "/admin.html" &&
        (responseHeaders.get("Content-Type") || "").includes("text/html")) {
      const html = await upstreamResponse.text();
      body = html
        .split('href="/style.css"').join('href="/admin-style.css"')
        .split("href='/style.css'").join("href='/admin-style.css'");
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
