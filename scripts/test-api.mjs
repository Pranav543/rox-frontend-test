#!/usr/bin/env node
/** Quick integration smoke test — run with dev server on BASE_URL */
const BASE = process.env.BASE_URL || "http://localhost:3000";

async function req(method, path, body) {
  const opts = { method, headers: {} };
  if (body && !(body instanceof FormData)) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  } else if (body) {
    opts.body = body;
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

let failed = 0;
function assert(name, cond) {
  if (!cond) {
    console.error("FAIL:", name);
    failed++;
  } else {
    console.log("ok:", name);
  }
}

const { status: m0, json: markers0 } = await req("GET", "/api/markers");
assert("GET markers", m0 === 200 && Array.isArray(markers0));

const { status: ep, json: episode } = await req("GET", "/api/episode");
assert("GET episode", ep === 200 && episode.url?.includes("podcast/"));
assert("episode exists", episode.exists === true);
assert("lists podcast folder", Array.isArray(episode.videos) && episode.videos.length >= 1);

const { status: adsStatus, json: ads } = await req("GET", "/api/ads");
assert("GET ads", adsStatus === 200 && ads.length >= 4);
assert("ads use ads/ path", ads[0]?.filename?.startsWith("ads/"));

const { status: mediaStatus } = await req("GET", "/api/media/podcast/main-video.mp4");
assert("GET podcast media", mediaStatus === 200);

const { status: perfStatus, json: perf } = await req("GET", "/api/ad-performance");
assert("GET ad-performance", perfStatus === 200 && perf["ad-4"]?.ctr > 0);

const { status: create, json: created } = await req("POST", "/api/markers", {
  startTime: 10,
  mode: "static",
  adIds: ["ad-1"],
});
assert("POST marker", create === 201 && created.id);

const { status: upd } = await req("PUT", `/api/markers/${created.id}`, {
  startTime: 20,
  mode: "ab",
  adIds: ["ad-1", "ad-2", "ad-3", "ad-4"],
});
assert("PUT marker", upd === 200);

const { status: del } = await req("DELETE", `/api/markers/${created.id}`);
assert("DELETE marker", del === 200);

const { status: home } = await req("GET", "/");
assert("GET page", home === 200);

console.log(failed ? `\n${failed} failed` : "\nAll API checks passed");
process.exit(failed ? 1 : 0);
