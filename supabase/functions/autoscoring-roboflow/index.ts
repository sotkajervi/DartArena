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

// Only counts and validated coordinates leave this function. Never forward
// provider's raw response, model metadata, or image data to the browser.
function normalizedDetections(input: unknown) {
  const raw = input && typeof input === "object" ? input as {predictions?: RoboflowDetection[]} : null;
  const predictions = Array.isArray(raw?.predictions) ? raw.predictions.slice(0, 80) : [];
  const diagnostics = {
    responseFormat: Array.isArray(raw?.predictions) ? "predictions" : "unexpected",
    providerPredictions: predictions.length,
    predictionsWithKeypoints: 0,
    keypointsReceived: 0,
    validKeypoints: 0,
    missingOrLowConfidence: 0
  };
  const detections: {x: number; y: number; confidence: number; className: string}[] = [];
  for (const detection of predictions) {
    if (!detection || typeof detection !== "object") continue;
    const points = Array.isArray(detection.keypoints) ? detection.keypoints : [];
    if(points.length) diagnostics.predictionsWithKeypoints++;
    diagnostics.keypointsReceived += points.length;
    const valid = points.filter(p => {
      const xy = typeof p?.x === "number" && typeof p?.y === "number" &&
        Number.isFinite(p.x) && Number.isFinite(p.y) && p.x > 0 && p.y > 0;
      const score = Number(p?.confidence ?? detection.confidence ?? 0);
      return xy && Number.isFinite(score) && score >= .05;
    });
    diagnostics.validKeypoints += valid.length;
    diagnostics.missingOrLowConfidence += points.length - valid.length;
    // A pose model returns a bounding box AND separately a keypoint.
    // Never treat the bounding-box center as a dartboard tip.
    const preferred = valid.find(p => /tip/i.test(String(p.class_name ?? p.class ?? ""))) || valid[0];
    if (!preferred) continue;
    const confidence = Number(preferred.confidence ?? detection.confidence ?? 0);
    detections.push({
      x: Number(preferred.x), y: Number(preferred.y),
      confidence: Math.max(0, Math.min(1, confidence)),
      className: String(detection.class || "dart_tip").slice(0, 64)
    });
  }
  return {detections: detections.slice(0, 40), diagnostics};
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
    // Roboflow publishable keys start with rf_ and do not authenticate the hosted REST inference API.
    // Return only a key-category flag, never the key or even a fragment of it.
    const publicKeyDetected = Boolean(apiKey && /^rf_/i.test(apiKey));
    if (req.method === "GET") return respond(200, {
      configured: Boolean(apiKey), model: MODEL_ID, maxRequestsPerUserPerDay: 25,
      keyType: !apiKey ? "missing" : publicKeyDetected ? "publishable" : "private-unverified",
      note: "Configured does not mean the key was authenticated by Roboflow."
    });
    if (!apiKey) return respond(503, {error: "roboflow_key_not_configured"});
    if (publicKeyDetected) return respond(400, {error: "roboflow_public_key"});

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
      // Roboflow defaults to a 40% object threshold. Use 15% only in this
      // isolated, manually verified experimental view to inspect weak detections.
      const uri = API_HOST + "/" + MODEL_ID + "?api_key=" + encodeURIComponent(apiKey) + "&confidence=15";
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
      error: remote.status === 401 ? "roboflow_unauthorized" :
        remote.status === 403 ? "roboflow_forbidden" :
        remote.status === 404 ? "roboflow_model_missing" :
        remote.status === 402 || remote.status === 429 ? "roboflow_billing_or_limit" :
        "roboflow_inference_failed",
      upstreamStatus: remote.status
    });
    let output: unknown;
    try { output = await remote.json(); }
    catch { return respond(502, {error: "invalid_provider_response"}); }
    const metadata = output && typeof output === "object" ? (output as {image?: {width?: number; height?: number}}).image : null;
    const width = Number(metadata?.width), height = Number(metadata?.height);
    const analyzed = normalizedDetections(output);
    return respond(200, {
      model: MODEL_ID, method: "roboflow-keypoint",
      detections: analyzed.detections,
      diagnostics: {...analyzed.diagnostics, queryConfidence: 15},
      image: {
        width: Number.isFinite(width) && width > 0 ? width : null,
        height: Number.isFinite(height) && height > 0 ? height : null
      }
    });
  } catch {
    return respond(500, {error: "server_error"});
  }
});
