// Tickets pane: one Azure DevOps work item beside Claude, keyboard driven.
//
// Open:  herdr-app do pane.split --direction right --mod my-tickets --props '{"id":12345}'
//        herdr-app do pane.split --direction right --mod my-tickets            (the browser)
//
// Views: the browser (current sprint or backlog, [ ] other sprints, @ u m filters, / search),
// the item (story or bug), pointing (p), comments (c), reply/new comment (enter/a),
// reactions (+ / e), ask Claude (:). Every write to Azure sits behind a y/n row.
// From the browser, enter opens the item in this same pane; esc comes back; n/N step through.
//
// Data comes from the Azure CLI on the WSL machine (`exec(..., { on: "wsl" })`): work-item show,
// WIQL is not needed for one item, comments/history/reactions through `az rest`, writes through
// JSON-patch on the work item. Images in fields are attachment URLs: downloaded once into
// <app home>/cache/tickets/<guid>.<ext> from WSL (the app home is on /mnt/c) and drawn with image().
//
// Keys (browser): x marks a ticket, d deploys the marked tickets (or the one under the cursor) as ONE
//               group to the orchestrator session (Herdr space orchSpace, tab orchTab; started when
//               missing). The message starts "[my-tickets deploy]" and asks the orchestrator to run deploySkill.
// Keys (item):  j k d u  scroll   p point   c comments   : ask Claude   e explain (Claude sums it up in plain words)   o browser   O first image
//               r refresh   y copy URL   esc/h back to the terminal   q close the pane
// Keys (comments): j k move   a new   enter reply   + like   e react   r refresh   esc back
// Keys (compose):  type; @ opens the people picker (j k pick, tab/enter insert); ctrl-enter post; esc discard
//
// Config: mods/my-tickets/local.json (gitignored), overridden by --props. Without org and project the pane says so.
//   { "org": "https://dev.azure.com/<org>", "project": "<project>", "machine": "wsl" (or "local"),
//     "orchSpace": "<space>", "orchTab": "orchestrator", "parent": "<folder for a new orchestrator>", "deploySkill": "<skill>" }

import { View, div, image } from "gpui-kit";
import { v_flex, h_flex, TextView, Textarea, TextareaState, Input, InputState } from "gpui-base";
import { props, theme, exec, hc, run, focused, panes, agents, spaces, checking, nextCommand, appHome, notify, readTextFile } from "herdr";
import * as fs from "fs/promises";

const ADO_RESOURCE = "499b84ac-1321-427f-aa17-267ca6975798";
const LINE = 44;
// What e sends after the ticket text: a plain-language summary, pitched for a first read.
const EXPLAIN_PROMPT = [
  "Explain this ticket to me in plain language, for a first read. Do not start any work on it.",
  "Lead with what it asks for, in one or two sentences. Then, as short bullets: why it matters,",
  "what has to change and where (which part of the system, in everyday words), and how we will know it is done.",
  "Short sentences, one idea each. If a technical term is needed, say what it means right there.",
  "Add one small concrete example if it helps. Keep it under 150 words.",
].join(" ");
const POINTS = ["1", "2", "3", "5", "8", "13", "?"];

const F = {
  title: "System.Title", type: "System.WorkItemType", state: "System.State", assigned: "System.AssignedTo",
  iteration: "System.IterationPath", tags: "System.Tags", priority: "Microsoft.VSTS.Common.Priority",
  severity: "Microsoft.VSTS.Common.Severity", points: "Microsoft.VSTS.Scheduling.StoryPoints",
  work: "Custom.AmountofWork", complexity: "Custom.ComplexityofWork", uncertainty: "Custom.Uncertainty",
  risk: "Custom.RiskorUncertainty", description: "System.Description",
  criteria: "Microsoft.VSTS.Common.AcceptanceCriteria", summary: "Custom.Summary",
  repro: "Microsoft.VSTS.TCM.ReproSteps", expected: "Custom.ExpectedBehavior", actual: "Custom.ActualBehavior",
  sysinfo: "Microsoft.VSTS.TCM.SystemInfo", created: "System.CreatedDate", createdBy: "System.CreatedBy",
  changedBy: "System.ChangedBy", changed: "System.ChangedDate", commentCount: "System.CommentCount",
};

// The pointing rows, by work item type. Bugs rate risk, stories rate uncertainty.
const factorsFor = (type) => [
  { key: "work", field: F.work, label: "Amount of work", values: ["1", "3", "7"] },
  { key: "complexity", field: F.complexity, label: "Complexity", values: ["1", "3", "7"] },
  type === "Bug"
    ? { key: "risk", field: F.risk, label: "Risk", values: ["1", "3", "7"] }
    : { key: "uncertainty", field: F.uncertainty, label: "Uncertainty", values: ["1", "4", "7"] },
];

const REACTIONS = ["like", "heart", "hooray", "smile", "confused", "dislike"];

// List grouping, in the order the team works a ticket. Unknown states go after these.
const STATE_ORDER = ["Blocked", "Active", "Dev Active", "Dev Review", "Stakeholder Design Review", "Ready for Testing",
  "QA Active", "QA Pass", "Ready For Release", "Dev Done", "Sprint Backlog", "Product Backlog", "New", "Wont Do", "Closed"];
