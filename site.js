// The parts of the site the admin dashboard edits, rendered from content.json, and the download list from the GitHub
// API (spec: dashboard and website, section 5). Text is only ever set through text nodes and setAttribute, so nothing
// in content.json or in a release name can become markup. Each section renders on its own: bad data leaves that
// section's built-in fallback text, never a blank page.

export const MEDIA_NAME = /^[a-z0-9-]{1,48}\.(png|jpe?g|webp|mp4)$/;
export const RELEASES_PAGE = "https://github.com/ShadowsTT/Tap-Titans2-Bot-Releases/releases/latest";
const RELEASES_API = "https://api.github.com/repos/ShadowsTT/Tap-Titans2-Bot-Releases/releases?per_page=100";
const DOWNLOAD_PREFIX = "https://github.com/ShadowsTT/Tap-Titans2-Bot-Releases/releases/download/";
const AMOUNT = /^(0|[1-9][0-9]{0,5})(\.[0-9]{2})?$/;
const CURRENCY = /^[A-Z]{3}$/;
const HTTPS_URL = /^https:\/\/[A-Za-z0-9.-]+(\/[^\s"'<>]*)?$/;
export const PLATFORM_LABELS = {
  "windows-installer": "Windows installer",
  "windows-portable": "Windows portable (zip)",
  "macos-dmg": "macOS (Apple silicon)",
  "linux-appimage": "Linux AppImage",
  "linux-deb": "Linux .deb (Debian, Ubuntu)",
};

export function text(value) { return typeof value === "string" ? value : ""; }
export function listOf(value) { return Array.isArray(value) ? value : []; }

export function mediaUrl(name, kinds) {
  if (typeof name !== "string" || !MEDIA_NAME.test(name)) return "";
  return kinds.includes(name.endsWith(".mp4") ? "video" : "image") ? `media/${name}` : "";
}

export function posterOf(name) { return mediaUrl(name, ["video"]).replace(/\.mp4$/, ".jpg"); }

export function priceText(plan) {
  if (plan && plan.id === "trial") return "Free";
  const price = plan && plan.price;
  if (price && AMOUNT.test(price.amount) && CURRENCY.test(price.currency) && typeof price.amount === "string") {
    return `${price.amount} ${price.currency}`;
  }
  return "Price coming soon";
}

export function buyUrl(buy) {
  return buy && buy.mode === "link" && typeof buy.url === "string" && buy.url.length <= 300 && HTTPS_URL.test(buy.url)
    ? buy.url : "";
}

export function platformOf(name) {
  if (typeof name !== "string") return "other";
  if ((name.startsWith("TapTitans2Bot-Setup-") && name.endsWith(".exe")) || name === "TapTitans2Bot.exe") return "windows-installer";
  if (name.endsWith("-windows-portable.zip")) return "windows-portable";
  if (name.endsWith(".dmg")) return "macos-dmg";
  if (name.endsWith(".AppImage")) return "linux-appimage";
  if (name.endsWith(".deb")) return "linux-deb";
  return "other";
}

export function downloadRows(release) {
  const order = Object.keys(PLATFORM_LABELS);
  const rows = [];
  for (const asset of listOf(release && release.assets)) {
    const name = text(asset && asset.name), url = text(asset && asset.browser_download_url);
    const platform = platformOf(name);
    if (platform !== "other" && url.startsWith(DOWNLOAD_PREFIX)) rows.push({ platform, label: PLATFORM_LABELS[platform], name, url });
  }
  return rows.sort((a, b) => order.indexOf(a.platform) - order.indexOf(b.platform));
}

function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== "" && value !== false && value != null) node.setAttribute(name, value === true ? "" : String(value));
  }
  node.append(...children); // strings become text nodes
  return node;
}

function fill(id, nodes) {
  const target = document.getElementById(id);
  if (target && nodes.length) target.replaceChildren(...nodes);
}

function picture(name, alt) {
  const src = mediaUrl(name, ["image"]);
  return src ? [el("img", { src, alt, loading: "lazy", decoding: "async" })] : [];
}

export function renderHero(content) {
  const hero = content.hero || {};
  const title = document.getElementById("hero-title"), body = document.getElementById("hero-text");
  if (title && text(hero.title)) title.textContent = hero.title;
  if (body && text(hero.text)) body.textContent = hero.text;
  const video = document.getElementById("hero-video"), src = mediaUrl(hero.video, ["video"]);
  if (!video || !src) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) video.preload = "none"; // set before src: nothing downloads until the visitor presses play
  video.poster = mediaUrl(hero.poster, ["image"]);
  video.src = src;
  document.getElementById("hero-media").hidden = false;
  video.controls = true; // looping motion over 5 s must be pausable (WCAG 2.2.2)
  if (!reduced) {
    video.play().catch(() => {}); // autoplay refused: the controls are already there
  } // reduced motion: no autoplay, the visitor starts it
}

