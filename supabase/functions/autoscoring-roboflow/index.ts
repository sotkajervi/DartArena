import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

// DartArena Autoscoring Lab only. All Roboflow credentials stay in Supabase secrets.
const MODEL_ID = "dart-tip-detection-6d3mw/17";
const API_HOST = "https://serverless.roboflow.com";
const MAX_B64_LENGTH = 800000;
const MAX_BODY_LENGTH = 840000;
const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Cache-Control": "no-store"
};

function respond(status: number, data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {status, headers});
}

type RoboflowKeypoint = {x?: number; y?: number; confidence?: number; class_name?: string; class?: string;};
type RoboflowDetection = {x?: number; y?: number; confidence?: number; class?: string; keypoints?: RoboflowKeypoint[];};

function normalizedDetections(input: unknown) {
  if (!input || typeof input !== "object") return [];
  const raw = input as {predictions?: RoboflowDetection[]};
  if (!Array.isArray(raw.predictions)) return [];
  const result: {x: number; y: number; confidence: number; className: string}[] = [];
  for (const detection of raw.predictions.slice(0, 80)) {
    if (!detection || typeof detection !== "object") continue;
    const points = Array.isArray(detection.keypoints) ? detection.keypoints : [];
    // The model is a pose detector: never pretend the box center is a tip.
    const preferred = points.find(p => Number.isFinite(p?.x) && Number.isFinite(p?.y)
      && /tip/i.test(String(p.class_name ?? p.class ?? "")) && Number(p.confidence ?? 1) > .05)
      || points.find(p => Number.isFinite(p?.x) && Number.isFinite(p?.y) && Number(p.confidence ?? 1) > .05);
    if (!preferred) continue;
    const confidence = Number(preferred.confidence ?? detection.confidence ?? 0);
    if (!Number.isFinite(confidence) || confidence < .05) continue;
    result.push({
      x: Number(preferred.x), y: Number(preferred.y),
      confidence: Math.max(0, Math.min(1, confidence)),
      className: String(detection.class || "dart_tip").slice(0,64)
    });
  }
  return result.slice(0, 40);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, {status: 204, headers});
  if (req.method !== "POST" && req.method !== "GET")
    return respond(405, {error: "method_not_allowed"});

  const authorization = req.headers.get("authorization") || "";
  const jwt = /^Bearer\s+([^\s]+)$/i.exec(authorization)?.[1];
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY")
    || JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}").default;
  if (!jwt || !url || !anon) return respond(401, {error: "unauthorized"});

  try {
    const db = createClient(url, anon, {
      global: {headers: {Authorization: authorization}},
      auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false}
    });
    // The JWT is validated by Supabase gateway and again by Auth here.
    const {data: userData, error: userError} = await db.auth.getUser(jwt);
    if (userError || !userData.user) return respond(401, {error: "unauthorized"});
    // Do not trust client-side menu or frontend role checks.
    const {data: admin, error: roleError} = await db.rpc("is_admin");
    if (roleError || admin !== true) return respond(403, {error: "forbidden"});

    const apiKey = Deno.env.get("ROBOFLOW_API_KEY")?.trim();
    if (req.method === "GET") return respond(200, {
      configured: Boolean(apiKey), model: MODEL_ID, maxRequestsPerUserPerDay: 25,
      note: "Camera frames are sent to Roboflow only after explicit consent and a test-button click."
    });
    if (!apiKey) return respond(503, {error: "roboflow_key_not_configured"});

    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > MAX_BODY_LENGTH) return respond(413, {error: "image_too_large"});
    const raw = await req.text();
    if (raw.length > MAX_BODY_LENGTH) return respond(413, {error: "image_too_large"});
    let params: {image?: unknown};
    try { params = JSON.parse(raw); }
    catch { return respond(400, {error: "invalid_json"}); }
    const image = params?.image;
    if (typeof image !== "string" || image.length < 100 || image.length > MAX_B64_LENGTH
        || !/^[a-zA-Z0-9+/]+={0,2}$/.test(image))
      return respond(400, {error: "invalid_image"});
    const head = atob(image.slice(0, 24));
    if (head.charCodeAt(0) !== 255 || head.charCodeAt(1) !== 216 || head.charCodeAt(2) !== 255)
      return respond(400, {error: "jpeg_required"});

    // The quota is checked atomically in Postgres before any billable API call.
    const quota = await db.rpc("autoscoring_roboflow_consume_quota");
    if (quota.error) return respond(503, {error: "quota_check_unavailable"});
    if (quota.data !== true) return respond(429, {error: "daily_test_limit"});

    let remote: Response;
    try {
      const uri = API_HOST + "/" + MODEL_ID + "?api_key=" + encodeURIComponent(apiKey);
      remote = await fetch(uri, {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: image,
        signal: AbortSignal.timeout(20000)
      });
    } catch {
      return respond(502, {error: "roboflow_connection_failed"});
    }
    if (!remote.ok) return respond(502, {
      error: remote.status === 401 || remote.status === 403 ? "roboflow_credentials_or_access" : "roboflow_inference_failed",
      upstreamStatus: remote.status
    });
    let output: unknown;
    try { output = await remote.json(); }
    catch { return respond(502, {error: "invalid_provider_response"}); }
    const metadata = output && typeof output === "object" ? (output as {image?: {width?: number; height?: number}}).image : null;
    const width = Number(metadata?.width), height = Number(metadata?.height);
    return respond(200, {
      model: MODEL_ID, method: "roboflow-keypoint", detections: normalizedDetections(output),
      image: {
        width: Number.isFinite(width) && width > 0 ? width : null,
        height: Number.isFinite(height) && height > 0 ? height : null
      }
    });
  } catch {
    return respond(500, {error: "server_error"});
  }
});