const FOLDED_IN_SPRINT = new Set(["Sprint Backlog", "New"]);
const LIST_COLUMNS = "[System.Id],[System.Title],[System.WorkItemType],[System.State],[System.AssignedTo],[Microsoft.VSTS.Scheduling.StoryPoints],[Microsoft.VSTS.Common.Priority],[System.Tags],[System.ChangedDate]";
const wiqlStr = (s) => String(s).replace(/'/g, "''");
// "Bruce Nguyen" -> "Bruce N"
const shortName = (n) => { const p = (n ?? "").trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}` : p[0] ?? ""; };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "2026-11-17" (a calendar date, no zone shift) or an ISO timestamp -> "Nov 17"
const mmdd = (s) => {
  if (!s) return "";
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m && String(s).length === 10) return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
  const d = new Date(s); return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
};

const lastLine = (s) => (s ?? "").trim().split("\n").filter(Boolean).pop() ?? "";
const errText = (e) => String(e?.message ?? e).replace(/^ERROR:\s*/i, "");
const name = (v) => (v && typeof v === "object" ? v.displayName : v) ?? "";
const idOf = (v) => (v && typeof v === "object" ? v.id : null);

// C:\Users\x\.config\herdr-app -> /mnt/c/Users/x/.config/herdr-app
const isWin = () => /^[A-Za-z]:[\\/]/.test(appHome());
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
// base64 text (whitespace ignored) to bytes: images come back from the az machine this way.
function fromBase64(text) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const map = new Int16Array(128).fill(-1); for (let i = 0; i < 64; i++) map[A.charCodeAt(i)] = i;
  const clean = text.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0, buf = 0, bits = 0;
  for (let i = 0; i < clean.length; i++) {
    buf = (buf << 6) | map[clean.charCodeAt(i)]; bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 255; }
  }
  return out.subarray(0, o);
}

function when(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  return mmdd(iso);
}

// "2- High – element affects…" -> "Sev 2 · High"
function severity(s) {
  const m = (s ?? "").match(/^(\d)\s*-\s*([A-Za-z]+)/);
  return m ? `Sev ${m[1]} · ${m[2]}` : s ?? "";
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", "#160": " " };
const decode = (s) => s.replace(/&(#?\w+);/g, (m, k) => ENTITIES[k] ?? (k[0] === "#" ? String.fromCharCode(Number(k.slice(1))) || m : m));

// Azure's rich text (HTML) as blocks: markdown text, and images by attachment id.
function blocks(html) {
  if (!html) return [];
  const out = [];
  const parts = html.split(/(<img\b[^>]*>)/i);
  for (const part of parts) {
    if (/^<img/i.test(part)) {
      const src = decode(part.match(/\bsrc=["']?([^"'\s>]+)/i)?.[1] ?? "");
      const guid = src.match(/\/attachments\/([0-9a-f-]{36})/i)?.[1];
      const file = src.match(/[?&]fileName=([^&]+)/i)?.[1];
      if (guid) out.push({ image: { guid, url: src, name: file ? decodeURIComponent(file) : "image" } });
      continue;
    }
    let t = part
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h\d|tr)>/gi, "\n\n")
      .replace(/<li[^>]*>/gi, "\n- ")
      .replace(/<\/(ul|ol)>/gi, "\n")
      .replace(/<(b|strong)\b[^>]*>/gi, "**").replace(/<\/(b|strong)>/gi, "**")
      .replace(/<(i|em)\b[^>]*>/gi, "_").replace(/<\/(i|em)>/gi, "_")
      .replace(/<code\b[^>]*>/gi, "`").replace(/<\/code>/gi, "`")
      .replace(/<h\d\b[^>]*>/gi, "\n\n### ")
      .replace(/<a\b[^>]*href=["']?([^"'\s>]+)[^>]*>(.*?)<\/a>/gi, (_, href, text) => (text.trim() && text.trim() !== href ? `${text} (${href})` : href))
      .replace(/<[^>]+>/g, "");
    t = decode(t).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (t) out.push({ text: t });
  }
  return out;
}

// Plain text as Azure comment HTML, with @mentions as the anchors Azure notifies on.
function toHtml(text, mentions) {
  let h = text.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  for (const m of mentions) {
    const needle = `@${m.name}`;
    h = h.split(needle).join(`<a href="#" data-vss-mention="version:2.0,${m.id}">${needle}</a>`);
  }
  return `<div>${h.replace(/\n/g, "<br>")}</div>`;
}

export default class Tickets extends View {
  init(_props, cx) {
    const p = props() ?? {};
    this.props = p;
    this.configure({});
    this.id = p.id ? Number(p.id) : null;
    this.handle = cx.focus_handle();
    // The init context outlives any one event: async work redraws through it, since an event's cx is stale after an await.
    // Its notify can land on whichever view's call is running, so loaders also call redraw() (a timer tick owned by this view).
    this.acx = cx;
    this.view = this.id ? "item" : "list";
    this.returnTo = null; // "list" when the item was opened from the browser
    this.me = null; // my sign-in name (uniqueName), for the m filter
    this.iterations = null; // [{ name, path, start, finish }], oldest first
    this.sprintAt = -1; // index into iterations
    // The browser opens on the current sprint filtered to my tickets (m toggles it off); with a person filter nothing starts folded.
    this.list = { tab: "sprint", rows: null, cursor: 0, folded: new Set(), picker: null, person: "me", search: "", searching: false, wontDo: false, fetchedAt: 0, people: null, marked: [] }; // marked: ticket ids in the order x marked them; the first is the group's lead
    this.pendingPoint = false;
    this.statePick = null; // { list, at, query, current } while choosing a state
    this.item = null; // { id, type, fields, rev, blocks: {...} }
    this.comments = null; // [{ id, who, whoId, when, blocks, reactions: [{type, count, mine}] }]
    this.people = []; // [{ name, id }]
    this.images = new Map(); // guid -> { status, path, name, url }
    this.error = null;
    this.busy = null; // a short line while az runs
    this.fetchedAt = 0;
    this.y = 0; this.viewH = 0; this.contentH = 0; this.pendingG = false;
    this.cursor = 0; // comments
    this.rowTop = []; // measured comment row offsets
    this.point = null; // { rows: [{...factor, at}], points, row }
    this.confirm = null; // { title, lines: [], run: async () => {} }
    this.reactPick = null; // index into REACTIONS while picking
    this.compose = null; // { state, replyTo, mentions: [], picker: null | { at }, kind: "comment" | "ask" }
    this.tab = focused()?.tab ?? null; // where the Claude terminal lives
    if (checking()) return;
    try { this.me = localStorage.getItem("me") || null; } catch {}
    this.cache();
    // The first load starts from a timer tick owned by this view, not from init itself. Opened by a key in
    // another mod (the leader's t), init runs inside that mod's call, and work started there belongs to a popup
    // that closes right after: its exec never answered and the list stayed on "Loading…".
    cx.timer.after(0, (cx) => {
      this.readConfig().then(() => { if (this.id) this.load(cx); else this.loadList(cx); });
    }, { owner: this });
    cx.timer.every(300000, (cx) => { if (this.id && this.view === "item") this.load(cx); else if (this.view === "list") this.loadList(cx); });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") {
          // The app sends "focus" again when a popup over this pane closes, even when the popup's own key just
          // moved the keyboard elsewhere (leader h): take it only while a tickets pane is the focused one.
          const held = panes().some((p) => p.mod === "my-tickets" && p.focused);
          if (held) { this.focus(); cx.notify(); }
        }
        // "key-<keystroke>" drives the pane from keys.json or the command line, e.g. my-tickets.key-c
        else if (c.startsWith("key-")) { const ks = c.slice(4); this.key({ keystroke: ks, key: ks, key_char: ks.length === 1 ? ks : undefined, modifiers: {} }, cx); cx.notify(); }
      }
    });
    this.focus();
    for (const ms of [150, 400]) cx.timer.after(ms, () => { if (!this.handle.is_focused() && !this.compose) this.focus(); });
  }

  // Work-specific settings live in local.json beside this file (gitignored); --props win over it.
  configure(local) {
    const c = { ...local, ...this.props };
    this.org = c.org ? String(c.org).replace(/\/+$/, "") : null;
    this.project = c.project ?? null;
    this.machine = c.machine === "local" ? null : (c.machine ?? "wsl"); // "local": this computer
    // Where deploys go: the orchestrator Claude session, and the folder a new one starts in.
    this.orchSpace = c.orchSpace ?? null;
    this.orchTab = c.orchTab ?? "orchestrator";
    this.parent = c.parent ?? null;
    this.deploySkill = c.deploySkill ?? null;
  }
  async readConfig() {
    this.configPath = `${appHome()}/mods/my-tickets/local.json`.replace(/\\/g, "/");
    let text = null;
    try { text = await readTextFile(this.configPath); } catch { text = null; }
    this.configFound = text != null;
    try { this.configure(JSON.parse(text ?? "{}")); }
    catch (e) { this.configError = `local.json isn't valid JSON: ${String(e?.message ?? e)}`; }
  }
  notConfigured() {
    if (this.configError) return this.configError;
    if (this.org && this.project) return null;
    if (!this.configFound) return "local.json is missing";
    const missing = [!this.org && `"org"`, !this.project && `"project"`].filter(Boolean);
    return `local.json has no ${missing.join(" or ")}`;
  }
  // While unconfigured, re-read local.json every 2s, so saving it brings the pane up.
  retryConfig(cx) {
    if (this.configRetry) return;
    this.configRetry = true;
    cx.timer.after(2000, async (cx) => {
      this.configRetry = false;
      this.configError = null;
      await this.readConfig();
      if (this.notConfigured()) { cx.notify(); this.retryConfig(cx); }
      else if (this.id) this.load(cx); else this.loadList(cx);
    });
  }
  // Shown in place of the list or item while notConfigured(): what's wrong, where the file goes, and what it takes.
  setupBody(t) {
    const text = (s, c) => div().text_color(c ?? t.dim).child(s);
    const field = (k, required, what) => h_flex().gap(10).items_start()
      .child(div().w(96).flex_none().text_color(required ? t.accent : t.foreground).child(k))
      .child(div().flex_1().min_w(0).text_color(t.dim).child(`${required ? "required" : "optional"} · ${what}`));
    const example = ["{", `  "org": "https://dev.azure.com/my-org",`, `  "project": "My Project",`, `  "machine": "local"`, "}"];
    return v_flex().gap(6).px(8).py(16).text_size(12)
      .child(text(`Tickets isn't set up: ${this.notConfigured()}`, t.blocked))
      .child(text("Create this file. It's gitignored, so each machine needs its own copy:"))
      .child(text(this.configPath ?? "mods/my-tickets/local.json", t.foreground))
      .child(div().h(4))
      .child(field("org", true, "Azure DevOps org URL, e.g. https://dev.azure.com/my-org"))
      .child(field("project", true, "Azure DevOps project name"))
      .child(field("machine", false, `machine whose az CLI is signed in: a machine name, or "local" for this one (default "wsl")`))
      .child(field("orchSpace", false, "space of the orchestrator Claude that d deploys to"))
      .child(field("orchTab", false, `that orchestrator's tab (default "orchestrator")`))
      .child(field("parent", false, "folder a new orchestrator starts in"))
      .child(field("deploySkill", false, "skill the orchestrator runs on a deploy"))
      .child(div().h(4))
      .child(text("Example:"))
      .child(v_flex().text_color(t.foreground).children(example.map((l) => div().child(l))))
      .child(div().h(4))
      .child(text("This pane checks the file every 2s and loads once it's right."));
  }

  focus() {
    if (this.compose && !this.compose.picker) this.compose.state.focus();
    else this.handle.focus();
  }

  // A redraw that always hits this pane: a timer callback's context belongs to this view, while
  // this.acx.notify() after an await resolves against whichever host call is running (possibly
  // another pane's), which left the list on "Loading…" with the rows already loaded.
  // `owner: this` pins the tick to this view: without it the timer belongs to whichever view's call
  // is running, and its notify would redraw that pane instead.
  redraw() { try { this.acx.timer.after(0, (cx) => cx.notify(), { owner: this }); } catch {} }

  // ---- the browser: sprints, backlog, filters --------------------------------------

  async loadIterations() {
    if (this.iterations) return;
    try {
      const raw = localStorage.getItem("iterations:v2");
      if (raw) { const c = JSON.parse(raw); if (Date.now() - c.at < 86400000) this.iterations = c.list; }
    } catch {}
    if (!this.iterations) {
      const d = await this.az(["boards", "iteration", "project", "list", "--depth", "2", "--organization", this.org, "--project", this.project]);
      // The API path carries an "\Iteration\" node ("\My Project\Iteration\Sprint 54"); WIQL wants "My Project\Sprint 54".
      const list = (d?.children ?? []).map((k) => ({ name: k.name, path: `${this.project}\\${k.name}`, start: k.attributes?.startDate?.slice(0, 10) ?? null, finish: k.attributes?.finishDate?.slice(0, 10) ?? null }))
        .filter((k) => k.start).sort((a, b) => a.start.localeCompare(b.start));
      this.iterations = list;
      try { localStorage.setItem("iterations:v2", JSON.stringify({ list, at: Date.now() })); } catch {}
    }
    if (this.sprintAt < 0) {
      const today = iso(new Date());
      let at = this.iterations.findIndex((k) => k.start <= today && (k.finish ?? "9999") >= today);
      if (at < 0) { at = this.iterations.findIndex((k) => k.start > today) - 1; }
      this.sprintAt = Math.max(0, Math.min(this.iterations.length - 1, at));
    }
  }

  sprint() { return this.iterations?.[this.sprintAt] ?? null; }
  listKey() { return this.list.tab === "backlog" ? "list:backlog" : `list:sprint:${this.sprint()?.path ?? "?"}`; }

  async loadList(cx) {
    cx = this.acx ?? cx;
    const missing = this.notConfigured();
    if (missing) { this.error = missing; this.busy = null; cx.notify(); this.retryConfig(cx); return; }
    this.busy = "fetching"; this.error = null; cx.notify();
    try {
      await this.loadIterations();
      if (!this.me) this.loadMe(cx);
      const key = this.listKey();
      if (!this.list.rows) { try { const c = JSON.parse(localStorage.getItem(key) ?? "null"); if (c) { this.list.rows = c.rows; this.list.fetchedAt = c.at; cx.notify(); this.redraw(); } } catch {} }
      let where;
      if (this.list.tab === "backlog") where = `[System.IterationPath] = '${wiqlStr(this.project)}' AND [System.State] NOT IN ('Closed','Removed','Done')`;
      else where = `[System.IterationPath] = '${wiqlStr(this.sprint().path)}' AND [System.State] <> 'Removed'`;
      const wiql = `SELECT ${LIST_COLUMNS} FROM workitems WHERE [System.TeamProject] = '${wiqlStr(this.project)}' AND [System.WorkItemType] IN ('User Story','Bug') AND ${where} ORDER BY [Microsoft.VSTS.Common.Priority], [System.ChangedDate] DESC`;
      const d = await this.az(["boards", "query", "--wiql", wiql, "--organization", this.org, "--project", this.project], 120000);
      const rows = (d ?? []).map((w) => {
        const f = w.fields ?? {};
        return { id: w.id, title: f[F.title] ?? "", type: f[F.type] ?? "", state: f[F.state] ?? "", who: name(f[F.assigned]), whoId: idOf(f[F.assigned]), whoName: f[F.assigned]?.uniqueName ?? null, points: f[F.points] ?? null, priority: f[F.priority] ?? null, tags: f[F.tags] ?? "", changed: f[F.changed] ?? null };
      });
      if (key !== this.listKey()) return; // the tab or sprint changed while this ran
      this.list.rows = rows; this.list.fetchedAt = Date.now(); this.list.people = null;
      this.list.cursor = Math.min(this.list.cursor, Math.max(0, this.visible().length - 1));
      try { localStorage.setItem(key, JSON.stringify({ rows, at: this.list.fetchedAt })); } catch {}
      this.busy = null; cx.notify(); this.redraw();
    } catch (e) { this.busy = null; this.error = errText(e); cx.notify(); this.redraw(); }
  }

  async loadMe(cx) {
    cx = this.acx ?? cx;
    try {
      const a = await this.az(["account", "show"]);
      this.me = a?.user?.name ?? null;
      if (this.me) try { localStorage.setItem("me", this.me); } catch {}
      cx.notify(); this.redraw();
    } catch {}
  }

  switchList(tab, sprintAt, cx) {
    if (tab) this.list.tab = tab;
    if (sprintAt != null && this.iterations) this.sprintAt = Math.max(0, Math.min(this.iterations.length - 1, sprintAt));
    this.list.rows = null; this.list.cursor = 0; this.list.people = null; this.y = 0;
    this.list.folded = new Set(this.list.tab === "sprint" && !this.list.person ? FOLDED_IN_SPRINT : []);
    this.loadList(cx);
  }

  isMe(r) { return Boolean(this.me) && (r.whoName ?? "").toLowerCase() === this.me.toLowerCase(); }

  // Rows that pass the person filter, the search and the Wont Do switch.
  filtered() {
    const L = this.list; const rows = L.rows ?? [];
    const q = L.search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!L.wontDo && r.state === "Wont Do") return false;
      if (L.person === "unassigned" && r.whoId) return false;
      if (L.person === "me" && !this.isMe(r)) return false;
      if (L.person && L.person !== "unassigned" && L.person !== "me" && r.whoId !== L.person) return false;
      if (q && !`${r.id} ${r.title} ${r.tags}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }

  // Groups by state in STATE_ORDER, each { state, rows }.
  groups() {
    const by = new Map();
    for (const r of this.filtered()) { if (!by.has(r.state)) by.set(r.state, []); by.get(r.state).push(r); }
    const rank = (s) => { const i = STATE_ORDER.indexOf(s); return i < 0 ? STATE_ORDER.length : i; };
    return [...by.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0])).map(([state, rows]) => ({ state, rows }));
  }

  // Rows in list order, skipping folded groups: what n/N step through and "4 of 35" counts.
  visible() {
    return this.groups().flatMap((g) => (this.list.folded.has(g.state) ? [] : g.rows));
  }

  // What the cursor lands on: every group header, then that group's rows unless it is folded.
  entries() {
    return this.groups().flatMap((g) => [{ group: g }, ...(this.list.folded.has(g.state) ? [] : g.rows.map((row) => ({ row, group: g })))]);
  }
  entryOfRow(id) { return this.entries().findIndex((e) => e.row?.id === id); }

  listPeople() {
    if (this.list.people) return this.list.people;
    const rows = this.list.rows ?? [];
    const by = new Map();
    for (const r of rows) { if (!r.whoId) continue; const p = by.get(r.whoId) ?? { id: r.whoId, name: r.who, count: 0, me: this.isMe(r) }; p.count++; by.set(r.whoId, p); }
    const people = [...by.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const unassigned = rows.filter((r) => !r.whoId && (this.list.wontDo || r.state !== "Wont Do")).length;
    this.list.people = [{ id: null, name: "Everyone", count: rows.length }, { id: "unassigned", name: "Unassigned", count: unassigned }, ...people];
    return this.list.people;
  }

  personLabel() {
    const p = this.list.person;
    if (!p) return "everyone";
    if (p === "unassigned") return "unassigned";
    if (p === "me") return "mine";
    return this.listPeople().find((x) => x.id === p)?.name ?? "person";
  }

  openFromList(id, cx) {
    this.returnTo = "list";
    this.id = id; this.item = null; this.comments = null; this.error = null; this.y = 0; this.people = [];
    this.view = "item";
    this.cache();
    this.load(cx);
  }

  backToList() {
    this.view = "list"; this.returnTo = null; this.item = null; this.comments = null; this.id = null; this.y = 0;
    this.keepListCursorVisible();
  }

  // n / N from an opened ticket: the next or previous row of the filtered list.
  stepInList(d, cx) {
    const vis = this.visible();
    const at = vis.findIndex((r) => r.id === this.id);
    const next = vis[at + d];
    if (!next) return;
    this.list.cursor = Math.max(0, this.entryOfRow(next.id));
    this.openFromList(next.id, cx);
  }

  listPosition() {
    const vis = this.visible();
    const at = vis.findIndex((r) => r.id === this.id);
    return at < 0 ? null : `${at + 1} of ${vis.length}`;
  }

  keepListCursorVisible() {
    const top = this.listTop?.[this.list.cursor];
    if (top == null) return;
    if (top < this.y) this.y = Math.max(0, top - 40);
    else if (top + 28 > this.y + this.viewH) this.y = top + 28 - this.viewH + 8;
  }

  // ---- data -------------------------------------------------------------------

  async az(args, timeout = 60000) {
    const r = await exec("az", [...args, "-o", "json"], { on: this.machine, timeout });
    if (r.code !== 0) throw new Error(lastLine(r.stderr) || `az exited ${r.code}`);
    const out = r.stdout.trim();
    return out ? JSON.parse(out) : null;
  }
  rest(method, url, extra = []) {
    return this.az(["rest", "--method", method, "--resource", ADO_RESOURCE, "--url", url, ...extra]);
  }
  itemUrl() { return `${this.org}/${encodeURIComponent(this.project)}/_workitems/edit/${this.id}`; }
  apiItem() { return `${this.org}/_apis/wit/workitems/${this.id}`; }
  apiComments() { return `${this.org}/${encodeURIComponent(this.project)}/_apis/wit/workItems/${this.id}/comments`; }

  cache() {
    if (!this.id) return;
    try {
      const raw = localStorage.getItem(`item:${this.id}`);
      if (raw) { const c = JSON.parse(raw); this.setItem(c.item); this.fetchedAt = c.at; }
      const rc = localStorage.getItem(`comments:${this.id}`);
      if (rc) this.comments = JSON.parse(rc);
    } catch {}
  }

  setItem(w) {
    const f = w.fields ?? {};
    const type = f[F.type] ?? "";
    const bug = type === "Bug";
    this.item = {
      id: w.id, rev: w.rev, type, bug, fields: f, relations: w.relations ?? [],
      blocks: bug
        ? { summary: blocks(f[F.summary] || f[F.description]), repro: blocks(f[F.repro]), expected: blocks(f[F.expected]), actual: blocks(f[F.actual]), criteria: blocks(f[F.criteria]) }
        : { description: blocks(f[F.description]), criteria: blocks(f[F.criteria]) },
    };
    this.addPeople([f[F.assigned], f[F.createdBy], f[F.changedBy]]);
  }

  addPeople(list) {
    for (const v of list) {
      const id = idOf(v); const n = name(v);
      if (id && n && !this.people.some((p) => p.id === id)) this.people.push({ name: n, id });
    }
  }

  async load(cx) {
    cx = this.acx ?? cx;
    if (!this.id) return;
    const missing = this.notConfigured();
    if (missing) { this.error = missing; this.busy = null; cx.notify(); this.retryConfig(cx); return; }
    this.busy = "fetching"; this.error = null; cx.notify();
    try {
      const w = await this.az(["boards", "work-item", "show", "--id", String(this.id), "--organization", this.org]);
      this.setItem(w);
      this.fetchedAt = Date.now();
      try { localStorage.setItem(`item:${this.id}`, JSON.stringify({ item: { id: w.id, rev: w.rev, fields: w.fields, relations: w.relations ?? [] }, at: this.fetchedAt })); } catch {}
      this.busy = null; cx.notify(); this.redraw();
      this.fetchImages(cx);
      if (this.comments || this.view === "comments") await this.loadComments(cx);
      if (this.pendingPoint) { this.pendingPoint = false; this.openPointing(); cx.notify(); }
    } catch (e) {
      this.busy = null; this.error = errText(e); cx.notify();
    }
  }

  async loadComments(cx) {
    cx = this.acx ?? cx;
    this.busy = "fetching comments"; cx.notify();
    try {
      const d = await this.rest("get", `${this.apiComments()}?$expand=reactions&order=asc&api-version=7.1-preview.4`);
      const list = (d?.comments ?? []).map((c) => ({
        id: c.id, who: name(c.createdBy), whoId: idOf(c.createdBy), when: c.createdDate, blocks: blocks(c.text),
        reactions: (c.reactions ?? []).map((r) => ({ type: r.type, count: r.count, mine: Boolean(r.isCurrentUserEngaged) })),
      }));
      this.addPeople((d?.comments ?? []).map((c) => c.createdBy));
      this.comments = list;
      this.cursor = Math.min(this.cursor, Math.max(0, list.length - 1));
      try { localStorage.setItem(`comments:${this.id}`, JSON.stringify(list)); } catch {}
      this.busy = null; cx.notify(); this.redraw();
      this.fetchImages(cx);
    } catch (e) {
      this.busy = null; this.error = errText(e); cx.notify();
    }
  }

  // Every image block not yet cached: download it from WSL into the app home, then draw it.
  fetchImages(cx) {
    cx = this.acx ?? cx;
    const all = [];
    for (const v of Object.values(this.item?.blocks ?? {})) all.push(...v);
    for (const c of this.comments ?? []) all.push(...c.blocks);
    for (const b of all) {
      const img = b.image;
      if (!img || this.images.has(img.guid)) continue;
      const ext = (img.name.match(/\.(png|jpe?g|gif|webp|bmp)$/i)?.[1] ?? "png").toLowerCase();
      const rel = `cache/tickets/${img.guid}.${ext}`;
      const entry = { status: "loading", path: rel, name: img.name, url: img.url, error: "" };
      this.images.set(img.guid, entry);
      cx.spawn(async (cx) => {
        const home = appHome();
        const file = `${home}/${rel}`.replace(/\\/g, "/");
        try {
          if (await fs.exists(file)) { entry.status = "ready"; cx.notify(); return; }
          // Downloaded where az runs and sent back as base64, so it lands here whichever machine az is on.
          const r = await exec("sh", ["-c", `t=$(mktemp) && az rest --method get --resource ${ADO_RESOURCE} --url ${shq(img.url)} --output-file "$t" >/dev/null && base64 < "$t"; c=$?; rm -f "$t"; exit $c`], { on: this.machine, timeout: 60000 });
          if (r.code !== 0) throw new Error(lastLine(r.stderr) || "download failed");
          await fs.mkdir(`${home}/cache/tickets`.replace(/\\/g, "/"), { recursive: true });
          await fs.writeFile(file, fromBase64(r.stdout));
          entry.status = "ready";
        } catch (e) {
          entry.status = "error"; entry.error = errText(e);
        }
        cx.notify();
      });
    }
  }

  // ---- writes (each behind the confirm row) -------------------------------------

  async patch(ops) {
    return this.rest("patch", `${this.apiItem()}?api-version=7.1`, ["--headers", "Content-Type=application/json-patch+json", "--body", JSON.stringify(ops)]);
  }

  openPointing() {
    const f = this.item.fields;
    const rows = factorsFor(this.item.type).map((r) => ({ ...r, at: f[r.field] == null ? -1 : r.values.indexOf(String(f[r.field])) }));
    const pts = f[F.points] == null ? -1 : POINTS.indexOf(String(Number(f[F.points])));
    this.point = { rows, points: pts, row: 0 };
    this.view = "point";
  }

  pointingChanges() {
    const f = this.item.fields;
    const changes = [];
    for (const r of this.point.rows) {
      const next = r.at < 0 ? null : r.values[r.at];
      const cur = f[r.field] == null ? null : String(f[r.field]);
      if (next !== cur) changes.push({ label: r.label, field: r.field, from: cur, to: next });
    }
    const nextPts = this.point.points < 0 || POINTS[this.point.points] === "?" ? null : POINTS[this.point.points];
    const curPts = f[F.points] == null ? null : String(Number(f[F.points]));
    if (nextPts !== curPts) changes.push({ label: "Story points", field: F.points, from: curPts, to: nextPts });
    return changes;
  }

  // ---- state change (s) -------------------------------------------------------

  // The workflow states Azure allows for this work item type, cached for a day.
  async loadStates(type) {
    const key = `states:${type}`;
    try { const c = JSON.parse(localStorage.getItem(key) ?? "null"); if (c && Date.now() - c.at < 86400000) return c.list; } catch {}
    const d = await this.rest("get", `${this.org}/${encodeURIComponent(this.project)}/_apis/wit/workitemtypes/${encodeURIComponent(type)}/states?api-version=7.1`);
    const list = (d?.value ?? []).map((s) => ({ name: s.name, category: s.category }));
    try { localStorage.setItem(key, JSON.stringify({ list, at: Date.now() })); } catch {}
    return list;
  }

  async openStatePick(cx) {
    cx = this.acx ?? cx;
    const current = this.item.fields[F.state];
    this.statePick = { list: null, at: 0, query: "", current };
    this.view = "state"; cx.notify();
    try {
      const list = await this.loadStates(this.item.type);
      if (this.view !== "state") return;
      this.statePick.list = list;
      this.statePick.at = Math.max(0, list.findIndex((s) => s.name === current));
    } catch (e) { this.error = errText(e); this.view = "item"; }
    cx.notify();
  }

  statesShown() {
    const P = this.statePick;
    const q = P.query.trim().toLowerCase();
    return (P.list ?? []).filter((s) => !q || s.name.toLowerCase().includes(q));
  }

  keyState(e, cx) {
    const k = e.keystroke, ch = e.key_char;
    const P = this.statePick;
    const list = this.statesShown();
    if (k === "j" || k === "down" || k === "ctrl-n") P.at = Math.min(list.length - 1, P.at + 1);
    else if (k === "k" || k === "up" || k === "ctrl-p") P.at = Math.max(0, P.at - 1);
    else if (k === "enter") {
      const s = list[P.at];
      if (!s || s.name === P.current) { this.view = "item"; this.statePick = null; return true; }
      this.confirm = {
        title: `Change state to ${s.name}?`,
        lines: [`${P.current} → ${s.name}`],
        back: "state",
        run: async () => { await this.patch([{ op: "add", path: `/fields/${F.state}`, value: s.name }]); this.statePick = null; return `State set to ${s.name}`; },
      };
      this.view = "confirm";
    }
    else if (k === "escape" || k === "q") { this.view = "item"; this.statePick = null; }
    else if (k === "backspace") { P.query = P.query.slice(0, -1); P.at = 0; }
    else if (ch && ch.length === 1 && !e.modifiers?.control && !e.modifiers?.alt) { P.query += ch; P.at = 0; }
    else return false;
    return true;
  }

  askSavePointing() {
    const changes = this.pointingChanges();
    if (!changes.length) { this.view = "item"; return; }
    this.confirm = {
      title: "Save pointing to Azure?",
      lines: changes.map((c) => `${c.label}  ${c.from ?? "—"} → ${c.to ?? "—"}`),
      back: "point",
      run: async () => {
        await this.patch(changes.map((c) => (c.to == null ? { op: "remove", path: `/fields/${c.field}` } : { op: "add", path: `/fields/${c.field}`, value: c.field === F.points ? Number(c.to) : c.to })));
        return `Pointing saved${changes.some((c) => c.field === F.points) ? ` · ${changes.find((c) => c.field === F.points).to ?? "no"} points` : ""}`;
      },
    };
    this.view = "confirm";
  }

  askPost() {
    const c = this.compose;
    const text = c.state.value().trim();
    if (!text) return;
    const used = c.mentions.filter((m) => text.includes(`@${m.name}`));
    this.confirm = {
      title: used.length ? `Post comment and notify ${used.length} ${used.length === 1 ? "person" : "people"}?` : "Post comment?",
      lines: text.split("\n").slice(0, 6),
      back: "compose",
      run: async () => {
        await this.rest("post", `${this.apiComments()}?api-version=7.1-preview.4`, ["--headers", "Content-Type=application/json", "--body", JSON.stringify({ text: toHtml(text, used) })]);
        this.compose = null;
        this.view = "comments";
        return "Comment posted";
      },
    };
    this.view = "confirm";
  }

  async runConfirm(cx) {
    cx = this.acx ?? cx;
    const c = this.confirm;
    this.busy = "saving"; this.error = null; cx.notify();
    try {
      const msg = await c.run();
      this.confirm = null; this.busy = null;
      if (this.view === "confirm") this.view = c.back === "point" || c.back === "state" ? "item" : c.back;
      this.toast = msg; cx.timer.after(4000, (cx) => { this.toast = null; cx.notify(); });
      cx.notify();
      await this.load(cx);
      if (c.back === "compose" || this.view === "comments") await this.loadComments(cx);
    } catch (e) {
      this.busy = null; this.error = errText(e); cx.notify();
    }
  }

  // A reaction is one click in the web UI too: no confirm row, the same key undoes it.
  async toggleReaction(type, cx) {
    cx = this.acx ?? cx;
    const c = this.comments?.[this.cursor];
    if (!c) return;
    const have = c.reactions.find((r) => r.type === type && r.mine);
    this.busy = have ? `removing ${type}` : `adding ${type}`; cx.notify();
    try {
      await this.rest(have ? "delete" : "put", `${this.apiComments()}/${c.id}/reactions/${type}?api-version=7.1-preview.1`);
      this.busy = null;
      await this.loadComments(cx);
    } catch (e) { this.busy = null; this.error = errText(e); cx.notify(); }
  }

  // ---- compose (comment or ask) --------------------------------------------------

  startCompose(kind, replyTo, cx) {
    const state = TextareaState.new({ placeholder: kind === "ask" ? "What should Claude do with this ticket?" : "Write a comment. @ mentions someone on the ticket.", rows: 5 });
    const mentions = [];
    if (replyTo?.whoId) { mentions.push({ name: replyTo.who, id: replyTo.whoId }); state.set_value(`@${replyTo.who} `); }
    this.compose = { kind, state, replyTo, mentions, picker: null, context: { ticket: true, pr: true, description: true, criteria: true } };
    state.on("change", (_e, cx) => {
      if (this.compose?.kind !== "ask" && /@$/.test(state.value()) && !this.compose.picker && this.people.length) {
        this.compose.picker = { at: 0 };
        this.handle.focus();
      }
      cx.notify();
    });
    state.on("submit", (_e, cx) => this.submitCompose(cx));
    this.view = kind === "ask" ? "ask" : "compose";
    cx.timer.after(50, () => state.focus());
  }

  submitCompose(cx) {
    if (this.compose.kind === "ask") this.sendAsk(cx);
    else this.askPost();
    cx.notify();
  }

  insertMention() {
    const c = this.compose;
    const person = this.people[c.picker.at];
    c.picker = null;
    if (person) {
      if (!c.mentions.some((m) => m.id === person.id)) c.mentions.push(person);
      c.state.replace(`${person.name} `); // the @ is already typed
    }
    c.state.focus();
  }

  // The agent in this pane's tab, else any terminal there, else the focused one.
  target() {
    const a = agents().find((x) => x.tab === this.tab) ?? agents()[0];
    if (a) return { terminal: a.address, label: `${a.program?.name ?? "agent"} · ${a.space_name ?? ""} · ${a.status}` };
    const p = panes().find((x) => x.tab === this.tab && x.terminal) ?? panes().find((x) => x.terminal);
    return p ? { terminal: p.terminal, label: p.title ?? p.terminal } : null;
  }

  linkedPr() {
    const rels = this.item?.relations ?? [];
    return rels.map((r) => r.url ?? "").find((u) => /PullRequest/i.test(u))?.match(/%2f(\d+)$/i)?.[1] ?? null;
  }

  async sendAsk(cx) {
    cx = this.acx ?? cx;
    const c = this.compose;
    const text = c.state.value().trim();
    const t = this.target();
    if (!text || !t) { this.error = t ? null : "No terminal to send to."; cx.notify(); return; }
    const f = this.item.fields;
    const parts = [];
    if (c.context.ticket) parts.push(`Azure DevOps ${this.item.type} #${this.id}: ${f[F.title]} (${f[F.state]}). ${this.itemUrl()}`);
    if (c.context.pr && this.pr) parts.push(`Linked GitHub pull request: #${this.pr}.`);
    const bl = this.item.blocks;
    const textOf = (bs) => (bs ?? []).filter((b) => b.text).map((b) => b.text).join("\n");
    if (c.context.description) { const d = textOf(this.item.bug ? bl.summary : bl.description); if (d) parts.push(`Description:\n${d}`); }
    if (c.context.criteria) { const a = textOf(bl.criteria); if (a) parts.push(`Acceptance criteria:\n${a}`); }
    parts.push(text);
    this.busy = "sending"; cx.notify();
    try {
      const r = await hc(["send", t.terminal, parts.join("\n\n")]);
      if (r.code !== 0) throw new Error(lastLine(r.stderr) || "send failed");
      this.busy = null; this.compose = null; this.view = "item";
      this.toast = "Sent to Claude"; cx.timer.after(4000, (cx) => { this.toast = null; cx.notify(); });
    } catch (e) { this.busy = null; this.error = errText(e); }
    cx.notify();
  }

  // e: send the whole ticket to Claude with the plain-language prompt, no typing.
  async explain(cx) {
    cx = this.acx ?? cx;
    const t = this.target();
    if (!this.item || !t) { this.error = t ? null : "No terminal to send to."; cx.notify(); return; }
    const f = this.item.fields; const bl = this.item.blocks;
    const textOf = (bs) => (bs ?? []).filter((b) => b.text).map((b) => b.text).join("\n");
    const parts = [`Azure DevOps ${this.item.type} #${this.id}: ${f[F.title]} (${f[F.state]}). ${this.itemUrl()}`];
    const d = textOf(this.item.bug ? bl.summary : bl.description); if (d) parts.push(`Description:\n${d}`);
    const r = textOf(bl.repro); if (r) parts.push(`Repro steps:\n${r}`);
    const x = textOf(bl.expected); if (x) parts.push(`Expected:\n${x}`);
    const y = textOf(bl.actual); if (y) parts.push(`Actual:\n${y}`);
    const a = textOf(bl.criteria); if (a) parts.push(`Acceptance criteria:\n${a}`);
    parts.push(EXPLAIN_PROMPT);
    this.busy = "sending"; cx.notify();
    try {
      const res = await hc(["send", t.terminal, parts.join("\n\n")]);
      if (res.code !== 0) throw new Error(lastLine(res.stderr) || "send failed");
      this.busy = null; this.toast = "Asked Claude to explain"; cx.timer.after(4000, (cx) => { this.toast = null; cx.notify(); });
    } catch (e) { this.busy = null; this.error = errText(e); }
    cx.notify();
  }

  // ---- keys ---------------------------------------------------------------------

  maxY() { return Math.max(0, this.contentH - this.viewH); }
  scrollTo(y, cx) { this.y = Math.round(Math.min(Math.max(0, y), this.maxY())); cx.notify(); }
  keepCursorVisible(cx) {
    const top = this.rowTop[this.cursor]; const h = this.rowH?.[this.cursor] ?? 80;
    if (top == null) return;
    if (top < this.y) this.scrollTo(top - 8, cx);
    else if (top + h > this.y + this.viewH) this.scrollTo(top + h - this.viewH + 8, cx);
  }
  openUrl(url) { if (isWin()) exec("cmd", ["/c", "start", "", url]); else exec("open", [url]); }
  // Close this mod's own pane, never a terminal: a `q` delivered from the command line arrives while
  // the terminal has focus, and closing the focused pane there would kill the Claude session.
  closePane() {
    const mine = panes().filter((p) => p.mod === "my-tickets");
    const f = focused()?.pane;
    const target = mine.find((p) => p.pane === f) ?? (mine.length === 1 ? mine[0] : mine.find((p) => p.focused)) ?? null;
    if (target) run("pane.close", { pane: target.pane });
  }
  back() { run("pane.go", { direction: "left" }); }

  key(e, cx) {
    const k = e.keystroke, ch = e.key_char;
    const v = this.view;
    let handled = true;
    if (v === "confirm") {
      if (k === "y") this.runConfirm(cx);
      else if (k === "n" || k === "escape" || k === "q") { this.view = this.confirm.back; this.confirm = null; }
      else handled = false;
    } else if (v === "point") handled = this.keyPoint(e, cx);
    else if (v === "state") handled = this.keyState(e, cx);
    else if (v === "comments") handled = this.keyComments(e, cx);
    else if (v === "compose" || v === "ask") handled = this.keyCompose(e, cx);
    else if (v === "item") handled = this.keyItem(e, cx);
    else if (v === "list") handled = this.keyList(e, cx);
    else handled = false;
    if (handled) { cx.stop_propagation(); cx.notify(); }
  }

  keyScroll(e, cx) {
    const k = e.keystroke, ch = e.key_char;
    const half = Math.max(LINE, this.viewH / 2), page = Math.max(LINE, this.viewH - LINE);
    const was = this.pendingG; this.pendingG = false;
    if (k === "j" || k === "down") this.scrollTo(this.y + LINE, cx);
    else if (k === "k" || k === "up") this.scrollTo(this.y - LINE, cx);
    else if (k === "d" || k === "ctrl-d" || k === "space") this.scrollTo(this.y + half, cx);
    else if (k === "u" || k === "ctrl-u") this.scrollTo(this.y - half, cx);
    else if (k === "f" || k === "ctrl-f" || k === "pagedown") this.scrollTo(this.y + page, cx);
    else if (k === "b" || k === "ctrl-b" || k === "pageup") this.scrollTo(this.y - page, cx);
    else if (k === "shift-g" || ch === "G" || k === "end") this.scrollTo(this.maxY(), cx);
    else if (k === "home") this.scrollTo(0, cx);
    else if (k === "g") { if (was) this.scrollTo(0, cx); else this.pendingG = true; }
    else return false;
    return true;
  }

  keyItem(e, cx) {
    const k = e.keystroke, ch = e.key_char;
    if (this.keyScroll(e, cx)) return true;
    const fromList = this.returnTo === "list";
    if (!this.item) {
      if (k === "q") this.closePane(); else if (k === "r") this.load(cx);
      else if (k === "escape" || k === "h") { if (fromList) this.backToList(); else this.back(); }
      else return false;
      return true;
    }
    if (fromList && k === "n") { this.stepInList(1, cx); return true; }
    if (fromList && (k === "shift-n" || ch === "N")) { this.stepInList(-1, cx); return true; }
    if (k === "p") this.openPointing();
    else if (k === "s") this.openStatePick(cx);
    else if (k === "c") { this.view = "comments"; this.y = 0; if (!this.comments || Date.now() - this.fetchedAt > 60000) this.loadComments(cx); }
    else if (ch === ":") this.startCompose("ask", null, cx);
    else if (k === "e") this.explain(cx);
    else if (k === "o") this.openUrl(this.itemUrl());
    else if (k === "shift-o" || ch === "O") { const first = [...this.images.values()].find((i) => i.status === "ready"); if (first) { const f = `${appHome()}/${first.path}`; this.openUrl(isWin() ? f.replace(/\//g, "\\") : f.replace(/\\/g, "/")); } }
    else if (k === "y") { cx.write_to_clipboard(this.itemUrl()); this.toast = "URL copied"; cx.timer.after(2000, (cx) => { this.toast = null; cx.notify(); }); }
    else if (k === "r") this.load(cx);
    else if (k === "escape" || k === "h") { if (fromList) this.backToList(); else this.back(); }
    else if (k === "q") this.closePane();
    else return false;
    return true;
  }

  keyList(e, cx) {
    const k = e.keystroke, ch = e.key_char;
    const L = this.list;
    L.marked ??= []; // a pane that outlived a hot reload keeps its old state object
    if (L.picker) return this.keyPeople(e, cx);
    if (L.searching) {
      if (k === "escape") { L.search = ""; L.searching = false; }
      else if (k === "enter") L.searching = false;
      else if (k === "backspace") L.search = L.search.slice(0, -1);
      else if (ch && ch.length === 1 && !e.modifiers?.control && !e.modifiers?.alt) L.search += ch;
      else return false;
      L.cursor = 0; this.y = 0;
      return true;
    }
    const ents = this.entries();
    L.cursor = Math.min(L.cursor, Math.max(0, ents.length - 1));
    const ent = ents[L.cursor];
    const cur = ent?.row ?? null; // the ticket under the cursor, if it is on a row
    const grp = ent?.group ?? null; // the group the cursor is in (its header, or one of its rows)
    const toHeader = (state) => { L.cursor = Math.max(0, this.entries().findIndex((e) => !e.row && e.group.state === state)); this.keepListCursorVisible(); };
    if (k === "j" || k === "down") { L.cursor = Math.min(ents.length - 1, L.cursor + 1); this.keepListCursorVisible(); }
    else if (k === "k" || k === "up") { L.cursor = Math.max(0, L.cursor - 1); this.keepListCursorVisible(); }
    else if (k === "g") { L.cursor = 0; this.y = 0; }
    else if (k === "shift-g" || ch === "G") { L.cursor = Math.max(0, ents.length - 1); this.keepListCursorVisible(); }
    else if (k === "ctrl-d" || k === "pagedown") { L.cursor = Math.min(ents.length - 1, L.cursor + 10); this.keepListCursorVisible(); }
    else if (k === "ctrl-u" || k === "pageup") { L.cursor = Math.max(0, L.cursor - 10); this.keepListCursorVisible(); }
    else if (k === "enter" || k === "space") {
      // On a row: open it. On a header: toggle its fold.
      if (cur) this.openFromList(cur.id, cx);
      else if (grp) { L.folded.has(grp.state) ? L.folded.delete(grp.state) : L.folded.add(grp.state); toHeader(grp.state); }
    }
    else if (k === "l") {
      // vim-style: on a row, l goes into the ticket; on a header, l toggles the fold.
      if (cur) this.openFromList(cur.id, cx);
      else if (grp) { L.folded.has(grp.state) ? L.folded.delete(grp.state) : L.folded.add(grp.state); toHeader(grp.state); }
    }
    else if (k === "shift-h" || ch === "H") { for (const g of this.groups()) L.folded.add(g.state); L.cursor = 0; this.y = 0; }
    else if (k === "shift-l" || ch === "L") { L.folded.clear(); if (grp) toHeader(grp.state); }
    else if (ch === "1") this.switchList("backlog", null, cx);
    else if (ch === "2") this.switchList("sprint", null, cx);
    else if (ch === "[") { if (L.tab === "sprint") this.switchList(null, this.sprintAt - 1, cx); }
    else if (ch === "]") { if (L.tab === "sprint") this.switchList(null, this.sprintAt + 1, cx); }
    else if (ch === "@") { L.picker = { at: 0, query: "" }; }
    else if (k === "u") { L.person = L.person === "unassigned" ? null : "unassigned"; L.cursor = 0; this.y = 0; }
    else if (k === "m") { L.person = L.person === "me" ? null : "me"; L.cursor = 0; this.y = 0; if (!this.me) this.loadMe(cx); }
    else if (ch === "/") { L.searching = true; }
    else if (k === "shift-w" || ch === "W") { L.wontDo = !L.wontDo; L.people = null; }
    else if (k === "p" && cur) { this.pendingPoint = true; this.openFromList(cur.id, cx); }
    else if (k === "x" && cur) { const i = L.marked.indexOf(cur.id); if (i < 0) L.marked.push(cur.id); else L.marked.splice(i, 1); }
    else if (k === "d") {
      const rows = this.deployRows(cur);
      if (!this.orchSpace) { this.toast = "No deploy target: set orchSpace in mods/my-tickets/local.json"; cx.timer.after(3000, (cx) => { this.toast = null; cx.notify(); }); }
      else if (rows.length) this.askDeploy(rows);
    }
    else if (k === "c" && cur) { this.openFromList(cur.id, cx); this.view = "comments"; this.loadComments(cx); }
    else if (k === "o" && cur) this.openUrl(`${this.org}/${encodeURIComponent(this.project)}/_workitems/edit/${cur.id}`);
    else if (k === "y" && cur) { cx.write_to_clipboard(`${this.org}/${encodeURIComponent(this.project)}/_workitems/edit/${cur.id}`); this.toast = "URL copied"; cx.timer.after(2000, (cx) => { this.toast = null; cx.notify(); }); }
    else if (k === "r") { L.rows = null; this.loadList(cx); }
    else if (k === "escape") { if (L.marked.length) L.marked = []; else if (L.person || L.search) { L.person = null; L.search = ""; L.cursor = 0; } else this.back(); }
    else if (k === "q") this.closePane();
    else return false;
    return true;
  }

  // ---- deploy: hand marked tickets to the orchestrator as one group ----------------

  // The marked rows in mark order (first marked = lead), else the row under the cursor.
  deployRows(cur) {
    const rows = this.list.rows ?? [];
    const marked = (this.list.marked ?? []).map((id) => rows.find((r) => r.id === id)).filter(Boolean);
    return marked.length ? marked : cur ? [cur] : [];
  }

  // The orchestrator: the agent in the orchSpace space's orchTab tab. Several parent sessions
  // share that folder, so the tab is the identity, not the cwd. Idle first, then most recent.
  orchestrator() {
    const cands = agents().filter((a) => a.space_name === this.orchSpace && a.tab_name === this.orchTab);
    const rank = (a) => (a.status === "idle" || a.status === "done" ? 0 : a.status === "working" ? 1 : 2);
    return cands.sort((a, b) => rank(a) - rank(b) || b.seq - a.seq)[0] ?? null;
  }

  deployText(rows) {
    const lines = [`[my-tickets deploy] ${rows.map((r) => r.id).join(", ")}`];
    for (const r of rows) lines.push(`#${r.id} ${r.type}: ${r.title} (${r.state})`);
    lines.push("", `${this.deploySkill ? `Run the ${this.deploySkill} skill` : "Deploy"}: one workspace and one agent for this selection, lead ticket first.`);
    return lines.join("\n");
  }

  askDeploy(rows) {
    const a = this.orchestrator();
    const to = a ? `to ${a.space_name} / ${a.tab_name} (${a.status})` : `to a new orchestrator in ${this.orchSpace} / ${this.orchTab}`;
    this.confirm = {
      title: `Deploy ${rows.length === 1 ? "an agent for 1 ticket" : `one agent for ${rows.length} tickets`} ${to}?`,
      lines: rows.map((r, i) => `${r.id}  ${r.title}${i === 0 && rows.length > 1 ? "  (lead)" : ""}`),
      back: "list",
      yes: "send",
      run: async () => { const msg = await this.deploy(rows); this.list.marked = []; return msg; },
    };
    this.view = "confirm";
  }

  // Sends to the running orchestrator, or starts one with the message as its first task.
  async deploy(rows) {
    const text = this.deployText(rows);
    const n = `${rows.length} ticket${rows.length === 1 ? "" : "s"}`;
    const a = this.orchestrator();
    if (a) {
      if (a.status === "blocked") throw new Error(`The orchestrator (${a.address}) is blocked on a dialog; answer it first.`);
      const r = await hc(["send", a.address, text]);
      if (r.code !== 0) throw new Error(lastLine(r.stderr) || "send failed");
      return `Sent ${n} to ${a.space_name} / ${a.tab_name}`;
    }
    const sp = spaces().find((s) => s.name === this.orchSpace);
    if (sp) run("tab.new", { name: this.orchTab, space: sp.id, folder: this.parent, argv: ["claude"], task: text, focus: false });
    else run("space.new", { name: this.orchSpace, folder: this.parent, machine: this.machine, tab: this.orchTab, argv: ["claude"], task: text, focus: false });
    return `Started an orchestrator in ${this.orchSpace} / ${this.orchTab} with ${n}`;
  }

  keyPeople(e, cx) {
    const k = e.keystroke, ch = e.key_char;
    const P = this.list.picker;
    const list = this.listPeople().filter((p) => !P.query || p.name.toLowerCase().includes(P.query.toLowerCase()));
    if (k === "j" || k === "down" || k === "ctrl-n") P.at = Math.min(list.length - 1, P.at + 1);
    else if (k === "k" || k === "up" || k === "ctrl-p") P.at = Math.max(0, P.at - 1);
    else if (k === "enter" || k === "tab") {
      const p = list[P.at];
      if (p) { this.list.person = p.id === null ? null : p.me && p.id !== "unassigned" ? "me" : p.id; this.list.cursor = 0; this.y = 0; }
      this.list.picker = null;
    }
    else if (k === "escape") this.list.picker = null;
    else if (k === "backspace") { P.query = P.query.slice(0, -1); P.at = 0; }
    else if (ch && ch.length === 1 && !e.modifiers?.control) { P.query += ch; P.at = 0; }
    else return false;
    return true;
  }

  keyPoint(e, cx) {
    const k = e.keystroke, ch = e.key_char;
    const p = this.point;
    const rows = p.rows.length; // row index `rows` is the points row
    const cur = () => (p.row < rows ? p.rows[p.row] : null);
    if (k === "j" || k === "down") p.row = Math.min(rows, p.row + 1);
    else if (k === "k" || k === "up") p.row = Math.max(0, p.row - 1);
    else if (k === "h" || k === "left" || k === "l" || k === "right") {
      const d = k === "h" || k === "left" ? -1 : 1;
      const r = cur();
      if (r) r.at = Math.max(-1, Math.min(r.values.length - 1, r.at + d));
      else p.points = Math.max(-1, Math.min(POINTS.length - 1, p.points + d));
    } else if (ch && /^[0-9?]$/.test(ch)) {
      const r = cur();
      if (r) { const i = r.values.indexOf(ch); if (i >= 0) r.at = i; }
      else {
        // two digits in a row make 13
        const want = this.lastDigit === "1" && ch === "3" ? "13" : ch;
        const i = POINTS.indexOf(want); if (i >= 0) p.points = i;
        this.lastDigit = ch;
      }
    } else if (k === "enter") this.askSavePointing();
    else if (k === "escape" || k === "q") { this.view = "item"; this.point = null; }
    else return false;
    return true;
  }

  keyComments(e, cx) {
    const k = e.keystroke, ch = e.key_char;
    const list = this.comments ?? [];
    if (this.reactPick != null) {
      if (k === "h" || k === "left") this.reactPick = Math.max(0, this.reactPick - 1);
      else if (k === "l" || k === "right") this.reactPick = Math.min(REACTIONS.length - 1, this.reactPick + 1);
      else if (k === "enter") { const t = REACTIONS[this.reactPick]; this.reactPick = null; this.toggleReaction(t, cx); }
      else if (k === "escape" || k === "e" || k === "q") this.reactPick = null;
      else return false;
      return true;
    }
    if (k === "j" || k === "down") { this.cursor = Math.min(list.length - 1, this.cursor + 1); this.keepCursorVisible(cx); }
    else if (k === "k" || k === "up") { this.cursor = Math.max(0, this.cursor - 1); this.keepCursorVisible(cx); }
    else if (k === "g") this.scrollTo(0, cx);
    else if (k === "shift-g" || ch === "G") this.scrollTo(this.maxY(), cx);
    else if (k === "a") this.startCompose("comment", null, cx);
    else if (k === "enter" && list[this.cursor]) this.startCompose("comment", list[this.cursor], cx);
    else if (ch === "+" || k === "=" ) this.toggleReaction("like", cx);
    else if (k === "e" && list.length) this.reactPick = 0;
    else if (k === "r") this.loadComments(cx);
    else if (k === "o") this.openUrl(this.itemUrl());
    else if (k === "escape" || k === "c" || k === "h") { this.view = "item"; this.y = 0; }
    else if (k === "q") this.closePane();
    else return false;
    return true;
  }

  keyCompose(e, cx) {
    const k = e.keystroke;
    const c = this.compose;
    if (c.picker) {
      if (k === "j" || k === "down") c.picker.at = Math.min(this.people.length - 1, c.picker.at + 1);
      else if (k === "k" || k === "up") c.picker.at = Math.max(0, c.picker.at - 1);
      else if (k === "tab" || k === "enter") this.insertMention();
      else if (k === "escape") { c.picker = null; c.state.focus(); }
      else return false;
      return true;
    }
    if (k === "ctrl-enter" || k === "cmd-enter") { this.submitCompose(cx); return true; }
    if (k === "escape") { this.compose = null; this.view = c.kind === "ask" ? "item" : "comments"; this.handle.focus(); return true; }
    if (c.kind === "ask" && k === "tab") {
      const keys = ["ticket", "pr", "description", "criteria"];
      const at = this.ctxAt ?? 0; const key = keys[at];
      c.context[key] = !c.context[key]; this.ctxAt = (at + 1) % keys.length;
      return true;
    }
    return false; // typing goes to the textarea
  }

  // ---- drawing ------------------------------------------------------------------

  stateColor(t, s) {
    const x = (s ?? "").toLowerCase();
    if (/block/.test(x)) return t.blocked;
    if (/active|progress|dev review|testing|ready/.test(x)) return t.working;
    if (/done|resolved|closed/.test(x)) return t.done;
    if (/new|approved/.test(x)) return t.dim;
    return t.muted;
  }

  pill(t, text, color) {
    return div().flex_none().px(7).h(18).rounded(5).bg(color + "26").text_size(11).text_color(color).flex().items_center().child(text);
  }
  section(t, title, count) {
    return h_flex().gap(8).items_baseline().pt(4)
      .child(div().text_size(10.5).font_semibold().text_color(t.dim).child(title.toUpperCase()))
      .when(count != null, (el) => el.child(div().text_size(11).text_color(t.dim).child(String(count))));
  }
  keyHint(t, pairs) {
    return h_flex().flex_none().flex_wrap().gap_x(14).gap_y(2).px(14).py(5).bg(t.chrome).border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
      .children(pairs.map(([k, what]) => h_flex().gap(5).child(div().text_color(t.foreground).child(k)).child(div().child(what))));
  }

  // Text and images in order. `id` keeps each TextView distinct.
  richBlocks(t, id, bs) {
    return v_flex().gap(8).children((bs ?? []).map((b, i) => {
      if (b.text) return TextView.markdown(`${id}-${i}`, b.text).selectable(true);
      const img = this.images.get(b.image.guid);
      if (img?.status === "ready") return image(img.path).w_full().rounded(6).border_1().border_color(t.border);
      return div().h(72).rounded(6).border_1().border_color(t.border).bg(t.chrome).flex().items_center().justify_center()
        .text_size(11.5).text_color(img?.status === "error" ? t.blocked : t.dim)
        .child(img?.status === "error" ? `${b.image.name} · ${img.error ?? "failed"}` : `${b.image.name} · loading`);
    }));
  }

  factorsLine(t) {
    const f = this.item.fields;
    return h_flex().gap(14).text_size(11.5).text_color(t.dim).children(factorsFor(this.item.type).map((r) =>
      h_flex().gap(5).child(div().child(r.key)).child(div().text_color(f[r.field] == null ? t.working : t.foreground).child(f[r.field] == null ? "—" : String(f[r.field])))));
  }

  header(t) {
    const f = this.item.fields;
    const bug = this.item.bug;
    return v_flex().gap(4)
      .child(h_flex().gap(8).items_baseline().text_size(12)
        .child(div().text_color(bug ? t.blocked : t.dim).child(`${this.item.type} #${this.id}`))
        .when(bug && f[F.severity], (el) => el.child(div().text_color(t.dim).child(severity(f[F.severity]))))
        .when(f[F.priority] != null, (el) => el.child(div().text_color(t.dim).child(`P${f[F.priority]}`))))
      .child(h_flex().flex_wrap().gap(8).items_baseline()
        .child(div().text_size(16).font_medium().child(f[F.title] ?? ""))
        .child(this.pill(t, f[F.state] ?? "", this.stateColor(t, f[F.state]))));
  }

  pointsBlock(t) {
    const f = this.item.fields;
    const pts = f[F.points];
    return v_flex().gap(4)
      .child(h_flex().gap(10).items_baseline()
        .child(div().text_size(30).font_medium().text_color(pts == null ? t.working : t.foreground).child(pts == null ? "—" : String(Number(pts))))
        .child(div().text_size(12).text_color(t.dim).child("story points"))
        .child(div().flex_1())
        .child(div().text_size(11.5).text_color(t.dim).child("p to point")))
      .child(this.factorsLine(t));
  }

  // A section that throws while drawing shows its error in place instead of blanking the pane.
  safe(t, label, build) {
    try { return build(); } catch (e) { return div().text_size(12).text_color(t.blocked).child(`${label}: ${errText(e)}`); }
  }

  itemBody(t) {
    const it = this.item;
    const f = it.fields;
    const b = it.blocks;
    const S = (label, build) => this.safe(t, label, build);
    const meta = () => h_flex().flex_wrap().gap_x(14).gap_y(2).text_size(11.5).text_color(t.dim)
      .when(Boolean(f[F.assigned]), (el) => el.child(div().child(name(f[F.assigned]))))
      .when(Boolean(f[F.iteration]), (el) => el.child(div().child(String(f[F.iteration]).split("\\").pop())))
      .when(Boolean(f[F.changed]), (el) => el.child(div().child(`changed ${when(f[F.changed])}`)));
    const tags = (f[F.tags] ?? "").split(";").map((s) => s.trim()).filter(Boolean);
    const col = v_flex().gap(18).child(S("header", () => this.header(t))).child(S("meta", meta)).child(S("points", () => this.pointsBlock(t)))
      .when(tags.length > 0, (el) => el.child(S("tags", () => h_flex().flex_wrap().gap(6).children(tags.map((x) => this.pill(t, x, t.accent))))));
    if (it.bug) {
      col.child(S("summary", () => v_flex().gap(8).child(this.section(t, "Summary")).child(this.richBlocks(t, "summary", b.summary))));
      if (b.expected.length || b.actual.length) col.child(S("expected/actual", () => h_flex().gap(12).items_start()
        .child(v_flex().flex_1().min_w(0).gap(6).p(10).rounded(7).border_1().border_color(t.border)
          .child(div().text_size(10.5).font_semibold().text_color(t.done).child("EXPECTED")).child(this.richBlocks(t, "expected", b.expected)))
        .child(v_flex().flex_1().min_w(0).gap(6).p(10).rounded(7).border_1().border_color(t.border)
          .child(div().text_size(10.5).font_semibold().text_color(t.blocked).child("ACTUAL")).child(this.richBlocks(t, "actual", b.actual)))));
      if (b.repro.length) col.child(S("repro", () => v_flex().gap(8).child(this.section(t, "Repro steps")).child(this.richBlocks(t, "repro", b.repro))));
      if (f[F.sysinfo]) col.child(S("system", () => h_flex().gap(8).text_size(12).child(div().text_color(t.dim).child("System")).child(div().text_color(t.muted).child(blocks(f[F.sysinfo]).map((x) => x.text ?? "").join(" ").trim()))));
    } else {
      col.child(S("description", () => v_flex().gap(8).child(this.section(t, "Description")).child(b.description.length ? this.richBlocks(t, "desc", b.description) : div().text_color(t.dim).child("No description."))));
    }
    col.child(S("criteria", () => v_flex().gap(8).child(this.section(t, "Acceptance criteria")).child(b.criteria.length ? this.richBlocks(t, "ac", b.criteria) : div().text_color(t.dim).child("None written."))));
    return col;
  }

  stateBody(t) {
    const P = this.statePick;
    const list = this.statesShown();
    const CAT = { Proposed: "Proposed", InProgress: "In progress", Resolved: "Resolved", Completed: "Completed", Removed: "Removed" };
    const col = v_flex().gap(14).child(this.header(t))
      .child(h_flex().gap(8).items_baseline()
        .child(div().text_size(10.5).font_semibold().text_color(t.dim).child("CHANGE STATE"))
        .child(div().text_size(11).text_color(t.dim).child(P.query ? `narrowed to "${P.query}"` : "type to narrow")));
    if (!P.list) return col.child(div().text_color(t.dim).child("Loading the workflow…"));
    let lastCat = null;
    const rows = v_flex().gap(2);
    list.forEach((s, i) => {
      if (s.category !== lastCat) { lastCat = s.category; rows.child(div().pt(6).pb(2).px(8).text_size(10.5).text_color(t.dim).child((CAT[s.category] ?? s.category).toUpperCase())); }
      const on = i === P.at; const cur = s.name === P.current;
      rows.child(h_flex().id(`st-${i}`).gap(8).items_center().px(8).h(24).rounded(6)
        .when(on, (el) => el.bg(t.raised).border_1().border_color(t.accent))
        .hover((x) => x.bg(t.hover))
        .on_click((_e, cx) => { P.at = i; this.keyState({ keystroke: "enter", key: "enter", modifiers: {} }, cx); cx.notify(); })
        .child(div().size(7).rounded(4).bg(this.stateColor(t, s.name)))
        .child(div().flex_1().text_color(on || cur ? t.foreground : t.muted).child(s.name))
        .when(cur, (el) => el.child(div().text_size(11).text_color(t.dim).child("current"))));
    });
    return col.child(rows);
  }

  pointBody(t) {
    const p = this.point;
    const chip = (text, on, cur) => div().min_w(32).text_center().py(2).rounded(6).border_1()
      .border_color(on ? t.accent : t.border).bg(on ? t.accent : cur ? t.raised : t.background + "00")
      .text_color(on ? t.accent_foreground ?? t.background : t.muted).when(on, (el) => el.font_medium()).child(text);
    const row = (label, values, at, cur) => h_flex().gap(10).items_center().mx(-8).px(8).py(4).rounded(7).when(cur, (el) => el.bg(t.raised))
      .child(div().w(150).flex_none().text_color(cur ? t.foreground : t.muted).child(label))
      .child(h_flex().flex_wrap().gap(6).children(values.map((v, i) => chip(v, i === at, cur))));
    const sum = p.rows.reduce((s, r) => s + (r.at >= 0 ? Number(r.values[r.at]) : 0), 0);
    const named = p.rows.filter((r) => r.at >= 0).map((r) => `${r.key} ${r.values[r.at]}`).join(" + ");
    return v_flex().gap(14).child(this.header(t))
      .child(v_flex().gap(10)
        .children(p.rows.map((r, i) => row(r.label, r.values, r.at, p.row === i)))
        .child(div().h(1).bg(t.border))
        .child(row("Story points", POINTS, p.points, p.row === p.rows.length))
        .when(named.length > 0, (el) => el.child(div().pl(160).text_size(11.5).text_color(t.dim).child(`${named} = ${sum}`))));
  }

  confirmBody(t) {
    const c = this.confirm;
    const red = t.blocked;
    return v_flex().gap(14).when(Boolean(this.item), (el) => el.child(this.header(t)))
      .child(v_flex().gap(6).px(12).py(8).rounded(7).border_1().border_color(red).bg(red + "14")
        .child(h_flex().gap(8).items_center()
          .child(div().text_color(t.foreground).child(c.title)).child(div().flex_1())
          .child(div().px(6).rounded(4).bg(red).text_color(t.background).font_medium().child("y"))
          .child(div().text_color(t.dim).child("/"))
          .child(div().px(6).rounded(4).border_1().border_color(t.border).text_color(t.muted).child("n")))
        .children(c.lines.map((l) => div().text_size(12).text_color(t.muted).child(l))))
      .when(Boolean(this.busy), (el) => el.child(div().text_size(12).text_color(t.working).child(`${this.busy}…`)));
  }

  commentsBody(t) {
    const list = this.comments;
    const col = v_flex().gap(14)
      .child(v_flex().gap(4)
        .child(div().text_size(12).text_color(this.item.bug ? t.blocked : t.dim).child(`${this.item.type} #${this.id}`))
        .child(div().text_size(14).font_medium().child(this.item.fields[F.title] ?? "")))
      .child(this.section(t, "Comments", list ? list.length : this.item.fields[F.commentCount]));
    if (!list) return col.child(div().text_color(t.dim).child(this.busy ? "Loading…" : "No comments loaded."));
    if (!list.length) return col.child(div().text_color(t.dim).child("No comments yet. a writes the first one."));
    this.rowH = this.rowH ?? [];
    return col.child(v_flex().gap(12).children(list.map((c, i) => {
      const cur = i === this.cursor;
      const picking = cur && this.reactPick != null;
      return v_flex().id(`cm-${c.id}`).gap(5).pl(10).py(cur ? 6 : 0).pr(cur ? 10 : 0).ml(cur ? -2 : 0)
        .border_l(2).border_color(cur ? t.accent : t.border).when(cur, (el) => el.rounded_r(7).bg(t.raised))
        .on_size_change((s, cx) => { this.rowH[i] = s.height; })
        .on_click((_e, cx) => { this.cursor = i; this.handle.focus(); cx.notify(); })
        .child(h_flex().gap(8).items_baseline().child(div().text_color(t.foreground).child(c.who)).child(div().text_size(11).text_color(t.dim).child(when(c.when))))
        .child(this.richBlocks(t, `c${c.id}`, c.blocks))
        .when(c.reactions.length > 0 && !picking, (el) => el.child(h_flex().flex_wrap().gap(6).text_size(11).children(c.reactions.filter((r) => r.count > 0).map((r) =>
          div().px(7).rounded(10).border_1().border_color(r.mine ? t.accent : t.border).text_color(r.mine ? t.accent : t.muted).child(`${r.type} ${r.count}`)))))
        .when(picking, (el) => el.child(v_flex().gap(4)
          .child(h_flex().flex_wrap().gap(6).text_size(11.5).children(REACTIONS.map((r, j) => {
            const on = j === this.reactPick; const mine = c.reactions.some((x) => x.type === r && x.mine);
            return div().px(8).py(1).rounded(6).border_1().border_color(on ? t.accent : mine ? t.accent + "80" : t.border)
              .bg(on ? t.accent : t.background + "00").text_color(on ? t.accent_foreground ?? t.background : t.foreground).child(mine ? `${r} ✓` : r);
          })))
          .child(div().text_size(11).text_color(t.dim).child("h/l pick · enter toggle · esc close"))));
    })));
  }

  listBody(t) {
    const L = this.list;
    L.marked ??= []; // see keyList: state survives a hot reload, new fields do not
    const sp = this.sprint();
    const tab = (id, label, count, on) => h_flex().gap(5).px(9).py(2).rounded(6).text_size(11.5)
      .when(on, (el) => el.bg(t.raised).border_1().border_color(t.border).text_color(t.foreground))
      .when(!on, (el) => el.text_color(t.muted))
      .child(div().child(label)).when(count != null, (el) => el.child(div().text_color(t.dim).child(String(count))));
    const sprintLabel = sp ? sp.name.replace(/\s*-\s*[A-Z][a-z]{2}.*$/, "") : "Sprint";
    const counts = L.tab === "sprint" ? (L.rows?.length ?? null) : null;
    const prev = this.iterations?.[this.sprintAt - 1]?.name.replace(/\s*-\s*[A-Z][a-z]{2}.*$/, "");
    const next = this.iterations?.[this.sprintAt + 1]?.name.replace(/\s*-\s*[A-Z][a-z]{2}.*$/, "");
    const tabs = h_flex().flex_none().gap(6).items_center().px(14).py(8).border_b(1).border_color(t.border)
      .child(tab("backlog", "1 Backlog", L.tab === "backlog" ? L.rows?.length ?? null : null, L.tab === "backlog"))
      .child(tab("sprint", `2 ${sprintLabel}`, L.tab === "sprint" ? counts : null, L.tab === "sprint"))
      .child(div().flex_1())
      .when(L.tab === "sprint" && Boolean(sp), (el) => el.child(div().text_size(11).text_color(t.dim).child(`[ ${prev ?? ""} · ${next ?? ""} ]`)));

    const rows = L.rows ?? [];
    const unpointed = rows.filter((r) => r.points == null && r.state !== "Wont Do").length;
    const unassigned = rows.filter((r) => !r.whoId && r.state !== "Wont Do").length;
    const today = iso(new Date());
    const day = sp?.start && sp?.finish ? `day ${Math.max(1, Math.round((Date.parse(today) - Date.parse(sp.start)) / 86400000) + 1)} of ${Math.round((Date.parse(sp.finish) - Date.parse(sp.start)) / 86400000) + 1}` : "";
    const status = h_flex().flex_none().gap(12).items_center().px(14).py(5).text_size(11).text_color(t.dim).border_b(1).border_color(t.border)
      .when(L.tab === "sprint" && Boolean(sp), (el) => el.child(div().child(`${mmdd(sp.start)} – ${mmdd(sp.finish)}${day ? ` · ${day}` : ""}`)))
      .when(L.tab === "backlog", (el) => el.child(div().child(`${rows.length} open${L.wontDo ? "" : " · Wont Do hidden"}`)))
      .child(h_flex().gap(4).child(div().text_color(t.working).child(String(unpointed))).child(div().child("unpointed")))
      .child(h_flex().gap(4).child(div().text_color(t.working).child(String(unassigned))).child(div().child("unassigned")))
      .child(div().flex_1())
      .when(L.marked.length > 0, (el) => el.child(div().text_color(t.accent).child(`${L.marked.length} marked · d deploys`)))
      .child(div().text_color(L.person ? t.accent : t.dim).child(L.person ? `filter: ${this.personLabel()}` : "everyone · @ to filter"));

    const search = L.searching || L.search
      ? h_flex().flex_none().gap(8).items_center().px(14).py(5).text_size(11.5).border_b(1).border_color(t.border)
        .child(div().text_color(t.dim).child("/"))
        .child(div().flex_1().text_color(t.foreground).child(L.search + (L.searching ? "▏" : "")))
        .child(div().text_size(11).text_color(t.dim).child(`${this.filtered().length} of ${rows.length}${L.searching ? " · enter keeps · esc clears" : ""}`))
      : null;

    const groups = this.groups();
    this.listTop = [];
    let index = 0; // position in entries(): headers and rows alike
    const body = v_flex().gap(2).px(10).py(8);
    if (!L.rows && this.notConfigured()) body.child(this.setupBody(t));
    else if (!L.rows) body.child(div().px(8).py(20).text_color(this.error ? t.blocked : t.dim).child(this.error ?? "Loading…"));
    else if (L.person === "me" && !this.me) body.child(div().px(8).py(20).text_color(t.dim).child("Finding your sign-in…"));
    else if (!groups.length) body.child(div().px(8).py(20).text_color(t.dim).child("Nothing matches."));
    for (const g of groups) {
      const folded = L.folded.has(g.state);
      const color = this.stateColor(t, g.state);
      const hi = index === L.cursor; const hIndex = index++;
      body.child(h_flex().id(`grp-${g.state}`).gap(8).items_baseline().px(6).mt(6).h(26).rounded(6).text_size(10.5).font_semibold().text_color(color)
        .when(hi, (el) => el.bg(t.raised).border_1().border_color(t.accent))
        .cursor_pointer().hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { L.cursor = hIndex; folded ? L.folded.delete(g.state) : L.folded.add(g.state); cx.notify(); })
        .child(div().child(folded ? "▸" : "▾"))
        .child(div().child(g.state.toUpperCase()))
        .child(div().font_normal().text_color(t.dim).child(String(g.rows.length)))
        .when(folded, (el) => el.child(div().flex_1()).child(div().font_normal().text_color(hi ? t.muted : t.dim).child(hi ? "enter opens" : "folded"))));
      if (folded) continue;
      for (const r of g.rows) {
        const i = index++;
        const cur = i === L.cursor;
        const marked = L.marked.includes(r.id);
        body.child(h_flex().id(`row-${r.id}`).gap(8).items_center().px(8).h(24).rounded(6).text_size(12.5)
          .when(cur, (el) => el.bg(t.raised).border_1().border_color(t.accent))
          .hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => { L.cursor = i; this.openFromList(r.id, cx); })
          .child(div().w(10).flex_none().text_color(t.accent).child(marked ? "●" : ""))
          .child(div().w(44).flex_none().text_size(11.5).text_color(r.type === "Bug" ? t.blocked : t.dim).child(String(r.id)))
          .child(div().flex_1().min_w(0).truncate().text_color(cur ? t.foreground : t.muted).child(r.title))
          .child(div().flex_none().text_size(11).text_color(r.whoId ? t.dim : t.working).child(r.whoId ? shortName(r.who) : "—"))
          .child(div().w(28).flex_none().text_right().text_color(r.points == null ? t.working : t.muted).child(r.points == null ? "—" : String(Number(r.points)))));
      }
    }
    // Tops are regular: a header is 6 + 26 + 2 gap, a row 24 + 2 gap. Enough to keep the cursor on screen.
    let top = 8; for (const g of groups) { this.listTop.push(top + 6); top += 34; if (L.folded.has(g.state)) continue; for (const _r of g.rows) { this.listTop.push(top); top += 26; } }

    const picker = L.picker ? this.peoplePopup(t) : null;
    return { tabs, status, search, body, picker };
  }

  peoplePopup(t) {
    const P = this.list.picker;
    const list = this.listPeople().filter((p) => !P.query || p.name.toLowerCase().includes(P.query.toLowerCase()));
    return v_flex().absolute().left(90).top(110).w(300).gap(2).p(8).rounded(8).border_1().border_color(t.border).bg(t.popover).shadow_lg()
      .child(div().px(8).pb(6).text_size(11).text_color(t.dim).child(P.query ? `Show tickets for · ${P.query}▏` : "Show tickets for · type to narrow"))
      .children(list.slice(0, 14).map((p, i) => {
        const on = i === P.at;
        const color = p.id === "unassigned" ? t.working : t.foreground;
        return h_flex().gap(8).px(8).py(3).rounded(5).when(on, (el) => el.bg(t.accent)).text_color(on ? t.accent_foreground ?? t.background : color)
          .child(div().flex_1().child(p.me ? `${p.name} · me` : p.name))
          .child(div().text_color(on ? t.accent_foreground ?? t.background : t.dim).child(String(p.count)))
          .when(i === 1, (el) => el);
      }))
      .when(list.length > 14, (el) => el.child(div().px(8).text_size(11).text_color(t.dim).child(`… ${list.length - 14} more`)))
      .child(div().px(8).pt(6).text_size(11).text_color(t.dim).child("j/k pick · enter apply · esc keep current"));
  }

  composeBody(t) {
    const c = this.compose;
    const ask = c.kind === "ask";
    const col = v_flex().gap(14)
      .child(v_flex().gap(4)
        .child(div().text_size(12).text_color(this.item.bug ? t.blocked : t.dim).child(`${this.item.type} #${this.id}`))
        .child(div().text_size(14).font_medium().child(this.item.fields[F.title] ?? "")));
    if (ask) {
      const tg = this.target();
      this.pr = this.linkedPr();
      const keys = [["ticket", `ticket #${this.id}`], ["pr", this.pr ? `GitHub PR #${this.pr}` : null], ["description", this.item.bug ? "summary" : "description"], ["criteria", "acceptance criteria"]];
      col.child(v_flex().gap(6).child(this.section(t, "Sent to"))
        .child(tg ? h_flex().gap(8).items_center().child(div().size(7).rounded(4).bg(t.done)).child(div().child(tg.label)) : div().text_color(t.blocked).child("No terminal found in this tab.")));
      col.child(v_flex().gap(6).child(this.section(t, "Attached context"))
        .child(h_flex().flex_wrap().gap(6).text_size(11.5).children(keys.filter(([, l]) => l).map(([k, l], i) =>
          div().px(8).rounded(6).border_1().border_color(c.context[k] ? t.accent : t.border).text_color(c.context[k] ? t.accent : t.dim)
            .when((this.ctxAt ?? 0) === i, (el) => el.bg(t.raised)).child(l))))
        .child(div().text_size(11).text_color(t.dim).child("tab toggles the highlighted chip")));
    } else if (c.replyTo) {
      col.child(v_flex().gap(3).pl(10).border_l(2).border_color(t.border)
        .child(h_flex().gap(8).items_baseline().child(div().text_size(11).text_color(t.dim).child("replying to")).child(div().text_color(t.foreground).child(c.replyTo.who)).child(div().text_size(11).text_color(t.dim).child(when(c.replyTo.when))))
        .child(div().text_color(t.muted).text_size(12.5).child(c.replyTo.blocks.map((b) => b.text ?? "").join(" ").slice(0, 240))));
    }
    col.child(v_flex().gap(6).child(this.section(t, ask ? "Prompt" : "Your comment"))
      .child(div().rounded(7).border_1().border_color(t.accent).bg(t.chrome).child(Textarea.new(c.state).w_full().h(120)))
      .when(Boolean(c.picker), (el) => el.child(v_flex().gap(2).p(6).w(260).rounded(7).border_1().border_color(t.border).bg(t.popover)
        .child(div().px(8).pb(4).text_size(11).text_color(t.dim).child("People on this ticket"))
        .children(this.people.map((p, i) => div().px(8).py(3).rounded(5).when(i === c.picker.at, (el) => el.bg(t.accent).text_color(t.accent_foreground ?? t.background)).child(p.name)))))
      .child(div().text_size(11).text_color(t.dim).child(ask ? "ctrl-enter sends · esc cancels" : "type @ to mention · ctrl-enter posts · esc discards")));
    return col;
  }

  render(cx) {
    const t = theme();
    const v = this.view;
    const root = div().id("tickets").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .relative().size_full().overflow_hidden().bg(t.background).text_color(t.foreground).text_size(13)
      .on_click(() => { if (!this.compose) this.handle.focus(); })
      .on_size_change((s, cx) => { this.viewH = s.height - 60; this.scrollTo(this.y, cx); })
      .on_scroll_wheel((e, cx) => this.scrollTo(this.y - (e.delta?.y ?? 0), cx));

    const crumb = this.returnTo === "list"
      ? `${this.list.tab === "backlog" ? "Backlog" : (this.sprint()?.name.replace(/\s*-\s*[A-Z][a-z]{2}.*$/, "") ?? "Sprint")}${this.list.person ? ` › ${this.personLabel()}` : ""} › `
      : "";
    const suffix = v === "comments" ? " · Comments" : v === "point" ? " · Pointing" : v === "state" ? " · State" : v === "ask" ? " · Ask Claude" : v === "compose" ? " · Reply" : "";
    const pos = this.returnTo === "list" && v === "item" ? this.listPosition() : null;
    const headerBar = h_flex().flex_none().h(30).px(14).gap(10).items_center().bg(t.chrome).border_b(1).border_color(t.border).text_size(11.5).text_color(t.muted)
      .child(div().size(8).rounded(4).bg(this.item?.bug ? t.blocked : t.accent))
      .when(Boolean(crumb), (el) => el.child(div().text_color(t.dim).child(crumb)))
      .child(div().child(v === "list" ? "Tickets" : `${crumb ? "" : "Tickets · "}${this.id ?? ""}${suffix}`))
      .when(Boolean(pos), (el) => el.child(div().text_color(t.dim).child(`${pos} · n/N`)))
      .child(div().flex_1())
      .when(Boolean(this.busy), (el) => el.child(div().text_color(t.working).child(`${this.busy}…`)))
      .when(!this.busy && Boolean(this.toast), (el) => el.child(div().text_color(t.done).child(this.toast)))
      .when(!this.busy && !this.toast && (v === "list" ? this.list.fetchedAt : this.fetchedAt) > 0, (el) => el.child(div().text_color(t.dim).child(`updated ${Math.max(0, Math.round((Date.now() - (v === "list" ? this.list.fetchedAt : this.fetchedAt)) / 60000))}m ago`)));

    if (v === "list") {
      const L = this.listBody(t);
      const hints = this.list.picker ? [["j/k", "pick"], ["enter", "apply"], ["type", "narrow"], ["esc", "close"]]
        : this.list.searching ? [["type", "search"], ["enter", "keep"], ["esc", "clear"]]
        : [["j/k", "move"], ["l", "open / fold"], ["1 2", "backlog / sprint"], ["[ ]", "sprint"], ["@", "person"], ["u", "unassigned"], ["m", "mine"], ["/", "search"], ["p", "point"], ["x", "mark"], ["d", "deploy"], ["W", "wont do"], ["q", "close"]];
      return root
        .child(v_flex().size_full()
          .child(headerBar)
          .child(L.tabs)
          .child(L.status)
          .when(Boolean(L.search), (el) => el.child(L.search))
          .child(div().id("frame").relative().flex_1().min_h(0).overflow_hidden()
            .child(div().id("content").absolute().left(0).right(0).top(-this.y)
              .on_size_change((s, cx) => { this.contentH = s.height; this.scrollTo(this.y, cx); })
              .child(L.body))
            .when(Boolean(L.picker), (el) => el.child(L.picker)))
          .child(this.keyHint(t, hints)));
    }

    let body;
    if (!this.item && v !== "confirm" && this.notConfigured()) body = this.setupBody(t);
    else if (!this.item && v !== "confirm") body = div().text_color(this.error ? t.blocked : t.dim).child(this.error ?? "Loading…");
    else if (v === "point") body = this.pointBody(t);
    else if (v === "state") body = this.stateBody(t);
    else if (v === "confirm") body = this.confirmBody(t);
    else if (v === "comments") body = this.commentsBody(t);
    else if (v === "compose" || v === "ask") body = this.composeBody(t);
    else body = this.itemBody(t);

    const hints = {
      item: this.returnTo === "list"
        ? [["esc / h", "back to list"], ["n/N", "next, prev"], ["s", "state"], ["p", "point"], ["c", "comments"], [":", "ask Claude"], ["e", "explain"], ["o", "browser"], ["q", "close"]]
        : [["j/k", "scroll"], ["s", "state"], ["p", "point"], ["c", "comments"], [":", "ask Claude"], ["e", "explain"], ["o", "browser"], ["r", "refresh"], ["q", "close"]],
      point: [["j/k", "row"], ["h/l", "value"], ["1-9", "type"], ["enter", "save all"], ["esc", "cancel"]],
      state: [["j/k", "pick"], ["type", "narrow"], ["enter", "change"], ["esc", "cancel"]],
      confirm: [["y", this.confirm?.yes ?? "send to Azure"], ["n / esc", "back"]],
      comments: [["j/k", "move"], ["a", "new"], ["enter", "reply"], ["+", "like"], ["e", "react"], ["r", "refresh"], ["esc", "back"]],
      compose: [["ctrl-enter", "post"], ["@", "mention"], ["esc", "discard"]],
      ask: [["ctrl-enter", "send"], ["tab", "toggle context"], ["esc", "cancel"]],
    }[v] ?? [];

    const content = v_flex().w_full().px(22).pt(18).pb(40).gap(16).child(body)
      .when(Boolean(this.error) && Boolean(this.item), (el) => el.child(div().text_size(12).text_color(t.blocked).child(this.error)));

    return root
      .child(v_flex().size_full()
        .child(headerBar)
        .child(div().id("frame").relative().flex_1().min_h(0).overflow_hidden()
          .child(div().id("content").absolute().left(0).right(0).top(-this.y)
            .on_size_change((s, cx) => { this.contentH = s.height; this.scrollTo(this.y, cx); })
            .child(content)))
        .child(this.keyHint(t, hints)));
  }
}
