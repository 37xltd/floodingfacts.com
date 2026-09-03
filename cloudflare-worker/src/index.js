import { sites } from "./sites.js";

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const response = (body, status = 200, headers = {}) =>
  new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "permissions-policy": "camera=(), microphone=(), geolocation=()",
      ...headers,
    },
  });

async function projectionState(env, site) {
  if (!env.PUBLIC_DATA || site.status !== "projection-pending")
    return { ready: false };
  const object = await env.PUBLIC_DATA.get(site.projection);
  if (!object) return { ready: false };
  try {
    const data = await object.json();
    return data?.publicationStatus === "approved" &&
      data?.publicProjection === true
      ? { ready: true, data }
      : { ready: false };
  } catch {
    return { ready: false };
  }
}

async function gzipJson(object) {
  if (!object) return null;
  const stream = object.body.pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).json();
}
function fnvShard(value, count) {
  let h = 2166136261;
  for (const b of new TextEncoder().encode(value))
    h = Math.imul(h ^ b, 16777619) >>> 0;
  return (h % count).toString(16).padStart(2, "0");
}

function shell(
  site,
  inner,
  {
    title = site.name,
    description = site.description,
    noindex = false,
    canonical = "/",
    report = false,
  } = {},
) {
  const productNav =
    site.name === "TenderTenderTender"
      ? '<a href="/opportunities">Opportunities</a><a href="/buyers">Buyers</a><a href="/categories">Categories</a>'
      : site.name === "Tide & Marine Conditions"
        ? '<a href="/#states">States</a><a href="/#stations">Stations</a><a href="/#how-it-works">How it works</a>'
        : site.name === "CharitySignal"
          ? '<a href="/#lookup">Lookup</a><a href="/#coverage">Coverage</a>'
          : site.name === "FloodingFacts"
            ? '<a href="/#rivers">Rivers</a><a href="/warnings">Warnings</a><a href="/#how-it-works">How to read it</a>'
            : '<a href="/#how-it-works">How it works</a>';
  const prepared = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "Europe/London",
  }).format(new Date());
  const reportTools = report
    ? `<aside class="report-tools" aria-label="Save and share this record"><div><strong>Keep or cite this page</strong><span>Save an A4 report or copy a citation containing the page title, site and canonical URL.</span></div><div class="report-actions"><button type="button" data-print>Download report (PDF)</button><button type="button" class="secondary-action" data-cite>Copy citation</button></div><small data-copy-state aria-live="polite">In the print window, choose “Save as PDF”.</small></aside><div class="print-masthead"><strong>${esc(site.name)}</strong><span>Evidence report · prepared ${esc(prepared)}</span><span>${esc(canonical)}</span></div>`
    : "";
  const schema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": report ? "Dataset" : "WebPage",
    name: title,
    description,
    url: canonical,
    isPartOf: {
      "@type": "WebSite",
      name: site.name,
      url: new URL(canonical).origin,
    },
    creator: {
      "@type": "Organization",
      name: "37X Ventures",
      url: "https://37xventures.com/",
    },
  }).replace(/</g, "\\u003c");
  const reportScript = report
    ? `<script>document.querySelector('[data-print]')?.addEventListener('click',function(){document.querySelectorAll('details').forEach(function(d){d.open=true});window.print()});document.querySelector('[data-cite]')?.addEventListener('click',async function(){var text=document.title+' — ${esc(site.name)}. '+location.href;var state=document.querySelector('[data-copy-state]');try{await navigator.clipboard.writeText(text);state.textContent='Citation copied.'}catch(e){state.textContent='Copy unavailable; use the address bar.'}})</script>`
    : "";
  // Indexing and measurement are independent controls. Preview/noindex pages
  // still need consent-gated analytics so launches and diagnostics can be
  // measured before a public projection is approved.
  const analyticsEligible =
    site.analyticsId && new URL(canonical).hostname === site.canonicalHost;
  const analytics = analyticsEligible
    ? `<style>.consent{position:fixed;z-index:20;left:1rem;right:1rem;bottom:1rem;max-width:920px;margin:auto;display:grid;grid-template-columns:1fr auto;gap:.65rem 1.2rem;align-items:center;padding:1rem 1.2rem;border-radius:1rem;background:#fff;color:${site.dark};border:1px solid ${site.dark}33;box-shadow:0 18px 60px #0003}.consent[hidden]{display:none}.consent div{display:flex;gap:.55rem;flex-direction:column}.consent div:nth-child(2){flex-direction:row}.consent span,.consent a{font-size:.84rem}.consent button{border:0;border-radius:.65rem;padding:.7rem .9rem;background:${site.accent};color:${site.dark};font-weight:800;cursor:pointer}.consent .secondary-action{background:${site.pale};border:1px solid ${site.dark}33}@media(max-width:650px){.consent{grid-template-columns:1fr}.consent div:nth-child(2){flex-wrap:wrap}}</style><aside class="consent" data-consent hidden aria-label="Analytics choice"><div><strong>Help us improve ${esc(site.name)}</strong><span>With your permission, Google Analytics measures which public pages are useful. No analytics loads before you accept.</span></div><div><button type="button" data-accept>Allow analytics</button><button type="button" class="secondary-action" data-decline>Decline</button></div><a href="/privacy">Privacy details</a></aside><script>(function(){var id=${JSON.stringify(site.analyticsId)},box=document.querySelector('[data-consent]'),key='37x-analytics-consent';function load(){if(window.__37xGa)return;window.__37xGa=true;window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('consent','default',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});gtag('js',new Date());gtag('config',id,{allow_google_signals:false,allow_ad_personalization_signals:false});var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);document.head.appendChild(s)}var choice=localStorage.getItem(key);if(choice==='yes')load();else if(choice!=='no')box.hidden=false;box.querySelector('[data-accept]').onclick=function(){localStorage.setItem(key,'yes');box.hidden=true;load()};box.querySelector('[data-decline]').onclick=function(){localStorage.setItem(key,'no');box.hidden=true}})()</script>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}">${noindex ? '<meta name="robots" content="noindex,nofollow">' : ""}<link rel="canonical" href="${canonical}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website"><meta name="theme-color" content="${site.dark}"><script type="application/ld+json">${schema}</script><style>${css(site)}</style></head><body${report ? ` onbeforeprint="document.querySelectorAll('details').forEach(function(detail){detail.open=true})"` : ""}><a class="skip" href="#main">Skip to content</a><header><a class="brand" href="/"><b>${esc(site.icon)}</b><span>${esc(site.name)}</span></a><nav aria-label="Primary">${productNav}<a href="/about">About</a><a href="/sources">Sources &amp; method</a><a href="/corrections">Corrections</a><a href="/privacy">Privacy</a></nav></header><main id="main">${reportTools}${inner}</main><footer><span>${esc(site.name)} · a 37X evidence product</span><span>Facts retain source, date and limitations. Data collection follows the observation timestamp on each record; site evidence rechecked 3 September 2026. <a href="/corrections">Report a correction</a> · <a href="/privacy">Privacy</a>.</span></footer>${analytics}${reportScript}</body></html>`;
}

