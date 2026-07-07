// 슈피겐코리아 면접관 핸드북 — Anthropic API 프록시 (Vercel Edge Function)
//
// Cloudflare Worker에서 겪었던 "가끔 막힌 지역으로 라우팅되는 문제"를 피하기 위해,
// 이 함수는 명시적으로 서울 리전(icn1)에 고정되어 실행됩니다.

export const config = {
  runtime: "edge",
  regions: ["icn1"], // 서울 리전에 고정 — 다른 지역으로 라우팅되지 않음
};

function corsHeaders(allowedOrigin) {
  return {
    "Access-Control-Allow-Origin": allowedOrigin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default async function handler(request) {
  const allowedOrigin = process.env.ALLOWED_ORIGIN || "";

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(allowedOrigin) });
  }

  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders(allowedOrigin),
    });
  }

  const origin = request.headers.get("origin") || "";
  const allowed = allowedOrigin.trim().replace(/\/$/, "");
  if (allowed && origin.replace(/\/$/, "") !== allowed) {
    return new Response(
      "Forbidden origin. received=[" + origin + "] expected=[" + allowed + "]",
      { status: 403, headers: corsHeaders(allowedOrigin) }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response("Invalid JSON body", {
      status: 400,
      headers: corsHeaders(allowedOrigin),
    });
  }

  const payload = {
    model: "claude-sonnet-5",
    max_tokens: 1000,
    system: body.system || "",
    messages: Array.isArray(body.messages) ? body.messages : [],
  };

  const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(payload),
  });

  const data = await anthropicRes.text();
  return new Response(data, {
    status: anthropicRes.status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(allowedOrigin),
    },
  });
}