export function renderFeatures(content) {
  fill("features", listOf(content.features).filter((item) => text(item && item.title)).map((item) =>
    el("article", { class: "feature" }, ...picture(item.image, item.title),
      el("div", { class: "feature-copy" }, el("h3", {}, item.title), el("p", {}, text(item.text))))));
}

export function renderGallery(content) {
  fill("gallery", listOf(content.gallery).filter((item) => text(item && item.caption)).flatMap((item) => {
    const caption = el("figcaption", {}, item.caption);
    const video = item.type === "video" ? mediaUrl(item.file, ["video"]) : "";
    if (video) {
      return [el("figure", { class: "gallery-video" }, el("video", { src: video, poster: posterOf(item.file), controls: true, muted: true,
        playsinline: true, preload: "none", "aria-label": item.caption }), caption)];
    }
    const image = item.type === "image" ? picture(item.file, item.caption) : [];
    return image.length ? [el("figure", { class: item.file.startsWith("app-") ? "gallery-wide" : "gallery-phone" },
      ...image, caption)] : [];
  }));
}

export function renderPlans(content) {
  const link = buyUrl(content.buy);
  fill("plans", listOf(content.plans).filter((plan) => text(plan && plan.name)).map((plan) => {
    const action = plan.id === "trial"
      ? el("a", { class: "button ghost", href: "download.html#trial" }, "Start the free trial")
      : link ? el("a", { class: "button primary", href: link, rel: "noopener" }, "Buy")
        : el("span", { class: "button", "aria-disabled": "true" }, "Coming soon");
    return el("article", { class: "card plan" }, el("h3", {}, plan.name), el("p", { class: "duration" }, text(plan.duration)),
      el("p", { class: "price" }, priceText(plan)), el("p", {}, text(plan.blurb)), action);
  }));
  const note = document.getElementById("buy-note");
  if (note) note.hidden = Boolean(link);
}

export function renderFaq(content) {
  fill("faq", listOf(content.faq).filter((item) => text(item && item.q) && text(item && item.a))
    .flatMap((item) => [el("dt", {}, item.q), el("dd", {}, item.a)]));
}

const RENDERERS = [renderHero, renderFeatures, renderGallery, renderPlans, renderFaq];

export function renderAll(content, renderers = RENDERERS) {
  if (!content || typeof content !== "object" || Array.isArray(content)) return [];
  const failed = [];
  for (const render of renderers) {
    try {
      render(content);
    } catch (error) {
      failed.push(render.name);
      console.error(`site: ${render.name} failed; that section keeps its built-in text`, error);
    }
  }
  return failed;
}

async function loadContent() {
  try {
    const response = await fetch("content.json", { cache: "no-cache" });
    return response.ok ? await response.json() : null;
  } catch (error) {
    console.error("site: content.json could not be loaded; the page keeps its built-in text", error);
    return null;
  }
}

function recentReleases(data) {
  return listOf(data).filter((release) => release && !release.draft && !release.prerelease
    && text(release.tag_name) && /^\d{4}-\d{2}-\d{2}T/.test(text(release.published_at))
    && Number.isFinite(Date.parse(release.published_at)))
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at)).slice(0, 3);
}

function releaseLines(body) {
  return text(body).split(/\r?\n/).map((line) => line
    .replace(/^\s*(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+|>\s*)/, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*`]/g, "").trim()).filter(Boolean);
}

function availabilityRows(rows) {
  const systems = [["windows", "Windows"], ["macos", "macOS (Apple silicon)"], ["linux", "Linux (x86_64)"]];
  return systems.flatMap(([platform, label]) => {
    const available = rows.filter((row) => row.platform.startsWith(platform));
    return available.length
      ? available.map((row) => el("li", {}, el("a", { href: row.url }, row.label), ` · ${row.name}`))
      : [el("li", {}, `${label} · Coming with the next release`)];
  });
}

export async function renderDownloads() {
  if (!document.getElementById("downloads")) return;
  try {
    const response = await fetch(RELEASES_API, { headers: { Accept: "application/vnd.github+json" },
      credentials: "omit", referrerPolicy: "no-referrer" });
    if (!response.ok) return; // the static links to GitHub stay
    const releases = recentReleases(await response.json());
    if (!releases.length) return;
    fill("downloads", [
      el("p", {}, `Version ${releases[0].tag_name.replace(/^v/, "")}`),
      el("ul", { class: "downloads" }, ...availabilityRows(downloadRows(releases[0]))),
      el("p", {}, el("a", { href: RELEASES_PAGE }, "All files on GitHub")),
    ]);
    fill("release-notes", releases.map((release) => el("article", {},
      el("h3", {}, release.tag_name),
      el("p", {}, el("time", { datetime: release.published_at }, release.published_at.slice(0, 10))),
      ...releaseLines(release.body).map((line) => el("p", {}, line)))));
  } catch (error) {
    console.error("site: the release list could not be loaded; the links to GitHub stay", error);
  }
}

async function main() {
  renderAll(await loadContent());
  renderDownloads();
}

if (typeof document !== "undefined") main();