function css(s) {
  return `*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:${s.pale};color:${s.dark};font:16px/1.55 Inter,ui-sans-serif,system-ui,sans-serif}body:before{content:'';position:fixed;inset:0;pointer-events:none;background:radial-gradient(circle at 88% 8%,${s.accent}24,transparent 32rem),radial-gradient(circle at 8% 48%,#ffffff9c,transparent 26rem);z-index:-1}a{color:inherit}.skip{position:absolute;left:-999px}.skip:focus{left:1rem;top:1rem;background:white;padding:.7rem;z-index:3}header,footer{display:flex;justify-content:space-between;align-items:center;gap:1rem;max-width:1180px;margin:auto;padding:1.2rem 2rem}.brand{display:flex;align-items:center;gap:.7rem;text-decoration:none;font-weight:900}.brand b{display:grid;place-items:center;min-width:2.35rem;height:2.35rem;padding:0 .5rem;border-radius:.75rem;background:${s.accent};color:${s.dark};box-shadow:0 8px 24px ${s.dark}20}nav{display:flex;gap:1.15rem;align-items:center;flex-wrap:wrap}nav a{text-decoration:none;font-size:.9rem;font-weight:700}main{max-width:1180px;margin:auto;padding:4.5rem 2rem 6rem}.hero{display:grid;grid-template-columns:1.35fr .65fr;gap:4rem;align-items:end}.eyebrow{text-transform:uppercase;letter-spacing:.12em;font-size:.78rem;font-weight:850;color:${s.dark}aa}h1{font-size:clamp(3rem,8vw,7.2rem);line-height:.93;letter-spacing:-.065em;margin:.8rem 0 1.5rem;max-width:950px}h2{font-size:clamp(1.7rem,4vw,3rem);line-height:1.05;letter-spacing:-.035em}.lead{font-size:1.25rem;max-width:760px}.search{display:flex;background:white;padding:.45rem;border:1px solid ${s.dark}22;border-radius:1rem;box-shadow:0 18px 60px ${s.dark}18;margin:2rem 0}.search:focus-within{outline:3px solid ${s.accent};outline-offset:3px}.search input,.search select{flex:1;border:0;background:transparent;padding:1rem;font:inherit;min-width:0}.search button{border:0;border-radius:.7rem;background:${s.accent};padding:0 1.3rem;font-weight:850;color:${s.dark};cursor:pointer}.stat{border-top:3px solid ${s.accent};padding-top:1rem}.stat strong{display:block;font-size:clamp(2.3rem,5vw,4.5rem);line-height:1;letter-spacing:-.05em}.stat span{display:block;margin-top:.55rem}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1rem;margin-top:4rem}.card{background:#fffffff0;padding:1.5rem;border-radius:1.1rem;min-height:150px;border:1px solid ${s.dark}10;box-shadow:0 15px 45px ${s.dark}0b}.card small{display:block;text-transform:uppercase;letter-spacing:.1em;font-weight:800;margin-bottom:.7rem}.notice{margin:2rem 0;padding:1rem 1.2rem;border-left:5px solid ${s.accent};background:#fffffff0;border-radius:0 .8rem .8rem 0}.source{padding:1rem 0;border-bottom:1px solid ${s.dark}22}table{width:100%;border-collapse:collapse;background:white;margin:1rem 0 3rem}th,td{text-align:left;padding:.8rem;border-bottom:1px solid ${s.dark}22}th{background:${s.accent}33}footer{border-top:1px solid ${s.dark}22;font-size:.85rem}.report-tools{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.3rem 1rem;align-items:center;margin:-2rem 0 2.5rem;padding:1rem 1.1rem;border:1px solid ${s.dark}22;border-radius:1rem;background:#fff;box-shadow:0 12px 36px ${s.dark}0f}.report-tools div{display:flex;flex-direction:column}.report-tools span,.report-tools small{color:${s.dark}aa;font-size:.83rem}.report-tools small{grid-column:2}.report-tools button{grid-column:2;grid-row:1;min-height:2.8rem;padding:.65rem 1rem;border:0;border-radius:.75rem;background:${s.accent};color:${s.dark};font:800 .92rem/1.2 Inter,ui-sans-serif,system-ui,sans-serif;cursor:pointer}.print-masthead{display:none}.crumbs{font-size:.88rem;color:${s.dark}aa;margin-bottom:2rem}.station-hero{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(18rem,.8fr);gap:2rem;align-items:stretch}.station-title{background:linear-gradient(145deg,${s.dark},#0d5068);color:white;border-radius:1.6rem;padding:clamp(1.5rem,4vw,3rem);position:relative;overflow:hidden}.station-title:after{content:'≈';position:absolute;right:-.3rem;bottom:-4rem;font-size:15rem;line-height:1;color:${s.accent};opacity:.12}.station-title h1{font-size:clamp(2.8rem,6vw,5.4rem);letter-spacing:-.055em;margin:.45rem 0}.station-title .lead{margin:.2rem 0 0;color:#d9f5ff}.pill{display:inline-flex;align-items:center;gap:.45rem;border-radius:99px;padding:.38rem .7rem;background:#d9f8e8;color:#075d38;font-size:.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.pill:before{content:'';width:.5rem;height:.5rem;border-radius:50%;background:#11a968}.reading-card{background:white;border-radius:1.6rem;padding:1.6rem;box-shadow:0 20px 60px ${s.dark}16;display:flex;flex-direction:column;justify-content:space-between}.reading-value{font-size:clamp(3rem,7vw,5rem);font-weight:850;letter-spacing:-.06em;line-height:1;margin:.5rem 0}.reading-value span{font-size:1rem;letter-spacing:0;color:${s.dark}99}.fresh{display:flex;align-items:center;gap:.5rem;color:${s.dark}aa;font-size:.9rem}.fresh:before{content:'●';color:#11a968}.actions{display:flex;gap:.7rem;flex-wrap:wrap;margin:1.5rem 0 0}.button{display:inline-flex;align-items:center;justify-content:center;min-height:2.8rem;padding:.65rem 1rem;border-radius:.75rem;background:${s.accent};font-weight:800;text-decoration:none}.button.secondary{background:white;border:1px solid ${s.dark}33}.evidence-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin:1.2rem 0 2.5rem}.evidence-card{background:white;border-radius:1.1rem;padding:1.25rem;border:1px solid ${s.dark}12}.evidence-card small{display:block;text-transform:uppercase;letter-spacing:.1em;font-size:.72rem;font-weight:800;color:${s.dark}99}.evidence-card strong{display:block;font-size:1.2rem;margin:.35rem 0}.feature-band{margin:4rem 0;padding:clamp(1.5rem,4vw,3rem);border-radius:1.8rem;background:${s.dark};color:white;position:relative;overflow:hidden}.feature-band:after{content:'37X';position:absolute;right:1rem;bottom:-2.8rem;font-size:9rem;font-weight:900;color:${s.accent};opacity:.08}.feature-band h2{max-width:760px}.step-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem;margin-top:2rem}.step{padding:1.2rem;border-top:1px solid #ffffff55}.step strong{display:block;color:${s.accent};font-size:1.6rem}.browse{columns:3;list-style:none;padding:0}.browse li{break-inside:avoid;padding:.45rem 0}.browse a{font-weight:750}.visual-panel{display:grid;grid-template-columns:.8fr 1.2fr;gap:1.2rem;align-items:stretch;margin:2rem 0;padding:1.2rem;border:1px solid ${s.dark}18;border-radius:1.3rem;background:#fff}.visual-copy{padding:.4rem}.visual-copy h2{margin:.25rem 0 .7rem;font-size:1.8rem}.visual-coordinates{font-family:ui-monospace,SFMono-Regular,monospace;color:${s.dark}aa}.map-frame{min-height:320px;overflow:hidden;border-radius:1rem;background:${s.pale}}.map-frame iframe{display:block;width:100%;height:285px;border:0}.map-frame p{margin:.5rem .8rem;font-size:.76rem;color:${s.dark}aa}.chart-panel{display:grid;grid-template-columns:.7fr 1.3fr;gap:1.5rem;align-items:center;margin:2rem 0;padding:1.4rem;border:1px solid ${s.dark}18;border-radius:1.3rem;background:#fff}.chart-panel h2{margin:.25rem 0 .7rem;font-size:1.8rem}.chart-panel svg{width:100%;height:auto;overflow:visible}.chart-panel line{stroke:${s.dark}44;stroke-width:2}.chart-panel polyline{fill:none;stroke:${s.dark};stroke-width:5;stroke-linecap:round;stroke-linejoin:round}.chart-panel circle{fill:${s.accent};stroke:${s.dark};stroke-width:2}.chart-panel text{fill:${s.dark}aa;font-size:13px}.explain{display:grid;grid-template-columns:1.1fr .9fr;gap:1rem;margin:2rem 0}.panel{background:white;border-radius:1.2rem;padding:1.5rem}.panel h2{margin-top:0;font-size:1.55rem}.panel.warning{background:#fff8dc;border:1px solid #e5bf43}.technical{margin-top:2rem;border-top:1px solid ${s.dark}22;padding-top:1rem}.technical summary{cursor:pointer;font-weight:800;padding:.8rem 0}.technical-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:0 2rem}.technical .source div{overflow-wrap:anywhere}.code{font-family:ui-monospace,SFMono-Regular,monospace;font-size:.88rem}@media(max-width:720px){header,footer{padding:1rem;align-items:flex-start}main{padding:2.3rem 1rem 4rem}.hero,.grid,.station-hero,.evidence-grid,.visual-panel,.chart-panel,.explain,.technical-grid,.step-grid{grid-template-columns:1fr;gap:1rem}h1{font-size:3.7rem}nav{gap:.7rem;font-size:.82rem}.search{flex-wrap:wrap}.search button{padding:.8rem;width:100%}.browse{columns:1}footer{flex-direction:column}table{font-size:.85rem}.station-title,.reading-card{border-radius:1.2rem}.reading-value{font-size:3.6rem}.actions .button{width:100%}.report-tools{grid-template-columns:1fr;margin:-.8rem 0 2rem}.report-tools button,.report-tools small{grid-column:1;grid-row:auto}.report-tools button{width:100%}}@media print{@page{size:A4;margin:14mm 13mm 16mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{background:#fff;color:#172b35;font:10.5pt/1.45 Georgia,serif}header,footer,.skip,.report-tools,.actions,.search{display:none!important}main{max-width:none;padding:0}.print-masthead{display:flex;justify-content:space-between;gap:8mm;margin:0 0 10mm;padding:0 0 4mm;border-bottom:2px solid ${s.accent};font:8.5pt/1.25 Inter,Arial,sans-serif;color:${s.dark}}.print-masthead span:last-child{max-width:85mm;overflow-wrap:anywhere;text-align:right}.crumbs{display:none}h1{font-size:26pt;line-height:1.02;letter-spacing:-.035em;margin:4mm 0 7mm}h2{font-size:16pt;break-after:avoid}.station-hero{grid-template-columns:1.2fr .8fr;gap:6mm}.station-title,.reading-card,.card,.evidence-card,.panel,.notice,.visual-panel,.chart-panel{box-shadow:none;break-inside:avoid}.station-title{border-radius:4mm;padding:8mm}.station-title h1{font-size:28pt}.reading-card{border:1px solid #ccd7dc;border-radius:4mm}.evidence-grid{grid-template-columns:repeat(3,1fr);gap:4mm}.visual-panel{grid-template-columns:.8fr 1.2fr}.map-frame{min-height:65mm}.map-frame iframe{height:58mm}.chart-panel{grid-template-columns:.7fr 1.3fr}.explain{grid-template-columns:1fr 1fr;gap:4mm}.source{break-inside:avoid;padding:3mm 0}.technical{display:block}.technical>summary{list-style:none}.technical>summary::-webkit-details-marker{display:none}.technical-grid{grid-template-columns:1fr 1fr}table{font-size:8.5pt;margin:4mm 0 8mm;break-inside:auto}thead{display:table-header-group}tr{break-inside:avoid}th,td{padding:2.2mm}.button{display:none!important}a{text-decoration:none;color:inherit}.notice{border:1px solid #ccd7dc;border-left:4px solid ${s.accent}}}`;
}

function home(site, ready, origin, catalog) {
  if (site.projection.includes("floodingfacts"))
    return floodHome(site, ready, origin, catalog);
  const cards = site.examples
    .map(
      (x, i) =>
        `<article class="card"><small>0${i + 1}</small><h2>${esc(x)}</h2><p>Built from approved source fields with observation dates, provenance and limitations beside the answer.</p></article>`,
    )
    .join("");
  const browse = (catalog?.entities || [])
    .slice(0, 24)
    .map(
      (x) =>
        `<li><a href="/entity/${encodeURIComponent(x.stationId || x.id)}">${esc(x.name || x.stationId || x.id)}</a>${x.state ? ` <small>${esc(x.state)}</small>` : ""}</li>`,
    )
    .join("");
  const states =
    site.name === "Tide & Marine Conditions"
      ? [...new Set((catalog?.entities || []).map((item) => item.state).filter(Boolean))]
          .sort()
          .map((state) => `<li><a href="/state/${routeValue(state)}">${esc(state)} tide stations</a></li>`)
          .join("")
      : "";
  const gated = !ready
    ? `<div class="notice" role="status"><strong>Evidence gate active.</strong> This product is deployed as a non-indexed preview. Search and entity pages remain unavailable until an approved public R2 projection exists.</div>`
    : "";
  const label =
    site.name === "Tide & Marine Conditions"
      ? "coastal stations"
      : site.name === "CharitySignal"
        ? "charity records"
        : "planned evidence checks";
  const productPurpose = site.name === "AustralianCompanyData"
    ? `<section class="explain"><article class="panel"><h2>What this company check answers</h2><p>Use an ACN or registered name to confirm the entity recorded by ASIC, its current registration status and its published name history. The page separates identifiers, dates and status so similarly named businesses are not treated as the same company.</p></article><article class="panel warning"><h2>What it does not prove</h2><p>A register match is not a credit score, ownership investigation or recommendation. Confirm time-sensitive decisions against the linked official source and seek professional advice where needed.</p></article></section>`
    : site.name === "CharitySignal"
      ? `<section class="explain"><article class="panel"><h2>What this charity check answers</h2><p>Find the registered organisation, its charity number, current register status, purposes, classifications and filing history where those fields are published. Stable identifiers keep similarly named charities separate.</p></article><article class="panel warning"><h2>Read dates before conclusions</h2><p>Income, spending and filing facts can describe different reporting periods. This service presents the dated official evidence; it does not rate effectiveness, governance or the people connected with a charity.</p></article></section>`
      : "";
  return shell(
    site,
    `<section class="hero"><div><p class="eyebrow">${esc(site.eyebrow)}</p><h1>${esc(site.promise)}</h1><p class="lead">${esc(site.description)}</p><form class="search" id="lookup" action="/search"><label hidden for="q">${esc(site.search)}</label><input id="q" name="q" autocomplete="off" placeholder="${esc(site.search)}"><button type="submit">Check the evidence</button></form></div><aside class="stat"><strong>${esc(site.count)}</strong><span>${esc(label)} · facts retain dates and source limits</span></aside></section>${gated}<section class="grid">${cards}</section>${productPurpose}<section class="feature-band" id="how-it-works"><p class="eyebrow" style="color:${site.accent}">A decision tool, not a data dump</p><h2>From an official identifier to a useful, checkable answer.</h2><div class="step-grid"><div class="step"><strong>01</strong><h3>Find the record</h3><p>Search the approved projection—never an inferred or invented match.</p></div><div class="step"><strong>02</strong><h3>Understand it</h3><p>See dates, definitions, comparisons and limitations beside the answer.</p></div><div class="step"><strong>03</strong><h3>Act safely</h3><p>Open the official record, save a report or submit a documented correction.</p></div></div></section>${states ? `<section id="states"><p class="eyebrow">Browse by state or territory</p><h2>US tide-station coverage</h2><ul class="browse">${states}</ul></section>` : ""}${browse ? `<section id="stations"><p class="eyebrow">Verified coverage</p><h2>Browse official records</h2><ul class="browse">${browse}</ul></section>` : ""}`,
    {
      canonical: origin + "/",
      title: `${site.name} | Official evidence made useful`,
      description: site.description,
      noindex: !ready,
    },
  );
}

function floodHome(site, ready, origin, catalog) {
  const stations = (catalog?.entities || [])
    .slice(0, 18)
    .map(
      (item) =>
        `<li><a href="/entity/${encodeURIComponent(item.stationId || item.id)}">${esc(item.name || item.stationId || item.id)}</a>${item.riverName ? ` <small>${esc(item.riverName)}</small>` : ""}</li>`,
    )
    .join("");
  const riverCounts = new Map();
  for (const item of catalog?.entities || [])
    if (item.river)
      riverCounts.set(item.river, (riverCounts.get(item.river) || 0) + 1);
  const rivers = [...riverCounts]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 60)
    .map(([river, count]) => `<li><a href="/river/${routeValue(river)}">${esc(river)}</a> <small>${count} stations</small></li>`)
    .join("");
  const gated = ready
    ? ""
    : `<div class="notice" role="status"><strong>Evidence gate active: river feed unavailable.</strong> Station lookups remain closed until the approved Environment Agency projection returns.</div>`;
  return shell(
    site,
    `<section class="station-hero"><div class="station-title"><p class="eyebrow" style="color:#b9eaff">Rivers, warnings and monitoring stations</p><h1>Check what the river is doing near you.</h1><p class="lead">Start with the latest instrument reading, then check the official warning service before making a safety decision.</p></div><aside class="reading-card"><div><p class="eyebrow">Published monitoring coverage</p><div class="reading-value">${esc(site.count.split(" ")[0])}</div><p>latest station measures in the governed snapshot</p></div><p class="fresh">Observation times shown on every station page</p></aside></section>
  <form class="search" action="/search"><label hidden for="q">River, station or nearby place</label><input id="q" name="q" placeholder="River, station or nearby place"><button type="submit">Find a gauge</button></form>${gated}
  <section class="evidence-grid"><article class="evidence-card"><small>1 · Now</small><strong>Read the timestamp</strong><span>A level without its observation time is not a current answer.</span></article><article class="evidence-card"><small>2 · Place</small><strong>Check the instrument</strong><span>The station and measure define what the number actually describes.</span></article><article class="evidence-card"><small>3 · Safety</small><strong>Open official warnings</strong><span>A gauge reading is never substituted for an Environment Agency alert.</span></article></section>
  <section class="feature-band" id="how-it-works"><p class="eyebrow" style="color:${site.accent}">Warning first. Context second.</p><h2>One river number cannot answer every flood question.</h2><div class="step-grid"><div class="step"><strong>Gauge</strong><h3>What was measured?</h3><p>Read the value, unit, instrument and observation time together.</p></div><div class="step"><strong>Catchment</strong><h3>Where does it belong?</h3><p>Use river and catchment names to understand the monitoring context.</p></div><div class="step"><strong>Warning</strong><h3>Is action required?</h3><p>Continue to the official warning service for current alerts and advice.</p></div></div></section>
  ${rivers ? `<section id="rivers"><p class="eyebrow">Browse by watercourse</p><h2>Rivers with multiple monitoring stations</h2><ul class="browse">${rivers}</ul></section>` : ""}${stations ? `<section><p class="eyebrow">Recently published stations</p><h2>Browse monitoring points</h2><ul class="browse">${stations}</ul></section>` : ""}`,
    {
      canonical: origin + "/",
      title: "Live river levels and monitoring stations | FloodingFacts",
      description:
        "Find Environment Agency river gauges, latest observation times and links to current official flood warnings.",
      noindex: !ready,
    },
  );
}

const shortDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeZone: "Europe/London",
      }).format(new Date(value))
    : "Not published";
async function noticeData(env, root = "tendertendertender") {
  const object = await env.PUBLIC_DATA.get(
    `public-projections/${root}/notices.json`,
  );
  return object ? object.json() : null;
}
const entityId = (record) =>
  record?.stationId ??
  record?.stationReference ??
  record?.authorityCode ??
  record?.acn ??
  record?.organisation_number ??
  record?.ocid ??
  record?.id;
function entityIndexable(site, entity) {
  if (!entity) return false;
  if (site.projection.includes("charitysignal")) {
    const status = String(entity.charity_registration_status || "").toLowerCase();
    return Boolean(
      entity.charity_name &&
        entity.registered_charity_number &&
        entity.date_of_extract &&
        !entity.date_of_removal &&
        !status.includes("removed"),
    );
  }
  if (site.projection.includes("australiancompanydata")) {
    return Boolean(
      entity.status === "REGD" &&
        entity.abn &&
        entity.registration_date &&
        entity.current_name &&
        entity.company_name &&
        entity.current_name !== entity.company_name,
    );
  }
  if (site.projection.includes("tendertendertender")) {
    return Boolean(
      entity.title &&
        entity.buyer_organisation &&
        entity.published_date &&
        (entity.description || entity.tender_deadline || entity.value),
    );
  }
  if (site.projection.includes("road-collisions"))
    return Object.keys(entity.years || {}).length >= 2;
  if (site.projection.includes("floodingfacts"))
    return Boolean(entity.label && entity.riverName && entity.measures?.length);
  if (site.projection.includes("tide-marine"))
    return Boolean(entity.name && (entity.predictions?.length || entity.observations?.length));
  if (site.projection.includes("heritage-atlas"))
    return Boolean(
      entity.name &&
        entity.grade &&
        entity.designation_date &&
        entity.official_url &&
        coordinatePair(entity),
    );
  if (site.projection.includes("fcc-equipment"))
    return Boolean(
      entity.id &&
        entity.applicant &&
        entity.latest_action_date &&
        entity.application_purpose &&
        Number.isFinite(Number(entity.lower_frequency_mhz)) &&
        Number.isFinite(Number(entity.upper_frequency_mhz)),
    );
  return true;
}
const routeValue = (value) => encodeURIComponent(String(value ?? "").trim());
const routeRecords = (records, field, value) =>
  records.filter(
    (record) => String(record?.[field] ?? "").trim() === String(value).trim(),
  );
function sitemapXml(origin, records = [], extraPaths = []) {
  const paths = ["/", "/about", "/sources", "/corrections", ...extraPaths];
  for (const record of records) {
    const id = entityId(record);
    if (id != null && String(id).trim())
      paths.push(`/entity/${encodeURIComponent(String(id))}`);
  }
  const unique = [...new Set(paths)].slice(0, 50000);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${unique.map((path) => `\n  <url><loc>${esc(origin + path)}</loc></url>`).join("")}\n</urlset>`;
}
function sitemapIndexXml(origin) {
  const names = [
    "pages",
    ...Array.from({ length: 256 }, (_, index) =>
      index.toString(16).padStart(2, "0"),
    ),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${names.map((name) => `\n  <sitemap><loc>${esc(origin)}/sitemaps/${name}.xml</loc></sitemap>`).join("")}\n</sitemapindex>`;
}
const noticeLink = (record) => `/entity/${encodeURIComponent(record.ocid)}`;
function tenderNoticeCards(records) {
  if (!records.length)
    return '<div class="notice">No notices match this view.</div>';
  return `<section class="grid">${records.map((record) => `<a class="card" href="${noticeLink(record)}" style="text-decoration:none;min-height:0"><small>${esc(record.tender_status || "published")}</small><h2 style="font-size:1.35rem">${esc(record.title || record.classification_description || "Public contract notice")}</h2><p><strong>${esc(record.buyer_organisation || "Buyer not published")}</strong></p><p>Deadline: ${esc(shortDate(record.tender_deadline))}</p></a>`).join("")}</section>`;
}
function tenderHome(site, data, origin) {
  const records = [...(data?.records || [])].sort((a, b) =>
    String(b.published_date).localeCompare(String(a.published_date)),
  );
  const active = records.filter((record) => record.tender_status === "active");
  const upcoming = [...active]
    .filter((record) => record.tender_deadline)
    .sort((a, b) =>
      String(a.tender_deadline).localeCompare(String(b.tender_deadline)),
    )
    .slice(0, 6);
  const deadlineStrip = upcoming
    .map(
      (record) =>
        `<a class="evidence-card" href="${noticeLink(record)}" style="text-decoration:none"><small>${esc(shortDate(record.tender_deadline))}</small><strong>${esc(record.title || record.classification_description || "Contract notice")}</strong><span>${esc(record.buyer_organisation || "Buyer not published")}</span></a>`,
    )
    .join("");
  const buyers = new Set(
    records.map((record) => record.buyer_organisation).filter(Boolean),
  );
  const categories = new Set(
    records.map((record) => record.classification_description).filter(Boolean),
  );
  return shell(
    site,
    `<section class="hero"><div><p class="eyebrow">${esc(site.eyebrow)}</p><h1>${esc(site.promise)}</h1><p class="lead">Browse live governed records without needing an OCID. Search by buyer, category or contract wording.</p><form class="search" action="/opportunities"><label hidden for="q">Search contracts</label><input id="q" name="q" placeholder="Try a buyer, service or CPV category"><button type="submit">Search</button></form></div><aside class="stat"><strong>${active.length}</strong><span>active notices · ${buyers.size} buyers · ${categories.size} categories</span></aside></section>
  <section class="grid"><a class="card" href="/opportunities" style="text-decoration:none"><small>Browse</small><h2>Open opportunities</h2><p>See active notices ordered by the nearest published deadline.</p></a><a class="card" href="/buyers" style="text-decoration:none"><small>Explore</small><h2>Public buyers</h2><p>Jump into notice histories by purchasing organisation.</p></a><a class="card" href="/categories" style="text-decoration:none"><small>Explore</small><h2>Contract categories</h2><p>Browse the CPV service and product categories represented in the data.</p></a><a class="card" href="/sources" style="text-decoration:none"><small>Trust</small><h2>Sources and coverage</h2><p>Understand what Contracts Finder can and cannot establish.</p></a></section>
  ${deadlineStrip ? `<section><p class="eyebrow">Deadline calendar</p><h2>What closes next?</h2><div class="evidence-grid">${deadlineStrip}</div><p><a href="/opportunities">Open the complete deadline-ordered list →</a></p></section>` : ""}
  <h2>Recently published opportunities</h2>${tenderNoticeCards(active.slice(0, 8))}`,
    {
      title: "UK public contract opportunities | TenderTenderTender",
      description:
        "Browse active Contracts Finder notices by deadline, public buyer and CPV category.",
      canonical: origin + "/",
    },
  );
}
function tenderBrowse(site, data, origin, url) {
  const records = data?.records || [];
  const path = url.pathname;
  if (path === "/buyers") {
    const groups = new Map();
    for (const record of records)
      if (record.buyer_organisation)
        groups.set(record.buyer_id || record.buyer_organisation, {
          name: record.buyer_organisation,
          count:
            (groups.get(record.buyer_id || record.buyer_organisation)?.count ||
              0) + 1,
        });
    const rows = [...groups].sort(
      (a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name),
    );
    return shell(
      site,
      `<p class="eyebrow">Browse the register</p><h1>Public buyers</h1><p class="lead">Choose an organisation to see its durable, source-linked notice history.</p><section class="grid">${rows.map(([id, row]) => `<a class="card" style="text-decoration:none;min-height:0" href="/buyer/${routeValue(id)}"><small>${row.count} notice${row.count === 1 ? "" : "s"}</small><h2 style="font-size:1.35rem">${esc(row.name)}</h2></a>`).join("")}</section>`,
      {
        title: "Public contract buyers | TenderTenderTender",
        description:
          "Browse public buyers represented in the governed Contracts Finder notice data.",
        canonical: origin + path,
      },
    );
  }
  if (path === "/categories") {
    const groups = new Map();
    for (const record of records)
      if (record.classification_description)
        groups.set(record.classification_id || record.classification_description, {
          name: record.classification_description,
          count:
            (groups.get(
              record.classification_id || record.classification_description,
            )?.count || 0) + 1,
        });
    const rows = [...groups].sort(
      (a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name),
    );
    return shell(
      site,
      `<p class="eyebrow">Browse the register</p><h1>Contract categories</h1><p class="lead">Explore durable category histories using the published CPV identifier.</p><section class="grid">${rows.map(([id, row]) => `<a class="card" style="text-decoration:none;min-height:0" href="/category/${routeValue(id)}"><small>${row.count} notice${row.count === 1 ? "" : "s"}</small><h2 style="font-size:1.35rem">${esc(row.name)}</h2></a>`).join("")}</section>`,
      {
        title: "Public contract categories | TenderTenderTender",
        description:
          "Browse governed Contracts Finder notices by published CPV category.",
        canonical: origin + path,
      },
    );
  }
  const query = (url.searchParams.get("q") || "").trim().toLowerCase();
  const buyer = url.searchParams.get("buyer") || "";
  const category = url.searchParams.get("category") || "";
  const filtered = records
    .filter(
      (record) =>
        (!buyer || record.buyer_organisation === buyer) &&
        (!category || record.classification_description === category) &&
        (!query ||
          [
            record.title,
            record.buyer_organisation,
            record.classification_description,
            record.ocid,
          ].some((value) =>
            String(value || "")
              .toLowerCase()
              .includes(query),
          )),
    )
    .sort((a, b) =>
      String(a.tender_deadline || "9999").localeCompare(
        String(b.tender_deadline || "9999"),
      ),
    );
  const heading =
    buyer ||
    category ||
    (query ? `Results for “${query}”` : "Open contract opportunities");
  return shell(
    site,
    `<p class="eyebrow">Contracts Finder notices</p><h1>${esc(heading)}</h1><p class="lead">${filtered.length} governed notice${filtered.length === 1 ? "" : "s"}, ordered by the nearest published deadline.</p><form class="search" action="/opportunities"><label hidden for="q">Search contracts</label><input id="q" name="q" value="${esc(url.searchParams.get("q") || "")}" placeholder="Buyer, category, wording or OCID"><button type="submit">Search</button></form><p><a href="/opportunities">All opportunities</a> · <a href="/buyers">Browse buyers</a> · <a href="/categories">Browse categories</a></p>${tenderNoticeCards(filtered)}`,
    {
      title: `${heading} | TenderTenderTender`,
      description:
        "Browse governed Contracts Finder notices by deadline, buyer and category.",
      canonical: origin + path,
      noindex: Boolean(query || buyer || category),
    },
  );
}

