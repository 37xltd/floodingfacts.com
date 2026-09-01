import test from "node:test";
import assert from "node:assert/strict";
import worker, { entityPage } from "../src/index.js";
import { sites } from "../src/sites.js";

for (const key of Object.keys(sites)) {
  test(`${key} fails closed without a public projection`, async () => {
    const env = { SITE_KEY: key, PUBLIC_DATA: { get: async () => null } };
    const home = await worker.fetch(new Request("https://example.test/"), env);
    assert.equal(home.status, 200);
    assert.equal(home.headers.get("x-robots-tag"), "noindex");
    assert.match(await home.text(), /Evidence gate active/);
    const entity = await worker.fetch(
      new Request("https://example.test/entity/x"),
      env,
    );
    assert.equal(entity.status, 503);
    assert.equal(entity.headers.get("x-robots-tag"), "noindex");
  });
}

test("approved projection opens the crawl gate", async () => {
  const env = {
    SITE_KEY: "tide",
    PUBLIC_DATA: {
      get: async () => ({
        json: async () => ({
          publicationStatus: "approved",
          publicProjection: true,
        }),
      }),
    },
  };
  const home = await worker.fetch(new Request("https://example.test/"), env);
  assert.equal(home.headers.get("x-robots-tag"), null);
  assert.doesNotMatch(await home.text(), /Evidence gate active/);
  const robots = await worker.fetch(
    new Request("https://example.test/robots.txt"),
    env,
  );
  assert.match(
    await robots.text(),
    /Sitemap: https:\/\/example\.test\/sitemap\.xml/,
  );
  const sitemap = await worker.fetch(
    new Request("https://example.test/sitemap.xml"),
    env,
  );
  assert.equal(sitemap.status, 200);
  assert.equal(
    sitemap.headers.get("content-type"),
    "application/xml; charset=utf-8",
  );
  assert.match(await sitemap.text(), /<loc>https:\/\/example\.test\/<\/loc>/);
});

test("closed projections do not expose an XML sitemap", async () => {
  const env = { SITE_KEY: "tide", PUBLIC_DATA: { get: async () => null } };
  const sitemap = await worker.fetch(
    new Request("https://example.test/sitemap.xml"),
    env,
  );
  assert.equal(sitemap.status, 404);
  assert.equal(sitemap.headers.get("x-robots-tag"), "noindex");
});

