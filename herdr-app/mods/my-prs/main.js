// PRs pane: GitHub pull requests beside Claude, keyboard driven.
//
// Open:  herdr-app do pane.split --direction right --mod my-prs                                   (the list)
//        herdr-app do pane.split --direction right --mod my-prs --props '{"repo":"my-repo","number":1041}'
//
// Views: the list (the configured repo set or every repo in the org, grouped by attention or by repo,
// r / m / @ person filters, n hides drafts and approved PRs, / search, b shows the bots), the PR (status, description, files),
// files (f), the unified diff (enter, or D from a list) with a line cursor and c to comment on a line, the conversation (c),
// checks (x) with the failed log, submit review (v), ask Claude (:). Every write to GitHub sits
// behind a y/n row.
//
// Data comes from `gh` on this machine. The active gh account may be a personal one, so with an account set
// every call first puts that account's token (gh auth token -u <account>) into GH_TOKEN: through
// cache/prs/gh.cmd on Windows, through sh elsewhere. Free text (comment bodies, GraphQL) travels in files,
// never on the command line.
//
// Keys (list):   j/k move   enter/l open   h/l fold   1 2 set / all   g by repo   r for me   m mine
//                @ person   / search   b bots   D diff   c conversation   o browser   y copy URL   R refresh   q close
// Keys (PR):     j k d u scroll   enter diff   f files   c conversation   x checks   v review   M merge
// Every view: j/k move a line or row, d/u half a page.
//                : ask Claude   o browser   y copy URL   r refresh   n/N next, prev   esc/h back   q close
// Keys (diff):   j/k line   d/u page   ] [ file   n/N hunk   c comment on line   x viewed   v review   esc back
// Test hook:     herdr-app do my-prs.key-<keystroke>
//
// Config: mods/my-prs/local.json (gitignored), overridden by --props. Without an owner the list says so.
//   { "owner": "<github org>", "account": "<gh login to use, or null for the active one>",
//     "repos": ["repo-a", "repo-b"], "setName": "My repos", "loginSuffix": "-corp" }
// Or several accounts, toggled with a in the list (the choice is remembered; "profile" is the first default):
//   { "profile": "work", "profiles": { "work": { ...the fields above }, "personal": { "owner": "me", "account": "me" } } }
// With profiles, the cached lists, PRs and sign-in are kept per profile.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView, Textarea, TextareaState } from "gpui-base";
import { props, theme, exec, hc, run, focused, panes, agents, checking, nextCommand, appHome, fonts, settings, openOverlay, readTextFile } from "herdr";
import * as fs from "fs/promises";

const LINE = 44;
const DIFF_LINE = 18;
const ROW = 48; // a list row: two lines
let LOGIN_SUFFIX = null; // e.g. "-corp": stripped from logins for display (config loginSuffix)
const LIST_FIELDS = "number,title,author,isDraft,updatedAt,createdAt,reviewDecision,statusCheckRollup,additions,deletions,changedFiles,reviewRequests,headRefName,baseRefName,url,labels";
const BOT = /aikido|dependabot|token-bot|renovate|\[bot\]|^app\//i;
const REACTIONS = [["+1", "👍"], ["heart", "❤"], ["hooray", "🎉"], ["laugh", "😄"], ["eyes", "👀"], ["rocket", "🚀"], ["confused", "😕"], ["-1", "👎"]];
const VERDICTS = [["APPROVE", "Approve", "goes to the author as a ✓"], ["REQUEST_CHANGES", "Request changes", "blocks merge until re-review"], ["COMMENT", "Comment", "no verdict"]];
const QUICK = [["1", "Review this PR for correctness and risk."], ["2", "Summarise what changed and why, in three lines."], ["3", "What is not covered by the tests?"], ["4", "Explain the failing check and suggest a fix."], ["5", "Draft my review summary from my pending comments."]];