function tenderGroupPage(site, data, origin, kind, id) {
  const records = data?.records || [];
  const field = kind === "buyer" ? "buyer_id" : "classification_id";
  let matches = routeRecords(records, field, id);
  // Older notices occasionally omit the identifier. A literal fallback keeps
  // those records discoverable without fuzzy or inferred identity matching.
  if (!matches.length) {
    const fallback = kind === "buyer" ? "buyer_organisation" : "classification_description";
    matches = routeRecords(records, fallback, id);
  }
  if (!matches.length) return null;
  const first = matches[0];
  const name =
    kind === "buyer"
      ? first.buyer_organisation || id
      : first.classification_description || id;
  const active = matches.filter((record) => record.tender_status === "active");
  const values = matches
    .map((record) => Number(record.value || record.minimum_value))
    .filter(Number.isFinite);
  const publishedValue = values.reduce((sum, value) => sum + value, 0);
  const latest = [...matches].sort((a, b) =>
    String(b.published_date).localeCompare(String(a.published_date)),
  )[0];
  const labelText = kind === "buyer" ? "Public buyer" : "CPV category";
  return shell(
    site,
    `<nav class="crumbs"><a href="/">TenderTenderTender</a> / <a href="/${kind === "buyer" ? "buyers" : "categories"}">${kind === "buyer" ? "Buyers" : "Categories"}</a> / <span>${esc(name)}</span></nav><p class="eyebrow">${labelText} history</p><h1>${esc(name)}</h1><p class="lead">A source-linked view of ${matches.length} Contracts Finder notice${matches.length === 1 ? "" : "s"}; unknown values are not estimated.</p><section class="evidence-grid"><article class="evidence-card"><small>Notices in snapshot</small><strong>${matches.length}</strong><span>${active.length} currently marked active</span></article><article class="evidence-card"><small>Latest publication</small><strong>${esc(shortDate(latest?.published_date))}</strong><span>From the governed notice record</span></article><article class="evidence-card"><small>Published values</small><strong>${publishedValue ? esc(new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(publishedValue)) : "Unavailable"}</strong><span>Sum of numeric values that were actually published</span></article></section>${tenderNoticeCards(matches.sort((a, b) => String(b.published_date).localeCompare(String(a.published_date))))}<div class="notice">This is a notice history, not a complete spending ledger or supplier-performance rating. Follow each source record for the authoritative context.</div>`,
    {
      title: `${name} contract notices | TenderTenderTender`,
      description: `Contracts Finder notice history for ${name}, including publication dates, deadlines, status and published values.`,
      canonical: `${origin}/${kind}/${routeValue(id)}`,
      report: true,
    },
  );
}

function catalogGroupPage(site, catalog, origin, kind, id) {
  const records = catalog?.entities || [];
  const field = kind === "state" ? "state" : kind;
  const matches = routeRecords(records, field, id);
  if (!matches.length) return null;
  const labelText = kind === "state" ? `NOAA stations in ${id}` : `${id} monitoring stations`;
  const links = matches
    .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)))
    .map((record) => {
      const recordId = record.stationId || record.id;
      const detail = kind === "state"
        ? `${record.predictionCount || 0} predictions · ${record.observationCount || 0} observations`
        : [record.river, record.town].filter(Boolean).join(" · ");
      return `<a class="card" href="/entity/${routeValue(recordId)}" style="text-decoration:none;min-height:0"><small>${esc(detail || "Official monitoring record")}</small><h2 style="font-size:1.35rem">${esc(record.name || recordId)}</h2></a>`;
    })
    .join("");
  const noun = kind === "state" ? "tide and water-level" : "river-level";
  const groupEvidence = kind === "state"
    ? `<section class="evidence-grid"><article class="evidence-card"><small>Published stations</small><strong>${matches.length}</strong><span>Only stations present in the approved NOAA projection</span></article><article class="evidence-card"><small>Prediction coverage</small><strong>${matches.filter((row) => Number(row.predictionCount) > 0).length}</strong><span>Stations with stored prediction records</span></article><article class="evidence-card"><small>Observation coverage</small><strong>${matches.filter((row) => Number(row.observationCount) > 0).length}</strong><span>Stations with stored observation records</span></article></section><section class="explain"><article class="panel"><h2>Choose by station, not state average</h2><p>Tide timing and height vary around a coastline. Open the named station nearest the place and waterway you actually need, then retain its datum and local-time basis when comparing predictions. Two stations in the same state can describe very different harbours, inlets or exposed coasts.</p></article><article class="panel warning"><h2>Planning context, not navigation</h2><p>These station pages organise official NOAA records. They do not replace navigational charts, local notices, weather warnings or on-water judgement. Check the individual station’s coverage and latest published evidence before relying on a comparison.</p></article></section>`
    : `<section class="evidence-grid"><article class="evidence-card"><small>Monitoring stations</small><strong>${matches.length}</strong><span>Separate instruments on this named watercourse</span></article><article class="evidence-card"><small>Latest readings</small><strong>${matches.filter((row) => row.measures?.length).length}</strong><span>Stations with a reading in the current response</span></article><article class="evidence-card"><small>Named places</small><strong>${new Set(matches.map((row) => row.town).filter(Boolean)).size}</strong><span>Published locality labels, not inferred boundaries</span></article></section><section class="explain"><article class="panel"><h2>Why nearby stations can disagree</h2><p>Each gauge measures its own instrument and location. Tributaries, structures, rainfall and the time of observation can produce different readings on the same named river, so compare timestamps and units before comparing values. A change at one station should not be projected onto every place downstream.</p></article><article class="panel warning"><h2>A reading is not a warning</h2><p>Use the Environment Agency warning service for current alerts and safety guidance. This browse page is a monitoring index, not an address-level flood-risk assessment. Historical or delayed readings should never be used as proof that a location is safe.</p></article></section>`;
  return shell(
    site,
    `<nav class="crumbs"><a href="/">${esc(site.name)}</a> / <span>${esc(id)}</span></nav><p class="eyebrow">Verified geographic coverage</p><h1>${esc(labelText)}</h1><p class="lead">Browse ${matches.length} official ${noun} station${matches.length === 1 ? "" : "s"}. Each station page keeps the identifier, source date, units and limitations beside the evidence.</p>${groupEvidence}<section class="grid">${links}</section>`,
    {
      title: `${labelText} | ${site.name}`,
      description: `Browse ${matches.length} official ${noun} stations for ${id}, with source-linked entity pages and currentness context.`,
      canonical: `${origin}/${kind}/${routeValue(id)}`,
    },
  );
}

function sources(site, ready, origin) {
  const list = site.sources.length
    ? site.sources
        .map(
          (s) =>
            `<div class="source"><h2>${esc(s.name)}</h2><p>${esc(s.licence)} · <a href="${esc(s.url)}" rel="external">official source</a></p></div>`,
        )
        .join("")
    : "<p>No source is listed as publishable yet. The product remains closed until authoritative rights evidence and an approved field projection exist.</p>";
  return shell(
    site,
    `<p class="eyebrow">Evidence ledger</p><h1>Sources & licences</h1><p class="lead">Only approved fields from approved public projections may appear on this site.</p>${list}`,
    {
      title: `Sources & licences · ${site.name}`,
      noindex: !ready,
      canonical: origin + "/sources",
      report: true,
    },
  );
}