test("shared evidence sites expose methodology and privacy-safe corrections", async () => {
  const env = {
    SITE_KEY: "asic",
    PUBLIC_DATA: {
      get: async () => ({
        json: async () => ({
          publicationStatus: "approved",
          publicProjection: true,
        }),
      }),
    },
  };
  const home = await worker.fetch(
    new Request("https://australiancompanydata.com/"),
    env,
  );
  const html = await home.text();
  assert.match(html, /Sources &amp; method/);
  assert.match(html, /href="\/corrections"/);
  assert.match(html, /Report a correction/);
  const corrections = await worker.fetch(
    new Request("https://australiancompanydata.com/corrections"),
    env,
  );
  assert.equal(corrections.status, 200);
  const correctionsHtml = await corrections.text();
  assert.match(correctionsHtml, /Help us correct the evidence/);
  assert.match(correctionsHtml, /Do not send personal records/);
  assert.match(correctionsHtml, /37xventures\.com\/#contact/);
  const privacy = await worker.fetch(
    new Request("https://australiancompanydata.com/privacy"),
    env,
  );
  assert.equal(privacy.status, 200);
  assert.match(await privacy.text(), /No analytics request/);
});

test("analytics is consent-first and only emitted on an eligible canonical host", async () => {
  const env = {
    SITE_KEY: "tide",
    PUBLIC_DATA: {
      get: async () => ({
        json: async () => ({
          publicationStatus: "approved",
          publicProjection: true,
        }),
      }),
    },
  };
  const canonical = await worker.fetch(new Request("https://tide99.com/"), env);
  const html = await canonical.text();
  assert.equal((html.match(/G-PYM0VS93F6/g) || []).length, 1);
  assert.match(html, /No analytics loads before you accept/);
  assert.match(html, /analytics_storage:'granted'/);
  assert.match(html, /ad_storage:'denied'/);
  assert.doesNotMatch(
    html,
    /<script[^>]+src=["']https:\/\/www\.googletagmanager\.com/,
  );
  const preview = await worker.fetch(
    new Request("https://us-tide-marine-conditions.example.workers.dev/"),
    env,
  );
  assert.doesNotMatch(await preview.text(), /G-PYM0VS93F6|data-consent/);
});

test("large company projections use R2-backed sitemap shards", async () => {
  const env = {
    SITE_KEY: "asic",
    PUBLIC_DATA: {
      get: async () => ({
        json: async () => ({
          publicationStatus: "approved",
          publicProjection: true,
        }),
      }),
    },
  };
  const sitemap = await worker.fetch(
    new Request("https://australiancompanydata.com/sitemap.xml"),
    env,
  );
  const xml = await sitemap.text();
  assert.match(xml, /<sitemapindex/);
  assert.match(xml, /\/sitemaps\/00\.xml/);
  assert.match(xml, /\/sitemaps\/ff\.xml/);
  assert.equal((xml.match(/<sitemap>/g) || []).length, 257);
});

test("FloodingFacts turns raw station fields into a user-first dashboard", () => {
  const html = entityPage(
    sites.river,
    {
      stationReference: "1771TH",
      label: "Letcombe Regis",
      riverName: "Letcombe Brook",
      town: "Letcombe Regis",
      catchmentName: "Vale of White Horse",
      lat: 51.571482,
      long: -1.449342,
      status: "http://example/statusActive",
      liveReadingRetrievedAt: "2026-08-30T15:49:12.125Z",
      measures: [
        {
          measure_id: "http://example/1771TH-level-mASD",
          observation_time: "2026-08-30T08:00:00Z",
          value: -0.087,
        },
      ],
    },
    "https://floodingfacts.com",
    "1771TH",
  );
  assert.match(html, /Letcombe Regis river level and station reading/);
  assert.match(html, /Latest published reading/);
  assert.match(html, /-0\.087 <span>mASD<\/span>/);
  assert.match(html, /Check official flood warnings/);
  assert.match(html, /View station map/);
  assert.match(html, /Where is Letcombe Regis\?/);
  assert.match(html, /openstreetmap\.org\/export\/embed\.html/);
  assert.match(html, /Map data ©/);
  assert.match(html, /not a site boundary, safety zone or property-risk area/);
  assert.match(html, /does not currently have an approved typical range/);
  assert.match(html, /Download report \(PDF\)/);
  assert.match(html, /choose “Save as PDF”/);
  assert.match(html, /@page\{size:A4/);
  assert.match(html, /Evidence report · prepared/);
  assert.doesNotMatch(html, />LiveReadingRetrievedAt</);
  assert.ok(
    html.indexOf("Technical record and provenance") <
      html.indexOf("http://example/1771TH-level-mASD"),
  );
});

test("TenderTenderTender exposes browse navigation and notice discovery", async () => {
  const notices = {
    records: [
      {
        ocid: "ocds-test-1",
        buyer_id: "GB-CFS-123",
        buyer_organisation: "Example Council",
        classification_id: "45000000",
        classification_description: "Building services",
        tender_status: "active",
        tender_deadline: "2026-09-10T12:00:00Z",
        published_date: "2026-08-30T12:00:00Z",
      },
    ],
  };
  const env = {
    SITE_KEY: "tender",
    PUBLIC_DATA: {
      get: async (key) => ({
        json: async () =>
          key.endsWith("catalog.json")
            ? { publicationStatus: "approved", publicProjection: true }
            : notices,
      }),
    },
  };
  const home = await worker.fetch(
    new Request("https://tendertendertender.com/"),
    env,
  );
  const homeHtml = await home.text();
  assert.match(homeHtml, /href="\/opportunities"/);
  assert.match(homeHtml, /href="\/buyers"/);
  assert.match(homeHtml, /href="\/categories"/);
  assert.match(homeHtml, /Example Council/);
  const buyers = await worker.fetch(
    new Request("https://tendertendertender.com/buyers"),
    env,
  );
  assert.match(await buyers.text(), /href="\/buyer\/GB-CFS-123"/);
  const buyer = await worker.fetch(
    new Request("https://tendertendertender.com/buyer/GB-CFS-123"),
    env,
  );
  assert.equal(buyer.status, 200);
  assert.match(await buyer.text(), /Example Council contract notices/);
  const category = await worker.fetch(
    new Request("https://tendertendertender.com/category/45000000"),
    env,
  );
  assert.equal(category.status, 200);
  assert.match(await category.text(), /Building services contract notices/);
  const search = await worker.fetch(
    new Request("https://tendertendertender.com/search?q=building"),
    env,
  );
  assert.equal(search.status, 302);
  assert.match(search.headers.get("location"), /opportunities\?q=building/);
  const sitemap = await worker.fetch(
    new Request("https://tendertendertender.com/sitemap.xml"),
    env,
  );
  const sitemapXml = await sitemap.text();
  assert.match(
    sitemapXml,
    /<loc>https:\/\/tendertendertender\.com\/buyers<\/loc>/,
  );
  assert.match(
    sitemapXml,
    /<loc>https:\/\/tendertendertender\.com\/entity\/ocds-test-1<\/loc>/,
  );
  assert.match(sitemapXml, /\/buyer\/GB-CFS-123/);
  assert.match(sitemapXml, /\/category\/45000000/);
});

test("Tide and FloodingFacts expose durable geographic browse pages", async () => {
  const catalogs = {
    tide: {
      publicationStatus: "approved",
      publicProjection: true,
      entities: [
        {
          stationId: "8518750",
          name: "The Battery",
          state: "NY",
          predictionCount: 12,
          observationCount: 3,
        },
      ],
    },
    river: {
      publicationStatus: "approved",
      publicProjection: true,
      entities: [
        { id: "A", name: "Upper Gauge", river: "River Test", town: "Alpha" },
        { id: "B", name: "Lower Gauge", river: "River Test", town: "Beta" },
      ],
    },
  };
  for (const [key, path, expected] of [
    ["tide", "/state/NY", /NOAA stations in NY/],
    ["river", "/river/River%20Test", /River Test monitoring stations/],
  ]) {
    const env = {
      SITE_KEY: key,
      PUBLIC_DATA: { get: async () => ({ json: async () => catalogs[key] }) },
    };
    const page = await worker.fetch(
      new Request(`https://${sites[key].canonicalHost}${path}`),
      env,
    );
    assert.equal(page.status, 200);
    assert.match(await page.text(), expected);
    const sitemap = await worker.fetch(
      new Request(`https://${sites[key].canonicalHost}/sitemap.xml`),
      env,
    );
    assert.match(await sitemap.text(), new RegExp(path.replace("%20", "%20")));
  }
});

test("Tide turns predictions and observations into a planning dashboard", () => {
  const html = entityPage(
    sites.tide,
    {
      stationId: "8518750",
      name: "The Battery",
      state: "NY",
      predictions: [
        {
          prediction_time: "2026-08-31 04:12",
          height_m: "1.42",
          high_low: "H",
          datum: "MLLW",
          time_zone: "lst_ldt",
        },
        {
          prediction_time: "2026-08-31 10:20",
          height_m: "0.08",
          high_low: "L",
          datum: "MLLW",
          time_zone: "lst_ldt",
        },
      ],
      observations: [
        {
          observation_time: "2026-08-30 17:00",
          water_level_m: "0.72",
          quality: "v",
          datum: "MLLW",
          time_zone: "gmt",
        },
      ],
    },
    "https://tide99.com",
    "8518750",
  );
  assert.match(html, /The Battery tide times and water levels/);
  assert.match(html, /Latest stored observation/);
  assert.match(html, /Next published high and low tides/);
  assert.match(html, /Open NOAA station/);
  assert.match(html, /For navigation or safety/);
  assert.match(html, /Download report \(PDF\)/);
});

test("CharitySignal turns approved organisation fields into an evidence view", () => {
  const html = entityPage(
    sites.charity,
    {
      organisation_number: "123",
      registered_charity_number: "456789",
      charity_name: "Example Trust",
      charity_registration_status: "Registered",
      date_of_registration: "2001-02-03",
      latest_income: 250000,
      latest_expenditure: 210000,
      latest_acc_fin_period_end_date: "2025-12-31",
      charity_type: "Charitable company",
      charity_reporting_status: "Up to date",
      date_of_extract: "2026-08-30",
    },
    "https://charitysignal.co.uk",
    "123",
  );
  assert.match(html, /Example Trust: income, status and filings/);
  assert.match(html, /Latest reported income/);
  assert.match(html, /£250,000/);
  assert.match(html, /Income less expenditure/);
  assert.match(html, /Open official register/);
  assert.match(html, /Complete approved organisation record/);
});

for (const key of ["boat", "fcc", "vehicleimport"]) {
  test(`${key} preview is useful but remains fail-closed`, async () => {
    const env = { SITE_KEY: key, PUBLIC_DATA: { get: async () => null } };
    const page = await worker.fetch(
      new Request(`https://${sites[key].canonicalHost}/`),
      env,
    );
    const html = await page.text();
    assert.equal(page.headers.get("x-robots-tag"), "noindex");
    assert.match(html, /Evidence gate active/);
    assert.match(html, /A decision tool, not a data dump/);
    assert.match(html, /Sources &amp; method/);
    assert.match(html, /Corrections/);
    assert.match(html, new RegExp(sites[key].analyticsId));
    assert.match(html, /No analytics loads before you accept/);
  });
}