const PR_QUERY = `query($owner:String!,$repo:String!,$n:Int!){ repository(owner:$owner,name:$repo){ pullRequest(number:$n){
 id number title body url state isDraft mergeable merged author{login} createdAt updatedAt baseRefName headRefName additions deletions changedFiles reviewDecision viewerDidAuthor
 reviewRequests(first:10){nodes{requestedReviewer{__typename ... on User{login} ... on Team{name slug}}}}
 latestReviews(first:20){nodes{author{login} state submittedAt}}
 reviews(first:40){nodes{databaseId author{login} state body submittedAt}}
 commits(last:1){nodes{commit{oid statusCheckRollup{state contexts(first:40){nodes{__typename ... on CheckRun{databaseId name status conclusion detailsUrl startedAt completedAt checkSuite{workflowRun{databaseId workflow{name}}}} ... on StatusContext{context state targetUrl}}}}}}}
 files(first:100){nodes{path additions deletions changeType}}
 reviewThreads(first:50){nodes{id isResolved isOutdated path line startLine diffSide comments(first:20){nodes{id databaseId author{login} body createdAt reactionGroups{content viewerHasReacted reactors{totalCount}}}}}}
 comments(first:50){nodes{id databaseId author{login} body createdAt reactionGroups{content viewerHasReacted reactors{totalCount}}}}
} } }`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const mmdd = (s) => { if (!s) return ""; const d = new Date(s); return `${MONTHS[d.getMonth()]} ${d.getDate()}`; };
// "2026-11-17T22:06:36Z" -> "1h", "3d", "Aug 20"
function age(iso) {
  if (!iso) return "";
  const m = Math.floor((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d`;
  return mmdd(iso);
}
function dur(a, b) {
  if (!a) return "";
  const s = Math.max(0, Math.round(((b ? Date.parse(b) : Date.now()) - Date.parse(a)) / 1000));
  return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
// "JaneDoe-corp" -> "Jane D", "john-smith" -> "john s", "jdoe-corp" -> "jdoe" (with loginSuffix "-corp")
function shortLogin(login) {
  let l = (login ?? "").replace(/^app\//, "");
  if (LOGIN_SUFFIX && l.toLowerCase().endsWith(LOGIN_SUFFIX.toLowerCase())) l = l.slice(0, -LOGIN_SUFFIX.length);
  const camel = l.match(/^([A-Z][a-z]+)([A-Z])/);
  if (camel) return `${camel[1]} ${camel[2]}`;
  const dash = l.match(/^([a-z]+)-([a-z])/i);
  if (dash) return `${dash[1]} ${dash[2]}`;
  return l;
}
const lastLine = (s) => (s ?? "").trim().split("\n").filter(Boolean).pop() ?? "";
const errText = (e) => String(e?.message ?? e).replace(/^(ERROR|error):\s*/i, "");
const isBot = (a) => Boolean(a?.is_bot) || a?.__typename === "Bot" || BOT.test(a?.login ?? "");
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

// Check runs and statuses as one state: "pass" | "fail" | "pending" | "none".
function checksState(contexts) {
  const list = contexts ?? [];
  if (!list.length) return "none";
  let pending = false;
  for (const c of list) {
    const concl = (c.conclusion ?? c.state ?? "").toUpperCase();
    const status = (c.status ?? "").toUpperCase();
    if (c.__typename === "StatusContext" || c.context) { if (concl === "FAILURE" || concl === "ERROR") return "fail"; if (concl === "PENDING" || concl === "EXPECTED") pending = true; continue; }
    if (status && status !== "COMPLETED") { pending = true; continue; }
    if (["FAILURE", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED", "STARTUP_FAILURE"].includes(concl)) return "fail";
  }
  return pending ? "pending" : "pass";
}
function checksCount(contexts) {
  const list = contexts ?? [];
  const ok = list.filter((c) => ["SUCCESS", "SKIPPED", "NEUTRAL"].includes((c.conclusion ?? c.state ?? "").toUpperCase())).length;
  return `${ok}/${list.length}`;
}

// A unified diff as files, each with hunks and numbered lines.
function parseDiff(text) {
  const files = [];
  let f = null, oldN = 0, newN = 0;
  for (const raw of (text ?? "").split("\n")) {
    if (raw.startsWith("diff --git ")) {
      const m = raw.match(/^diff --git a\/(.+?) b\/(.+)$/);
      f = { path: m ? m[2] : raw.slice(11), lines: [], add: 0, del: 0, binary: false };
      files.push(f);
      continue;
    }
    if (!f) continue;
    if (raw.startsWith("--- ") || raw.startsWith("+++ ") || raw.startsWith("index ") || raw.startsWith("new file") || raw.startsWith("deleted file") || raw.startsWith("similarity") || raw.startsWith("rename ") || raw.startsWith("old mode") || raw.startsWith("new mode")) continue;
    if (raw.startsWith("Binary files")) { f.binary = true; continue; }
    if (raw.startsWith("@@")) {
      const m = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@ ?(.*)$/);
      oldN = m ? Number(m[1]) : 0; newN = m ? Number(m[2]) : 0;
      f.lines.push({ kind: "hunk", text: raw });
      continue;
    }
    if (raw.startsWith("\\")) continue; // "\ No newline at end of file"
    const c = raw[0];
    if (c === "+") { f.lines.push({ kind: "add", text: raw.slice(1), newN: newN++ }); f.add++; }
    else if (c === "-") { f.lines.push({ kind: "del", text: raw.slice(1), oldN: oldN++ }); f.del++; }
    else if (c === " " || raw === "") { if (raw === "" && !f.lines.length) continue; f.lines.push({ kind: "ctx", text: raw.slice(1), oldN: oldN++, newN: newN++ }); }
  }
  return files;
}

export default class PRs extends View {
  init(_props, cx) {
    const p = props() ?? {};
    this.props = p;
    this.configure({});
    this.handle = cx.focus_handle();
    this.acx = cx; // an event's cx is stale after an await; async work redraws through this one
    this.repo = p.repo ? String(p.repo).replace(/^.*\//, "") : null;
    this.number = p.number ? Number(p.number) : null;
    this.view = this.number ? "pr" : "list";
    this.returnTo = null;
    this.me = null; this.teams = null;
    this.list = { scope: p.scope === "all" ? "all" : "set", rows: null, cursor: 0, folded: new Set(["automated"]), byRepo: false, person: null, needs: p.needs !== false, search: "", searching: false, bots: false, forMe: new Set(), fetchedAt: 0, picker: null, people: null, enriching: 0 };
    this.pr = null; // normalized PR
    this.fetchedAt = 0;
    this.files = { cursor: 0, viewed: new Set(), folded: new Set(), sort: "path" };
    this.diff = null; // { files: [...], flat: [{file, line}], cursor }
    this.pending = []; // review comments not yet submitted: { path, line, side, body }
    this.review = null; // { verdict, state (textarea), inSummary }
    this.threads = { cursor: 0, folded: new Set() };
    this.checks = { cursor: 0, log: null }; // log: { title, text }
    this.compose = null; // { kind: "inline" | "reply" | "general" | "ask", state, line, thread, context, ctxAt, postNow }
    this.confirm = null; // { title, lines, back, run }
    this.error = null; this.busy = null; this.toast = null;
    this.y = 0; this.viewH = 0; this.contentH = 0; this.pendingG = false;
    this.rowTop = []; this.rowH = [];
    this.tab = focused()?.tab ?? null;
    const have = fonts?.() ?? [];
    this.mono = ["JetBrains Mono", "Cascadia Mono", "Cascadia Code", "Consolas", "Menlo", "Courier New"].find((f) => have.includes(f)) ?? null;
    if (checking()) return;
    try { this.me = localStorage.getItem(this.ns("prs:me")) || null; const t = localStorage.getItem(this.ns("prs:teams")); if (t) this.teams = JSON.parse(t); } catch {}
    this.cacheList();
    // The first load starts from a timer tick owned by this view: opened by a key in another mod (the leader's g),
    // init runs inside that mod's call and work started there belongs to the popup that closes right after.
    cx.timer.after(0, (cx) => {
      this.readConfig().then(() => { if (this.profileName) this.restoreCache(); if (this.number) { this.cachePr(); this.load(cx); } else this.loadList(cx); });
    }, { owner: this });
    cx.timer.every(300000, (cx) => { if (this.view === "list") this.loadList(cx); else if (this.pr && this.view === "pr") this.load(cx); });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") {
          // The app sends "focus" again when a popup over this pane closes, even when the popup's own key just
          // moved the keyboard elsewhere (leader h): take it only while a PRs pane is the focused one.
          if (panes().some((p) => p.mod === "my-prs" && p.focused)) { this.focus(); cx.notify(); }
        }
        else if (c.startsWith("key-")) { const ks = c.slice(4); this.key({ keystroke: ks, key: ks, key_char: ks.length === 1 ? ks : undefined, modifiers: {} }, cx); cx.notify(); }
      }
    });
    this.focus();
    for (const ms of [150, 400]) cx.timer.after(ms, () => { if (!this.handle.is_focused() && !this.textFocused()) this.focus(); });
  }

  // Work-specific settings live in local.json beside this file (gitignored); --props win over it.
  configure(local) {
    const profiles = local?.profiles && typeof local.profiles === "object" && !Array.isArray(local.profiles) ? local.profiles : null;
    this.profiles = profiles ? Object.keys(profiles) : [];
    let saved = null;
    try { saved = localStorage.getItem("prs:profile"); } catch {}
    this.profileName = profiles ? ([this.profileName, this.props.profile, saved, local.profile, this.profiles[0]].find((n) => n && profiles[n]) ?? null) : null;
    const c = { ...(profiles ? profiles[this.profileName] : local), ...this.props };
    this.owner = c.owner ?? null;
    this.account = c.account ?? null; // null: the active gh account
    this.repoSet = Array.isArray(c.repos) ? c.repos : [];
    this.setName = c.setName ?? "Repos";
    LOGIN_SUFFIX = c.loginSuffix ?? null;
  }
  async readConfig() {
    this.configPath = `${appHome()}/mods/my-prs/local.json`.replace(/\\/g, "/");
    let text = null;
    try { text = await readTextFile(this.configPath); } catch { text = null; }
    this.configFound = text != null;
    try { this.configure(JSON.parse(text ?? "{}")); }
    catch (e) { this.configError = `local.json isn't valid JSON: ${errText(e)}`; }
    // Several accounts: the tabs pick the account, and each one shows its repo set, or all its repos without one.
    // One account: no repo set means start on all repos instead of an empty tab.
    const scope = this.multi() ? (this.repoSet.length ? "set" : "all") : (this.list?.scope === "set" && this.owner && !this.repoSet.length ? "all" : this.list?.scope);
    if (this.list && scope !== this.list.scope) { this.list.scope = scope; this.cacheList(); }
  }
  notConfigured() {
    if (this.configError) return this.configError;
    if (!this.owner) return !this.configFound ? "local.json is missing" : this.profileName ? `profile "${this.profileName}" has no "owner"` : `local.json has no "owner"`;
    if (this.list.scope === "set" && !this.repoSet.length) return `local.json has no "repos" for this tab (press 2 for all repos)`;
    return null;
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
      else if (this.number) this.load(cx); else this.loadList(cx);
    });
  }
  // Shown in place of the list or PR while notConfigured(): what's wrong, where the file goes, and what it takes.
  setupBody(t) {
    const text = (s, c) => div().text_color(c ?? t.dim).child(s);
    const field = (k, required, what) => h_flex().gap(10).items_start()
      .child(this.mono_(div().w(96).flex_none().text_color(required ? t.accent : t.foreground).child(k)))
      .child(div().flex_1().min_w(0).text_color(t.dim).child(`${required ? "required" : "optional"} · ${what}`));
    const example = ["{", `  "profile": "work",`, `  "profiles": {`, `    "work": { "owner": "my-org", "account": "me-corp", "repos": ["api", "web"] },`, `    "personal": { "owner": "me", "account": "me" }`, `  }`, "}"];
    return v_flex().gap(6).px(8).py(16).text_size(12)
      .child(text(`PRs isn't set up: ${this.notConfigured()}`, t.blocked))
      .child(text("Create this file. It's gitignored, so each machine needs its own copy:"))
      .child(this.mono_(text(this.configPath ?? "mods/my-prs/local.json", t.foreground)))
      .child(div().h(4))
      .child(field("owner", true, "GitHub org or user whose open PRs to list"))
      .child(field("repos", false, "repo names for tab 1 (the repo set); tab 2 lists every repo of owner"))
      .child(field("setName", false, `label for tab 1 (default "Repos")`))
      .child(field("account", false, "gh login to use (default: the active gh auth account)"))
      .child(field("loginSuffix", false, `suffix stripped from logins when shown, e.g. "-corp"`))
      .child(field("profiles", false, `several accounts: { "work": {...}, "personal": {...} }, each with the fields above; a toggles`))
      .child(field("profile", false, "the profile to start on (later, the last one picked)"))
      .child(div().h(4))
      .child(text("Example:"))
      .child(this.mono_(v_flex().text_color(t.foreground).children(example.map((l) => div().child(l || " ")))))
      .child(div().h(4))
      .child(text("This pane checks the file every 2s and loads once it's right."));
  }

  textFocused() { return Boolean(this.compose && !this.compose.picker) || Boolean(this.review?.inSummary); }
  focus() {
    if (this.compose && !this.compose.picker) this.compose.state.focus();
    else if (this.review?.inSummary) this.review.state.focus();
    else this.handle.focus();
  }
  flash(msg, cx, ms = 3000) { cx = this.acx ?? cx; this.toast = msg; cx.timer.after(ms, (cx) => { this.toast = null; cx.notify(); }); }

  // ---- gh ---------------------------------------------------------------------

  // localStorage key for this profile's copy of k (no prefix without profiles, so older caches still count).
  ns(k) { return this.profileName ? `${this.profileName}:${k}` : k; }
  isWin() { return /^[A-Za-z]:[\\/]/.test(appHome()); }
  winPath(f) { return this.isWin() ? f.replace(/\//g, "\\") : f; }
  // Back to the cached sign-in and list (or PR) of the current profile.
  restoreCache() {
    this.me = null; this.teams = null;
    try { this.me = localStorage.getItem(this.ns("prs:me")) || null; const t = localStorage.getItem(this.ns("prs:teams")); if (t) this.teams = JSON.parse(t); } catch {}
    if (this.number) this.cachePr(); else this.cacheList();
  }
  multi() { return (this.profiles?.length ?? 0) > 1; }
  // 1-9 or a in the list: that profile (a: the next one) from local.json; its own owner, account, repos and caches.
  switchProfile(cx, name) {
    if (!this.multi()) { this.flash(`One account: add "profiles" to local.json to switch`, cx); return; }
    const L = this.list;
    const next = name ?? this.profiles[(this.profiles.indexOf(this.profileName) + 1) % this.profiles.length];
    if (next === this.profileName) return;
    this.profileName = next;
    try { localStorage.setItem("prs:profile", this.profileName); } catch {}
    this._ghCmd = null;
    L.rows = null; L.people = null; L.forMe = new Set(); L.person = null; L.cursor = 0; L.fetchedAt = 0; this.y = 0; this.error = null;
    this.readConfig().then(() => {
      this.restoreCache();
      this.flash(`Account: ${this.profileName}${this.account ? ` (${this.account})` : ""}`, cx, 2000);
      this.loadList(cx);
    });
  }
  cacheDir() { return `${appHome()}/cache/prs`.replace(/\\/g, "/"); }
  async ghCmd() {
    if (this._ghCmd) return this._ghCmd;
    const dir = this.cacheDir();
    await fs.mkdir(dir, { recursive: true });
    const file = `${dir}/gh.cmd`;
    const body = this.account
      ? `@echo off\r\nsetlocal\r\nfor /f "usebackq delims=" %%t in (\`gh auth token -u ${this.account}\`) do set "GH_TOKEN=%%t"\r\ngh %*\r\n`
      : `@echo off\r\ngh %*\r\n`;
    const have = await fs.exists(file) ? await fs.readFile(file, "utf8") : null;
    if (have !== body) await fs.writeFile(file, body);
    this._ghCmd = file.replace(/\//g, "\\");
    return this._ghCmd;
  }
  // Runs gh with the work account; the stdout, or throws the last stderr line.
  async gh(args, timeout = 60000) {
    let r;
    if (this.isWin()) r = await exec("cmd", ["/c", await this.ghCmd(), ...args], { timeout });
    // sh's $0 is the account ("" for the active one); gh and brew's bin may be missing from an app's PATH.
    else r = await exec("sh", ["-c", `PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"; if [ -n "$0" ]; then GH_TOKEN=$(gh auth token -u "$0") || exit 1; export GH_TOKEN; fi; exec gh "$@"`, this.account ?? "", ...args], { timeout });
    if (r.code !== 0) throw new Error(lastLine(r.stderr) || lastLine(r.stdout) || `gh exited ${r.code}`);
    return r.stdout;
  }
  async ghJson(args, timeout) { const out = (await this.gh(args, timeout)).trim(); return out ? JSON.parse(out) : null; }
  async tmpFile(name, text) {
    const dir = this.cacheDir();
    await fs.mkdir(dir, { recursive: true });
    const file = `${dir}/${name}`;
    await fs.writeFile(file, text);
    return this.winPath(file);
  }
  async graphql(query, vars) {
    const q = await this.tmpFile(`q-${Date.now()}.graphql`, query);
    const args = ["api", "graphql", "-F", `query=@${q}`];
    for (const [k, v] of Object.entries(vars ?? {})) args.push(typeof v === "number" ? "-F" : "-f", `${k}=${v}`);
    const d = await this.ghJson(args, 90000);
    try { await fs.unlink(q.replace(/\\/g, "/")); } catch {}
    if (d?.errors?.length) throw new Error(d.errors.map((e) => e.message).join("; "));
    return d?.data;
  }
  async loadMe() {
    if (this.me && this.teams) return;
    try {
      const u = await this.ghJson(["api", "user"]);
      this.me = u?.login ?? null;
      const t = await this.ghJson(["api", "user/teams", "--paginate"]);
      this.teams = (t ?? []).map((x) => x.slug);
      try { localStorage.setItem(this.ns("prs:me"), this.me ?? ""); localStorage.setItem(this.ns("prs:teams"), JSON.stringify(this.teams)); } catch {}
    } catch {}
  }
  full(repo) { return `${this.owner}/${repo ?? this.repo}`; }
  prUrl() { return this.pr?.url ?? `https://github.com/${this.full()}/pull/${this.number}`; }
  key_() { return `${this.repo}#${this.number}`; }

  // ---- the list -----------------------------------------------------------------

  cacheList() {
    try {
      const c = JSON.parse(localStorage.getItem(this.ns(`list:${this.list.scope}`)) ?? "null");
      if (c) { this.list.rows = c.rows; this.list.fetchedAt = c.at; }
      const f = JSON.parse(localStorage.getItem(this.ns("forMe")) ?? "null");
      if (f) this.list.forMe = new Set(f);
    } catch {}
  }

  rowFromList(repo, x) {
    const rr = (x.reviewRequests ?? []).map((r) => r.login ?? r.slug ?? r.name ?? "").filter(Boolean);
    return { key: `${repo}#${x.number}`, repo, number: x.number, title: x.title ?? "", author: x.author?.login ?? "", bot: isBot(x.author), draft: Boolean(x.isDraft),
      updated: x.updatedAt, created: x.createdAt, decision: x.reviewDecision ?? "", checks: checksState(x.statusCheckRollup), checksN: checksCount(x.statusCheckRollup),
      add: x.additions ?? null, del: x.deletions ?? null, files: x.changedFiles ?? null, requested: rr, head: x.headRefName ?? "", base: x.baseRefName ?? "", url: x.url, labels: (x.labels ?? []).map((l) => l.name), lite: false };
  }
  rowFromSearch(x) {
    const repo = x.repository?.name ?? "";
    return { key: `${repo}#${x.number}`, repo, number: x.number, title: x.title ?? "", author: x.author?.login ?? "", bot: isBot(x.author), draft: Boolean(x.isDraft),
      updated: x.updatedAt, created: x.createdAt, decision: "", checks: "none", checksN: "", add: null, del: null, files: null, requested: [], head: "", base: "", url: x.url, labels: (x.labels ?? []).map((l) => l.name), comments: x.commentsCount ?? 0, lite: true };
  }

  async loadList(cx) {
    cx = this.acx ?? cx;
    const L = this.list;
    const scope = L.scope;
    const missing = this.notConfigured();
    if (missing) { this.error = missing; this.busy = null; cx.notify(); this.retryConfig(cx); return; }
    this.busy = "fetching"; this.error = null; cx.notify();
    try {
      this.loadMe();
      // Needs my review: one search, GitHub resolves my teams. Runs alongside the rows.
      const forMe = this.ghJson(["search", "prs", "--review-requested=@me", "--owner", this.owner, "--state", "open", "--limit", "100", "--json", "number,repository"]).then((d) => {
        L.forMe = new Set((d ?? []).map((x) => `${x.repository?.name}#${x.number}`));
        try { localStorage.setItem(this.ns("forMe"), JSON.stringify([...L.forMe])); } catch {}
        cx.notify();
      }).catch(() => {});
      let rows;
      if (scope === "set") {
        const per = await Promise.all(this.repoSet.map((repo) => this.ghJson(["pr", "list", "-R", this.full(repo), "--state", "open", "--limit", "100", "--json", LIST_FIELDS], 90000).then((d) => (d ?? []).map((x) => this.rowFromList(repo, x))).catch((e) => { this.error = `${repo}: ${errText(e)}`; return []; })));
        rows = per.flat();
      } else {
        const d = await this.ghJson(["search", "prs", "--owner", this.owner, "--state", "open", "--limit", "300", "--json", "number,title,author,isDraft,updatedAt,createdAt,repository,commentsCount,url,labels"], 90000);
        rows = (d ?? []).map((x) => this.rowFromSearch(x));
      }
      if (scope !== L.scope) return;
      rows.sort((a, b) => (b.updated ?? "").localeCompare(a.updated ?? ""));
      // Fresh rows may land in a new order: the cursor stays on the PR it was on.
      const keep = this.entries()[L.cursor]?.row?.key ?? null;
      L.rows = rows; L.fetchedAt = Date.now(); L.people = null;
      if (keep) { const i = this.entries().findIndex((e) => e.row?.key === keep); if (i >= 0) L.cursor = i; }
      this.clampListCursor();
      try { localStorage.setItem(this.ns(`list:${scope}`), JSON.stringify({ rows, at: L.fetchedAt })); } catch {}
      this.busy = null; cx.notify();
      await forMe;
      if (scope === "all") this.enrich(cx);
    } catch (e) { this.busy = null; this.error = errText(e); cx.notify(); }
  }

  // "All repos" rows come from the search without checks or sizes: fill them in per repo, a few at a time.
  async enrich(cx) {
    cx = this.acx ?? cx;
    const L = this.list;
    const repos = [...new Set((L.rows ?? []).filter((r) => r.lite).map((r) => r.repo))];
    if (!repos.length) return;
    L.enriching = repos.length; cx.notify();
    const queue = [...repos];
    const worker = async () => {
      while (queue.length) {
        const repo = queue.shift();
        try {
          const d = await this.ghJson(["pr", "list", "-R", this.full(repo), "--state", "open", "--limit", "100", "--json", LIST_FIELDS], 90000);
          const by = new Map((d ?? []).map((x) => [x.number, x]));
          for (const r of L.rows ?? []) if (r.repo === repo && by.has(r.number)) Object.assign(r, this.rowFromList(repo, by.get(r.number)));
        } catch {}
        L.enriching--; cx.notify();
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, repos.length) }, worker));
    L.enriching = 0;
    try { localStorage.setItem(this.ns(`list:${L.scope}`), JSON.stringify({ rows: L.rows, at: L.fetchedAt })); } catch {}
    cx.notify();
  }

  isMine(r) { return Boolean(this.me) && r.author.toLowerCase() === this.me.toLowerCase(); }
  // Still needs a review from someone: not a draft and not approved (changes requested still counts).
  needsReview(r) { return !r.draft && r.decision !== "APPROVED"; }
  forMe(r) { return this.list.forMe.has(r.key) || (this.me && r.requested.some((x) => x.toLowerCase() === this.me.toLowerCase())) || (this.teams ?? []).some((t) => r.requested.includes(t)); }

  filtered() {
    const L = this.list; const q = L.search.trim().toLowerCase();
    return (L.rows ?? []).filter((r) => {
      if (L.needs && !this.needsReview(r)) return false;
      if (L.person === "me" && !this.isMine(r)) return false;
      if (L.person === "forme" && !this.forMe(r)) return false;
      if (L.person && L.person !== "me" && L.person !== "forme" && r.author !== L.person) return false;
      if (q && !`${r.number} ${r.title} ${r.repo} ${r.author} ${r.head} ${r.labels.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }
  // Groups: by attention (needs my review, mine, team, automated) or by repo.
  groups() {
    const L = this.list;
    const rows = this.filtered();
    if (L.byRepo) {
      const by = new Map();
      for (const r of rows) { if (r.bot && !L.bots) continue; if (!by.has(r.repo)) by.set(r.repo, []); by.get(r.repo).push(r); }
      const bots = rows.filter((r) => r.bot).length;
      const out = [...by.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).map(([id, rs]) => ({ id, label: id, rows: rs, color: "muted" }));
      if (bots && !L.bots) out.push({ id: "automated", label: "automated", rows: rows.filter((r) => r.bot), color: "dim" });
      return out;
    }
    const g = { forme: [], mine: [], team: [], automated: [] };
    for (const r of rows) {
      if (r.bot) g.automated.push(r);
      else if (this.forMe(r)) g.forme.push(r);
      else if (this.isMine(r)) g.mine.push(r);
      else g.team.push(r);
    }
    return [["forme", "needs my review", "working"], ["mine", "mine", "accent"], ["team", "team", "muted"], ["automated", "automated", "dim"]]
      .filter(([id]) => g[id].length).map(([id, label, color]) => ({ id, label, rows: g[id], color }));
  }
  entries() { return this.groups().flatMap((g) => [{ group: g }, ...(this.list.folded.has(g.id) ? [] : g.rows.map((row) => ({ row, group: g })))]); }
  visible() { return this.groups().flatMap((g) => (this.list.folded.has(g.id) ? [] : g.rows)); }
  clampListCursor() { this.list.cursor = Math.min(this.list.cursor, Math.max(0, this.entries().length - 1)); }
  keepListCursorVisible() {
    const top = this.listTop?.[this.list.cursor];
    if (top == null) return;
    if (top < this.y) this.y = Math.max(0, top - 40);
    else if (top + ROW > this.y + this.viewH) this.y = top + ROW - this.viewH + 8;
  }
  listPeople() {
    if (this.list.people) return this.list.people;
    const by = new Map();
    for (const r of this.list.rows ?? []) { if (r.bot) continue; const p = by.get(r.author) ?? { id: r.author, name: shortLogin(r.author), count: 0, me: this.isMine(r) }; p.count++; by.set(r.author, p); }
    const people = [...by.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    this.list.people = [{ id: null, name: "Everyone", count: (this.list.rows ?? []).length }, { id: "forme", name: "Needs my review", count: (this.list.rows ?? []).filter((r) => this.forMe(r)).length }, ...people];
    return this.list.people;
  }
  personLabel() {
    const p = this.list.person;
    if (!p) return "everyone";
    if (p === "me") return "mine";
    if (p === "forme") return "needs my review";
    return shortLogin(p);
  }

  openFromList(r, cx) {
    this.returnTo = "list";
    this.repo = r.repo; this.number = r.number; this.pr = null; this.error = null; this.y = 0; this.diff = null; this.pending = []; this.review = null;
    this.files = { cursor: 0, viewed: new Set(), folded: new Set(), sort: "path" };
    this.threads = { cursor: 0, folded: new Set() }; this.checks = { cursor: 0, log: null };
    this.view = "pr";
    this.cachePr();
    this.load(cx);
  }
  backToList() { this.view = "list"; this.returnTo = null; this.pr = null; this.number = null; this.y = 0; this.keepListCursorVisible(); }
  stepInList(d, cx) {
    const vis = this.visible();
    const at = vis.findIndex((r) => r.key === this.key_());
    const next = vis[at + d];
    if (!next) return;
    this.list.cursor = Math.max(0, this.entries().findIndex((e) => e.row?.key === next.key));
    this.openFromList(next, cx);
  }
  listPosition() { const vis = this.visible(); const at = vis.findIndex((r) => r.key === this.key_()); return at < 0 ? null : `${at + 1} of ${vis.length}`; }

  // ---- one PR -------------------------------------------------------------------

  cachePr() {
    try {
      const c = JSON.parse(localStorage.getItem(this.ns(`pr:${this.key_()}`)) ?? "null");
      if (c) { this.pr = c.pr; this.fetchedAt = c.at; }
      const v = JSON.parse(localStorage.getItem(this.ns(`viewed:${this.key_()}`)) ?? "null");
      if (v) this.files.viewed = new Set(v);
    } catch {}
  }
  normalize(p) {
    const commit = p.commits?.nodes?.[0]?.commit ?? {};
    const contexts = commit.statusCheckRollup?.contexts?.nodes ?? [];
    const checks = contexts.map((c) => c.__typename === "StatusContext"
      ? { name: c.context, status: "COMPLETED", conclusion: c.state, url: c.targetUrl, workflow: "", started: null, completed: null, job: null, run: null }
      : { name: c.name, status: c.status, conclusion: c.conclusion, url: c.detailsUrl, workflow: c.checkSuite?.workflowRun?.workflow?.name ?? "", started: c.startedAt, completed: c.completedAt, job: c.databaseId, run: c.checkSuite?.workflowRun?.databaseId ?? (c.detailsUrl?.match(/\/runs\/(\d+)/)?.[1] ?? null) });
    const reactions = (g) => (g ?? []).filter((x) => x.reactors?.totalCount > 0).map((x) => ({ content: x.content, count: x.reactors.totalCount, mine: Boolean(x.viewerHasReacted) }));
    return {
      id: p.id, number: p.number, title: p.title ?? "", body: p.body ?? "", url: p.url, state: p.state, draft: Boolean(p.isDraft), mergeable: p.mergeable, merged: Boolean(p.merged),
      author: p.author?.login ?? "", created: p.createdAt, updated: p.updatedAt, base: p.baseRefName, head: p.headRefName, add: p.additions ?? 0, del: p.deletions ?? 0, nFiles: p.changedFiles ?? 0,
      decision: p.reviewDecision ?? "", mine: Boolean(p.viewerDidAuthor),
      requested: (p.reviewRequests?.nodes ?? []).map((r) => r.requestedReviewer).filter(Boolean).map((r) => ({ kind: r.__typename, name: r.login ?? r.name ?? r.slug, slug: r.slug ?? r.login })),
      latest: (p.latestReviews?.nodes ?? []).map((r) => ({ who: r.author?.login ?? "", state: r.state, at: r.submittedAt })),
      reviews: (p.reviews?.nodes ?? []).filter((r) => r.state !== "PENDING").map((r) => ({ id: r.databaseId, who: r.author?.login ?? "", state: r.state, body: r.body ?? "", at: r.submittedAt })),
      sha: commit.oid ?? "", checksState: checksState(contexts), checks,
      files: (p.files?.nodes ?? []).map((f) => ({ path: f.path, add: f.additions, del: f.deletions, change: f.changeType })),
      threads: (p.reviewThreads?.nodes ?? []).map((t) => ({ id: t.id, resolved: Boolean(t.isResolved), outdated: Boolean(t.isOutdated), path: t.path, line: t.line, side: t.diffSide,
        comments: (t.comments?.nodes ?? []).map((c) => ({ id: c.databaseId, who: c.author?.login ?? "", body: c.body ?? "", at: c.createdAt, reactions: reactions(c.reactionGroups) })) })),
      comments: (p.comments?.nodes ?? []).map((c) => ({ id: c.databaseId, who: c.author?.login ?? "", body: c.body ?? "", at: c.createdAt, reactions: reactions(c.reactionGroups) })),
    };
  }
  async load(cx) {
    cx = this.acx ?? cx;
    if (!this.number) return;
    if (!this.owner) { this.error = this.notConfigured(); this.busy = null; cx.notify(); this.retryConfig(cx); return; }
    const key = this.key_();
    this.busy = "fetching"; this.error = null; cx.notify();
    try {
      this.loadMe();
      const d = await this.graphql(PR_QUERY, { owner: this.owner, repo: this.repo, n: this.number });
      const p = d?.repository?.pullRequest;
      if (!p) throw new Error(`No PR ${key}`);
      if (key !== this.key_()) return;
      this.pr = this.normalize(p); this.fetchedAt = Date.now();
      this.threads.cursor = Math.min(this.threads.cursor, Math.max(0, this.threadItems().length - 1));
      // GraphQL (and gh pr view) stop at 100 files; the REST endpoint pages through the rest.
      if (this.pr.nFiles > this.pr.files.length) {
        try {
          const pages = await this.ghJson(["api", `repos/${this.full()}/pulls/${this.number}/files?per_page=100`, "--paginate", "--slurp"], 120000);
          if (key !== this.key_()) return;
          const CHANGE = { added: "ADDED", removed: "DELETED", modified: "MODIFIED", renamed: "RENAMED", copied: "COPIED" };
          const all = (Array.isArray(pages) ? pages.flat() : []).map((f) => ({ path: f.filename, add: f.additions ?? 0, del: f.deletions ?? 0, change: CHANGE[f.status] ?? "" }));
          if (all.length) this.pr.files = all;
        } catch {}
      }
      try { localStorage.setItem(this.ns(`pr:${key}`), JSON.stringify({ pr: this.pr, at: this.fetchedAt })); } catch {}
      this.busy = null; cx.notify();
    } catch (e) { this.busy = null; this.error = errText(e); cx.notify(); }
  }
  async loadDiff(cx) {
    cx = this.acx ?? cx;
    const key = this.key_();
    this.busy = "fetching diff"; cx.notify();
    try {
      const text = await this.gh(["pr", "diff", String(this.number), "-R", this.full()], 90000);
      if (key !== this.key_()) return;
      const files = parseDiff(text);
      const flat = [];
      files.forEach((f, fi) => { flat.push({ fi, head: true }); f.lines.forEach((l, li) => flat.push({ fi, li })); });
      this.diff = { files, flat, cursor: 0 };
      this.busy = null; cx.notify();
    } catch (e) { this.busy = null; this.error = errText(e); cx.notify(); }
  }
  // The flat index of a file's header, so f and ] [ can jump.
  diffFileStart(fi) { return Math.max(0, this.diff.flat.findIndex((e) => e.fi === fi && e.head)); }
  openDiff(path, cx) {
    this.view = "diff"; this.y = 0;
    const go = () => { if (path && this.diff) { const fi = this.diff.files.findIndex((f) => f.path === path); if (fi >= 0) { this.diff.cursor = this.diffFileStart(fi); this.keepDiffCursorVisible(); } } };
    if (!this.diff) this.loadDiff(cx).then(() => { go(); (this.acx ?? cx).notify(); });
    else go();
  }
  keepDiffCursorVisible() {
    const top = this.diff.cursor * DIFF_LINE + 8;
    if (top < this.y + DIFF_LINE) this.y = Math.max(0, top - DIFF_LINE * 3);
    else if (top + DIFF_LINE > this.y + this.viewH - DIFF_LINE) this.y = top + DIFF_LINE * 4 - this.viewH;
  }
  async loadLog(check, cx) {
    cx = this.acx ?? cx;
    if (!check?.job) { this.error = "No job log for this check (a status, not a run)."; cx.notify(); return; }
    this.busy = "fetching log"; cx.notify();
    try {
      const failed = ["FAILURE", "TIMED_OUT", "CANCELLED"].includes((check.conclusion ?? "").toUpperCase());
      let text;
      try { text = await this.gh(["run", "view", "--job", String(check.job), "-R", this.full(), failed ? "--log-failed" : "--log"], 120000); }
      catch (e) { if (!failed) throw e; text = await this.gh(["run", "view", "--job", String(check.job), "-R", this.full(), "--log"], 120000); }
      // Each line is "job\tstep\tTIMESTAMP message": keep the step and the message.
      const ansi = /\x1b\[[0-9;?]*[A-Za-z]|\^\[\[[0-9;?]*[A-Za-z]/g; // escapes, and gh's "^[[32m" spelling of them
      const lines = text.split("\n").map((l) => { const p = l.split("\t"); const msg = (p[2] ?? p[0] ?? "").replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z ?/, "").replace(ansi, "").replace(/\r$/, ""); return p.length >= 3 ? { step: p[1] === "UNKNOWN STEP" ? "" : p[1], msg } : { step: "", msg }; }).filter((l) => l.msg.trim());
      this.checks.log = { title: check.name, lines: lines.slice(-400), failed };
      this.view = "log"; this.y = 0;
      this.busy = null; cx.notify();
    } catch (e) { this.busy = null; this.error = errText(e); cx.notify(); }
  }

  // Threads and general comments in time order, for the conversation view.
  threadItems() {
    const p = this.pr; if (!p) return [];
    const items = [];
    for (const t of p.threads) items.push({ kind: "thread", at: t.comments[0]?.at ?? "", thread: t });
    for (const c of p.comments) items.push({ kind: "comment", at: c.at, comment: c });
    for (const r of p.reviews) if (r.body || r.state !== "COMMENTED") items.push({ kind: "review", at: r.at, review: r });
    return items.sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
  }

  // ---- writes (each behind the confirm row) -------------------------------------

  // The confirm row needs the keyboard: a summary or comment box that still had focus would swallow the y.
  ask(title, lines, back, run) {
    this.confirm = { title, lines, back, run }; this.view = "confirm";
    if (this.review) this.review.inSummary = false;
    this.handle.focus();
  }

  async runConfirm(cx) {
    cx = this.acx ?? cx;
    const c = this.confirm;
    this.busy = "sending"; this.error = null; cx.notify();
    try {
      const msg = await c.run();
      this.confirm = null; this.busy = null;
      if (this.view === "confirm") this.view = c.back;
      this.flash(msg, cx, 4000);
      cx.notify();
      await this.load(cx);
    } catch (e) { this.busy = null; this.error = errText(e); cx.notify(); }
  }

  startReview() {
    if (this.review) { this.review.inSummary = false; this.view = "review"; this.handle.focus(); return; }
    const state = TextareaState.new({ placeholder: "Comment sent with the verdict (markdown)", rows: 4 });
    this.review = { verdict: 0, state, inSummary: false };
    state.on("submit", (_e, cx) => { this.askSubmitReview(); cx.notify(); });
    this.view = "review";
    this.handle.focus();
  }
  askSubmitReview() {
    const R = this.review; const [event, label] = VERDICTS[R.verdict];
    const body = R.state.value().trim();
    const n = this.pending.length;
    this.error = null;
    if (event !== "APPROVE" && !body && !n) {
      this.error = `${label} needs a comment: write it, then enter.`;
      R.inSummary = true; R.state.focus(); return;
    }
    this.ask(`${label} #${this.number}${n ? ` with ${plural(n, "inline comment")}` : ""}?`,
      [body ? body.split("\n")[0].slice(0, 120) : "(no summary)", ...this.pending.slice(0, 4).map((c) => `${c.path.split("/").pop()}:${c.line}  ${c.body.split("\n")[0].slice(0, 80)}`), "The author and the team are notified."], "review",
      async () => {
        const payload = { event, body, comments: this.pending.map((c) => ({ path: c.path, line: c.line, side: c.side, body: c.body })) };
        const f = await this.tmpFile(`review-${Date.now()}.json`, JSON.stringify(payload));
        await this.gh(["api", "-X", "POST", `repos/${this.full()}/pulls/${this.number}/reviews`, "--input", f]);
        try { await fs.unlink(f.replace(/\\/g, "/")); } catch {}
        this.pending = []; this.review = null; this.view = "pr";
        return `${label}d: #${this.number}`.replace("Request changesd", "Changes requested").replace("Commentd", "Commented");
      });
  }
  askMerge() {
    const p = this.pr;
    this.ask(`Merge #${this.number} into ${p.base} (squash)?`,
      [`${p.head} → ${p.base}`, `Deletes ${p.head} after the merge.`, p.decision === "APPROVED" ? "Approved." : "Not approved yet: GitHub may refuse.", p.checksState === "pass" ? "Checks passed." : `Checks: ${p.checksState}.`], "pr",
      async () => { await this.gh(["pr", "merge", String(this.number), "-R", this.full(), "--squash", "--delete-branch"], 120000); return `Merged #${this.number}`; });
  }
  askRerun(check) {
    if (!check?.run) { this.error = "No workflow run to re-run for this check."; return; }
    const failed = ["FAILURE", "TIMED_OUT", "CANCELLED"].includes((check.conclusion ?? "").toUpperCase());
    this.ask(`Re-run "${check.name}"?`, [failed ? "Re-runs the failed jobs of this workflow run." : "Re-runs the whole workflow run.", `run ${check.run}`], "checks",
      async () => { await this.gh(["run", "rerun", String(check.run), "-R", this.full(), ...(failed ? ["--failed"] : [])]); return "Re-run queued"; });
  }
  askResolve(thread) {
    const un = thread.resolved;
    this.ask(`${un ? "Unresolve" : "Resolve"} the thread on ${thread.path.split("/").pop()}:${thread.line ?? "?"}?`, [un ? "Reopens it for everyone." : "Marks it resolved; anyone can reopen it."], "threads",
      async () => { await this.graphql(`mutation($id:ID!){ ${un ? "unresolveReviewThread" : "resolveReviewThread"}(input:{threadId:$id}){ thread{ isResolved } } }`, { id: thread.id }); return un ? "Thread reopened" : "Thread resolved"; });
  }
  askPostCompose() {
    const c = this.compose;
    const text = c.state.value().trim();
    if (!text) return;
    const head = text.split("\n").slice(0, 5);
    if (c.kind === "inline") {
      if (!c.postNow) {
        this.pending.push({ path: c.line.path, line: c.line.n, side: c.line.side, body: text });
        this.compose = null; this.view = "diff"; this.handle.focus();
        this.flash(`Added to your review · ${plural(this.pending.length, "pending comment")} · v submits`, this.acx);
        return;
      }
      this.ask(`Post a comment on ${c.line.path.split("/").pop()}:${c.line.n} now?`, [...head, "Visible to everyone with repo access."], "comment",
        async () => {
          const f = await this.tmpFile(`c-${Date.now()}.json`, JSON.stringify({ body: text, commit_id: this.pr.sha, path: c.line.path, line: c.line.n, side: c.line.side }));
          await this.gh(["api", "-X", "POST", `repos/${this.full()}/pulls/${this.number}/comments`, "--input", f]);
          this.compose = null; this.view = "diff";
          return "Comment posted";
        });
    } else if (c.kind === "reply") {
      const first = c.thread.comments[0];
      this.ask(`Reply to ${shortLogin(first.who)} on ${c.thread.path.split("/").pop()}:${c.thread.line ?? "?"}?`, head, "compose",
        async () => {
          const f = await this.tmpFile(`r-${Date.now()}.json`, JSON.stringify({ body: text }));
          await this.gh(["api", "-X", "POST", `repos/${this.full()}/pulls/${this.number}/comments/${first.id}/replies`, "--input", f]);
          this.compose = null; this.view = "threads";
          return "Reply posted";
        });
    } else {
      this.ask(`Post a comment on #${this.number}?`, [...head, "Not part of a review; posts right away."], "compose",
        async () => {
          const f = await this.tmpFile(`g-${Date.now()}.md`, text);
          await this.gh(["pr", "comment", String(this.number), "-R", this.full(), "--body-file", f]);
          this.compose = null; this.view = "threads";
          return "Comment posted";
        });
    }
  }
  // A reaction is one click in the web UI too: no confirm row, the same key undoes it.
  async toggleReaction(content, cx) {
    cx = this.acx ?? cx;
    const it = this.threadItems()[this.threads.cursor];
    if (!it) return;
    const c = it.kind === "thread" ? it.thread.comments[it.thread.comments.length - 1] : it.kind === "comment" ? it.comment : null;
    if (!c) return;
    const have = c.reactions.find((r) => r.content === content.toUpperCase().replace("+1", "THUMBS_UP").replace("-1", "THUMBS_DOWN") && r.mine) || c.reactions.find((r) => r.content === content && r.mine);
    this.busy = have ? "removing reaction" : "reacting"; cx.notify();
    try {
      const base = it.kind === "thread" ? `repos/${this.full()}/pulls/comments/${c.id}/reactions` : `repos/${this.full()}/issues/comments/${c.id}/reactions`;
      if (have) {
        const list = await this.ghJson(["api", base]);
        const mine = (list ?? []).find((r) => r.content === content && r.user?.login?.toLowerCase() === (this.me ?? "").toLowerCase());
        if (mine) await this.gh(["api", "-X", "DELETE", `${base}/${mine.id}`]);
      } else await this.gh(["api", "-X", "POST", base, "-f", `content=${content}`]);
      this.busy = null;
      await this.load(cx);
    } catch (e) { this.busy = null; this.error = errText(e); cx.notify(); }
  }

  // ---- compose and ask ------------------------------------------------------------

  startCompose(kind, extra, cx) {
    cx = this.acx ?? cx;
    const ph = { inline: "Comment on this line (markdown; ```suggestion offers a one-click apply).", reply: "Reply to this thread.", general: "Comment on the pull request.", ask: "What should Claude do with this PR?" }[kind];
    const state = TextareaState.new({ placeholder: ph, rows: 5 });
    this.compose = { kind, state, postNow: false, context: { pr: true, diff: true, threads: true, logs: kind === "ask" && this.checks.log ? true : false, ticket: true }, ctxAt: 0, ...extra };
    state.on("submit", (_e, cx) => { this.submitCompose(cx); cx.notify(); });
    this.view = kind === "ask" ? "ask" : kind === "inline" ? "comment" : "compose";
    cx.timer.after(50, () => state.focus());
  }
  submitCompose(cx) { if (this.compose.kind === "ask") this.sendAsk(cx); else this.askPostCompose(); }
  target() {
    const a = agents().find((x) => x.tab === this.tab) ?? agents()[0];
    if (a) return { terminal: a.address, label: `${a.program?.name ?? "agent"} · ${a.space_name ?? ""} · ${a.status}` };
    const p = panes().find((x) => x.tab === this.tab && x.terminal) ?? panes().find((x) => x.terminal);
    return p ? { terminal: p.terminal, label: p.title ?? p.terminal } : null;
  }
  ticketOf() { return (`${this.pr?.title ?? ""} ${this.pr?.body ?? ""} ${this.pr?.head ?? ""}`).match(/AB#(\d{4,6})/)?.[1] ?? null; }
  async sendAsk(cx) {
    cx = this.acx ?? cx;
    const c = this.compose; const p = this.pr;
    const text = c.state.value().trim();
    const t = this.target();
    if (!text || !t) { this.error = t ? null : "No terminal to send to."; cx.notify(); return; }
    const parts = [`GitHub pull request ${this.full()}#${this.number}: ${p.title} (${p.head} → ${p.base}, by ${p.author}, ${p.decision || "no review"}, checks ${p.checksState}). ${p.url}`];
    if (c.context.pr && p.body) parts.push(`Description:\n${p.body.slice(0, 6000)}`);
    if (c.context.diff) {
      if (!this.diff) { this.busy = "fetching diff"; cx.notify(); await this.loadDiff(cx); }
      const text = (this.diff?.files ?? []).map((f) => [`--- ${f.path} (+${f.add} -${f.del})`, ...f.lines.map((l) => (l.kind === "hunk" ? l.text : (l.kind === "add" ? "+" : l.kind === "del" ? "-" : " ") + l.text))].join("\n")).join("\n\n");
      parts.push(`Diff:\n${text.length > 16000 ? text.slice(0, 16000) + "\n… (truncated)" : text}`);
    }
    if (c.context.threads && (p.threads.length || p.comments.length)) {
      const th = p.threads.map((t) => `${t.path}:${t.line ?? "?"}${t.resolved ? " (resolved)" : ""}\n` + t.comments.map((x) => `  ${x.who}: ${x.body}`).join("\n")).join("\n");
      const gc = p.comments.map((x) => `${x.who}: ${x.body}`).join("\n");
      parts.push(`Review threads:\n${th}${gc ? `\nComments:\n${gc}` : ""}`.slice(0, 8000));
    }
    if (c.context.logs && this.checks.log) parts.push(`Check "${this.checks.log.title}" log (tail):\n${this.checks.log.lines.slice(-80).map((l) => l.msg).join("\n")}`);
    const ab = this.ticketOf();
    if (c.context.ticket && ab) parts.push(`Linked Azure DevOps work item: AB#${ab} (the tickets pane can open it: herdr-app do pane.split --direction right --mod my-tickets --props '{"id":${ab}}').`);
    parts.push(text);
    this.busy = "sending"; cx.notify();
    try {
      const r = await hc(["send", t.terminal, parts.join("\n\n")]);
      if (r.code !== 0) throw new Error(lastLine(r.stderr) || "send failed");
      this.busy = null; this.compose = null; this.view = "pr"; this.handle.focus();
      this.flash("Sent to Claude", cx, 4000);
    } catch (e) { this.busy = null; this.error = errText(e); }
    cx.notify();
  }

  // ---- keys -------------------------------------------------------------------------

  maxY() { return Math.max(0, this.contentH - this.viewH); }
  // Rows in half the pane, for d/u in the cursor lists.
  halfPage(rowH) { return Math.max(1, Math.floor(this.viewH / rowH / 2)); }
  scrollTo(y, cx) { this.y = Math.round(Math.min(Math.max(0, y), this.maxY())); cx.notify(); }
  keepRowVisible(i, cx) {
    const top = this.rowTop[i]; const h = this.rowH[i] ?? 80;
    if (top == null) return;
    if (top < this.y) this.scrollTo(top - 8, cx);
    else if (top + h > this.y + this.viewH) this.scrollTo(top + h - this.viewH + 8, cx);
  }
  openUrl(url) { if (this.isWin()) exec("cmd", ["/c", "start", "", url]); else exec("open", [url]); }
  copy(url, cx) { cx.write_to_clipboard(url); this.flash("URL copied", cx, 2000); }
  // This mod's own pane, never a terminal: a key delivered from the command line arrives while
  // the terminal has focus, and acting on the focused pane there would hit the Claude session.
  myPane() {
    const mine = panes().filter((p) => p.mod === "my-prs");
    const f = focused()?.pane;
    return mine.find((p) => p.pane === f) ?? (mine.length === 1 ? mine[0] : mine.find((p) => p.focused)) ?? null;
  }
  closePane() { const target = this.myPane(); if (target) run("pane.close", { pane: target.pane }); }
  zoomPane() { const target = this.myPane(); if (target) run("pane.zoom", { pane: target.pane }); }
  back() { run("pane.go", { direction: "left" }); }
  leavePr() { if (this.returnTo === "list") this.backToList(); else this.back(); }

  key(e, cx) {
    const k = e.keystroke;
    const v = this.view;
    let handled = true;
    // y copies the open PR's URL from any of its views (the list copies the highlighted row's).
    if (k === "y" && this.number && ["pr", "files", "diff", "threads", "checks", "log", "review"].includes(v)) { this.copy(this.prUrl(), cx); cx.stop_propagation(); cx.notify(); return; }
    // ? shows every key of this pane in the keybinds popup.
    if (e.key_char === "?" && !this.textFocused() && !this.list.searching && !this.list.picker && !this.repos?.filtering && this.reactPick == null && !["confirm", "comment", "compose", "ask"].includes(v)) { this.showKeys(); cx.stop_propagation(); return; }
    // z toggles the pane's zoom wherever no text box has the keys.
    if (k === "z" && !this.textFocused() && !this.list.searching && !this.list.picker && !this.repos?.filtering) { this.zoomPane(); cx.stop_propagation(); return; }
    if (v === "confirm") {
      if (k === "y") this.runConfirm(cx);
      else if (k === "n" || k === "escape" || k === "q") { this.view = this.confirm.back; this.confirm = null; if (this.view !== "review") this.focus(); }
      else handled = false;
    }
    else if (v === "list") handled = this.keyList(e, cx);
    else if (v === "repos") handled = this.keyRepos(e, cx);
    else if (v === "pr") handled = this.keyPr(e, cx);
    else if (v === "files") handled = this.keyFiles(e, cx);
    else if (v === "diff") handled = this.keyDiff(e, cx);
    else if (v === "threads") handled = this.keyThreads(e, cx);
    else if (v === "checks") handled = this.keyChecks(e, cx);
    else if (v === "log") handled = this.keyLog(e, cx);
    else if (v === "review") handled = this.keyReview(e, cx);
    else if (v === "comment" || v === "compose" || v === "ask") handled = this.keyCompose(e, cx);
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
    else if (k === "ctrl-f" || k === "pagedown") this.scrollTo(this.y + page, cx);
    else if (k === "ctrl-b" || k === "pageup") this.scrollTo(this.y - page, cx);
    else if (k === "shift-g" || ch === "G" || k === "end") this.scrollTo(this.maxY(), cx);
    else if (k === "home") this.scrollTo(0, cx);
    else if (k === "g") { if (was) this.scrollTo(0, cx); else this.pendingG = true; }
    else return false;
    return true;
  }

  keyList(e, cx) {
    const k = e.keystroke, ch = e.key_char;
    const L = this.list;
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
    const cur = ent?.row ?? null; const grp = ent?.group ?? null;
    const toggle = (g) => { L.folded.has(g.id) ? L.folded.delete(g.id) : L.folded.add(g.id); L.cursor = Math.max(0, this.entries().findIndex((x) => !x.row && x.group.id === g.id)); this.keepListCursorVisible(); };
    const reset = () => { L.cursor = 0; this.y = 0; };
    if (k === "j" || k === "down") { L.cursor = Math.min(ents.length - 1, L.cursor + 1); this.keepListCursorVisible(); }
    else if (k === "k" || k === "up") { L.cursor = Math.max(0, L.cursor - 1); this.keepListCursorVisible(); }
    else if (k === "shift-g" || ch === "G") { L.cursor = Math.max(0, ents.length - 1); this.keepListCursorVisible(); }
    else if (k === "d" || k === "ctrl-d" || k === "pagedown") { L.cursor = Math.min(ents.length - 1, L.cursor + this.halfPage(ROW + 2)); this.keepListCursorVisible(); }
    else if (k === "u" || k === "ctrl-u" || k === "pageup") { L.cursor = Math.max(0, L.cursor - this.halfPage(ROW + 2)); this.keepListCursorVisible(); }
    else if (k === "enter" || k === "l" || k === "space") { if (cur) this.openFromList(cur, cx); else if (grp) toggle(grp); }
    else if (k === "h") { if (grp) toggle(grp); }
    else if (k === "shift-h" || ch === "H") { for (const g of this.groups()) L.folded.add(g.id); reset(); }
    else if (k === "shift-l" || ch === "L") { L.folded.clear(); }
    else if (this.multi() && ch && /^[1-9]$/.test(ch)) { const name = this.profiles[Number(ch) - 1]; if (name) this.switchProfile(cx, name); }
    else if (ch === "1" || ch === "2") { const scope = ch === "1" ? "set" : "all"; if (scope !== L.scope) { L.scope = scope; L.rows = null; L.people = null; reset(); this.cacheList(); this.loadList(cx); } }
    else if (k === "g") { L.byRepo = !L.byRepo; L.folded = new Set(["automated"]); reset(); }
    else if (k === "m") { L.person = L.person === "me" ? null : "me"; reset(); }
    else if (k === "r") { L.person = L.person === "forme" ? null : "forme"; reset(); }
    else if (k === "n") { L.needs = !L.needs; reset(); }
    else if (ch === "@") L.picker = { at: 0, query: "" };
    else if (k === "e") this.openRepos(cx);
    else if (ch === "/") L.searching = true;
    else if (k === "b") { L.bots = !L.bots; if (L.bots) L.folded.delete("automated"); else L.folded.add("automated"); }
    else if ((k === "shift-d" || ch === "D") && cur) { this.openFromList(cur, cx); this.openDiff(null, cx); }
    else if (k === "c" && cur) { this.openFromList(cur, cx); this.view = "threads"; }
    else if (k === "o" && cur) this.openUrl(cur.url);
    else if (k === "y" && cur) this.copy(cur.url, cx);
    else if (k === "shift-r" || ch === "R") { this.loadList(cx); }
    else if (k === "a") this.switchProfile(cx);
    // esc resets the filters to the default (needs review on); from the default it leaves the pane.
    else if (k === "escape") { if (L.person || L.search || !L.needs) { L.person = null; L.search = ""; L.needs = true; reset(); } else this.back(); }
    else if (k === "q") this.closePane();
    else return false;
    return true;
  }
  // e in the list: a page of every repo of the owner; the checked ones are this account's repo set (repos in local.json).
  openRepos(cx) {
    if (!this.owner) { this.flash("Set owner in local.json first", cx); return; }
    const R = { cursor: 0, query: "", filtering: false, all: null, pushed: new Map(), chosen: new Set(this.repoSet), saved: new Set(this.repoSet), error: null };
    this.repos = R; this.view = "repos"; this.y = 0;
    this.ghJson(["repo", "list", this.owner, "--limit", "1000", "--no-archived", "--json", "name,pushedAt"], 90000)
      .then((d) => {
        R.pushed = new Map((d ?? []).map((r) => [r.name, r.pushedAt ?? ""]));
        for (const r of R.chosen) if (!R.pushed.has(r)) R.pushed.set(r, ""); // keep checked repos gh no longer lists, so they can be unchecked
        // Checked first, then the most recently pushed; the order stays put while boxes change.
        R.all = [...R.pushed.keys()].sort((a, b) => (R.chosen.has(b) - R.chosen.has(a)) || R.pushed.get(b).localeCompare(R.pushed.get(a)) || a.localeCompare(b));
      })
      .catch((e) => { R.error = errText(e); })
      .finally(() => { (this.acx ?? cx).notify(); });
  }
  repoRows() {
    const R = this.repos;
    const q = R.query.toLowerCase();
    return (R.all ?? []).filter((r) => !q || r.toLowerCase().includes(q));
  }
  reposDirty() { const R = this.repos; return R.chosen.size !== R.saved.size || [...R.chosen].some((r) => !R.saved.has(r)); }
  keyRepos(e, cx) {
    const k = e.keystroke, ch = e.key_char;
    const R = this.repos; const rows = this.repoRows();
    if (R.filtering) {
      if (k === "escape") { R.query = ""; R.filtering = false; }
      else if (k === "enter") R.filtering = false;
      else if (k === "backspace") R.query = R.query.slice(0, -1);
      else if (ch && ch.length === 1 && !e.modifiers?.control && !e.modifiers?.alt) R.query += ch;
      else return false;
      R.cursor = 0; this.y = 0;
      return true;
    }
    R.cursor = Math.min(R.cursor, Math.max(0, rows.length - 1));
    const cur = rows[R.cursor];
    const toggle = (r) => { R.chosen.has(r) ? R.chosen.delete(r) : R.chosen.add(r); };
    if (k === "j" || k === "down") { R.cursor = Math.min(rows.length - 1, R.cursor + 1); this.keepRowVisible(R.cursor, cx); }
    else if (k === "k" || k === "up") { R.cursor = Math.max(0, R.cursor - 1); this.keepRowVisible(R.cursor, cx); }
    else if (k === "d" || k === "ctrl-d" || k === "pagedown") { R.cursor = Math.min(rows.length - 1, R.cursor + this.halfPage(25)); this.keepRowVisible(R.cursor, cx); }
    else if (k === "u" || k === "ctrl-u" || k === "pageup") { R.cursor = Math.max(0, R.cursor - this.halfPage(25)); this.keepRowVisible(R.cursor, cx); }
    else if (k === "g") { R.cursor = 0; this.scrollTo(0, cx); }
    else if (k === "shift-g" || ch === "G") { R.cursor = Math.max(0, rows.length - 1); this.scrollTo(this.maxY(), cx); }
    else if (k === "space" || k === "x") { if (cur) { toggle(cur); R.cursor = Math.min(rows.length - 1, R.cursor + 1); this.keepRowVisible(R.cursor, cx); } }
    else if (k === "shift-a" || ch === "A") { const all = rows.length && rows.every((r) => R.chosen.has(r)); for (const r of rows) all ? R.chosen.delete(r) : R.chosen.add(r); }
    else if (k === "c") R.chosen.clear();
    else if (ch === "/") R.filtering = true;
    else if (k === "enter" || k === "s") { if (R.all) this.saveRepos([...R.chosen], cx); }
    else if (k === "escape" && R.query) { R.query = ""; R.cursor = 0; this.y = 0; }
    else if (k === "escape" || k === "h") { this.repos = null; this.view = "list"; this.y = 0; this.keepListCursorVisible(); }
    else if (k === "q") this.closePane();
    else return false;
    return true;
  }
  // Writes the repo set into local.json (this profile's entry, or the top level without profiles), then back to the list.
  async saveRepos(repos, cx) {
    cx = this.acx ?? cx;
    const L = this.list;
    let conf;
    try { conf = JSON.parse((await readTextFile(this.configPath)) ?? "{}"); }
    catch (e) { this.flash(`local.json isn't valid JSON: ${errText(e)}`, cx, 5000); return; }
    const target = this.profileName && conf.profiles?.[this.profileName] ? conf.profiles[this.profileName] : conf;
    repos.sort((a, b) => a.localeCompare(b));
    if (repos.length) target.repos = repos; else delete target.repos;
    try { await fs.writeFile(this.configPath, JSON.stringify(conf, null, 2) + "\n"); }
    catch (e) { this.flash(`Couldn't write local.json: ${errText(e)}`, cx, 5000); return; }
    this.repos = null; this.view = "list";
    L.scope = repos.length ? "set" : "all";
    L.rows = null; L.people = null; L.cursor = 0; this.y = 0;
    await this.readConfig();
    this.cacheList();
    this.flash(repos.length ? `Showing ${repos.length} repo${repos.length === 1 ? "" : "s"}` : "Showing all repos", cx, 2500);
    this.loadList(cx);
  }
  reposBody(t) {
    const R = this.repos; const rows = this.repoRows();
    this.rowTop = []; this.rowH = [];
    const dirty = this.reposDirty();
    const col = v_flex().gap(1)
      .child(h_flex().gap(10).items_center().pb(6).text_size(11).text_color(t.dim)
        .child(div().text_color(t.done).child(`✓ ${R.chosen.size} checked`))
        .child(div().child(R.chosen.size ? `${R.all ? R.all.length - R.chosen.size : 0} hidden` : "none checked: the list shows all repos"))
        .when(dirty, (el) => el.child(div().text_color(t.working).child("unsaved · enter saves")))
        .child(div().flex_1())
        .child(div().text_color(R.filtering || R.query ? t.accent : t.dim).child(R.filtering || R.query ? `/ ${R.query}${R.filtering ? "▏" : ""}` : "/ to filter")));
    if (R.error) return col.child(div().py(10).text_size(12).text_color(t.blocked).child(R.error));
    if (!R.all) return col.child(div().py(10).text_size(12).text_color(t.dim).child(`Loading ${this.owner}'s repos…`));
    if (!rows.length) return col.child(div().py(10).text_size(12).text_color(t.dim).child("No repo matches."));
    rows.forEach((r, i) => {
      const cur = i === R.cursor, on = R.chosen.has(r);
      const pushed = R.pushed.get(r);
      col.child(h_flex().id(`repo-${i}`).gap(8).items_center().px(8).h(24).rounded(5).text_size(11.5).border_1().border_color(cur ? t.accent : t.background + "00").when(cur, (el) => el.bg(t.raised))
        .on_size_change((s) => { this.rowH[i] = s.height; })
        .on_click((_e, cx) => { R.cursor = i; R.chosen.has(r) ? R.chosen.delete(r) : R.chosen.add(r); cx.notify(); })
        .child(div().w(14).h(14).flex_none().rounded(3).border_1().border_color(on ? t.done : t.border).when(on, (el) => el.bg(t.done + "33"))
          .child(div().text_size(10).text_color(t.done).text_center().child(on ? "✓" : "")))
        .child(this.mono_(div().flex_1().min_w(0).truncate().text_color(on ? t.foreground : cur ? t.foreground : t.muted).child(r)))
        .child(div().flex_none().text_size(10.5).text_color(t.dim).child(pushed ? `pushed ${age(pushed)}` : "")));
    });
    let top = 26; rows.forEach(() => { this.rowTop.push(top); top += 25; });
    return col;
  }
  keyPeople(e, cx) {
    const k = e.keystroke, ch = e.key_char;
    const P = this.list.picker;
    const list = this.listPeople().filter((p) => !P.query || p.name.toLowerCase().includes(P.query.toLowerCase()) || (p.id ?? "").toLowerCase().includes(P.query.toLowerCase()));
    if (k === "j" || k === "down" || k === "ctrl-n") P.at = Math.min(list.length - 1, P.at + 1);
    else if (k === "k" || k === "up" || k === "ctrl-p") P.at = Math.max(0, P.at - 1);
    else if (k === "enter" || k === "tab") { const p = list[P.at]; if (p) { this.list.person = p.id === null ? null : p.me ? "me" : p.id; this.list.cursor = 0; this.y = 0; } this.list.picker = null; }
    else if (k === "escape") this.list.picker = null;
    else if (k === "backspace") { P.query = P.query.slice(0, -1); P.at = 0; }
    else if (ch && ch.length === 1 && !e.modifiers?.control) { P.query += ch; P.at = 0; }
    else return false;
    return true;
  }

  keyPr(e, cx) {
    const k = e.keystroke, ch = e.key_char;
    if (this.keyScroll(e, cx)) return true;
    const fromList = this.returnTo === "list";
    if (!this.pr) {
      if (k === "q") this.closePane(); else if (k === "r") this.load(cx);
      else if (k === "escape" || k === "h") this.leavePr();
      else return false;
      return true;
    }
    if (fromList && k === "n") { this.stepInList(1, cx); return true; }
    if (fromList && (k === "shift-n" || ch === "N")) { this.stepInList(-1, cx); return true; }
    if (k === "f") this.openFiles();
    else if (k === "enter" || k === "shift-d" || ch === "D") this.openDiff(null, cx);
    else if (k === "c") { this.view = "threads"; this.y = 0; }
    else if (k === "x") { this.view = "checks"; this.y = 0; }
    else if (k === "v") this.startReview();
    else if (k === "shift-m" || ch === "M") this.askMerge();
    else if (ch === ":") this.startCompose("ask", {}, cx);
    else if (k === "a") this.startCompose("general", {}, cx);
    else if (k === "o") this.openUrl(this.prUrl());
    else if (k === "y") this.copy(this.prUrl(), cx);
    else if (k === "r") { this.diff = null; this.load(cx); }
    else if (k === "shift-l" || ch === "L") { this.backToList(); if (!this.list.rows) this.loadList(cx); }
    else if (k === "escape" || k === "h") this.leavePr();
    else if (k === "q") this.closePane();
    else return false;
    return true;
  }

  // Files in display order: by path with their folders, or by size.
  fileRows() {
    const F = this.files; const files = [...(this.pr?.files ?? [])];
    if (F.sort === "size") return files.sort((a, b) => (b.add + b.del) - (a.add + a.del)).map((f) => ({ file: f }));
    files.sort((a, b) => a.path.localeCompare(b.path));
    const rows = []; let lastDir = null;
    for (const f of files) {
      const dir = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/") + 1) : "";
      if (dir !== lastDir) { lastDir = dir; rows.push({ dir }); }
      if (!F.folded.has(dir)) rows.push({ file: f, dir });
    }
    return rows;
  }
  // The cursor lands on the first file, never on its folder header.
  openFiles() {
    this.view = "files"; this.y = 0;
    const rows = this.fileRows();
    if (!rows[this.files.cursor]?.file) this.files.cursor = Math.max(0, rows.findIndex((r) => r.file));
  }
  saveViewed() { try { localStorage.setItem(this.ns(`viewed:${this.key_()}`), JSON.stringify([...this.files.viewed])); } catch {} }
  keyFiles(e, cx) {
    const k = e.keystroke, ch = e.key_char;
    const F = this.files; const rows = this.fileRows();
    F.cursor = Math.min(F.cursor, Math.max(0, rows.length - 1));
    const cur = rows[F.cursor];
    if (k === "j" || k === "down") { F.cursor = Math.min(rows.length - 1, F.cursor + 1); this.keepRowVisible(F.cursor, cx); }
    else if (k === "k" || k === "up") { F.cursor = Math.max(0, F.cursor - 1); this.keepRowVisible(F.cursor, cx); }
    else if (k === "d" || k === "ctrl-d" || k === "pagedown") { F.cursor = Math.min(rows.length - 1, F.cursor + this.halfPage(25)); this.keepRowVisible(F.cursor, cx); }
    else if (k === "u" || k === "ctrl-u" || k === "pageup") { F.cursor = Math.max(0, F.cursor - this.halfPage(25)); this.keepRowVisible(F.cursor, cx); }
    else if (k === "g") { F.cursor = 0; this.scrollTo(0, cx); }
    else if (k === "shift-g" || ch === "G") { F.cursor = rows.length - 1; this.scrollTo(this.maxY(), cx); }
    else if (k === "enter" || k === "l") { if (cur?.file) this.openDiff(cur.file.path, cx); else if (cur) { F.folded.has(cur.dir) ? F.folded.delete(cur.dir) : F.folded.add(cur.dir); } }
    else if (k === "h") { if (cur) { const d = cur.dir ?? ""; F.folded.has(d) ? F.folded.delete(d) : F.folded.add(d); F.cursor = Math.max(0, this.fileRows().findIndex((r) => r.dir === d && !r.file)); } }
    else if (k === "x" && cur?.file) { F.viewed.has(cur.file.path) ? F.viewed.delete(cur.file.path) : F.viewed.add(cur.file.path); this.saveViewed(); F.cursor = Math.min(rows.length - 1, F.cursor + 1); }
    else if (k === "s") { F.sort = F.sort === "path" ? "size" : "path"; F.cursor = 0; }
    else if (k === "shift-d" || ch === "D") this.openDiff(cur?.file?.path ?? null, cx);
    else if (k === "escape" || k === "f") { this.view = "pr"; this.y = 0; }
    else if (k === "q") this.closePane();
    else return false;
    return true;
  }

  keyDiff(e, cx) {
    const k = e.keystroke, ch = e.key_char;
    const D = this.diff;
    if (!D) { if (k === "escape" || k === "h") { this.view = "pr"; this.y = 0; } else if (k === "q") this.closePane(); else return false; return true; }
    const n = D.flat.length;
    const lines = Math.max(1, Math.floor(this.viewH / DIFF_LINE) - 2);
    const move = (d) => { D.cursor = Math.max(0, Math.min(n - 1, D.cursor + d)); this.keepDiffCursorVisible(); };
    const cur = D.flat[D.cursor];
    const file = () => D.files[cur?.fi ?? 0];
    const was = this.pendingG; this.pendingG = false;
    if (k === "j" || k === "down") move(1);
    else if (k === "k" || k === "up") move(-1);
    else if (k === "d" || k === "ctrl-d" || k === "space") move(Math.floor(lines / 2));
    else if (k === "u" || k === "ctrl-u") move(-Math.floor(lines / 2));
    else if (k === "ctrl-f" || k === "pagedown") move(lines);
    else if (k === "ctrl-b" || k === "pageup") move(-lines);
    else if (k === "g") { if (was) { D.cursor = 0; this.y = 0; } else this.pendingG = true; }
    else if (k === "shift-g" || ch === "G") { D.cursor = n - 1; this.keepDiffCursorVisible(); }
    else if (ch === "]") { const fi = Math.min(D.files.length - 1, (cur?.fi ?? 0) + 1); D.cursor = this.diffFileStart(fi); this.keepDiffCursorVisible(); }
    else if (ch === "[") { const fi = Math.max(0, (cur?.fi ?? 0) - (cur?.head ? 1 : 0)); D.cursor = this.diffFileStart(fi); this.keepDiffCursorVisible(); }
    else if (k === "n" || k === "shift-n" || ch === "N") {
      const d = k === "n" ? 1 : -1;
      for (let i = D.cursor + d; i >= 0 && i < n; i += d) { const x = D.flat[i]; if (x.head || D.files[x.fi].lines[x.li]?.kind === "hunk") { D.cursor = i; break; } }
      this.keepDiffCursorVisible();
    }
    else if (k === "c") {
      if (!cur || cur.head) return true;
      const l = file().lines[cur.li];
      if (l.kind === "hunk") return true;
      const side = l.kind === "del" ? "LEFT" : "RIGHT";
      this.startCompose("inline", { line: { path: file().path, n: side === "LEFT" ? l.oldN : l.newN, side, text: l.text, kind: l.kind } }, cx);
    }
    else if (k === "x") { const p = file().path; this.files.viewed.has(p) ? this.files.viewed.delete(p) : this.files.viewed.add(p); this.saveViewed(); }
    else if (k === "v") this.startReview();
    else if (k === "f") this.openFiles();
    else if (k === "o") this.openUrl(`${this.prUrl()}/files`);
    else if (k === "r") { this.diff = null; this.loadDiff(cx); }
    else if (k === "escape" || k === "h") { this.view = "pr"; this.y = 0; }
    else if (k === "q") this.closePane();
    else return false;
    return true;
  }

  keyThreads(e, cx) {
    const k = e.keystroke, ch = e.key_char;
    const T = this.threads; const items = this.threadItems();
    T.cursor = Math.min(T.cursor, Math.max(0, items.length - 1));
    const it = items[T.cursor];
    if (this.reactPick != null) {
      if (k === "h" || k === "left") this.reactPick = Math.max(0, this.reactPick - 1);
      else if (k === "l" || k === "right") this.reactPick = Math.min(REACTIONS.length - 1, this.reactPick + 1);
      else if (k === "enter") { const [c] = REACTIONS[this.reactPick]; this.reactPick = null; this.toggleReaction(c, cx); }
      else if (k === "escape" || k === "e" || k === "q") this.reactPick = null;
      else return false;
      return true;
    }
    if (k === "j" || k === "down") { T.cursor = Math.min(items.length - 1, T.cursor + 1); this.keepRowVisible(T.cursor, cx); }
    else if (k === "k" || k === "up") { T.cursor = Math.max(0, T.cursor - 1); this.keepRowVisible(T.cursor, cx); }
    else if (k === "d" || k === "ctrl-d" || k === "pagedown") this.scrollTo(this.y + this.viewH / 2, cx);
    else if (k === "u" || k === "ctrl-u" || k === "pageup") this.scrollTo(this.y - this.viewH / 2, cx);
    else if (k === "g") { T.cursor = 0; this.scrollTo(0, cx); }
    else if (k === "shift-g" || ch === "G") { T.cursor = Math.max(0, items.length - 1); this.scrollTo(this.maxY(), cx); }
    else if (k === "enter" && it?.kind === "thread") this.startCompose("reply", { thread: it.thread }, cx);
    else if (k === "a") this.startCompose("general", {}, cx);
    else if ((k === "shift-r" || ch === "R") && it?.kind === "thread") this.askResolve(it.thread);
    else if (k === "h" || k === "l") { if (it?.kind === "thread") { T.folded.has(it.thread.id) ? T.folded.delete(it.thread.id) : T.folded.add(it.thread.id); } }
    else if (ch === "+" || k === "=") this.toggleReaction("+1", cx);
    else if (k === "e" && it && it.kind !== "review") this.reactPick = 0;
    else if ((k === "shift-d" || ch === "D") && it?.kind === "thread") { this.openDiff(it.thread.path, cx); }
    else if (k === "o") this.openUrl(it?.kind === "thread" ? `${this.prUrl()}/files` : this.prUrl());
    else if (k === "r") this.load(cx);
    else if (k === "escape" || k === "c") { this.view = "pr"; this.y = 0; }
    else if (k === "q") this.closePane();
    else return false;
    return true;
  }

  keyChecks(e, cx) {
    const k = e.keystroke, ch = e.key_char;
    const C = this.checks; const list = this.pr?.checks ?? [];
    C.cursor = Math.min(C.cursor, Math.max(0, list.length - 1));
    const cur = list[C.cursor];
    if (k === "j" || k === "down") C.cursor = Math.min(list.length - 1, C.cursor + 1);
    else if (k === "k" || k === "up") C.cursor = Math.max(0, C.cursor - 1);
    else if (k === "d" || k === "ctrl-d" || k === "pagedown") C.cursor = Math.min(list.length - 1, C.cursor + 4);
    else if (k === "u" || k === "ctrl-u" || k === "pageup") C.cursor = Math.max(0, C.cursor - 4);
    else if (k === "enter" || k === "l") { if (cur) this.loadLog(cur, cx); }
    else if (k === "shift-r" || ch === "R") { if (cur) this.askRerun(cur); }
    else if (k === "o") { if (cur?.url) this.openUrl(cur.url); }
    else if (ch === ":") { if (cur?.job && !C.log) this.loadLog(cur, cx).then(() => { this.view = "checks"; this.startCompose("ask", {}, cx); (this.acx ?? cx).notify(); }); else this.startCompose("ask", {}, cx); }
    else if (k === "r") this.load(cx);
    else if (k === "escape" || k === "x" || k === "h") { this.view = "pr"; this.y = 0; }
    else if (k === "q") this.closePane();
    else return false;
    return true;
  }
  keyLog(e, cx) {
    const k = e.keystroke;
    if (this.keyScroll(e, cx)) return true;
    if (k === "escape" || k === "h" || k === "enter") { this.view = "checks"; this.y = 0; }
    else if (k === "o") { const cur = this.pr?.checks?.[this.checks.cursor]; if (cur?.url) this.openUrl(cur.url); }
    else if (e.key_char === ":") this.startCompose("ask", {}, cx);
    else if (k === "q") this.closePane();
    else return false;
    return true;
  }

  keyReview(e, cx) {
    const k = e.keystroke, ch = e.key_char;
    const R = this.review;
    if (R.inSummary) {
      // enter sends, shift-enter is a new line (the box would otherwise take enter as one).
      if (k === "enter" || k === "ctrl-enter" || k === "cmd-enter") { this.askSubmitReview(); return true; }
      if (k === "shift-enter") { R.state.replace(String.fromCharCode(10)); return true; }
      if (k === "escape" || k === "tab") { R.inSummary = false; this.handle.focus(); return true; }
      return false; // typing goes to the textarea
    }
    if (k === "j" || k === "down") R.verdict = Math.min(VERDICTS.length - 1, R.verdict + 1);
    else if (k === "k" || k === "up") R.verdict = Math.max(0, R.verdict - 1);
    else if (ch && /^[1-3]$/.test(ch)) R.verdict = Number(ch) - 1;
    else if (k === "enter") this.askSubmitReview();
    else if (k === "c" || k === "tab" || k === "i") { R.inSummary = true; R.state.focus(); }
    else if (k === "ctrl-enter" || k === "cmd-enter") this.askSubmitReview();
    else if (k === "x" && this.pending.length) { this.pending.pop(); this.flash("Dropped the last pending comment", cx); }
    else if (k === "escape" || k === "v") { this.view = this.diff && this.pending.length ? "diff" : "pr"; this.y = 0; }
    else if (k === "q") this.closePane();
    else return false;
    return true;
  }

  keyCompose(e, cx) {
    const k = e.keystroke;
    const c = this.compose;
    if (k === "enter" || k === "ctrl-enter" || k === "cmd-enter") { this.submitCompose(cx); return true; }
    if (k === "shift-enter") { c.state.replace(String.fromCharCode(10)); return true; }
    if (k === "escape") {
      this.compose = null;
      this.view = c.kind === "ask" ? (this.checks.log ? "checks" : "pr") : c.kind === "inline" ? "diff" : "threads";
      this.handle.focus(); return true;
    }
    if (c.kind === "inline" && k === "tab") { c.postNow = !c.postNow; return true; }
    if (c.kind === "ask") {
      if (k === "tab") { const keys = this.askKeys().map(([k]) => k); const key = keys[c.ctxAt % keys.length]; c.context[key] = !c.context[key]; c.ctxAt = (c.ctxAt + 1) % keys.length; return true; }
      const q = QUICK.find(([n]) => k === `ctrl-${n}`);
      if (q) { c.state.set_value(q[1]); c.state.focus(); return true; }
    }
    return false; // typing goes to the textarea
  }
  askKeys() {
    const ab = this.ticketOf();
    return [["pr", "title, branches, description"], ["diff", this.diff ? `diff · ${this.diff.files.length} files` : `diff · ${this.pr?.nFiles ?? "?"} files`], ["threads", `threads · ${(this.pr?.threads.length ?? 0) + (this.pr?.comments.length ?? 0)}`],
      ...(this.checks.log ? [["logs", `log · ${this.checks.log.title}`]] : []), ...(ab ? [["ticket", `AB#${ab}`]] : [])];
  }

  // ---- drawing ------------------------------------------------------------------

  mono_(el) { return this.mono ? el.font_family(this.mono) : el; }
  pill(t, text, color, outline) {
    return div().flex_none().px(6).h(17).rounded(5).text_size(10.5).flex().items_center().child(text)
      .when(!outline, (el) => el.bg(color + "28").text_color(color)).when(Boolean(outline), (el) => el.border_1().border_color(t.border).text_color(t.dim));
  }
  section(t, title, count, right) {
    return h_flex().gap(8).items_baseline().pt(2)
      .child(div().text_size(10.5).font_semibold().text_color(t.dim).child(title.toUpperCase()))
      .when(count != null, (el) => el.child(div().text_size(11).text_color(t.dim).child(String(count))))
      .when(Boolean(right), (el) => el.child(div().flex_1()).child(div().text_size(11).text_color(t.dim).child(right)));
  }
  // Every key, per view: the ? popup (my-help in sheet mode) shows these. Keep in step with the key* handlers.
  keyMap() {
    const fromList = this.returnTo === "list" || this.view === "list";
    return [
      ["list", "LIST", [["j/k", "move"], ["d/u", "half page"], ["G", "end"], ["enter/l", "open the PR"], ["h", "fold group"], ["H/L", "fold all, open all"],
        this.multi() ? ["1-9", `account: ${this.profiles.join(" / ")}`] : ["1 2", `${this.setName} / all repos`], ["g", "group by repo / attention"], ["r", "needs my review"], ["m", "mine"], ["n", "needs review on / off (on by default: hides drafts and approved)"],
        ["@", "pick a person"], ["/", "search"], ["esc", "reset filters"], ["b", "show bots"], ["D", "open the diff"], ["c", "open the conversation"], ["o", "open in browser"], ["R", "refresh"], ["a", "next account (profiles in local.json)"], ["e", "choose this account's repos"]]],
      ["pr", "PR", [...(fromList ? [["esc/h", "back to the list"], ["n/N", "next, previous PR"]] : [["esc/h", "back"], ["L", "the list"]]),
        ["j/k d/u", "scroll"], ["gg/G", "top, end"], ["enter/D", "diff"], ["f", "files"], ["c", "conversation"], ["a", "new comment"], ["x", "checks"],
        ["v", "review: approve or request changes"], ["M", "squash merge"], [":", "ask Claude"], ["o", "open in browser"], ["r", "refresh"]]],
      ["repos", "REPOS", [["j/k", "move"], ["d/u", "half page"], ["g/G", "top, end"], ["space/x", "check / uncheck"], ["A", "check / uncheck every shown repo"], ["c", "uncheck all (list shows all repos)"],
        ["/", "filter by name"], ["enter/s", "save to local.json and go back"], ["esc/h", "back without saving"]]],
      ["files", "FILES", [["j/k", "move"], ["d/u", "half page"], ["g/G", "top, end"], ["enter/l", "diff of the file"], ["D", "diff from here"], ["x", "mark viewed"],
        ["h", "fold folder"], ["s", "sort by path / size"], ["esc/f", "back"]]],
      ["diff", "DIFF", [["j/k", "line"], ["d/u", "half page"], ["ctrl-f/b", "page"], ["gg/G", "top, end"], ["] [", "next, previous file"], ["n/N", "next, previous hunk"],
        ["c", "comment on the line"], ["x", "mark file viewed"], ["v", "review"], ["f", "files"], ["o", "open in browser"], ["r", "refresh"], ["esc/h", "back"]]],
      ["threads", "CONVERSATION", [["j/k", "thread"], ["d/u", "half page"], ["g/G", "top, end"], ["enter", "reply"], ["a", "new comment"], ["R", "resolve / unresolve"],
        ["+", "👍"], ["e", "pick a reaction"], ["h/l", "fold thread"], ["D", "diff of the thread"], ["o", "open in browser"], ["r", "refresh"], ["esc/c", "back"]]],
      ["checks", "CHECKS", [["j/k", "move"], ["d/u", "jump 4"], ["enter/l", "job log"], ["R", "re-run"], ["o", "open the run"], [":", "ask Claude"], ["r", "refresh"], ["esc/h/x", "back"]]],
      ["log", "JOB LOG", [["j/k d/u", "scroll"], ["gg/G", "top, end"], ["o", "open the run"], [":", "ask Claude"], ["esc/h", "back"]]],
      ["review", "REVIEW", [["j/k 1-3", "verdict: approve, request changes, comment"], ["enter", "send the verdict (asks y/n)"], ["c/tab/i", "write a comment to go with it"], ["enter", "in the comment: send with it (asks y/n)"], ["shift-enter", "new line in the comment"], ["esc/tab", "from the comment back to the verdict"], ["x", "drop the last pending line comment"], ["esc/v", "back"]]],
      ["any", "ANYWHERE", [["?", "this sheet"], ["y", "copy the URL"], ["z", "zoom the pane"], ["q", "close the pane"], ["y / n", "answer a confirm"]]],
    ];
  }
  // The footer: the keys used most in this view, then ? for the rest.
  shortHints(v) {
    const fromList = this.returnTo === "list";
    const more = ["?", "all keys"];
    return {
      repos: this.repos?.filtering ? [["type", "filter"], ["enter", "keep"], ["esc", "clear"]] : [["j/k", "move"], ["space", "check"], ["A", "all shown"], ["/", "filter"], ["enter", "save"], ["esc", "back"], more],
      list: [["j/k", "move"], ["enter", "open"], ["n", this.list.needs ? "show all" : "needs review"], ["r", "for me"], ["/", "search"], ["R", "refresh"], ["e", "repos"], more],
      pr: [["esc", fromList ? "list" : "back"], ...(fromList ? [["n/N", "next, prev"]] : []), ["enter", "diff"], ["c", "talk"], ["v", "review"], ["M", "merge"], more],
      files: [["j/k", "move"], ["enter", "diff"], ["x", "viewed"], ["esc", "back"], more],
      diff: [["j/k", "line"], ["n/N", "hunk"], ["] [", "file"], ["c", "comment"], ["v", "review"], ["esc", "back"], more],
      threads: this.reactPick != null ? [["h/l", "pick"], ["enter", "toggle"], ["esc", "close"]] : [["j/k", "thread"], ["enter", "reply"], ["a", "new"], ["R", "resolve"], ["esc", "back"], more],
      checks: [["j/k", "move"], ["enter", "log"], ["R", "re-run"], [":", "ask Claude"], ["esc", "back"], more],
      log: [["j/k d/u", "scroll"], [":", "ask Claude"], ["esc", "back"], more],
      review: this.review?.inSummary ? [["enter", "send with comment"], ["shift-enter", "new line"], ["esc", "verdict"]] : [["j/k 1-3", "verdict"], ["enter", "send"], ["c", "with a comment"], ["esc", "back"], more],
      confirm: [["y", "send to GitHub"], ["n / esc", "back"]],
      comment: [["enter", this.compose?.postNow ? "post now" : "add to review"], ["shift-enter", "new line"], ["tab", "post now / review"], ["esc", "discard"]],
      compose: [["enter", "post"], ["shift-enter", "new line"], ["esc", "discard"]],
      ask: [["enter", "send"], ["shift-enter", "new line"], ["tab", "toggle context"], ["ctrl-1..5", "quick ask"], ["esc", "cancel"]],
    }[v] ?? [];
  }
  // ? opens the keybinds popup (my-help) with the keys of the view on screen, plus the ones that work anywhere.
  showKeys() {
    const v = this.view;
    const map = this.keyMap();
    const ansi = { list: 4, repos: 4, pr: 2, files: 6, diff: 5, threads: 3, checks: 1, log: 1, review: 2, any: 7 };
    const cur = map.find(([id]) => id === v);
    const groups = [...(cur ? [cur] : []), map.find(([id]) => id === "any")]
      .map(([id, name, rows]) => ({ name, ansi: ansi[id] ?? 7, rows }));
    openOverlay({ mod: "my-help", kind: "dialog", width: 980, height: 660,
      props: { sheet: { title: "PR VIEWER", subtitle: cur ? cur[1].toLowerCase() : "my-prs", source: "mods/my-prs", groups } } });
  }

  keyHint(t, pairs) {
    return h_flex().flex_none().flex_wrap().gap_x(14).gap_y(2).px(14).py(5).bg(t.chrome).border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
      .children(pairs.map(([k, what]) => h_flex().gap(5).child(div().text_color(t.foreground).child(k)).child(div().child(what))));
  }
  checkDot(t, state) { return div().size(7).flex_none().rounded(4).bg(state === "pass" ? t.done : state === "fail" ? t.blocked : state === "pending" ? t.working : t.border); }
  decisionPill(t, r) {
    if (r.draft) return this.pill(t, "draft", t.dim, true);
    if (r.decision === "APPROVED") return this.pill(t, "approved", t.done);
    if (r.decision === "CHANGES_REQUESTED") return this.pill(t, "changes", t.blocked);
    if (r.decision === "REVIEW_REQUIRED") return this.pill(t, "review", t.working);
    return r.lite ? null : this.pill(t, "no review", t.dim, true);
  }
  colorOf(t, name) { return t[name] ?? t.muted; }
  safe(t, label, build) { try { return build(); } catch (e) { return div().text_size(12).text_color(t.blocked).child(`${label}: ${errText(e)}`); } }
  md(t, id, text) { return text ? TextView.markdown(id, text).selectable(true) : div().text_color(t.dim).child("(empty)"); }

  listBody(t) {
    const L = this.list;
    const rows = L.rows ?? [];
    const tab = (label, count, on) => h_flex().gap(5).px(9).py(2).rounded(6).text_size(11.5)
      .when(on, (el) => el.bg(t.raised).border_1().border_color(t.border).text_color(t.foreground)).when(!on, (el) => el.text_color(t.muted))
      .child(div().child(label)).when(count != null, (el) => el.child(div().text_color(t.dim).child(String(count))));
    const bots = rows.filter((r) => r.bot).length;
    const tabs = h_flex().flex_none().gap(6).items_center().px(14).py(8).border_b(1).border_color(t.border)
      .when(this.multi(), (el) => el.children(this.profiles.map((name, i) => tab(`${i + 1} ${name}`, name === this.profileName ? rows.length - bots : null, name === this.profileName))))
      .when(!this.multi(), (el) => el
        .child(tab(`1 ${this.setName}`, L.scope === "set" ? rows.length - bots : null, L.scope === "set"))
        .child(tab("2 All repos", L.scope === "all" ? rows.length - bots : null, L.scope === "all")))
      .child(div().flex_1())
      .child(div().text_size(11).text_color(t.dim).child(L.byRepo ? "by repo · g by attention" : "g by repo"));
    const forMe = rows.filter((r) => !r.bot && this.forMe(r)).length;
    const mine = rows.filter((r) => !r.bot && this.isMine(r)).length;
    const drafts = rows.filter((r) => !r.bot && r.draft).length;
    const needs = rows.filter((r) => !r.bot && this.needsReview(r)).length;
    const filterLabel = [L.person ? this.personLabel() : null, L.needs ? "needs review" : null].filter(Boolean).join(" · ");
    const status = h_flex().flex_none().gap(12).items_center().px(14).py(5).text_size(11).text_color(t.dim).border_b(1).border_color(t.border)
      .child(h_flex().gap(4).child(div().text_color(forMe ? t.working : t.dim).child(String(forMe))).child(div().child("need my review")))
      .child(h_flex().gap(4).child(div().text_color(t.accent).child(String(mine))).child(div().child("mine")))
      .child(h_flex().gap(4).child(div().text_color(L.needs ? t.accent : t.dim).child(String(needs))).child(div().child("need review")))
      .child(h_flex().gap(4).child(div().child(String(drafts))).child(div().child("drafts")))
      .when(L.enriching > 0, (el) => el.child(div().text_color(t.working).child(`details for ${L.enriching} repos…`)))
      .child(div().flex_1())
      .child(div().text_color(filterLabel ? t.accent : t.dim).child(filterLabel ? `filter: ${filterLabel}` : "everyone · @ to filter · n needs review"));
    const search = L.searching || L.search
      ? h_flex().flex_none().gap(8).items_center().px(14).py(5).text_size(11.5).border_b(1).border_color(t.border)
        .child(div().text_color(t.dim).child("/")).child(div().flex_1().text_color(t.foreground).child(L.search + (L.searching ? "▏" : "")))
        .child(div().text_size(11).text_color(t.dim).child(`${this.filtered().length} of ${rows.length}${L.searching ? " · enter keeps · esc clears" : ""}`))
      : null;

    const groups = this.groups();
    this.listTop = [];
    let index = 0;
    const body = v_flex().gap(2).px(10).py(8);
    if (!L.rows && this.notConfigured()) body.child(this.setupBody(t));
    else if (!L.rows) body.child(div().px(8).py(20).text_color(this.error ? t.blocked : t.dim).child(this.error ?? "Loading…"));
    else if (!groups.length) body.child(div().px(8).py(20).text_color(t.dim).child("Nothing matches."));
    let top = 8;
    for (const g of groups) {
      const folded = L.folded.has(g.id);
      const color = this.colorOf(t, g.color);
      const hi = index === L.cursor; const hIndex = index++;
      this.listTop.push(top + 6); top += 34;
      const extra = g.id === "automated" ? (() => { const by = new Map(); for (const r of g.rows) { const n = r.author.replace(/^app\//, "").replace(/\[bot\]$/, ""); by.set(n, (by.get(n) ?? 0) + 1); } return [...by.entries()].map(([n, c]) => `${n} ${c}`).join(" · ") + (folded ? " · b shows" : ""); })() : null;
      body.child(h_flex().id(`grp-${g.id}`).gap(8).items_baseline().px(6).mt(6).h(26).rounded(6).text_size(10.5).font_semibold().text_color(color)
        .when(hi, (el) => el.bg(t.raised).border_1().border_color(t.accent)).cursor_pointer().hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => { L.cursor = hIndex; folded ? L.folded.delete(g.id) : L.folded.add(g.id); cx.notify(); })
        .child(div().child(folded ? "▸" : "▾")).child(div().child(g.label.toUpperCase())).child(div().font_normal().text_color(t.dim).child(String(g.rows.length)))
        .child(div().flex_1())
        .when(Boolean(extra), (el) => el.child(div().font_normal().text_color(t.dim).child(extra)))
        .when(!extra && folded, (el) => el.child(div().font_normal().text_color(t.dim).child(hi ? "enter opens" : "folded"))));
      if (folded) continue;
      for (const r of g.rows) {
        const i = index++; const cur = i === L.cursor;
        this.listTop.push(top); top += ROW + 2;
        const pill = this.decisionPill(t, r);
        const dimmed = r.draft || r.bot;
        const meta = h_flex().gap(8).items_center().text_size(11).text_color(t.dim).whitespace_nowrap().overflow_hidden()
          .when(L.byRepo === false, (el) => el.child(div().text_color(dimmed ? t.dim : t.muted).child(r.repo)))
          .child(this.mono_(div().child(`#${r.number}`)))
          .child(div().child(this.isMine(r) ? "me" : shortLogin(r.author)))
          .child(div().child(age(r.updated)))
          .when(r.add != null, (el) => el.child(div().text_color(dimmed ? t.dim : t.done).child(`+${r.add}`)).child(div().text_color(dimmed ? t.dim : t.blocked).child(`−${r.del}`)).child(div().child(plural(r.files, "file"))))
          .when(r.lite && r.comments > 0, (el) => el.child(div().child(plural(r.comments, "comment"))))
          .when(Boolean(r.base) && !/^(dev|main|master)$/.test(r.base), (el) => el.child(div().child(`→ ${r.base}`)));
        body.child(v_flex().id(`row-${r.key}`).h(ROW).gap(3).px(8).py(6).rounded(6).border_1().border_color(cur ? t.accent : t.background + "00")
          .when(cur, (el) => el.bg(t.raised)).hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => { L.cursor = i; this.openFromList(r, cx); })
          .child(h_flex().gap(8).items_center()
            .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(cur ? t.foreground : dimmed ? t.dim : t.muted).child(r.title))
            .when(!r.lite, (el) => el.child(this.checkDot(t, r.checks)))
            .when(Boolean(pill), (el) => el.child(pill)))
          .child(meta));
      }
    }
    const picker = L.picker ? this.peoplePopup(t) : null;
    return { tabs, status, search, body, picker };
  }

  peoplePopup(t) {
    const P = this.list.picker;
    const list = this.listPeople().filter((p) => !P.query || p.name.toLowerCase().includes(P.query.toLowerCase()) || (p.id ?? "").toLowerCase().includes(P.query.toLowerCase()));
    return v_flex().absolute().left(90).top(110).w(300).gap(2).p(8).rounded(8).border_1().border_color(t.border).bg(t.popover).shadow_lg()
      .child(div().px(8).pb(6).text_size(11).text_color(t.dim).child(P.query ? `Show PRs by · ${P.query}▏` : "Show PRs by · type to narrow"))
      .children(list.slice(0, 14).map((p, i) => {
        const on = i === P.at;
        return h_flex().gap(8).px(8).py(3).rounded(5).when(on, (el) => el.bg(t.accent)).text_color(on ? t.accent_foreground ?? t.background : t.foreground)
          .child(div().flex_1().child(p.me ? `${p.name} · me` : p.name)).child(div().text_color(on ? t.accent_foreground ?? t.background : t.dim).child(String(p.count)));
      }))
      .when(list.length > 14, (el) => el.child(div().px(8).text_size(11).text_color(t.dim).child(`… ${list.length - 14} more`)))
      .child(div().px(8).pt(6).text_size(11).text_color(t.dim).child("j/k pick · enter apply · esc keep current"));
  }

  prHeader(t, small) {
    const p = this.pr;
    return v_flex().gap(4)
      .child(h_flex().gap(8).items_baseline().text_size(12).text_color(t.dim)
        .child(div().child(`${this.repo} #${this.number}`))
        .when(p.draft, (el) => el.child(this.pill(t, "draft", t.dim, true)))
        .when(p.merged, (el) => el.child(this.pill(t, "merged", t.accent)))
        .when(p.state === "CLOSED" && !p.merged, (el) => el.child(this.pill(t, "closed", t.blocked))))
      .child(div().text_size(small ? 13 : 15).font_medium().child(p.title));
  }
  statusChips(t) {
    const p = this.pr;
    const chip = (dot, text, color) => h_flex().gap(5).items_center().px(7).h(20).rounded(5).border_1().border_color(t.border).text_size(11).text_color(t.muted)
      .child(div().text_color(color).child(dot)).child(div().child(text));
    const ab = this.ticketOf();
    const nChecks = p.checks.length;
    const checksLabel = p.checksState === "none" ? "no checks" : `checks ${checksCount(p.checks.map((c) => ({ conclusion: c.conclusion, status: c.status })))}`;
    return h_flex().flex_wrap().gap(6)
      .child(chip(p.checksState === "pass" ? "✓" : p.checksState === "fail" ? "✗" : p.checksState === "pending" ? "⟳" : "○", nChecks ? checksLabel : "no checks", p.checksState === "pass" ? t.done : p.checksState === "fail" ? t.blocked : p.checksState === "pending" ? t.working : t.dim))
      .child(chip(p.decision === "APPROVED" ? "✓" : p.decision === "CHANGES_REQUESTED" ? "✗" : "○", p.decision === "APPROVED" ? "approved" : p.decision === "CHANGES_REQUESTED" ? "changes requested" : p.decision === "REVIEW_REQUIRED" ? "review required" : "no review", p.decision === "APPROVED" ? t.done : p.decision === "CHANGES_REQUESTED" ? t.blocked : p.decision === "REVIEW_REQUIRED" ? t.working : t.dim))
      .child(chip(p.mergeable === "MERGEABLE" ? "✓" : p.mergeable === "CONFLICTING" ? "✗" : "○", p.mergeable === "MERGEABLE" ? "mergeable" : p.mergeable === "CONFLICTING" ? "conflicts" : "mergeable?", p.mergeable === "MERGEABLE" ? t.done : p.mergeable === "CONFLICTING" ? t.blocked : t.dim))
      .when(Boolean(ab), (el) => el.child(chip("⌾", `AB#${ab}`, t.accent)))
      .when(this.pending.length > 0, (el) => el.child(chip("●", `${plural(this.pending.length, "pending comment")} · v`, t.working)));
  }
  prBody(t) {
    const p = this.pr;
    const S = (label, build) => this.safe(t, label, build);
    const meta = h_flex().flex_wrap().gap_x(12).gap_y(2).text_size(11.5).text_color(t.dim)
      .child(div().child(p.mine ? "me" : shortLogin(p.author)))
      .child(this.mono_(div().child(`${p.head} → ${p.base}`)))
      .child(div().child(`opened ${mmdd(p.created)}, ${age(p.created)} ago`))
      .child(h_flex().gap(4).child(div().text_color(t.done).child(`+${p.add}`)).child(div().text_color(t.blocked).child(`−${p.del}`)))
      .child(div().child(plural(p.nFiles, "file")));
    const requested = p.requested.map((r) => r.kind === "Team" ? r.name : (r.name.toLowerCase() === (this.me ?? "").toLowerCase() ? "you" : shortLogin(r.name)));
    const reviewed = p.latest.filter((r) => r.state !== "PENDING").map((r) => `${shortLogin(r.who)} ${r.state === "APPROVED" ? "✓" : r.state === "CHANGES_REQUESTED" ? "✗" : "·"}`);
    const col = v_flex().gap(16).child(S("header", () => this.prHeader(t))).child(meta).child(S("status", () => this.statusChips(t)));
    if (requested.length || reviewed.length) col.child(h_flex().flex_wrap().gap(8).items_center().text_size(11.5).text_color(t.dim)
      .when(reviewed.length > 0, (el) => el.child(div().child("reviews")).children(reviewed.map((x) => this.pill(t, x, x.endsWith("✓") ? t.done : x.endsWith("✗") ? t.blocked : t.muted))))
      .when(requested.length > 0, (el) => el.child(div().child("requested")).children(requested.map((x) => this.pill(t, x, x === "you" ? t.working : t.muted, x !== "you")))));
    col.child(v_flex().gap(8).child(this.section(t, "Description", null, "markdown")).child(S("description", () => this.md(t, `pr-${this.key_()}`, p.body || "_No description._"))));
    col.child(v_flex().gap(4).child(this.section(t, "Files", p.files.length, "f opens · enter diff"))
      .children(p.files.slice(0, 40).map((f) => h_flex().gap(8).items_center().text_size(11.5)
        .child(div().w(12).flex_none().text_color(t.done).child(this.files.viewed.has(f.path) ? "✓" : ""))
        .child(this.mono_(div().flex_1().min_w(0).truncate().text_color(t.muted).child(f.path)))
        .child(this.mono_(h_flex().gap(4).text_size(10.5).child(div().text_color(t.done).child(`+${f.add}`)).when(f.del > 0, (el) => el.child(div().text_color(t.blocked).child(`−${f.del}`))))))
      ).when(p.files.length > 40, (el) => el.child(div().text_size(11).text_color(t.dim).child(`… ${p.files.length - 40} more · f`))));
    return col;
  }

  filesBody(t) {
    const F = this.files; const rows = this.fileRows();
    const viewed = (this.pr.files ?? []).filter((f) => F.viewed.has(f.path)).length;
    const max = Math.max(1, ...this.pr.files.map((f) => f.add + f.del));
    const bar = (f) => { const a = Math.round((f.add / max) * 5), d = Math.round((f.del / max) * 5); return h_flex().gap(1).w(40).flex_none().children(Array.from({ length: 5 }, (_, i) => div().flex_1().h(7).rounded(1).bg(i < a ? t.done : i < a + d ? t.blocked : t.border))); };
    this.rowTop = []; this.rowH = [];
    const col = v_flex().gap(1)
      .child(h_flex().gap(10).items_center().pb(6).text_size(11).text_color(t.dim)
        .child(div().text_color(t.done).child(`✓ ${viewed} viewed`)).child(div().child(`${this.pr.files.length - viewed} to go`)).child(div().flex_1())
        .child(div().child(F.sort === "path" ? "sorted by path · s by size" : "sorted by size · s by path")));
    rows.forEach((r, i) => {
      const cur = i === F.cursor;
      if (!r.file) {
        col.child(this.mono_(h_flex().id(`dir-${i}`).gap(6).items_center().px(8).h(24).mt(4).rounded(5).text_size(11).text_color(t.dim)
          .when(cur, (el) => el.bg(t.raised).border_1().border_color(t.accent)).on_size_change((s) => { this.rowH[i] = s.height; })
          .child(div().child(F.folded.has(r.dir) ? "▸" : "▾")).child(div().child(r.dir || "(root)"))));
        return;
      }
      const f = r.file; const name = F.sort === "path" ? f.path.slice(r.dir.length) : f.path;
      col.child(h_flex().id(`file-${i}`).gap(8).items_center().px(8).h(24).rounded(5).text_size(11.5).border_1().border_color(cur ? t.accent : t.background + "00").when(cur, (el) => el.bg(t.raised))
        .on_size_change((s) => { this.rowH[i] = s.height; })
        .on_click((_e, cx) => { F.cursor = i; this.openDiff(f.path, cx); })
        .child(div().w(12).flex_none().text_size(11).text_color(t.done).child(F.viewed.has(f.path) ? "✓" : ""))
        .child(this.mono_(div().flex_1().min_w(0).truncate().text_color(cur ? t.foreground : t.muted).child(name)))
        .child(bar(f))
        .child(this.mono_(h_flex().gap(4).w(70).flex_none().justify_end().text_size(10.5).child(div().text_color(t.done).child(`+${f.add}`)).when(f.del > 0, (el) => el.child(div().text_color(t.blocked).child(`−${f.del}`)))))
        .when(f.change === "ADDED" || f.change === "DELETED" || f.change === "RENAMED", (el) => el.child(div().text_size(9.5).font_semibold().px(4).rounded(3).border_1().border_color(t.border).text_color(t.dim).child(f.change === "ADDED" ? "NEW" : f.change === "DELETED" ? "DEL" : "MV"))));
    });
    // Tops are regular: a folder row is 4 + 24 + 1, a file row 24 + 1.
    let top = 26; rows.forEach((r) => { if (!r.file) { this.rowTop.push(top + 4); top += 29; } else { this.rowTop.push(top); top += 25; } });
    return col;
  }

  // Only the lines on screen are drawn (a 220-file PR is thousands of lines, and drawing them all
  // takes longer than Herdr allows a render); every line is DIFF_LINE tall, so spacers keep the
  // scroll height and cursor math right.
  diffBody(t) {
    const D = this.diff;
    if (!D) return div().text_color(this.error ? t.blocked : t.dim).child(this.error ?? "Loading the diff…");
    if (!D.files.length) return div().text_color(t.dim).child("No changes.");
    const n = D.flat.length;
    const first = Math.max(0, Math.floor(this.y / DIFF_LINE) - 6);
    const last = Math.min(n, first + Math.ceil(Math.max(this.viewH, 300) / DIFF_LINE) + 14);
    const col = v_flex().gap(0).pt(first * DIFF_LINE).pb((n - last) * DIFF_LINE);
    const addBg = t.done + "1a", delBg = t.blocked + "1a";
    for (let i = first; i < last; i++) {
      const e = D.flat[i];
      const cur = i === D.cursor; const f = D.files[e.fi];
      if (e.head) {
        col.child(this.mono_(h_flex().id(`dh-${e.fi}`).h(DIFF_LINE).gap(8).items_center().px(8).mx(-18).w_full().bg(t.chrome).text_size(11)
          .when(cur, (el) => el.border_1().border_color(t.accent))
          .child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(f.path))
          .child(div().text_color(t.done).child(`+${f.add}`)).child(div().text_color(t.blocked).child(`−${f.del}`))
          .child(div().text_color(this.files.viewed.has(f.path) ? t.done : t.dim).child(this.files.viewed.has(f.path) ? "✓ viewed" : "◻"))));
        continue;
      }
      const l = f.lines[e.li];
      if (l.kind === "hunk") { col.child(this.mono_(div().h(DIFF_LINE).px(8).mx(-18).bg(t.chrome + "80").text_size(10.5).text_color(t.accent).whitespace_nowrap().overflow_hidden().child(l.text).when(cur, (el) => el.border_1().border_color(t.accent)))); continue; }
      const pend = this.pending.find((p) => p.path === f.path && p.line === (l.kind === "del" ? l.oldN : l.newN) && p.side === (l.kind === "del" ? "LEFT" : "RIGHT"));
      const color = l.kind === "add" ? t.done : l.kind === "del" ? t.blocked : t.muted;
      col.child(this.mono_(h_flex().id(`dl-${i}`).h(DIFF_LINE).items_center().mx(-18).text_size(11).whitespace_nowrap().overflow_hidden()
        .when(l.kind === "add", (el) => el.bg(addBg)).when(l.kind === "del", (el) => el.bg(delBg))
        .when(cur, (el) => el.bg(t.raised).border_1().border_color(t.accent))
        .child(div().w(34).flex_none().text_right().pr(4).text_size(10).text_color(t.dim + "b0").child(l.oldN != null ? String(l.oldN) : ""))
        .child(div().w(34).flex_none().text_right().pr(6).text_size(10).text_color(t.dim + "b0").border_r(1).border_color(t.border).child(l.newN != null ? String(l.newN) : ""))
        .child(div().w(14).flex_none().text_center().text_color(color).child(l.kind === "add" ? "+" : l.kind === "del" ? "−" : ""))
        .child(div().flex_1().min_w(0).overflow_hidden().text_color(cur ? t.foreground : l.kind === "ctx" ? t.muted : color).child(l.text.length > 400 ? l.text.slice(0, 400) + " …" : l.text.replace(/\t/g, "    ")))
        .when(Boolean(pend), (el) => el.child(div().flex_none().px(6).text_size(10).text_color(t.working).child("● pending")))));
    }
    return col;
  }

  commentCard(t, id, c, cur, opts = {}) {
    const rx = c.reactions ?? [];
    return v_flex().gap(3).child(h_flex().gap(8).items_baseline().text_size(11).text_color(t.dim)
        .child(div().text_color(t.foreground).child(c.who.toLowerCase() === (this.me ?? "").toLowerCase() ? "you" : shortLogin(c.who)))
        .child(div().child(age(c.at))).when(Boolean(opts.tag), (el) => el.child(div().text_color(opts.tagColor ?? t.dim).child(opts.tag))))
      .child(this.md(t, id, c.body))
      .when(rx.length > 0, (el) => el.child(h_flex().flex_wrap().gap(6).text_size(10.5).children(rx.map((r) => {
        const glyph = REACTIONS.find(([k]) => k.toUpperCase().replace("+1", "THUMBS_UP").replace("-1", "THUMBS_DOWN") === r.content)?.[1] ?? r.content.toLowerCase();
        return div().px(6).rounded(9).border_1().border_color(r.mine ? t.accent : t.border).text_color(r.mine ? t.accent : t.muted).child(`${glyph} ${r.count}`);
      }))));
  }
  threadsBody(t) {
    const p = this.pr; const T = this.threads;
    const items = this.threadItems();
    this.rowTop = []; this.rowH = [];
    const col = v_flex().gap(10).child(this.prHeader(t, true))
      .child(h_flex().gap(8).items_center().text_size(11.5).text_color(t.dim)
        .child(div().child("○")).child(div().child(`${shortLogin(p.author)} opened · ${plural(p.threads.length, "thread")} · ${p.threads.filter((x) => !x.resolved).length} open · ${plural(p.comments.length, "comment")}`)));
    if (!items.length) col.child(div().text_color(t.dim).child("No conversation yet. a writes a comment; c on a diff line starts a thread."));
    items.forEach((it, i) => {
      const cur = i === T.cursor;
      const box = v_flex().id(`th-${i}`).gap(6).px(10).py(8).rounded(7).border_1().border_color(cur ? t.accent : t.border).when(cur, (el) => el.bg(t.raised))
        .on_size_change((s) => { this.rowH[i] = s.height; })
        .on_click((_e, cx) => { T.cursor = i; this.handle.focus(); cx.notify(); });
      if (it.kind === "thread") {
        const th = it.thread; const folded = T.folded.has(th.id) || (th.resolved && !cur && !T.folded.has(`open:${th.id}`));
        box.child(this.mono_(h_flex().gap(8).items_center().text_size(10.5).text_color(t.dim)
          .child(div().text_color(th.resolved ? t.done : t.working).child(th.resolved ? "✓" : "●"))
          .child(div().flex_1().min_w(0).truncate().child(`${th.path}:${th.line ?? "?"}`))
          .child(div().child(th.resolved ? (folded ? "resolved · folded" : "resolved") : th.outdated ? "outdated" : "unresolved"))));
        if (folded) { const c = th.comments[0]; box.child(div().text_size(11.5).text_color(t.dim).truncate().child(`${shortLogin(c?.who ?? "")}: ${(c?.body ?? "").split("\n")[0].slice(0, 120)}`)); }
        else {
          th.comments.forEach((c, j) => box.child(j === 0 ? this.commentCard(t, `tc-${c.id}`, c, cur) : div().ml(10).pl(10).border_l(2).border_color(t.border).child(this.commentCard(t, `tc-${c.id}`, c, cur))));
          if (cur) box.child(h_flex().gap(12).pt(2).text_size(11).text_color(t.dim).child(div().child("enter reply")).child(div().child(`R ${th.resolved ? "unresolve" : "resolve"}`)).child(div().child("+ like")).child(div().child("e react")).child(div().child("D diff")));
        }
      } else if (it.kind === "comment") {
        box.child(this.commentCard(t, `gc-${it.comment.id}`, it.comment, cur, { tag: "comment" }));
      } else {
        const r = it.review;
        const color = r.state === "APPROVED" ? t.done : r.state === "CHANGES_REQUESTED" ? t.blocked : t.dim;
        box.child(this.commentCard(t, `rv-${r.id}`, { who: r.who, at: r.at, body: r.body || `_${r.state.toLowerCase().replace("_", " ")}_`, reactions: [] }, cur, { tag: r.state === "APPROVED" ? "approved ✓" : r.state === "CHANGES_REQUESTED" ? "requested changes ✗" : r.state === "DISMISSED" ? "dismissed" : "reviewed", tagColor: color }));
      }
      if (cur && this.reactPick != null) box.child(v_flex().gap(4)
        .child(h_flex().flex_wrap().gap(6).text_size(11.5).children(REACTIONS.map(([k, g], j) => { const on = j === this.reactPick; return div().px(8).py(1).rounded(6).border_1().border_color(on ? t.accent : t.border).bg(on ? t.accent : t.background + "00").text_color(on ? t.accent_foreground ?? t.background : t.foreground).child(`${g} ${k}`); })))
        .child(div().text_size(11).text_color(t.dim).child("h/l pick · enter toggle · esc close")));
      col.child(box);
    });
    return col;
  }

  checksBody(t) {
    const p = this.pr; const C = this.checks;
    const list = p.checks;
    const n = (s) => list.filter((c) => checksState([c]) === s).length;
    const col = v_flex().gap(12).child(this.prHeader(t, true))
      .child(h_flex().gap(12).text_size(11.5).text_color(t.dim)
        .when(n("fail") > 0, (el) => el.child(h_flex().gap(4).child(div().text_color(t.blocked).child("✗")).child(div().child(`${n("fail")} failed`))))
        .child(h_flex().gap(4).child(div().text_color(t.done).child("✓")).child(div().child(`${n("pass")} passed`)))
        .when(n("pending") > 0, (el) => el.child(h_flex().gap(4).child(div().text_color(t.working).child("⟳")).child(div().child(`${n("pending")} running`))))
        .child(div().flex_1()).child(this.mono_(div().child(p.sha.slice(0, 7)))));
    if (!list.length) return col.child(div().text_color(t.dim).child("No checks on this commit."));
    const byWf = new Map();
    for (const c of list) { const w = c.workflow || (c.job ? "checks" : "statuses"); if (!byWf.has(w)) byWf.set(w, []); byWf.get(w).push(c); }
    const rows = v_flex().gap(2);
    let i = 0;
    for (const [wf, cs] of byWf) {
      rows.child(div().pt(6).pb(2).px(8).text_size(10.5).font_semibold().text_color(t.dim).child(wf.toUpperCase()));
      for (const c of cs) {
        const idx = i++; const cur = idx === C.cursor; const st = checksState([c]);
        rows.child(h_flex().id(`ck-${idx}`).gap(10).items_center().px(8).py(5).rounded(6).border_1().border_color(cur ? t.accent : t.background + "00").when(cur, (el) => el.bg(t.raised))
          .on_click((_e, cx) => { C.cursor = idx; this.handle.focus(); cx.notify(); })
          .child(div().w(14).flex_none().text_center().text_color(st === "pass" ? t.done : st === "fail" ? t.blocked : st === "pending" ? t.working : t.dim).child(st === "pass" ? "✓" : st === "fail" ? "✗" : st === "pending" ? "⟳" : "○"))
          .child(v_flex().flex_1().min_w(0).gap(1).child(div().truncate().text_color(cur ? t.foreground : t.muted).child(c.name))
            .child(div().text_size(11).text_color(t.dim).child(`${(c.conclusion ?? c.status ?? "").toLowerCase().replace(/_/g, " ")}${c.started ? ` · ${dur(c.started, c.completed)}` : ""}`)))
          .child(this.mono_(div().text_size(10.5).text_color(t.dim).child(c.job ? "job" : "status"))));
      }
    }
    col.child(rows);
    if (C.log) col.child(v_flex().gap(6).child(this.section(t, `${C.log.title} · last lines`, null, "enter for the full log"))
      .child(this.mono_(v_flex().gap(0).p(8).rounded(6).border_1().border_color(t.border).bg(t.chrome).text_size(10.5).children(C.log.lines.slice(-14).map((l, j) => div().whitespace_nowrap().overflow_hidden().text_color(/error|fail|assert/i.test(l.msg) ? t.blocked : t.muted).child(l.msg))))));
    col.child(div().text_size(11).text_color(t.dim).child(": sends the selected check's log to Claude with the diff attached"));
    return col;
  }
  // Same windowing as the diff: 16 px a line, step headings as their own lines.
  logBody(t) {
    const L = this.checks.log;
    const H = 16;
    if (!L.rows) {
      L.rows = []; let step = null;
      for (const l of L.lines) { if (l.step && l.step !== step) { step = l.step; L.rows.push({ head: step }); } L.rows.push(l); }
    }
    const n = L.rows.length;
    const first = Math.max(0, Math.floor(this.y / H) - 6);
    const last = Math.min(n, first + Math.ceil(Math.max(this.viewH, 300) / H) + 14);
    const box = this.mono_(v_flex().gap(0).text_size(10.5).pt(first * H).pb((n - last) * H));
    for (let i = first; i < last; i++) {
      const l = L.rows[i];
      if (l.head) { box.child(div().h(H).font_semibold().text_color(t.accent).child(l.head)); continue; }
      box.child(div().h(H).whitespace_nowrap().overflow_hidden().text_color(/##\[error\]|error|fail|assert/i.test(l.msg) ? t.blocked : /##\[warning\]|warn/i.test(l.msg) ? t.working : t.muted).child(l.msg.length > 400 ? l.msg.slice(0, 400) + " …" : l.msg));
    }
    return v_flex().gap(8).child(this.section(t, L.title, L.lines.length, L.failed ? "failed steps only" : "full log")).child(box);
  }

  reviewBody(t) {
    const R = this.review; const p = this.pr;
    const col = v_flex().gap(14).child(this.prHeader(t, true))
      .child(div().text_size(11.5).text_color(t.dim).child(`${shortLogin(p.author)} · ${p.head} → ${p.base} · checks ${p.checksState}`));
    col.child(v_flex().gap(6).child(this.section(t, "Verdict", null, "j/k or 1 2 3 · enter sends · c adds a comment"))
      .children(VERDICTS.map(([_ev, label, note], i) => { const on = i === R.verdict;
        return h_flex().gap(10).items_center().px(10).py(6).rounded(6).border_1().border_color(on && !R.inSummary ? t.accent : t.border).when(on, (el) => el.bg(t.raised))
          .child(this.mono_(div().w(14).text_size(10.5).text_color(t.dim).child(String(i + 1))))
          .child(div().size(12).rounded(6).border_1().border_color(on ? t.accent : t.dim).when(on, (el) => el.bg(t.accent)))
          .child(div().text_color(on ? t.foreground : t.muted).child(label)).child(div().flex_1()).child(div().text_size(11).text_color(t.dim).child(note)); })));
    col.child(v_flex().gap(6).child(this.section(t, `Comment · ${VERDICTS[R.verdict][1]}`, null, R.inSummary ? "enter sends · shift-enter new line · esc back to the verdict" : VERDICTS[R.verdict][0] === "APPROVE" ? "optional · c to write" : "required · c to write"))
      .child(div().rounded(7).border_1().border_color(R.inSummary ? t.accent : t.border).bg(t.chrome).child(Textarea.new(R.state).w_full().h(96))));
    col.child(v_flex().gap(6).child(this.section(t, "Pending comments", this.pending.length, this.pending.length ? "x drops the last" : "c on a diff line adds one"))
      .children(this.pending.map((c, i) => h_flex().gap(8).px(10).py(6).rounded(6).border_1().border_color(t.border).bg(t.chrome).text_size(11.5)
        .child(div().text_color(t.working).child("●"))
        .child(v_flex().flex_1().min_w(0).gap(2).child(this.mono_(div().text_size(10.5).text_color(t.dim).child(`${c.path.split("/").pop()}:${c.line}`))).child(div().truncate().text_color(t.muted).child(c.body.split("\n")[0]))))));
    return col;
  }

  confirmBody(t) {
    const c = this.confirm; const red = t.blocked;
    return v_flex().gap(14).child(this.pr ? this.prHeader(t, true) : div())
      .child(v_flex().gap(6).px(12).py(8).rounded(7).border_1().border_color(red).bg(red + "14")
        .child(h_flex().gap(8).items_center().child(div().text_color(t.foreground).child(c.title)).child(div().flex_1())
          .child(div().px(6).rounded(4).bg(red).text_color(t.background).font_medium().child("y")).child(div().text_color(t.dim).child("/")).child(div().px(6).rounded(4).border_1().border_color(t.border).text_color(t.muted).child("n")))
        .children(c.lines.map((l) => div().text_size(12).text_color(t.muted).child(l)))
        .child(div().text_size(11).text_color(t.dim).child("Nothing is sent until you press y.")))
      .when(Boolean(this.busy), (el) => el.child(div().text_size(12).text_color(t.working).child(`${this.busy}…`)));
  }

  composeBody(t) {
    const c = this.compose; const p = this.pr;
    const col = v_flex().gap(12).child(this.prHeader(t, true));
    if (c.kind === "inline") {
      const l = c.line;
      col.child(this.mono_(v_flex().gap(0).rounded(6).border_1().border_color(t.border).overflow_hidden().text_size(11)
        .child(h_flex().gap(8).px(8).h(DIFF_LINE).items_center().bg(t.chrome).child(div().flex_1().min_w(0).truncate().text_color(t.foreground).child(l.path)).child(div().text_color(t.dim).child(`L${l.n}${l.side === "LEFT" ? " (old)" : ""}`)))
        .child(h_flex().px(8).h(DIFF_LINE).items_center().whitespace_nowrap().overflow_hidden().when(l.kind === "add", (el) => el.bg(t.done + "1a")).when(l.kind === "del", (el) => el.bg(t.blocked + "1a"))
          .child(div().w(14).text_color(l.kind === "add" ? t.done : l.kind === "del" ? t.blocked : t.dim).child(l.kind === "add" ? "+" : l.kind === "del" ? "−" : "")).child(div().text_color(t.muted).child(l.text)))));
    } else if (c.kind === "reply") {
      const th = c.thread; const first = th.comments[0];
      col.child(v_flex().gap(3).pl(10).border_l(2).border_color(t.border)
        .child(h_flex().gap(8).items_baseline().child(div().text_size(11).text_color(t.dim).child("replying to")).child(div().text_color(t.foreground).child(shortLogin(first.who))).child(this.mono_(div().text_size(10.5).text_color(t.dim).child(`${th.path}:${th.line ?? "?"}`))))
        .child(div().text_color(t.muted).text_size(12).child((th.comments[th.comments.length - 1]?.body ?? "").slice(0, 240))));
    } else if (c.kind === "ask") {
      const tg = this.target();
      const keys = this.askKeys();
      col.child(v_flex().gap(6).child(this.section(t, "Sent to"))
        .child(tg ? h_flex().gap(8).items_center().child(div().size(7).rounded(4).bg(t.done)).child(div().child(tg.label)) : div().text_color(t.blocked).child("No terminal found in this tab.")));
      col.child(v_flex().gap(6).child(this.section(t, "Attached", null, "tab toggles the highlighted chip"))
        .child(h_flex().flex_wrap().gap(6).text_size(11.5).children(keys.map(([k, l], i) =>
          div().px(8).rounded(6).border_1().border_color(c.context[k] ? t.accent : t.border).text_color(c.context[k] ? t.accent : t.dim).when(c.ctxAt % keys.length === i, (el) => el.bg(t.raised)).child(l)))));
      col.child(v_flex().gap(3).child(this.section(t, "Quick asks", null, "ctrl-1 … ctrl-5 fill the prompt"))
        .children(QUICK.map(([n, q]) => h_flex().gap(8).text_size(11.5).text_color(t.muted).child(this.mono_(div().w(14).text_color(t.dim).child(n))).child(div().child(q)))));
    }
    col.child(v_flex().gap(6).child(this.section(t, c.kind === "ask" ? "Prompt" : c.kind === "inline" ? "Comment on this line" : "Your comment"))
      .child(div().rounded(7).border_1().border_color(t.accent).bg(t.chrome).child(Textarea.new(c.state).w_full().h(120)))
      .when(c.kind === "inline", (el) => el.child(h_flex().gap(8).items_center().text_size(11)
        .child(div().px(8).py(1).rounded_l(5).border_1().border_color(t.border).when(!c.postNow, (x) => x.bg(t.accent).text_color(t.accent_foreground ?? t.background)).when(c.postNow, (x) => x.text_color(t.muted)).child("add to review"))
        .child(div().px(8).py(1).rounded_r(5).border_1().border_color(t.border).when(c.postNow, (x) => x.bg(t.accent).text_color(t.accent_foreground ?? t.background)).when(!c.postNow, (x) => x.text_color(t.muted)).child("post now"))
        .child(div().text_color(t.dim).child("tab switches"))
        .when(this.pending.length > 0, (el) => el.child(div().flex_1()).child(div().text_color(t.working).child(`${plural(this.pending.length, "pending")}`)))))
      .child(div().text_size(11).text_color(t.dim).child(c.kind === "ask" ? "enter sends · shift-enter new line · esc cancels" : c.kind === "inline" ? "enter adds it · shift-enter new line · esc discards" : "enter posts · shift-enter new line · esc discards")));
    return col;
  }

  render(cx) {
    const t = theme();
    const v = this.view;
    // Herdr's zoom (app.zoom_in, settings "zoom") scales every px the mod draws, and the sizes
    // on_size_change reports come back scaled. Dividing them by the zoom keeps the row maths
    // (ROW, DIFF_LINE, the list tops) in the same unscaled px as the drawing.
    this.zoom = Number(settings()?.zoom) || 1;
    const root = div().id("prs").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .relative().size_full().overflow_hidden().bg(t.background).text_color(t.foreground).text_size(13)
      .on_click(() => { if (!this.textFocused()) this.handle.focus(); })
      .on_scroll_wheel((e, cx) => this.scrollTo(this.y - (e.delta?.y ?? 0) / this.zoom, cx));

    const titles = { pr: "", files: " · Files", diff: " · Diff", threads: " · Conversation", checks: " · Checks", log: " · Log", review: " · Review", confirm: " · Confirm", comment: " · Comment", compose: " · Comment", ask: " · Ask Claude" };
    const crumb = this.returnTo === "list" && v !== "repos" ? `${this.multi() ? this.profileName : this.list.scope === "set" ? this.setName : "All repos"}${this.list.person ? ` › ${this.personLabel()}` : ""} › ` : "";
    const pos = this.returnTo === "list" && v === "pr" ? this.listPosition() : null;
    const updated = v === "list" ? this.list.fetchedAt : this.fetchedAt;
    const headerBar = h_flex().flex_none().h(30).px(14).gap(10).items_center().bg(t.chrome).border_b(1).border_color(t.border).text_size(11.5).text_color(t.muted)
      .child(div().size(8).rounded(4).bg(this.pr?.checksState === "fail" ? t.blocked : t.accent))
      .when(Boolean(crumb) && v !== "list", (el) => el.child(div().text_color(t.dim).child(crumb)))
      .child(div().child(v === "repos" ? `PRs · ${this.profileName ?? this.owner} · Repos` : v === "list" ? `PRs · ${this.multi() ? `${this.profileName} · ${this.account ?? "active gh account"}` : this.list.scope === "set" ? this.setName : "all repos"}` : `${crumb ? "" : "PRs · "}${this.repo} #${this.number}${titles[v] ?? ""}`))
      .when(Boolean(pos), (el) => el.child(div().text_color(t.dim).child(`${pos} · n/N`)))
      .child(div().flex_1())
      .when(Boolean(this.busy), (el) => el.child(div().text_color(t.working).child(`${this.busy}…`)))
      .when(!this.busy && Boolean(this.toast), (el) => el.child(div().text_color(t.done).child(this.toast)))
      .when(!this.busy && !this.toast && updated > 0, (el) => el.child(div().text_color(t.dim).child(`updated ${Math.max(0, Math.round((Date.now() - updated) / 60000))}m ago`)))

    // The frame is the visible window: its own measured height is what keep-cursor-visible and paging use,
    // whatever the header rows and the key strip take above and below it.
    const frame = (content, extra) => div().id("frame").relative().flex_1().min_h(0).overflow_hidden()
      .on_size_change((s, cx) => { const h = s.height / this.zoom; if (h !== this.viewH) { this.viewH = h; this.scrollTo(this.y, cx); } })
      .child(div().id("content").absolute().left(0).right(0).top(-this.y).on_size_change((s, cx) => { this.contentH = s.height / this.zoom; this.scrollTo(this.y, cx); }).child(content))
      .when(Boolean(extra), (el) => el.child(extra));

    if (v === "list") {
      const L = this.listBody(t);
      const hints = this.list.picker ? [["j/k", "pick"], ["enter", "apply"], ["type", "narrow"], ["esc", "close"]]
        : this.list.searching ? [["type", "search"], ["enter", "keep"], ["esc", "clear"]]
        : this.shortHints("list");
      return root.child(v_flex().size_full().child(headerBar).child(L.tabs).child(L.status).when(Boolean(L.search), (el) => el.child(L.search)).child(frame(L.body, L.picker)).child(this.keyHint(t, hints)));
    }

    let body;
    if (v === "repos") body = this.reposBody(t);
    else if (!this.pr && this.notConfigured()) body = this.setupBody(t);
    else if (!this.pr) body = div().text_color(this.error ? t.blocked : t.dim).child(this.error ?? "Loading…");
    else if (v === "files") body = this.filesBody(t);
    else if (v === "diff") body = this.diffBody(t);
    else if (v === "threads") body = this.threadsBody(t);
    else if (v === "checks") body = this.checksBody(t);
    else if (v === "log") body = this.logBody(t);
    else if (v === "review") body = this.reviewBody(t);
    else if (v === "confirm") body = this.confirmBody(t);
    else if (v === "comment" || v === "compose" || v === "ask") body = this.composeBody(t);
    else body = this.prBody(t);
    body = this.safe(t, v, () => body);

    const hints = this.shortHints(v);

    const content = v_flex().w_full().px(18).pt(14).pb(40).gap(14).child(body)
      .when(Boolean(this.error) && Boolean(this.pr), (el) => el.child(div().text_size(12).text_color(t.blocked).child(this.error)));
    return root.child(v_flex().size_full().child(headerBar).child(frame(content)).child(this.keyHint(t, hints)));
  }
}