const label = (key) =>
  key.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const prettyTime = (value) => {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(date);
};
const prettyDate = (value) => {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);
};
function coordinatePair(entity) {
  const lat = Number(entity.lat ?? entity.latitude);
  const lon = Number(
    entity.long ?? entity.lng ?? entity.lon ?? entity.longitude,
  );
  return Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
    ? { lat, lon }
    : null;
}
function locatorMap(entity, title) {
  const point = coordinatePair(entity);
  if (!point) return "";
  const latDelta = 0.025;
  const lonDelta = Math.max(
    0.025,
    latDelta / Math.max(0.2, Math.cos((point.lat * Math.PI) / 180)),
  );
  const bbox = [
    point.lon - lonDelta,
    point.lat - latDelta,
    point.lon + lonDelta,
    point.lat + latDelta,
  ]
    .map((value) => value.toFixed(6))
    .join(",");
  const marker = `${point.lat.toFixed(6)},${point.lon.toFixed(6)}`;
  const osm = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(marker)}`;
  const full = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(point.lat)}&mlon=${encodeURIComponent(point.lon)}#map=15/${encodeURIComponent(point.lat)}/${encodeURIComponent(point.lon)}`;
  return `<section class="visual-panel" aria-labelledby="locator-heading"><div class="visual-copy"><p class="eyebrow">Published location</p><h2 id="locator-heading">Where is ${esc(title)}?</h2><p>This locator uses the coordinates in the approved source record. It shows geographic context, not a site boundary, safety zone or property-risk area.</p><p class="visual-coordinates">${esc(point.lat.toFixed(6))}, ${esc(point.lon.toFixed(6))}</p><a class="button secondary" href="${full}" rel="external">Open the interactive map ↗</a></div><div class="map-frame"><iframe title="Map showing ${esc(title)}" src="${osm}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe><p>Map data © <a href="https://www.openstreetmap.org/copyright" rel="external">OpenStreetMap contributors</a></p></div></section>`;
}
function evidenceChart(entity) {
  let points = [];
  let heading = "Evidence over time";
  if (entity.predictions?.length) {
    points = entity.predictions
      .slice(0, 14)
      .map((row, index) => ({
        label: row.prediction_time || index + 1,
        value: Number(row.height_m),
      }))
      .filter((row) => Number.isFinite(row.value));
    heading = "Next published tide heights";
  } else if (entity.observations?.length) {
    points = entity.observations
      .slice(-14)
      .map((row, index) => ({
        label: row.observation_time || index + 1,
        value: Number(row.water_level_m ?? row.value),
      }))
      .filter((row) => Number.isFinite(row.value));
    heading = "Recent published observations";
  } else if (entity.years && typeof entity.years === "object") {
    points = Object.entries(entity.years)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, row]) => ({ label: year, value: Number(row.collisions) }))
      .filter((row) => Number.isFinite(row.value));
    heading = "Recorded collisions by year";
  }
  if (points.length < 2) return "";
  const values = points.map((row) => row.value);
  const min = Math.min(...values),
    max = Math.max(...values),
    range = max - min || 1;
  const coords = points
    .map(
      (row, index) =>
        `${((index / (points.length - 1)) * 560 + 20).toFixed(1)},${(170 - ((row.value - min) / range) * 130).toFixed(1)}`,
    )
    .join(" ");
  return `<section class="chart-panel" aria-labelledby="chart-heading"><div><p class="eyebrow">Visual evidence</p><h2 id="chart-heading">${esc(heading)}</h2><p>The chart visualises the values listed in the table below; it does not interpolate missing records.</p></div><svg viewBox="0 0 600 205" role="img" aria-label="${esc(heading)}, ranging from ${min} to ${max}"><line x1="20" y1="170" x2="580" y2="170"></line><polyline points="${coords}"></polyline>${points.map((row, index) => `<circle cx="${((index / (points.length - 1)) * 560 + 20).toFixed(1)}" cy="${(170 - ((row.value - min) / range) * 130).toFixed(1)}" r="4"><title>${esc(row.label)}: ${esc(row.value)}</title></circle>`).join("")}<text x="20" y="198">${esc(points[0].label)}</text><text x="580" y="198" text-anchor="end">${esc(points.at(-1).label)}</text></svg></section>`;
}
function floodEntityPage(site, entity, origin, id) {
  const reading = entity.measures?.[0];
  const measure = String(reading?.measure_id || "");
  const unit = measure.includes("mASD")
    ? "mASD"
    : measure.includes("mAOD")
      ? "mAOD"
      : "published unit";
  const status = String(entity.status || "")
    .toLowerCase()
    .includes("active")
    ? "Active station"
    : "Station status published";
  const place = entity.label || entity.town || id;
  const river = entity.riverName || "River name unavailable";
  const location = [entity.town, entity.catchmentName]
    .filter(Boolean)
    .join(" · ");
  const warningUrl = `https://check-for-flooding.service.gov.uk/location?location=${encodeURIComponent(entity.town || place)}`;
  const mapUrl =
    entity.lat && entity.long
      ? `https://www.openstreetmap.org/?mlat=${encodeURIComponent(entity.lat)}&mlon=${encodeURIComponent(entity.long)}#map=15/${encodeURIComponent(entity.lat)}/${encodeURIComponent(entity.long)}`
      : null;
  const technical = [
    ["Station reference", entity.stationReference || id],
    [
      "Station opened",
      entity.dateOpened
        ? prettyTime(entity.dateOpened).replace(/, 00:00$/, "")
        : null,
    ],
    ["Latitude", entity.lat],
    ["Longitude", entity.long],
    ["Source", entity.liveReadingSource],
    ["API retrieval", prettyTime(entity.liveReadingRetrievedAt)],
    ["Raw measure identifier", measure],
  ]
    .filter(
      ([, value]) => value !== null && value !== undefined && value !== "",
    )
    .map(
      ([key, value]) =>
        `<div class="source"><strong>${esc(key)}</strong><div class="${key.includes("identifier") ? "code" : ""}">${esc(value)}</div></div>`,
    )
    .join("");
  const description = `${place} river monitoring station on ${river}: latest Environment Agency reading, observation time and station context.`;
  return shell(
    site,
    `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">FloodingFacts</a> / <span>${esc(place)}</span></nav>
    <section class="station-hero"><div class="station-title"><span class="pill">${esc(status)}</span><p class="eyebrow" style="color:#b9eaff">Environment Agency monitoring station</p><h1>${esc(place)}</h1><p class="lead">${esc(river)}${location ? ` · ${esc(location)}` : ""}</p></div>
    <aside class="reading-card" aria-labelledby="latest-reading"><div><p class="eyebrow" id="latest-reading">Latest published reading</p>${reading ? `<div class="reading-value">${esc(reading.value)} <span>${esc(unit)}</span></div><p>Observed ${esc(prettyTime(reading.observation_time))}</p>` : `<div class="reading-value">—</div><p>No latest reading is available.</p>`}</div><p class="fresh">Data checked ${esc(prettyTime(entity.liveReadingRetrievedAt))}</p></aside></section>
    <div class="actions"><a class="button" href="${warningUrl}" rel="external">Check official flood warnings ↗</a>${mapUrl ? `<a class="button secondary" href="${mapUrl}" rel="external">View station map ↗</a>` : ""}<a class="button secondary" href="/search?q=${encodeURIComponent(entity.town || place)}">Find another station</a></div>
    <section class="evidence-grid" aria-label="Station summary"><article class="evidence-card"><small>River</small><strong>${esc(river)}</strong><span>Watercourse named by the publisher</span></article><article class="evidence-card"><small>Catchment</small><strong>${esc(entity.catchmentName || "Unavailable")}</strong><span>Environment Agency catchment context</span></article><article class="evidence-card"><small>Station ID</small><strong>${esc(entity.stationReference || id)}</strong><span>Use this when checking the official source</span></article></section>
    ${locatorMap(entity, place)}
    <section class="explain"><article class="panel"><h2>What this reading tells you</h2><p>It is the latest value published for this monitoring instrument at the stated observation time. The unit <strong>${esc(unit)}</strong> is retained from the Environment Agency measure record.</p><p>This page does not currently have an approved typical range or warning threshold for this measure, so it does not label the reading as high, normal or low.</p></article><article class="panel warning"><h2>Need a current safety answer?</h2><p>A gauge reading is not a flood warning or a property-risk assessment. Use the official warning service for current alerts and follow emergency-service advice.</p><p><a href="${warningUrl}" rel="external"><strong>Open the official flood-warning check →</strong></a></p></article></section>
    <details class="technical"><summary>Technical record and provenance</summary><div class="technical-grid">${technical}</div><p><a href="/sources">Source, licence and methodology</a></p></details>`,
    {
      title: `${place} river level and station reading | FloodingFacts`,
      description,
      canonical: origin + `/entity/${encodeURIComponent(id)}`,
      report: true,
    },
  );
}
function tideEntityPage(site, entity, origin, id) {
  const title = entity.name || id;
  const predictions = [...(entity.predictions || [])].sort((a, b) =>
    String(a.prediction_time).localeCompare(String(b.prediction_time)),
  );
  const observations = [...(entity.observations || [])].sort((a, b) =>
    String(b.observation_time).localeCompare(String(a.observation_time)),
  );
  const next = predictions.slice(0, 6);
  const latest = observations[0];
  const datum = next[0]?.datum || latest?.datum || "Not published";
  const zone = next[0]?.time_zone || latest?.time_zone || "Not published";
  // NOAA prediction timestamps are station-local values. Preserve them rather
  // than silently converting them through the portfolio's UK display timezone.
  const rows = next
    .map(
      (x) =>
        `<tr><td>${esc(x.prediction_time)}</td><td><span class="pill">${x.high_low === "H" ? "High" : x.high_low === "L" ? "Low" : x.high_low || "Prediction"}</span></td><td><strong>${esc(x.height_m)} m</strong></td></tr>`,
    )
    .join("");
  return shell(
    site,
    `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Tide &amp; Marine Conditions</a> / <span>${esc(title)}</span></nav>
  <section class="station-hero"><div class="station-title"><span class="pill">NOAA station ${esc(id)}</span><p class="eyebrow" style="color:#b9fff8">${esc(entity.state || "US coast")}</p><h1>${esc(title)}</h1><p class="lead">Official tide predictions with the datum, units and time basis kept visible.</p></div><aside class="reading-card"><div><p class="eyebrow">Latest stored observation</p>${latest ? `<div class="reading-value">${esc(latest.water_level_m)} <span>m</span></div><p>${esc(prettyTime(latest.observation_time))}</p>` : `<div class="reading-value">—</div><p>No recent observation is available for this station.</p>`}</div><p class="fresh">${latest ? `Quality flag ${esc(latest.quality || "not published")}` : "Prediction-only station"}</p></aside></section>
  <div class="actions"><a class="button" href="#next-tides">See next tides</a><a class="button secondary" href="https://tidesandcurrents.noaa.gov/stationhome.html?id=${encodeURIComponent(id)}" rel="external">Open NOAA station ↗</a><a class="button secondary" href="/search?q=${encodeURIComponent(entity.state || "")}">Find another station</a></div>
  <section class="evidence-grid"><article class="evidence-card"><small>Datum</small><strong>${esc(datum)}</strong><span>The vertical reference for the published height</span></article><article class="evidence-card"><small>Time basis</small><strong>${esc(zone)}</strong><span>Retained from the NOAA response</span></article><article class="evidence-card"><small>Coverage</small><strong>${predictions.length} predictions</strong><span>${observations.length} recent observations stored</span></article></section>
  ${locatorMap(entity, title)}${evidenceChart(entity)}
  <section id="next-tides"><p class="eyebrow">Plan the next water window</p><h2>Next published high and low tides</h2>${rows ? `<table><thead><tr><th>Published time</th><th>Event</th><th>Height</th></tr></thead><tbody>${rows}</tbody></table>` : `<div class="notice">No prediction series is available for this station.</div>`}</section>
  <section class="explain"><article class="panel"><h2>How to read this page</h2><p>Predicted heights are astronomical estimates relative to <strong>${esc(datum)}</strong>. Weather, pressure, wind and river flow can move observed water away from the prediction.</p></article><article class="panel warning"><h2>For navigation or safety</h2><p>This is a planning aid, not a navigational chart or warning service. Check NOAA notices, local conditions and official marine guidance before acting.</p></article></section>
  <details class="technical"><summary>Source, identifiers and limitations</summary><div class="technical-grid"><div class="source"><strong>Station ID</strong><div>${esc(id)}</div></div><div class="source"><strong>Source</strong><div>NOAA CO-OPS Data API</div></div><div class="source"><strong>Prediction datum</strong><div>${esc(datum)}</div></div><div class="source"><strong>Time basis</strong><div>${esc(zone)}</div></div></div><p><a href="/sources">Read the full source and methodology record</a></p></details>`,
    {
      title: `${title} tide times and water levels | Tide & Marine Conditions`,
      description: `Official NOAA tide predictions and recent water-level observations for ${title}, station ${id}.`,
      canonical: origin + `/entity/${encodeURIComponent(id)}`,
      report: true,
    },
  );
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number)
    ? new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
        maximumFractionDigits: 0,
      }).format(number)
    : "Unavailable";
}
function asicEntityPage(site, entity, origin, id) {
  const title = entity.current_name || entity.company_name || `Company ${id}`;
  const formerName = entity.company_name && entity.company_name !== entity.current_name
    ? entity.company_name
    : null;
  const officialUrl = "https://connectonline.asic.gov.au/RegistrySearch/faces/landing/SearchRegisters.jspx";
  return shell(
    site,
    `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">AustralianCompanyData</a> / <span>${esc(id)}</span></nav><section class="station-hero"><div class="station-title" style="background:linear-gradient(145deg,${site.dark},#674800)"><span class="pill">${entity.status === "REGD" ? "Registered" : "Status " + esc(entity.status || "unavailable")}</span><p class="eyebrow" style="color:#ffe8a8">Australian company identity</p><h1>${esc(title)}</h1><p class="lead">ACN ${esc(entity.acn || id)}${entity.abn ? ` · ABN ${esc(entity.abn)}` : ""}</p></div><aside class="reading-card"><div><p class="eyebrow">Registered from</p><div class="reading-value" style="font-size:clamp(2rem,4vw,3.5rem)">${esc(entity.registration_date || "Unavailable")}</div><p>The date is reproduced exactly as published in the approved ASIC snapshot.</p></div><p class="fresh">Current name began ${esc(entity.current_name_start_date || "date unavailable")}</p></aside></section><div class="actions"><a class="button" href="${officialUrl}" rel="external">Check the ASIC register ↗</a><a class="button secondary" href="/search?q=${encodeURIComponent(entity.acn || id)}">Check another ACN</a></div><section class="evidence-grid"><article class="evidence-card"><small>Current register status</small><strong>${esc(entity.status || "Unavailable")}</strong><span>The source code is retained rather than expanded into an inferred legal conclusion</span></article><article class="evidence-card"><small>Entity type</small><strong>${esc(entity.entity_type || "Unavailable")}</strong><span>ASIC type code as published</span></article><article class="evidence-card"><small>Class · subclass</small><strong>${esc([entity.company_class, entity.company_subclass].filter(Boolean).join(" · ") || "Unavailable")}</strong><span>Published classification codes</span></article></section><section class="explain"><article class="panel"><p class="eyebrow">Name history signal</p><h2>${formerName ? `Previously ${esc(formerName)}` : "No separate former name in this projection"}</h2><p>${formerName ? `The source records ${esc(title)} as the current name and ${esc(formerName)} as the earlier published company name. The current-name start date is ${esc(entity.current_name_start_date || "not available")}.` : "A missing former-name signal does not prove that the company has never changed name; use the official register for the complete history."}</p></article><article class="panel"><p class="eyebrow">Registration context</p><h2>${esc(entity.previous_state_of_registration || "State not published")}</h2><p>${entity.state_registration_number ? `The projection retains state registration number ${esc(entity.state_registration_number)} for exact identity checking.` : "No earlier state registration number is published in this projection."} This page does not publish directors, addresses or personal contact details.</p></article></section><div class="notice"><strong>What this page answers:</strong> whether the approved ASIC snapshot links this exact ACN to the shown current name, status and identifiers. It does not provide credit, ownership or legal advice. Projection generated ${esc(prettyTime(entity._projectionGeneratedAt))}.</div><details class="technical"><summary>Approved source fields</summary><div class="technical-grid">${Object.entries(entity).filter(([key, value]) => !key.startsWith("_") && value !== null && value !== undefined && value !== "").map(([key, value]) => `<div class="source"><strong>${esc(label(key))}</strong><div>${esc(value)}</div></div>`).join("")}</div><p><a href="/sources">Source, licence and methodology</a></p></details>`,
    {
      title: `${title}: ACN, status and name history | AustralianCompanyData`,
      description: `ASIC company identity for ${title}, including ACN, ABN, registration status, type and published name history.`,
      canonical: origin + `/entity/${encodeURIComponent(id)}`,
      report: true,
    },
  );
}
function charityEntityPage(site, entity, origin, id) {
  const title = entity.charity_name || `Charity ${id}`;
  const active =
    !entity.date_of_removal &&
    !String(entity.charity_registration_status || "")
      .toLowerCase()
      .includes("removed");
  const income = Number(entity.latest_income);
  const expenditure = Number(entity.latest_expenditure);
  const balance =
    Number.isFinite(income) && Number.isFinite(expenditure)
      ? income - expenditure
      : null;
  const largest = Math.max(income || 0, expenditure || 0, 1);
  const financeChart =
    Number.isFinite(income) && Number.isFinite(expenditure)
      ? `<section class="panel" aria-labelledby="finance-comparison"><p class="eyebrow">Latest reported period</p><h2 id="finance-comparison">Income and expenditure, side by side</h2><div role="img" aria-label="Income ${esc(money(income))}; expenditure ${esc(money(expenditure))}"><p><strong>Income</strong> ${esc(money(income))}</p><div style="height:1.1rem;border-radius:99px;background:#ece8f8;overflow:hidden"><span style="display:block;height:100%;width:${Math.round((income / largest) * 100)}%;background:${site.accent}"></span></div><p><strong>Expenditure</strong> ${esc(money(expenditure))}</p><div style="height:1.1rem;border-radius:99px;background:#ece8f8;overflow:hidden"><span style="display:block;height:100%;width:${Math.round((expenditure / largest) * 100)}%;background:${site.dark}"></span></div></div><p>This visual compares the two published values only. It is not a rating of impact, reserves or financial health.</p></section>`
      : "";
  return shell(
    site,
    `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">CharitySignal</a> / <span>${esc(title)}</span></nav>
  <section class="station-hero"><div class="station-title" style="background:linear-gradient(145deg,${site.dark},#5b30a5)"><span class="pill">${active ? "Registered" : "Historic record"}</span><p class="eyebrow" style="color:#e7ddff">England &amp; Wales charity register</p><h1>${esc(title)}</h1><p class="lead">Organisation ${esc(entity.organisation_number || id)} · registered charity ${esc(entity.registered_charity_number || "not published")}</p></div><aside class="reading-card"><div><p class="eyebrow">Latest reported income</p><div class="reading-value" style="font-size:clamp(2.5rem,5vw,4.2rem)">${esc(money(income))}</div><p>Financial period ending ${esc(prettyDate(entity.latest_acc_fin_period_end_date))}</p></div><p class="fresh">Extract ${esc(prettyDate(entity.date_of_extract))}</p></aside></section>
  <div class="actions"><a class="button" href="https://register-of-charities.charitycommission.gov.uk/en/charity-search/-/charity-details/${encodeURIComponent(entity.registered_charity_number || id)}" rel="external">Open official register ↗</a><a class="button secondary" href="/search?q=${encodeURIComponent(entity.registered_charity_number || id)}">Check another charity</a></div>
  <section class="evidence-grid"><article class="evidence-card"><small>Status</small><strong>${esc(entity.charity_registration_status || (active ? "Registered" : "Historic"))}</strong><span>${entity.date_of_registration ? `Registered ${esc(prettyDate(entity.date_of_registration))}` : "Registration date unavailable"}</span></article><article class="evidence-card"><small>Latest expenditure</small><strong>${esc(money(expenditure))}</strong><span>As published in the latest register extract</span></article><article class="evidence-card"><small>Income less expenditure</small><strong>${balance == null ? "Unavailable" : esc(money(balance))}</strong><span>A simple subtraction, not an assessment of financial health</span></article></section>
  ${financeChart}
  <section class="explain"><article class="panel"><p class="eyebrow">Organisation form</p><h2>${esc(entity.charity_type || "Type not published")}</h2><p>${entity.charity_is_cio ? "The register marks this organisation as a Charitable Incorporated Organisation." : "Use the official register for the complete legal and filing context."}</p></article><article class="panel"><p class="eyebrow">Reporting signal</p><h2>${esc(entity.charity_reporting_status || "Status unavailable")}</h2><p>This label is retained from the source and should be read with the stated extract date.</p></article></section>
  <details class="technical"><summary>Complete approved organisation record</summary><div class="technical-grid">${Object.entries(
    entity,
  )
    .filter(
      ([, value]) => value !== null && value !== undefined && value !== "",
    )
    .map(
      ([key, value]) =>
        `<div class="source"><strong>${esc(label(key))}</strong><div>${esc(value)}</div></div>`,
    )
    .join(
      "",
    )}</div><p><a href="/sources">Source, licence and methodology</a></p></details>`,
    {
      title: `${title}: income, status and filings | CharitySignal`,
      description: `Official Charity Commission organisation facts for ${title}, including status, latest income, expenditure and reporting dates.`,
      canonical: origin + `/entity/${encodeURIComponent(id)}`,
      report: true,
    },
  );
}
function normaliseSearch(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
async function charitySearch(env, site, origin, query) {
  const normalised = normaliseSearch(query);
  const prefix = /^[a-z0-9]/.test(normalised) ? normalised[0] : "_";
  const object = await env.PUBLIC_DATA.get(
    `public-projections/charitysignal/search/${prefix}.json.gz`,
  );
  if (!object) return null;
  const records = await gzipJson(object);
  const matches = (records || [])
    .filter((row) => String(row.search || "").includes(normalised))
    .slice(0, 50);
  const cards = matches
    .map(
      (row) =>
        `<a class="card" href="/entity/${encodeURIComponent(row.id)}" style="text-decoration:none;min-height:0"><small>${esc(row.status || "Register record")}</small><h2 style="font-size:1.35rem">${esc(row.name)}</h2><p>Registered charity ${esc(row.registered || "number unavailable")} · organisation ${esc(row.id)}</p></a>`,
    )
    .join("");
  return shell(
    site,
    `<nav class="crumbs"><a href="/">CharitySignal</a> / Search</nav><p class="eyebrow">Organisation-only register search</p><h1>Results for “${esc(query)}”</h1><p class="lead">${matches.length === 50 ? "First 50" : matches.length} approved organisation record${matches.length === 1 ? "" : "s"}. Refine the name or use an exact registration number if needed.</p><form class="search" action="/search"><label hidden for="q">Charity name or number</label><input id="q" name="q" value="${esc(query)}"><button type="submit">Search again</button></form>${matches.length ? `<section class="grid" style="margin-top:2rem">${cards}</section>` : `<div class="notice">No matching organisation name was found in this extract.</div>`}`,
    {
      title: `Charity search results | CharitySignal`,
      description: `Charity Commission organisation search results for ${query}.`,
      noindex: true,
      canonical: origin + "/search",
    },
  );
}
function entityPage(site, entity, origin, id) {
  if (site.projection.includes("tide-marine"))
    return tideEntityPage(site, entity, origin, id);
  if (site.projection.includes("charitysignal"))
    return charityEntityPage(site, entity, origin, id);
  if (site.projection.includes("australiancompanydata"))
    return asicEntityPage(site, entity, origin, id);
  if (site.projection.includes("floodingfacts"))
    return floodEntityPage(site, entity, origin, id);
  if (site.projection.includes("heritage-atlas"))
    return heritageEntityPage(site, entity, origin, id);
  if (site.projection.includes("fcc-equipment"))
    return fccEntityPage(site, entity, origin, id);
  const hidden = new Set([
    "predictions",
    "observations",
    "measures",
    "years",
    "bulletins",
  ]);
  const facts = Object.entries(entity)
    .filter(
      ([k, v]) => !hidden.has(k) && !k.startsWith("_") && v !== null && v !== undefined && v !== "",
    )
    .map(
      ([k, v]) =>
        `<div class="source"><strong>${esc(label(k))}</strong><div>${esc(v)}</div></div>`,
    )
    .join("");
  const predictions = (entity.predictions || [])
    .slice(0, 14)
    .map(
      (x) =>
        `<tr><td>${esc(x.prediction_time)}</td><td>${esc(x.high_low)}</td><td>${esc(x.height_m)} m</td></tr>`,
    )
    .join("");
  const observations = (entity.observations || [])
    .slice(-12)
    .reverse()
    .map(
      (x) =>
        `<tr><td>${esc(x.observation_time)}</td><td>${esc(x.water_level_m)} m</td><td>${esc(x.quality || "—")}</td></tr>`,
    )
    .join("");
  const measures = (entity.measures || [])
    .map(
      (x) =>
        `<tr><td>${esc(x.measure_id)}</td><td>${esc(x.observation_time)}</td><td>${esc(x.value)}</td></tr>`,
    )
    .join("");
  const years = Object.entries(entity.years || {})
    .sort()
    .reverse()
    .map(
      ([year, x]) =>
        `<tr><td>${esc(year)}</td><td>${esc(x.collisions)}</td><td>${esc(x.casualties)}</td><td>${esc(x.vehicles)}</td></tr>`,
    )
    .join("");
  const bulletins = (entity.bulletins || [])
    .slice(0, 20)
    .map(
      (x) =>
        `<tr><td>${esc(x.publication_time)}</td><td>${esc(x.valid_end)}</td><td>${esc(x.danger_ratings?.[0]?.mainValue || "—")}</td></tr>`,
    )
    .join("");
  const tables = `${predictions ? `<h2>Next predictions</h2><table><thead><tr><th>Local time</th><th>High/low</th><th>Height</th></tr></thead><tbody>${predictions}</tbody></table>` : ""}${observations ? `<h2>Recent observations</h2><table><thead><tr><th>UTC time</th><th>Level</th><th>Quality</th></tr></thead><tbody>${observations}</tbody></table>` : ""}${measures ? `<h2>Latest measures</h2><table><thead><tr><th>Measure</th><th>Observed</th><th>Value</th></tr></thead><tbody>${measures}</tbody></table>` : ""}${years ? `<h2>Collision aggregates</h2><table><thead><tr><th>Year</th><th>Collisions</th><th>Casualties</th><th>Vehicles</th></tr></thead><tbody>${years}</tbody></table>` : ""}${bulletins ? `<div class="notice"><strong>Historical evidence only.</strong> These bulletins are not a current safety assessment. Always use the current official SLF bulletin before mountain travel.</div><h2>Recent records in the stored season</h2><table><thead><tr><th>Published</th><th>Valid to</th><th>Danger</th></tr></thead><tbody>${bulletins}</tbody></table>` : ""}`;
  const title =
    entity.company_name ||
    entity.current_name ||
    entity.charity_name ||
    entity.title ||
    entity.classification_description ||
    entity.name ||
    entity.stationId ||
    id;
  return shell(
    site,
    `<p class="eyebrow">Official ${esc(site.entity)} evidence</p><h1>${esc(title)}</h1><div class="notice">Source fields are shown as published in the approved projection. Unknown and unavailable values are not inferred.${entity._projectionGeneratedAt ? ` Projection generated ${esc(prettyTime(entity._projectionGeneratedAt))}.` : ""}</div>${locatorMap(entity, title)}${evidenceChart(entity)}${facts}${tables}<p><a href="/sources">Source, licence and methodology</a></p>`,
    {
      title: `${title} · ${site.name}`,
      description: `Official ${site.entity} evidence for ${title}, with source and currentness.`,
      canonical: origin + `/entity/${encodeURIComponent(id)}`,
      report: true,
    },
  );
}

function heritageEntityPage(site, entity, origin, id) {
  const title = entity.name || `Listed place ${id}`;
  const officialUrl = entity.official_url || "https://historicengland.org.uk/listing/the-list/";
  const current = String(entity.designation_status || "").toLowerCase().includes("current");
  const gradeMeaning = {
    I: "Grade I is the highest listed-building category in England.",
    "II*": "Grade II* identifies a particularly important building of more than special interest.",
    II: "Grade II identifies a building of special architectural or historic interest.",
  }[entity.grade] || "The designation grade is reproduced exactly as published by the source.";
  return shell(
    site,
    `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Listed Building Facts</a> / <span>${esc(title)}</span></nav>
    <section class="station-hero"><div class="station-title" style="background:linear-gradient(145deg,${site.dark},#6b4c25)"><span class="pill">${esc(entity.grade || "Grade unavailable")}</span><p class="eyebrow" style="color:#ffe1b0">Official designation evidence</p><h1>${esc(title)}</h1><p class="lead">List entry ${esc(id)} · ${current ? "current in the source snapshot" : esc(entity.designation_status || "status unavailable")}</p></div><aside class="reading-card"><div><p class="eyebrow">Designated</p><div class="reading-value" style="font-size:clamp(2rem,4vw,3.4rem)">${esc(prettyDate(entity.designation_date))}</div><p>${esc(gradeMeaning)}</p></div><p class="fresh">Source snapshot ${esc(prettyDate(entity.snapshot_date))}</p></aside></section>
    <div class="actions"><a class="button" href="${esc(officialUrl)}" rel="external">Open the official list entry ↗</a><a class="button secondary" href="/search?q=${encodeURIComponent(title)}">Find another listed place</a></div>
    <section class="evidence-grid" aria-label="Designation summary"><article class="evidence-card"><small>List entry</small><strong>${esc(id)}</strong><span>Use this stable identifier when checking the official record</span></article><article class="evidence-card"><small>Published grade</small><strong>${esc(entity.grade || "Unavailable")}</strong><span>The source category is retained without reinterpretation</span></article><article class="evidence-card"><small>Published state</small><strong>${current ? "Current" : esc(entity.designation_status || "Unavailable")}</strong><span>Status in the dated source snapshot, not a live legal opinion</span></article></section>
    ${locatorMap(entity, title)}
    <section class="explain"><article class="panel"><p class="eyebrow">What the record establishes</p><h2>A named designation linked to an official entry</h2><p>The approved source projection links this name, identifier, grade, designation date and mapped point. It is useful for confirming identity and opening the primary record. The map is location context only: it does not reproduce the legal designation boundary.</p></article><article class="panel warning"><p class="eyebrow">Before planning work</p><h2>Check the official entry and local authority</h2><p>Listing can affect work to a building and sometimes associated structures. This page does not decide whether consent is needed, describe the full extent of protection or replace professional and local-authority advice.</p></article></section>
    <div class="notice"><strong>Freshness and limits:</strong> source data were captured for the ${esc(prettyDate(entity.snapshot_date))} snapshot and this projection was generated ${esc(prettyTime(entity._projectionGeneratedAt))}. Names, coordinates and status may later change; the official list entry is the controlling reference.</div>
    <details class="technical"><summary>Complete approved source fields</summary><div class="technical-grid">${Object.entries(entity).filter(([key, value]) => !key.startsWith("_") && value !== null && value !== undefined && value !== "").map(([key, value]) => `<div class="source"><strong>${esc(label(key))}</strong><div>${key === "official_url" ? `<a href="${esc(value)}" rel="external">Open official record ↗</a>` : esc(value)}</div></div>`).join("")}</div><p><a href="/sources">Source, licence and methodology</a></p></details>`,
    {
      title: `${title}: grade, designation date and official entry | Listed Building Facts`,
      description: `Official listed-building evidence for ${title}: list entry ${id}, published grade, designation date, mapped context and source date.`,
      canonical: origin + `/entity/${encodeURIComponent(id)}`,
      report: true,
    },
  );
}

function fccEntityPage(site, entity, origin, id) {
  const title = entity.applicant || entity.grantee_registered_name || `FCC ID ${id}`;
  const low = Number(entity.lower_frequency_mhz);
  const high = Number(entity.upper_frequency_mhz);
  const frequency = Number.isFinite(low) && Number.isFinite(high)
    ? low === high ? `${low.toLocaleString("en-GB")} MHz` : `${low.toLocaleString("en-GB")}–${high.toLocaleString("en-GB")} MHz`
    : "Unavailable";
  const officialUrl = `https://apps.fcc.gov/oetcf/eas/reports/GenericSearch.cfm`;
  return shell(
    site,
    `<nav class="crumbs" aria-label="Breadcrumb"><a href="/">FCC Equipment ID Lookup</a> / <span>${esc(id)}</span></nav>
    <section class="station-hero"><div class="station-title" style="background:linear-gradient(145deg,${site.dark},#2f417d)"><span class="pill">FCC ID ${esc(id)}</span><p class="eyebrow" style="color:#fff1a8">Equipment authorisation evidence</p><h1>${esc(title)}</h1><p class="lead">${esc(entity.application_purpose || "Application purpose unavailable")} · grantee code ${esc(entity.grantee_code || "unavailable")}</p></div><aside class="reading-card"><div><p class="eyebrow">Published frequency range</p><div class="reading-value" style="font-size:clamp(2rem,4vw,3.4rem)">${esc(frequency)}</div><p>Lower and upper bounds retained from the approved grant projection.</p></div><p class="fresh">Latest action ${esc(prettyDate(entity.latest_action_date))}</p></aside></section>
    <div class="actions"><a class="button" href="${officialUrl}" rel="external">Search the official FCC database ↗</a><a class="button secondary" href="/search?q=${encodeURIComponent(id)}">Check another FCC ID</a></div>
    <section class="evidence-grid" aria-label="Authorisation summary"><article class="evidence-card"><small>Applicant</small><strong>${esc(title)}</strong><span>Organisation name published with this authorisation record</span></article><article class="evidence-card"><small>Application purpose</small><strong>${esc(entity.application_purpose || "Unavailable")}</strong><span>Purpose wording retained from the source</span></article><article class="evidence-card"><small>Published actions</small><strong>${esc(entity.grant_rows || 0)}</strong><span>Rows consolidated for this exact FCC ID</span></article></section>
    <section class="explain"><article class="panel"><p class="eyebrow">What this result answers</p><h2>The identifier appears in the approved FCC grant projection</h2><p>The page connects the exact FCC ID to the shown applicant, grantee code, application purpose, action dates and frequency bounds. It is an identity and authorisation trail, not a product review or a claim that every unit bearing a similar label is genuine.</p></article><article class="panel warning"><p class="eyebrow">Check the physical label</p><h2>Match the complete identifier</h2><p>Model names and marketing names can cover several radio variants. Compare every character of the FCC ID on the device with the official database result. For exhibits, grant conditions and current regulatory status, use the FCC database.</p></article></section>
    <div class="notice"><strong>Freshness and privacy:</strong> source actions run from ${esc(prettyDate(entity.first_action_date))} to ${esc(prettyDate(entity.latest_action_date))}; the public projection was generated ${esc(prettyTime(entity._projectionGeneratedAt))}. It excludes applicant addresses, contacts, signatures, email addresses and private exhibits.</div>
    <details class="technical"><summary>Complete approved source fields</summary><div class="technical-grid">${Object.entries(entity).filter(([key, value]) => !key.startsWith("_") && value !== null && value !== undefined && value !== "").map(([key, value]) => `<div class="source"><strong>${esc(label(key))}</strong><div>${esc(value)}</div></div>`).join("")}</div><p><a href="/sources">Source, licence and methodology</a></p></details>`,
    {
      title: `${id}: applicant, frequencies and FCC action dates | FCC ID Check`,
      description: `FCC equipment-authorisation evidence for ${id}: applicant, grantee code, purpose, frequencies and dated actions.`,
      canonical: origin + `/entity/${encodeURIComponent(id)}`,
      report: true,
    },
  );
}

export { entityIndexable, entityPage };
async function getEntity(env, site, id) {
  if (site.projection.includes("tide-marine")) {
    const o = await env.PUBLIC_DATA.get(
      `public-projections/tide-marine/stations/${id}.json.gz`,
    );
    return gzipJson(o);
  }
  if (
    site.projection.includes("australiancompanydata") ||
    site.projection.includes("charitysignal")
  ) {
    const digits = String(id).replace(/\D/g, "");
    if (!digits) return null;
    const shard = Number(BigInt(digits) % 256n)
      .toString(16)
      .padStart(2, "0");
    const root = site.projection.includes("australian")
      ? "australiancompanydata"
      : "charitysignal";
    const o = await env.PUBLIC_DATA.get(
      `public-projections/${root}/shards/${shard}.json.gz`,
    );
    if (!o) return null;
    const rows = await gzipJson(o);
    const field =
      root === "australiancompanydata" ? "acn" : "organisation_number";
    return (
      rows.find((row) => String(row[field]).replace(/\D/g, "") === digits) ||
      null
    );
  }
  if (site.projection.includes("floodingfacts")) {
    const o = await env.PUBLIC_DATA.get(
      `public-projections/floodingfacts/shards/${fnvShard(id, 256)}.json.gz`,
    );
    const rows = await gzipJson(o);
    const entity =
      rows?.find((row) => String(row.stationReference) === id) || null;
    if (!entity) return null;
    try {
      const live = await fetch(
        `https://environment.data.gov.uk/flood-monitoring/id/stations/${encodeURIComponent(id)}/readings?latest`,
        { headers: { accept: "application/json" } },
      );
      if (live.ok) {
        const data = await live.json();
        entity.measures = (data.items || []).map((reading) => ({
          measure_id: reading.measure,
          observation_time: reading.dateTime,
          value: reading.value,
        }));
        entity.liveReadingSource = "Environment Agency Flood Monitoring API";
        entity.liveReadingRetrievedAt = new Date().toISOString();
      }
    } catch {}
    return entity;
  }
  if (site.projection.includes("road-collisions")) {
    const o = await env.PUBLIC_DATA.get(
      `public-projections/road-collisions/shards/${fnvShard(id, 64)}.json.gz`,
    );
    const rows = await gzipJson(o);
    return rows?.find((row) => String(row.authorityCode) === id) || null;
  }
  if (
    site.projection.includes("tendertendertender") ||
    site.projection.includes("ukpublicmoney")
  ) {
    const root = site.projection.includes("tendertendertender")
      ? "tendertendertender"
      : "ukpublicmoney";
    const o = await env.PUBLIC_DATA.get(
      `public-projections/${root}/notices.json`,
    );
    if (!o) return null;
    const data = await o.json();
    return data?.records?.find((row) => String(row.ocid) === id) || null;
  }
  if (site.projection.includes("swiss-avalanche")) {
    const o = await env.PUBLIC_DATA.get(
      `public-projections/swiss-avalanche/regions/${id}.json.gz`,
    );
    return gzipJson(o);
  }
  return null;
}

export default {
  async fetch(request, env) {
    const site = sites[env.SITE_KEY] || sites.tide;
    const url = new URL(request.url),
      origin = url.origin,
      preview = url.hostname.endsWith(".workers.dev");
    if (
      site.canonicalHost &&
      url.hostname === `www.${site.canonicalHost}`
    ) {
      return Response.redirect(
        `https://${site.canonicalHost}${url.pathname}${url.search}`,
        301,
      );
    }
    if (
      url.pathname === "/api/notices" &&
      (site.projection.includes("tendertendertender") ||
        site.projection.includes("ukpublicmoney"))
    ) {
      const root = site.projection.includes("tendertendertender")
        ? "tendertendertender"
        : "ukpublicmoney";
      const object = await env.PUBLIC_DATA.get(
        `public-projections/${root}/notices.json`,
      );
      if (!object)
        return Response.json(
          { error: "projection unavailable" },
          {
            status: 503,
            headers: {
              "access-control-allow-origin": "https://tendertendertender.com",
              "cache-control": "no-store",
            },
          },
        );
      return new Response(object.body, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "access-control-allow-origin": "https://tendertendertender.com",
          "cache-control": "public, max-age=300",
          "x-content-type-options": "nosniff",
        },
      });
    }
    const state = await projectionState(env, site),
      crawlReady = state.ready && !preview;
    const previewHeaders = preview ? { "x-robots-tag": "noindex" } : {};
    if (url.pathname === "/sitemap.xml") {
      if (!crawlReady)
        return new Response("Not found", {
          status: 404,
          headers: { "content-type": "text/plain", "x-robots-tag": "noindex" },
        });
      if (
        site.projection.includes("australiancompanydata") ||
        site.projection.includes("charitysignal")
      ) {
        return new Response(sitemapIndexXml(origin), {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=86400",
            "x-content-type-options": "nosniff",
          },
        });
      }
      let records = state.data?.entities || [];
      let extraPaths = [];
      if (site.projection.includes("tendertendertender")) {
        const notices = await noticeData(env);
        records = notices?.records || [];
        const buyers = new Set();
        const categories = new Set();
        for (const record of records) {
          if (record.buyer_id || record.buyer_organisation)
            buyers.add(record.buyer_id || record.buyer_organisation);
          if (record.classification_id || record.classification_description)
            categories.add(
              record.classification_id || record.classification_description,
            );
        }
        extraPaths = [
          "/opportunities",
          "/buyers",
          "/categories",
          ...[...buyers].map((id) => `/buyer/${routeValue(id)}`),
          ...[...categories].map((id) => `/category/${routeValue(id)}`),
        ];
      } else if (site.projection.includes("tide-marine")) {
        const states = new Map();
        for (const record of records)
          if (record.state)
            states.set(record.state, (states.get(record.state) || 0) + 1);
        extraPaths = [...states]
          .filter(([, count]) => count >= 5)
          .map(([state]) => `/state/${routeValue(state)}`);
      } else if (site.projection.includes("floodingfacts")) {
        const rivers = new Map();
        for (const record of records)
          if (record.river)
            rivers.set(record.river, (rivers.get(record.river) || 0) + 1);
        extraPaths = [...rivers]
          .filter(([, count]) => count >= 5)
          .map(([river]) => `/river/${routeValue(river)}`);
      }
      return new Response(
        sitemapXml(
          origin,
          records.filter((record) => entityIndexable(site, record)),
          extraPaths,
        ),
        {
        headers: {
          "content-type": "application/xml; charset=utf-8",
          "cache-control": "public, max-age=900",
          "x-content-type-options": "nosniff",
        },
      },
      );
    }
    const sitemapShard = url.pathname.match(
      /^\/sitemaps\/(pages|[0-9a-f]{2})\.xml$/,
    );
    if (
      sitemapShard &&
      crawlReady &&
      (site.projection.includes("australiancompanydata") ||
        site.projection.includes("charitysignal"))
    ) {
      if (sitemapShard[1] === "pages")
        return new Response(sitemapXml(origin), {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=86400",
            "x-content-type-options": "nosniff",
          },
        });
      const root = site.projection.includes("australiancompanydata")
        ? "australiancompanydata"
        : "charitysignal";
      const object = await env.PUBLIC_DATA.get(
        `public-projections/${root}/shards/${sitemapShard[1]}.json.gz`,
      );
      const records = await gzipJson(object);
      if (!records)
        return new Response("Not found", {
          status: 404,
          headers: { "content-type": "text/plain", "x-robots-tag": "noindex" },
        });
      return new Response(
        sitemapXml(
          origin,
          records.filter((record) => entityIndexable(site, record)),
        ),
        {
        headers: {
          "content-type": "application/xml; charset=utf-8",
          "cache-control": "public, max-age=86400",
          "x-content-type-options": "nosniff",
        },
      },
      );
    }
    if (
      url.pathname === "/" &&
      site.projection.includes("tendertendertender")
    ) {
      const notices = await noticeData(env);
      if (notices)
        return response(
          tenderHome(site, notices, origin),
          200,
          crawlReady ? {} : { "x-robots-tag": "noindex" },
        );
    }
    if (
      site.projection.includes("tendertendertender") &&
      ["/opportunities", "/buyers", "/categories"].includes(url.pathname)
    ) {
      const notices = await noticeData(env);
      if (notices)
        return response(
          tenderBrowse(site, notices, origin, url),
          200,
          crawlReady ? {} : { "x-robots-tag": "noindex" },
        );
    }
    const tenderGroup = url.pathname.match(/^\/(buyer|category)\/([^/]+)$/);
    if (site.projection.includes("tendertendertender") && tenderGroup) {
      const notices = await noticeData(env);
      const page = notices
        ? tenderGroupPage(
            site,
            notices,
            origin,
            tenderGroup[1],
            decodeURIComponent(tenderGroup[2]),
          )
        : null;
      if (page)
        return response(
          page,
          200,
          crawlReady ? {} : { "x-robots-tag": "noindex" },
        );
    }
    const catalogGroup = url.pathname.match(/^\/(state|river)\/([^/]+)$/);
    if (
      catalogGroup &&
      ((catalogGroup[1] === "state" &&
        site.projection.includes("tide-marine")) ||
        (catalogGroup[1] === "river" &&
          site.projection.includes("floodingfacts")))
    ) {
      const id = decodeURIComponent(catalogGroup[2]);
      const groupCount = routeRecords(
        state.data?.entities || [],
        catalogGroup[1] === "state" ? "state" : "river",
        id,
      ).length;
      const page = catalogGroupPage(
        site,
        state.data,
        origin,
        catalogGroup[1],
        id,
      );
      if (page)
        return response(
          page,
          200,
          crawlReady && groupCount >= 5
            ? {}
            : { "x-robots-tag": "noindex, follow" },
        );
    }
    if (url.pathname === "/")
      return response(
        home(site, state.ready, origin, state.data),
        200,
        crawlReady ? {} : { "x-robots-tag": "noindex" },
      );
    if (
      url.pathname === "/warnings" &&
      site.projection.includes("floodingfacts")
    ) {
      const o = await env.PUBLIC_DATA.get(
        "public-projections/floodingfacts/warnings.json",
      );
      const c = await env.PUBLIC_DATA.get(
        "public-projections/floodingfacts/warnings-catalog.json",
      );
      if (!o || !c)
        return response(
          shell(
            site,
            "<h1>Current warnings unavailable</h1><p>Use the official Environment Agency service.</p>",
            { noindex: true, canonical: origin + url.pathname },
          ),
          503,
          { "x-robots-tag": "noindex" },
        );
      let data = await o.json();
      const meta = await c.json();
      try {
        const live = await fetch(
          "https://environment.data.gov.uk/flood-monitoring/id/floods",
          { headers: { accept: "application/json" } },
        );
        if (live.ok) {
          const source = await live.json();
          const fields = [
            "floodAreaID",
            "description",
            "eaAreaName",
            "severity",
            "severityLevel",
            "timeRaised",
            "timeMessageChanged",
            "timeSeverityChanged",
          ];
          data = {
            generatedAt: new Date().toISOString(),
            records: (source.items || []).map((item) =>
              Object.fromEntries(
                fields
                  .filter((field) => item[field] != null)
                  .map((field) => [field, item[field]]),
              ),
            ),
          };
        }
      } catch {}
      const rows = (data.records || [])
        .map(
          (x) =>
            `<tr><td>${esc(x.description)}</td><td>${esc(x.severity)}</td><td>${esc(x.timeMessageChanged || x.timeRaised)}</td></tr>`,
        )
        .join("");
      return response(
        shell(
          site,
          `<p class="eyebrow">Operational snapshot</p><h1>Environment Agency flood warnings</h1><div class="notice"><strong>Snapshot ${esc(data.generatedAt)}.</strong> This page is not an emergency service. <a href="https://check-for-flooding.service.gov.uk/">Check the live official service</a>.</div><table><thead><tr><th>Official area</th><th>Severity</th><th>Message changed</th></tr></thead><tbody>${rows}</tbody></table><p>${esc(meta.licence)} · <a href="${esc(meta.sourceUrl)}">official source</a></p>`,
          {
            title: `Current warning snapshot · ${site.name}`,
            noindex: true,
            canonical: origin + url.pathname,
          },
        ),
        200,
        { "x-robots-tag": "noindex" },
      );
    }
    if (url.pathname === "/sources")
      return response(
        sources(site, crawlReady, origin),
        200,
        crawlReady ? {} : { "x-robots-tag": "noindex" },
      );
    if (url.pathname === "/about")
      return response(
        shell(
          site,
          `<p class="eyebrow">About</p><h1>Evidence before claims.</h1><p class="lead">${esc(site.description)}</p><p>Every indexable page must have stable identity, approved rights, visible provenance, current evidence and a distinct user task. Empty, stale and unavailable states are kept separate.</p>`,
          {
            title: `About · ${site.name}`,
            noindex: !crawlReady,
            canonical: origin + "/about",
          },
        ),
        200,
        previewHeaders,
      );
    if (url.pathname === "/corrections")
      return response(
        shell(
          site,
          `<p class="eyebrow">Corrections</p><h1>Help us correct the evidence.</h1><p class="lead">If a record is wrong, stale or linked to the wrong entity, tell us exactly which page and field needs attention.</p><div class="grid"><section class="card"><small>Include</small><h2>The evidence needed</h2><p>Send the page URL, the field or statement concerned, the correct value and an authoritative source that supports the change.</p></section><section class="card"><small>Privacy</small><h2>Do not send personal records</h2><p>Do not include private addresses, personal contact details, identity documents or other unnecessary personal information.</p></section></div><p class="notice">Use the <a href="https://37xventures.com/#contact">37X Ventures correction form</a> and select the relevant project. Corrections are reviewed against the source before publication.</p>`,
          {
            title: `Corrections · ${site.name}`,
            noindex: !crawlReady,
            canonical: origin + "/corrections",
          },
        ),
        200,
        previewHeaders,
      );
    if (url.pathname === "/privacy")
      return response(
        shell(
          site,
          `<p class="eyebrow">Privacy</p><h1>Your choice comes first.</h1><p class="lead">This site does not load Google Analytics unless you explicitly choose “Allow analytics”. Declining does not limit the site.</p><div class="grid"><section class="card"><small>Before consent</small><h2>No analytics request</h2><p>Pages work without analytics. We do not send a measurement request to Google before consent, and preview, error and API responses are not measured.</p></section><section class="card"><small>After consent</small><h2>Aggregate usage only</h2><p>Analytics helps us understand which public pages are useful. Advertising storage, ad personalisation and Google signals are disabled.</p></section></div><p class="notice">Your choice is stored in this browser as <span class="code">37x-analytics-consent</span>. Clear this site’s local storage to choose again. Do not submit personal information through search or correction links.</p>`,
          {
            title: `Privacy · ${site.name}`,
            noindex: !crawlReady,
            canonical: origin + "/privacy",
          },
        ),
        200,
        previewHeaders,
      );
    if (url.pathname === "/robots.txt")
      return new Response(
        crawlReady
          ? `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`
          : "User-agent: *\nDisallow: /\n",
        { headers: { "content-type": "text/plain" } },
      );
    if (url.pathname === "/search") {
      if (!state.ready)
        return response(
          shell(
            site,
            `<h1>Evidence unavailable</h1><p>The approved public projection required for this answer is not available.</p>`,
            { noindex: true, canonical: origin + url.pathname },
          ),
          503,
          { "x-robots-tag": "noindex" },
        );
      const q = (url.searchParams.get("q") || "").trim();
      if (site.projection.includes("tendertendertender") && q)
        return Response.redirect(
          origin + `/opportunities?q=${encodeURIComponent(q)}`,
          302,
        );
      if (/^\d+$/.test(q) || q.startsWith("ocds-"))
        return Response.redirect(
          origin + `/entity/${encodeURIComponent(q)}`,
          302,
        );
      if (site.projection.includes("charitysignal") && q.length >= 2) {
        const results = await charitySearch(env, site, origin, q);
        if (results)
          return response(results, 200, { "x-robots-tag": "noindex" });
      }
      if (state.data?.entities) {
        const match = state.data.entities.find(
          (x) =>
            x.stationId === q ||
            x.id === q ||
            x.name?.toLowerCase() === q.toLowerCase(),
        );
        if (match)
          return Response.redirect(
            origin + `/entity/${match.stationId || match.id}`,
            302,
          );
      }
      return response(
        shell(
          site,
          "<h1>No exact match</h1><p>Try an official identifier or exact station name. Broad fuzzy results are not invented.</p>",
          { noindex: true, canonical: origin + url.pathname },
        ),
        404,
        { "x-robots-tag": "noindex" },
      );
    }
    if (url.pathname.startsWith("/entity/")) {
      if (!state.ready)
        return response(
          shell(
            site,
            "<h1>Evidence unavailable</h1><p>The approved public projection required for this answer is not available.</p>",
            { noindex: true, canonical: origin + url.pathname },
          ),
          503,
          { "x-robots-tag": "noindex" },
        );
      const id = decodeURIComponent(url.pathname.slice(8));
      const entity =
        state.data?.entities?.find(
          (record) => String(entityId(record)) === String(id),
        ) || (await getEntity(env, site, id));
      if (!entity)
        return response(
          shell(
            site,
            "<h1>Record not found</h1><p>No record with that exact approved identifier exists in this projection.</p>",
            { noindex: true, canonical: origin + url.pathname },
          ),
          404,
          { "x-robots-tag": "noindex" },
        );
      Object.defineProperty(entity, "_projectionGeneratedAt", {
        value: state.data?.generatedAt || null,
        enumerable: false,
      });
      return response(entityPage(site, entity, origin, id), 200, {
        ...previewHeaders,
        ...(entityIndexable(site, entity)
          ? {}
          : { "x-robots-tag": "noindex, follow" }),
      });
    }
    return response(
      shell(
        site,
        "<h1>Not found</h1><p>This URL does not identify a published evidence page.</p>",
        {
          title: `Not found · ${site.name}`,
          noindex: true,
          canonical: origin + url.pathname,
        },
      ),
      404,
      { "x-robots-tag": "noindex" },
    );
  },
};

// FloodingFacts has a river-monitoring identity even though this Worker can host
// several evidence products. Keep the override scoped to this site only.
const baseCss = css;
css = function siteSpecificCss(site) {
  const common = baseCss(site);
  if (site.name !== "FloodingFacts") return common;
  return `${common}
  body{background-color:#e9f4f7;background-image:repeating-radial-gradient(ellipse at 90% 5%,transparent 0,transparent 28px,#7db7c522 29px,#7db7c522 30px)}
  header{max-width:none;background:#07354a;color:#fff;border-bottom:6px solid #35c6e8;padding:1rem max(2rem,calc((100vw - 1180px)/2))}
  header nav a{color:#d8edf4}.brand b{border-radius:50%;background:#35c6e8;color:#07354a;box-shadow:none}
  main{padding-top:2.5rem}.hero{grid-template-columns:1.1fr .9fr;align-items:stretch;background:#fff;border:1px solid #a9c6cf;padding:2rem;margin-bottom:2rem}
  .hero h1{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:clamp(2.8rem,5vw,5.3rem);line-height:.93;letter-spacing:-.06em}
  .hero .stat{background:#07354a;color:#fff;border:0;border-top:8px solid #35c6e8;padding:2rem;display:flex;flex-direction:column;justify-content:end}
  .search{border-radius:0;box-shadow:none;border:2px solid #07354a}.search button,.button{border-radius:0;background:#35c6e8;color:#07354a}
  .station-title{border-radius:0;background:#07354a}.reading-card,.evidence-card,.panel,.visual-panel,.chart-panel{border-radius:0;border-color:#9ebdc7;box-shadow:none}
  .reading-value{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.feature-band{border-radius:0;background:#07354a}
  @media(max-width:720px){header nav{overflow:auto;flex-wrap:nowrap;width:100%}.hero{display:block;padding:1.25rem}.hero .stat{margin-top:1.25rem}.hero h1{font-size:3rem}}
  `;
};
