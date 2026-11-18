// Brain Chat: a structured chat around Claude for the second-brain learning loop.
//
// Open:  herdr-app do tab.new --name Brain --mod my-brain-chat --props '{"vault":"/abs/vault"}'
//        (bound to ctrl-a shift-b in keys.json)
//
// Each message runs one `claude -p` turn in the vault (stream-json, resumed by session id),
// so CLAUDE.md, skills, memory and the Vikunja MCP all apply. `.claude/brain-chat.md` is
// appended to the system prompt: it tells Claude to answer with ```brain-card JSON blocks,
// which this mod draws as cards (question, answer, reading, grade, gap, receipt, hint, step).
// Card answers go back as `[quiz]` / `[answer]` / `[reading]` messages, the same formats the
// quiz and answer panes use.
//
// Layout: status bar (recall due, next, gaps, uncommitted files) · mode rail (each mode sends
// a fixed opener; workflow rules stay in CLAUDE.md) · step tracker + thread + composer ·
// topic panel (level, recall, open questions, terminology gaps, uncommitted changes).
//
// Composer: Enter sends, paste keeps newlines. `til: …` appends verbatim to
// raw-sources/til/YYYY-MM-DD.md without Claude. `?` asks for the next hint rung. `/new`
// archives the thread and starts a new session.
//
// State: <vault>/.brain-chat/thread.json (gitignored). Turn output streams through
// <vault>/.brain-chat/turn-<ms>.jsonl, removed after each turn.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextareaState, Textarea, TextView, ScrollHandle } from "gpui-base";
import { props, theme, readTextFile, writeTextFile, watchFolder, checking, nextCommand, exec, home, run } from "herdr";
import * as fs from "fs/promises";

const LEVELS = ["heard-of", "read-about", "can-explain", "applied", "can-teach"];
const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const MODES = [
  { id: "recall", label: "Recall", prompt: "Start a recall round for the topics that are due (CLAUDE.md, Spaced recall). One topic at a time." },
  { id: "deep-read", label: "Deep-read session", prompt: "Start a deep-read session (CLAUDE.md, Deep-read session) on the next item in the learning queue." },
  { id: "review", label: "Review", prompt: "Start a review (CLAUDE.md, Review). Ask me which topic if it isn't obvious." },
  { id: "zettel", label: "Zettel read", prompt: "Continue the zettel-read flow." },
  { id: "til", label: "TIL", prefill: "til: " },
  { id: "ask", label: "Ask (query)", prefill: "Query: " },
  { sep: true },
  { id: "plan", label: "Plan", prompt: "Plan: what should I learn next? (CLAUDE.md, Plan)", quiet: true },
  { id: "lint", label: "Lint", prompt: "Run the weekly lint (CLAUDE.md, Lint).", quiet: true },
];

const START_PROMPT = "Start the session: the CLAUDE.md session-start status line, ingest any new TILs, then offer due recalls.";
const END_PROMPT = "End session: finish any pending saves per CLAUDE.md (reviews, topics, map, queue, index, log), then commit and push. Finish with a receipt card listing the files.";

// Tools a turn may use without asking (`-p` can't prompt). Anything else is denied and shows
// a card with "Allow & retry", which adds the rule for the rest of this session.
const ALLOWED = [
  "Read", "Write", "Edit", "Glob", "Grep", "WebFetch", "WebSearch", "Skill", "TodoWrite",
  "Bash(git:*)", "Bash(ls:*)", "Bash(cat:*)", "Bash(head:*)", "Bash(tail:*)", "Bash(grep:*)",
  "Bash(date:*)", "Bash(wc:*)", "Bash(mkdir:*)", "Bash(python3:*)", "Bash(.claude/skills/reader-pane/fetch.py:*)",
  "mcp__claude_ai_Vikunja",
];

// Runs one turn: the inner sh records claude's pid (for Stop) and execs it; tool-result events
// ("type":"user", often whole files) are dropped so the stream stays small.
// GUI apps don't inherit the shell PATH (nvm etc.), so find claude first.
const FIND_CLAUDE = `PATH="$HOME/.local/bin:$HOME/.claude/local:/opt/homebrew/bin:/usr/local/bin:$PATH"
command -v claude >/dev/null 2>&1 || for d in $(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -rV); do [ -x "$d/claude" ] && PATH="$d:$PATH" && break; done
`;

const TURN_SH = FIND_CLAUDE + `out=$1; shift
sh -c 'echo $$ > "$0.pid"; exec claude "$@"' "$out" "$@" 2>"$out.err" | grep --line-buffered -v '^{"type":"user"' > "$out"`;

const CARD_RE = /```brain-card[^\n]*\n([\s\S]*?)\n?```/g;

const pad = (n) => String(n).padStart(2, "0");
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const plain = (s) => (s ?? "").replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1").replace(/\*\*/g, "").trim();
const unquote = (s) => s.replace(/^["“]|["”]$/g, "");
const choiceText = (c) => (typeof c === "string" ? c : c?.text ?? "");
const choiceGap = (c) => (typeof c === "string" ? null : c?.gap ?? null);

function frontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  const meta = {};
  if (m) for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*?)\s*(#.*)?$/);
    if (kv) meta[kv[1]] = kv[2];
  }
  return meta;
}

// Rows of the first markdown table after `heading`, as arrays of cells.
function tableAfter(raw, heading) {
  const i = raw.indexOf(heading);
  if (i < 0) return [];
  const rows = [];
  let started = false;
  for (const line of raw.slice(i).split("\n").slice(1)) {
    if (line.startsWith("|")) { started = true; rows.push(line.split("|").slice(1, -1).map((c) => c.trim())); }
    else if (started) break;
    else if (line.startsWith("## ")) break;
  }
  return rows.slice(2);
}

// Top-level bullets of the section whose heading starts with `heading`.
function bulletsAfter(raw, heading) {
  const i = raw.indexOf(heading);
  if (i < 0) return [];
  const out = [];
  for (const line of raw.slice(i).split("\n").slice(1)) {
    if (line.startsWith("## ")) break;
    const m = line.match(/^[-*] (.+)/);
    if (m) out.push(plain(m[1]));
  }
  return out;
}

// Assistant text → parts: plain markdown and parsed cards.
function parseText(text) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(CARD_RE)) {
    const before = text.slice(last, m.index).trim();
    if (before) parts.push({ type: "text", text: before });
    try {
      const card = JSON.parse(m[1]);
      if (!card || typeof card.kind !== "string") throw new Error("no kind");
      parts.push({ type: "card", card });
    } catch (e) {
      parts.push({ type: "text", text: `\`\`\`json\n${m[1]}\n\`\`\`\n_(card not readable: ${e.message})_` });
    }
    last = m.index + m[0].length;
  }
  const rest = text.slice(last).trim();
  if (rest) parts.push({ type: "text", text: rest });
  return parts;
}

export default class BrainChat extends View {
  init(_props, cx) {
    this.vault = props()?.vault ?? `${home()}/Notes/bruce-brain`;
    this.dir = `${this.vault}/.brain-chat`;
    this.stateFile = `${this.dir}/thread.json`;
    this.st = { session: null, items: [], step: null, cost: 0, allow: [] };
    this.data = null;          // wiki snapshot
    this.changes = [];         // git status lines
    this.error = null;
    this.busy = false;
    this.live = null;          // the claude item being streamed
    this.turnFile = null;
    this.lineCount = 0;
    this.pumpChain = Promise.resolve();
    this.size = null;
    this.choice = null;        // active question card: picked index
    this.boxKey = null;        // focused answer box

    this.handle = cx.focus_handle();
    this.scroll = ScrollHandle.new();

    this.composer = TextareaState.new({ placeholder: "Talk, ask, or say 'just tell me'…  (Enter sends)" });
    this.composer.set_auto_grow(1, 8);
    this.enterToSend(this.composer, "composer", (cx) => this.submitComposer(cx));

    this.why = InputState.new({ placeholder: "Why? (optional, Enter sends)" });
    this.why.on("submit", (_e, cx) => this.submitQuestion(cx));

    this.boxes = {};
    for (const key of ["x", "y", "z", "a"]) {
      const s = TextareaState.new({ placeholder: { x: "What is true?", y: "because…", z: "so…", a: "In your own words…" }[key] });
      s.set_auto_grow(2, 10);
      s.on("change", (_e, cx) => cx.notify());
      s.on("submit", (e, cx) => { if (e?.secondary) this.submitAnswer(cx); });
      s.on("focus", () => { this.boxKey = key; });
      s.on("blur", () => { if (this.boxKey === key) this.boxKey = null; });
      this.boxes[key] = s;
    }

    if (checking()) return;
    cx.spawn(async (cx) => {
      await exec("mkdir", ["-p", this.dir]);
      const raw = await readTextFile(this.stateFile);
      if (raw) {
        try { this.st = { ...this.st, ...JSON.parse(raw) }; } catch (e) { this.error = `thread.json unreadable: ${e.message}`; }
      }
      // A turn that was cut off (app quit mid-turn) can't be resumed from here.
      const last = this.st.items[this.st.items.length - 1];
      if (last?.role === "claude" && last.running) { delete last.running; last.error = "Turn interrupted."; }
      this.prepareCard();
      this.toBottom();
      cx.notify();
    });
    cx.spawn(async (cx) => {
      await this.load(cx);
      for (;;) {
        await watchFolder(`${this.vault}/wiki`);
        await this.load(cx);
      }
    });
    cx.timer.every(3600000, (cx) => this.load(cx));
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") { this.focusInput(); cx.notify(); }
      }
    });
  }

  // Textarea where Enter sends and a pasted newline stays: a one-character change that added a
  // line break is a typed Enter, so strip it and send.
  enterToSend(state, key, send) {
    this.prev = this.prev ?? {};
    this.prev[key] = "";
    state.on("change", (_e, cx) => {
      const before = this.prev[key];
      const v = state.value();
      this.prev[key] = v;
      if (v.length === before.length + 1 && v.split("\n").length > before.split("\n").length) {
        let i = 0;
        while (i < before.length && v[i] === before[i]) i++;
        const cleaned = v.slice(0, i) + v.slice(i + 1);
        this.prev[key] = cleaned;
        state.set_value(cleaned);
        send(cx);
      }
      cx.notify();
    });
  }

  setComposer(text) {
    this.prev.composer = text;
    this.composer.set_value(text);
  }

  focusInput() {
    const card = this.activeCard();
    if (card?.card.kind === "answer") this.boxes[card.card.mode === "free" ? "a" : "x"].focus();
    else this.composer.focus();
  }

  toBottom() {
    const n = this.st.items.length + (this.busy ? 1 : 0);
    if (n > 0) this.scroll.scroll_to_item(n - 1);
  }

  // ---------- persistence and wiki ----------

  async save() {
    try {
      const old = await readTextFile(this.stateFile);
      await writeTextFile(this.stateFile, JSON.stringify(this.st, null, 1), old);
    } catch (e) {
      this.error = `Couldn't save thread: ${e.message ?? e}`;
    }
  }

  async load(cx) {
    try {
      const dir = `${this.vault}/wiki/topics`;
      const names = (await fs.readdir(dir)).filter((n) => n.endsWith(".md")).sort();
      const topics = [];
      const gaps = [];
      for (const n of names) {
        const raw = (await readTextFile(`${dir}/${n}`)) ?? "";
        const meta = frontmatter(raw);
        const slug = n.replace(/\.md$/, "");
        const title = raw.match(/^# (.+)$/m)?.[1] ?? slug;
        const tgaps = [];
        for (const row of tableAfter(raw, "## Terminology gaps")) {
          const [date, said, , , uses, status] = row;
          if (!date || /✅/.test(status ?? "")) continue;
          const g = { date, said: unquote(plain(said)), uses: ((uses ?? "").match(/\d{4}-\d\d-\d\d/g) ?? []).length, topic: slug };
          tgaps.push(g);
          gaps.push(g);
        }
        topics.push({
          slug, title, level: Number(meta.level ?? 0), next: meta.next_recall, interval: meta.recall_interval,
          open: bulletsAfter(raw, "## Open questions"), gaps: tgaps,
        });
      }
      gaps.sort((a, b) => a.date.localeCompare(b.date));
      const queueRaw = (await readTextFile(`${this.vault}/wiki/learning-queue.md`)) ?? "";
      const queue = tableAfter(queueRaw, "# Learning Queue").map(([prio, topic, , , next]) => ({ prio, topic: plain(topic), next: plain(next) }));
      this.data = { topics, gaps, queue, day: today() };
    } catch (e) {
      this.error = `Couldn't read the wiki: ${e.message ?? e}`;
    }
    await this.loadChanges();
    cx.notify();
  }

  async loadChanges() {
    try {
      const r = await exec("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: this.vault });
      this.changes = r.stdout.split("\n").filter(Boolean).map((l) => ({ code: l.slice(0, 2).trim(), path: l.slice(3) }));
    } catch (_e) {
      this.changes = [];
    }
  }

  // ---------- turns ----------

  send(text, display, cx) {
    if (this.busy || !text.trim()) return;
    this.st.items.push({ role: "user", text: display ?? text });
    const item = { role: "claude", parts: [], running: true };
    this.st.items.push(item);
    this.live = item;
    this.busy = true;
    this.lineCount = 0;
    this.turnFile = `${this.dir}/turn-${Date.now()}.jsonl`;
    const out = this.turnFile;
    this.toBottom();
    cx.notify();

    cx.spawn(async (cx) => {
      await this.save();
      const sys = (await readTextFile(`${this.vault}/.claude/brain-chat.md`)) ?? "";
      const args = ["-p", text, "--output-format", "stream-json", "--verbose", "--permission-mode", "acceptEdits"];
      if (sys) args.push("--append-system-prompt", sys);
      if (this.st.session) args.push("--resume", this.st.session);
      args.push("--allowedTools", ...ALLOWED, ...this.st.allow);

      this.watch = null;
      cx.spawn(async (cx) => {
        while (this.turnFile === out) {
          this.watch = watchFolder(this.dir);
          await this.watch;
          if (this.turnFile !== out) break;
          await this.pump(out, false, cx);
        }
      });

      let r = null;
      try {
        r = await exec("sh", ["-c", TURN_SH, "sh", out, ...args], { cwd: this.vault, timeout: 600000 });
      } catch (e) {
        item.error = `Turn failed: ${e.message ?? e}`;
      }
      await this.pump(out, true, cx);
      this.turnFile = null;
      this.watch?.cancel();
      if (!item.done && !item.error) {
        const err = ((await readTextFile(`${out}.err`)) ?? "").trim();
        item.error = item.stopped ? "Stopped." : (err.split("\n").slice(-3).join("\n") || `claude exited (${r?.code ?? "?"}) without a result.`);
      }
      delete item.running;
      exec("rm", ["-f", out, `${out}.err`, `${out}.pid`]);
      this.live = null;
      this.busy = false;
      this.prepareCard();
      await this.save();
      await this.loadChanges();
      this.toBottom();
      this.focusInput();
      cx.notify();
    });
  }

  pump(out, final, cx) {
    this.pumpChain = this.pumpChain.then(async () => {
      let raw = null;
      try { raw = await readTextFile(out); } catch (_e) { return; }
      if (raw == null) return;
      const lines = raw.split("\n");
      const complete = final ? lines : lines.slice(0, -1);
      for (let i = this.lineCount; i < complete.length; i++) {
        if (!complete[i].trim()) continue;
        try { this.onEvent(JSON.parse(complete[i])); } catch (_e) { /* partial or non-JSON line */ }
      }
      this.lineCount = Math.max(this.lineCount, complete.length);
      this.toBottom();
      cx.notify();
    });
    return this.pumpChain;
  }

  onEvent(e) {
    const item = this.live;
    if (!item) return;
    if (e.type === "system" && e.subtype === "init" && e.session_id) {
      this.st.session = e.session_id;
    } else if (e.type === "assistant") {
      for (const c of e.message?.content ?? []) {
        if (c.type === "text" && c.text?.trim()) {
          for (const p of parseText(c.text)) {
            if (p.type === "card" && p.card.kind === "step") this.st.step = p.card;
            item.parts.push(p);
          }
        } else if (c.type === "tool_use") {
          item.parts.push({ type: "tool", label: this.toolLabel(c) });
        }
      }
    } else if (e.type === "result") {
      item.done = true;
      if (e.session_id) this.st.session = e.session_id;
      this.st.cost = (this.st.cost ?? 0) + (e.total_cost_usd ?? 0);
      if (e.is_error) item.error = String(e.result ?? e.subtype ?? "error");
      if (e.permission_denials?.length) {
        item.denials = e.permission_denials.map((d) => ({
          tool: d.tool_name,
          detail: d.tool_input?.command ?? d.tool_input?.file_path ?? d.tool_input?.url ?? "",
        }));
      }
    }
  }

  toolLabel(c) {
    const i = c.input ?? {};
    const rel = (p) => String(p).replace(`${this.vault}/`, "");
    let name = c.name.replace(/^mcp__claude_ai_(\w+?)__/, "$1 ");
    let arg = i.file_path ? rel(i.file_path) : i.command ?? i.pattern ?? i.url ?? i.query ?? i.skill ?? i.title ?? "";
    arg = String(arg).split("\n")[0];
    if (arg.length > 48) arg = `${arg.slice(0, 47)}…`;
    return arg ? `${name} ${arg}` : name;
  }

  stop() {
    const out = this.turnFile;
    if (!out || !this.live) return;
    this.live.stopped = true;
    exec("sh", ["-c", 'kill "$(cat "$1")" 2>/dev/null', "sh", `${out}.pid`]);
  }

  // ---------- composer, modes, TIL ----------

  submitComposer(cx) {
    const text = this.composer.value().trim();
    if (!text || this.busy) return;
    if (/^til:/i.test(text)) { this.saveTil(text.replace(/^til:\s*/i, ""), cx); return; }
    if (text === "/new") { this.setComposer(""); this.newSession(cx); return; }
    this.setComposer("");
    if (text === "?") this.send("? (next rung of the hint ladder)", "?", cx);
    else this.send(text, text, cx);
  }

  saveTil(text, cx) {
    if (!text) return;
    const now = new Date();
    const rel = `raw-sources/til/${today()}.md`;
    const file = `${this.vault}/${rel}`;
    const entry = `## ${pad(now.getHours())}:${pad(now.getMinutes())}\n${text}\n`;
    cx.spawn(async (cx) => {
      try {
        const old = await readTextFile(file);
        const next = old == null ? `# TIL ${today()}\n\n${entry}` : `${old.replace(/\n*$/, "\n\n")}${entry}`;
        await writeTextFile(file, next, old);
        this.setComposer("");
        this.st.items.push({ role: "til", text, file: rel });
        await this.save();
        await this.loadChanges();
      } catch (e) {
        this.st.items.push({ role: "note", text: `TIL not saved: ${e.message ?? e}` });
      }
      this.toBottom();
      cx.notify();
    });
  }

  pickMode(m, cx) {
    if (m.prefill != null) { this.setComposer(m.prefill); this.composer.focus(); cx.notify(); return; }
    this.send(m.prompt, `**${m.label}**`, cx);
  }

  newSession(cx) {
    if (this.busy) return;
    cx.spawn(async (cx) => {
      if (this.st.items.length) {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        await exec("mkdir", ["-p", `${this.dir}/archive`]);
        try { await writeTextFile(`${this.dir}/archive/${stamp}.json`, JSON.stringify(this.st, null, 1), null); } catch (_e) { /* best effort */ }
      }
      this.st = { session: null, items: [], step: null, cost: 0, allow: [] };
      await this.save();
      cx.notify();
    });
  }

  // ---------- cards ----------

  // The interactive card waiting for Bruce: the last unanswered question/answer card of the
  // latest Claude reply, and only when no turn is running.
  activeCard() {
    if (this.busy) return null;
    const items = this.st.items;
    const last = items[items.length - 1];
    if (last?.role !== "claude") return null;
    for (let j = last.parts.length - 1; j >= 0; j--) {
      const p = last.parts[j];
      if (p.type === "card" && (p.card.kind === "question" || p.card.kind === "answer")) return p.answered ? null : p;
    }
    return null;
  }

  prepareCard() {
    this.choice = null;
    this.why.set_value("");
    for (const s of Object.values(this.boxes)) s.set_value("");
  }

  submitQuestion(cx) {
    const p = this.activeCard();
    if (!p || p.card.kind !== "question" || this.choice == null) return;
    const c = p.card.choices?.[this.choice];
    const letter = String.fromCharCode(65 + this.choice);
    const why = this.why.value().trim();
    const lines = [`[quiz] ${p.card.title ?? "Question"}`, `Choice: ${letter}. ${choiceText(c)}`];
    if (choiceGap(c)) lines.push(`Gap: ${choiceGap(c)}`);
    if (why) lines.push(`Why: ${why}`);
    p.answered = { choice: this.choice, why };
    this.send(lines.join("\n"), `${letter}. ${choiceText(c)}${why ? `\n\nWhy: ${why}` : ""}`, cx);
  }

  answerFields(card) {
    return card.mode === "free"
      ? [{ key: "a", label: "Answer" }]
      : [{ key: "x", label: "X — claim" }, { key: "y", label: "Y — reason" }, { key: "z", label: "Z — consequence" }];
  }

  submitAnswer(cx) {
    const p = this.activeCard();
    if (!p || p.card.kind !== "answer") return;
    const fields = this.answerFields(p.card).map((f) => ({ ...f, text: this.boxes[f.key].value().trim() }));
    if (fields.some((f) => !f.text)) return;
    const free = p.card.mode === "free";
    const body = fields.map((f) => (free ? f.text : `${f.label}: ${f.text}`));
    p.answered = { fields };
    this.send([`[answer] ${p.card.title ?? "Answer"}`, ...body].join("\n"), body.join("\n\n"), cx);
  }

  openReading(card, cx) {
    cx.spawn(async (cx) => {
      try {
        const r = await exec(`${this.vault}/.claude/skills/reader-pane/fetch.py`, [card.url], { cwd: this.vault, timeout: 120000 });
        const path = r.stdout.split("\t")[0].trim();
        if (r.code !== 0 || !path) throw new Error(r.stderr.trim() || "fetch failed");
        run("pane.split", { direction: "right", mod: "my-reader", props: { file: path } });
      } catch (e) {
        exec("open", [card.url]);
        this.st.items.push({ role: "note", text: `Reader failed (${e.message ?? e}); opened in the browser.` });
      }
      cx.notify();
    });
  }

  allowAndRetry(item, cx) {
    const rules = [];
    for (const d of item.denials ?? []) {
      const rule = d.tool === "Bash" && d.detail ? `Bash(${d.detail.trim().split(/\s+/)[0]}:*)` : d.tool;
      if (!this.st.allow.includes(rule)) this.st.allow.push(rule);
      if (!rules.includes(rule)) rules.push(rule);
    }
    item.denialsHandled = true;
    this.send(`Allowed for this session: ${rules.join(", ")}. Retry what was blocked.`, `Allow ${rules.join(", ")} and retry`, cx);
  }

  key(e, cx) {
    const k = e.keystroke;
    const p = this.activeCard();
    if (k === "cmd-enter" && p?.card.kind === "answer") { this.submitAnswer(cx); cx.stop_propagation(); return; }
    if ((k === "tab" || k === "shift-tab") && p?.card.kind === "answer" && this.boxKey) {
      const keys = this.answerFields(p.card).map((f) => f.key);
      const i = keys.indexOf(this.boxKey);
      const box = this.boxes[this.boxKey];
      if (box.value().includes("\t")) box.set_value(box.value().replace(/\t/g, ""));
      this.boxes[keys[(i + (k === "tab" ? 1 : -1) + keys.length) % keys.length]].focus();
      cx.stop_propagation();
      cx.notify();
      return;
    }
    if (k === "escape" && this.busy) { this.stop(); cx.stop_propagation(); }
  }

  // ---------- rendering ----------

  render() {
    const t = theme();
    const w = this.size?.width ?? 1400;
    return v_flex().id("root").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .on_size_change((size, cx) => { this.size = size; cx.notify(); })
      .size_full().bg(t.background).text_color(t.foreground).text_size(14)
      .child(this.statusBar(t))
      .child(h_flex().flex_1().min_h_0().items_stretch()
        .when(w >= 760, (el) => el.child(this.rail(t)))
        .child(this.center(t))
        .when(w >= 1100, (el) => el.child(this.panel(t))));
  }

  label(t, text, color) {
    return div().text_size(11).font_semibold().text_color(color ?? t.dim).child(text.toUpperCase());
  }

  button(t, id, text, kind, enabled, action) {
    const primary = kind === "primary";
    return h_flex().id(id).h(30).px(12).items_center().rounded(6).flex_shrink_0()
      .border_1().border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised)
      .text_color(primary ? t.solid_foreground : t.foreground).text_size(12.5).font_medium()
      .opacity(enabled ? 1 : 0.45).when(enabled, (el) => el.cursor_pointer().hover((s) => s.opacity(0.85)))
      .on_click((_e, cx) => { if (enabled) action(cx); }).child(text);
  }

  dueTopics() {
    const d = this.data;
    if (!d) return [];
    return d.topics.filter((x) => x.level >= 1 && x.next && x.next <= d.day)
      .map((x) => ({ ...x, late: daysBetween(x.next, d.day) })).sort((a, b) => b.late - a.late);
  }

  statusBar(t) {
    const d = this.data;
    const due = this.dueTopics();
    const pair = (k, v, color) => h_flex().gap(6).items_center().flex_shrink_0()
      .child(div().text_color(t.muted).child(k)).child(div().text_color(color ?? t.foreground).child(v));
    const gapsOld = d?.gaps[0] ? daysBetween(d.gaps[0].date, d.day) : 0;
    return h_flex().h(44).flex_shrink_0().px(16).gap(20).items_center().bg(t.chrome).border_b_1().border_color(t.border).text_size(13)
      .child(div().font_semibold().child("Brain"))
      .child(due.length
        ? h_flex().gap(6).items_center().flex_shrink_0().child(div().w(8).h(8).rounded(4).bg(t.blocked))
            .child(pair("Recall due:", due.map((x) => x.slug + (x.late > 0 ? ` (${x.late}d over)` : "")).join(", ")))
        : pair("Recall:", "nothing due"))
      .when(Boolean(d?.queue[0]), (el) => el.child(div().min_w_0().truncate().child(
        h_flex().gap(6).child(div().text_color(t.muted).child("Next:")).child(div().truncate().child(d.queue[0].next)))))
      .when(Boolean(d), (el) => el.child(pair("Gaps:", `${d.gaps.length} open${d.gaps.length ? ` · oldest ${gapsOld}d` : ""}`, gapsOld > 14 ? t.blocked : null)))
      .child(div().flex_1())
      .when(this.st.cost > 0, (el) => el.child(div().text_size(12).text_color(t.dim).flex_shrink_0().child(`$${this.st.cost.toFixed(2)}`)))
      .child(this.button(t, "new", "New", "plain", !this.busy, (cx) => this.newSession(cx)))
      .child(this.button(t, "end", "End session", "plain", !this.busy && this.st.items.length > 0, (cx) => this.send(END_PROMPT, "**End session**", cx)));
  }

  rail(t) {
    const due = this.dueTopics().length;
    const step = this.st.step;
    const gaps = this.data?.gaps.slice(0, 3) ?? [];
    return v_flex().w(210).flex_shrink_0().bg(t.chrome).border_r_1().border_color(t.border).px(10).py(14).gap(2)
      .child(div().px(10).pb(8).child(this.label(t, "Modes")))
      .children(MODES.map((m, i) => {
        if (m.sep) return div().h(1).bg(t.border).mx(6).my(8);
        const active = step && step.mode && m.label.toLowerCase().startsWith(String(step.mode).toLowerCase().split(" ")[0]);
        const badge = m.id === "recall" && due ? String(due) : active && Array.isArray(step.steps) ? `${(step.current ?? 0) + 1}/${step.steps.length}` : null;
        return h_flex().id(`mode-${i}`).px(10).py(8).rounded(6).items_center().justify_between()
          .bg(active ? t.accent : t.chrome).text_color(active ? t.accent_foreground : m.quiet ? t.muted : t.foreground)
          .when(active, (el) => el.font_semibold())
          .opacity(this.busy && !m.prefill ? 0.5 : 1)
          .cursor_pointer().hover((s) => s.bg(active ? t.accent : t.hover))
          .on_click((_e, cx) => { if (!this.busy || m.prefill != null) this.pickMode(m, cx); })
          .child(div().child(m.label))
          .when(Boolean(badge), (el) => el.child(div().text_size(11.5).px(7).rounded(9)
            .bg(m.id === "recall" ? t.blocked : t.accent).text_color(t.background).child(badge)));
      }))
      .child(div().flex_1())
      .when(gaps.length > 0, (el) => el
        .child(div().px(10).pb(6).child(this.label(t, "Warm-up queue")))
        .children(gaps.map((g) => div().px(10).py(3).text_size(12).text_color(t.muted).truncate().child(`“${g.said}”`))));
  }

  tracker(t) {
    const s = this.st.step;
    if (!s || !Array.isArray(s.steps)) return null;
    const cur = s.current ?? 0;
    const kids = [];
    s.steps.forEach((name, i) => {
      if (i > 0) kids.push(div().text_color(t.dim).child("—"));
      if (i < cur) kids.push(div().text_color(t.done).child(`✓ ${name}`));
      else if (i === cur) kids.push(div().px(10).py(3).rounded(10).bg(t.accent).text_color(t.accent_foreground).font_semibold().child(name));
      else kids.push(div().text_color(t.muted).child(name));
    });
    kids.push(div().flex_1());
    kids.push(div().text_color(t.muted).child(`${s.mode ?? ""}${s.topic ? ` · ${s.topic}` : ""}`));
    return h_flex().h(48).flex_shrink_0().px(24).gap(6).items_center().border_b_1().border_color(t.border).text_size(12).children(kids);
  }

  center(t) {
    const items = this.st.items;
    const kids = items.length
      ? items.map((it, i) => this.renderItem(t, it, i))
      : [v_flex().gap(12).items_center().pt(80)
          .child(div().text_color(t.muted).child(this.error ?? "New session."))
          .child(this.button(t, "start", "Start session", "primary", !this.busy, (cx) => this.send(START_PROMPT, "**Start session**", cx)))];
    if (this.busy) {
      const tools = this.live?.parts.filter((p) => p.type === "tool") ?? [];
      kids.push(h_flex().gap(8).items_center().text_size(12.5).text_color(t.muted)
        .child(div().text_color(t.ansi5).frames(SPIN, 90))
        .child(div().min_w_0().truncate().child(tools.length ? tools[tools.length - 1].label : "Claude is thinking…"))
        .child(div().id("stop").text_color(t.dim).cursor_pointer().hover((s) => s.text_color(t.foreground))
          .on_click(() => this.stop()).child("Stop (Esc)")));
    }
    const thread = v_flex().id("thread").flex_1().min_h_0().overflow_y_scrollbar().track_scroll(this.scroll)
      .px(24).py(20).gap(16).children(kids);
    const tracker = this.tracker(t);
    return v_flex().flex_1().min_w_0().h_full()
      .when(Boolean(tracker), (el) => el.child(tracker))
      .child(thread)
      .child(this.composerBar(t));
  }

  composerBar(t) {
    const p = this.activeCard();
    const mode = this.st.step?.mode ? `${this.st.step.mode}${Array.isArray(this.st.step.steps) ? ` · ${this.st.step.steps[this.st.step.current ?? 0] ?? ""}` : ""}` : "chat";
    const hint = (k, v) => h_flex().gap(5).child(div().text_color(t.muted).child(k)).child(div().child(v));
    return v_flex().flex_shrink_0().border_t_1().border_color(t.border).px(24).pt(12).pb(14).gap(8)
      .child(h_flex().gap(10).items_start().px(10).py(8).rounded(8).bg(t.surface).border_1().border_color(t.input)
        .child(div().mt(2).flex_shrink_0().text_size(12).px(8).py(2).rounded(5).bg(t.accent).text_color(t.accent_foreground).font_semibold().child(mode))
        .child(div().flex_1().min_w_0().child(Textarea.new(this.composer).w_full().bg(t.surface).text_size(14).text_color(t.foreground)))
        .child(this.button(t, "send", this.busy ? "…" : "Send", "primary", !this.busy && this.composer.value().trim().length > 0, (cx) => this.submitComposer(cx))))
      .child(h_flex().gap(16).text_size(12).text_color(t.dim)
        .child(hint("til:", "saves verbatim, no AI"))
        .child(hint("?", "next hint rung"))
        .child(hint("/new", "new session"))
        .when(p?.card.kind === "answer", (el) => el.child(hint("⌘↵", "send answer card"))));
  }

  renderItem(t, it, i) {
    if (it.role === "user") {
      return h_flex().justify_end().child(div().max_w(560).px(13).py(9).rounded(10).bg(t.selection)
        .child(TextView.markdown(`u-${i}`, it.text).selectable(true)));
    }
    if (it.role === "til") {
      return this.card(t, "TIL captured", t.done, [
        div().italic().child(`“${it.text}”`),
        div().text_size(12).text_color(t.muted).child(`→ ${it.file}`),
      ]);
    }
    if (it.role === "note") {
      return h_flex().justify_center().child(div().text_size(12).text_color(t.dim).child(it.text));
    }
    // claude: group consecutive tool calls into one dim line
    const rows = [];
    let tools = [];
    const flush = () => {
      if (!tools.length) return;
      const shown = tools.slice(0, 3).join(" · ");
      rows.push(div().text_size(12).text_color(t.dim).truncate().child(`⚙ ${shown}${tools.length > 3 ? ` · +${tools.length - 3}` : ""}`));
      tools = [];
    };
    it.parts.forEach((p, j) => {
      if (p.type === "tool") { tools.push(p.label); return; }
      flush();
      if (p.type === "text") rows.push(TextView.markdown(`c-${i}-${j}`, p.text).selectable(true));
      else if (p.type === "card") rows.push(this.renderCard(t, p, `${i}-${j}`, it));
    });
    flush();
    if (it.denials?.length) rows.push(this.denialCard(t, it));
    if (it.error) rows.push(div().text_size(12.5).text_color(t.blocked).child(it.error));
    if (!rows.length && !it.running) rows.push(div().text_color(t.dim).child("(no reply)"));
    return h_flex().gap(12).items_start().max_w(820)
      .child(h_flex().w(26).h(26).flex_shrink_0().rounded(13).bg(t.raised).items_center().justify_center()
        .text_size(12).font_semibold().text_color(t.ansi5).child("C"))
      .child(v_flex().flex_1().min_w_0().gap(8).children(rows));
  }

  card(t, title, color, children, border) {
    return v_flex().gap(8).px(14).py(12).rounded(8).bg(t.surface).border_1().border_color(border ?? t.border)
      .child(this.label(t, title, color)).children(children);
  }

  renderCard(t, p, id, item) {
    const c = p.card;
    const md = (suffix, text) => TextView.markdown(`k-${id}-${suffix}`, String(text ?? "")).selectable(true);
    const passage = c.passage ? div().border_l_2().border_color(t.accent).pl(12).text_color(t.muted).child(md("passage", c.passage)) : null;
    const active = this.activeCard() === p;
    switch (c.kind) {
      case "step": {
        const name = Array.isArray(c.steps) ? c.steps[c.current ?? 0] : "";
        return div().text_size(12).text_color(t.dim).child(`→ ${c.mode ?? "step"}${name ? `: ${name}` : ""}`);
      }
      case "question": {
        const picked = p.answered ? p.answered.choice : active ? this.choice : null;
        const choices = (c.choices ?? []).map((ch, k) => h_flex().id(`q-${id}-${k}`).gap(10).px(12).py(8).rounded(6)
          .border_1().border_color(picked === k ? t.accent : t.input).bg(picked === k ? t.selected : t.background)
          .when(active, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)))
          .on_click((_e, cx) => { if (active) { this.choice = k; this.why.focus(); cx.notify(); } })
          .child(div().font_semibold().text_color(picked === k ? t.accent : t.dim).child(String.fromCharCode(65 + k)))
          .child(div().flex_1().child(choiceText(ch))));
        const kids = [passage, md("prompt", c.prompt), v_flex().gap(6).children(choices)].filter(Boolean);
        if (active) {
          kids.push(h_flex().gap(8).items_center()
            .child(Input.new(this.why).flex_1().h(32).px(10).rounded(6).border_1().border_color(t.input).bg(t.background).text_size(13))
            .child(this.button(t, `q-send-${id}`, "Send", "primary", this.choice != null, (cx) => this.submitQuestion(cx))));
          kids.push(div().text_size(12).text_color(t.dim).child("Click a choice, add an optional why, Enter sends."));
        } else if (!p.answered) {
          kids.push(div().text_size(12).text_color(t.dim).child("Not answered."));
        }
        return this.card(t, `Question${c.title ? ` · ${c.title}` : ""}`, t.ansi5, kids, active ? t.accent : null);
      }
      case "answer": {
        const fields = this.answerFields(c);
        const kids = [passage, md("prompt", c.prompt)].filter(Boolean);
        if (p.answered) {
          for (const f of p.answered.fields ?? []) kids.push(v_flex().gap(2)
            .child(div().text_size(11.5).text_color(t.dim).child(f.label)).child(div().child(f.text)));
        } else if (active) {
          for (const f of fields) kids.push(v_flex().gap(4)
            .child(div().text_size(11.5).font_semibold().text_color(t.accent).child(f.label))
            .child(Textarea.new(this.boxes[f.key]).w_full().p(8).rounded(6).border_1().border_color(t.input).bg(t.background).text_size(13.5)));
          const ready = fields.every((f) => this.boxes[f.key].value().trim());
          kids.push(h_flex().items_center().justify_between()
            .child(div().text_size(12).text_color(t.dim).child("Saved verbatim before grading · Tab next box · ⌘↵ send"))
            .child(this.button(t, `a-send-${id}`, "Send", "primary", Boolean(ready), (cx) => this.submitAnswer(cx))));
        } else {
          kids.push(div().text_size(12).text_color(t.dim).child("Not answered."));
        }
        return this.card(t, `Answer${c.title ? ` · ${c.title}` : ""}`, t.accent, kids, active ? t.accent : null);
      }
      case "reading":
        return this.card(t, "Reading", t.ansi6, [
          div().font_semibold().child(c.title ?? c.url ?? ""),
          div().text_size(12).text_color(t.accent).child(String(c.url ?? "")),
          c.bring ? div().text_size(13).text_color(t.muted).child(`Bring back: ${c.bring}`) : null,
          h_flex().gap(8)
            .child(this.button(t, `r-open-${id}`, "Open in reader", "primary", Boolean(c.url), (cx) => this.openReading(c, cx)))
            .child(this.button(t, `r-done-${id}`, p.done ? "Done ✓" : "Done reading", "plain", !p.done && !this.busy, (cx) => {
              p.done = true;
              this.send(`[reading] Done: ${c.title ?? c.url}`, `Done reading: ${c.title ?? c.url}`, cx);
            })),
        ].filter(Boolean));
      case "grade": {
        const color = c.grade === "Pass" ? t.done : c.grade === "Fail" ? t.blocked : t.working;
        return this.card(t, "Grade", color, [
          h_flex().gap(8).children(["Pass", "Partial", "Fail"].map((g) => div().px(10).py(4).rounded(6).text_size(13)
            .border_1().border_color(g === c.grade ? color : t.input).bg(g === c.grade ? color : t.surface)
            .text_color(g === c.grade ? t.background : t.dim).when(g === c.grade, (el) => el.font_semibold()).child(g))),
          c.note ? md("note", c.note) : null,
          (c.interval || c.next_recall) ? div().text_size(12).text_color(t.muted)
            .child([c.interval && `interval ${c.interval}`, c.next_recall && `next ${c.next_recall}`].filter(Boolean).join(" · ")) : null,
        ].filter(Boolean));
      }
      case "gap":
        return this.card(t, `Terminology gap${c.topic ? ` · ${c.topic}` : ""}`, t.blocked, [
          h_flex().gap(10).child(div().w(70).text_color(t.dim).child("You said")).child(div().flex_1().child(`“${unquote(String(c.said ?? ""))}”`)),
          h_flex().gap(10).child(div().w(70).text_color(t.dim).child("Precise")).child(div().flex_1().font_semibold().child(String(c.precise ?? ""))),
          c.why ? h_flex().gap(10).child(div().w(70).text_color(t.dim).child("Why")).child(div().flex_1().text_color(t.muted).child(String(c.why))) : null,
        ].filter(Boolean));
      case "receipt":
        return this.card(t, "Wiki updated", t.done, [
          c.topic || c.level ? div().child(`${c.topic ?? ""}${c.level ? `  ${c.level}` : ""}`) : null,
          c.evidence ? div().text_size(12.5).text_color(t.muted).child(`Evidence: ${c.evidence}`) : null,
          Array.isArray(c.files) && c.files.length ? v_flex().gap(2).children(c.files.map((f) => div().text_size(12).text_color(t.muted).child(String(f)))) : null,
        ].filter(Boolean));
      case "hint": {
        const rung = Math.max(1, Math.min(4, Number(c.rung) || 1));
        return this.card(t, `Hint · rung ${rung} of 4`, t.ansi5, [
          h_flex().gap(4).children([1, 2, 3, 4].map((r) => div().flex_1().h(5).rounded(3).bg(r <= rung ? t.ansi5 : t.border))),
          passage,
          c.text ? md("text", c.text) : null,
        ].filter(Boolean));
      }
      default:
        return this.card(t, c.kind, t.dim, [md("raw", `\`\`\`json\n${JSON.stringify(c, null, 2)}\n\`\`\``)]);
    }
  }

  denialCard(t, item) {
    return this.card(t, "Blocked: needs permission", t.working, [
      v_flex().gap(3).children(item.denials.map((d) => div().text_size(12.5).text_color(t.muted).truncate()
        .child(`${d.tool}${d.detail ? `  ${String(d.detail).split("\n")[0]}` : ""}`))),
      item.denialsHandled
        ? div().text_size(12).text_color(t.dim).child("Allowed for this session.")
        : h_flex().gap(8).child(this.button(t, `deny-${this.st.items.indexOf(item)}`, "Allow & retry", "primary", !this.busy, (cx) => this.allowAndRetry(item, cx))),
    ], t.working);
  }

  panel(t) {
    const d = this.data;
    const kids = [];
    const root = () => v_flex().id("panel").w(310).flex_shrink_0().bg(t.chrome).border_l_1().border_color(t.border).p(16).gap(18).text_size(13)
      .overflow_y_scrollbar().children(kids);
    if (!d) { kids.push(div().text_color(t.muted).child(this.error ?? "Loading wiki…")); return root(); }
    const slug = this.st.step?.topic;
    const topic = d.topics.find((x) => x.slug === slug) ?? this.dueTopics()[0] ?? d.topics[0];
    if (topic) {
      const overdue = topic.next && topic.next < d.day;
      kids.push(v_flex().gap(8)
        .child(this.label(t, "Topic"))
        .child(div().text_size(16).font_semibold().child(topic.title))
        .child(h_flex().gap(4).children([0, 1, 2, 3, 4].map((i) => div().flex_1().h(6).rounded(3).bg(i <= topic.level ? t.accent : t.border))))
        .child(div().text_color(t.muted).child(`Level ${topic.level} · ${LEVELS[topic.level] ?? ""}`))
        .when(Boolean(topic.next), (el) => el.child(h_flex().gap(6)
          .child(div().text_color(t.muted).child(`Recall every ${topic.interval ?? "?"}d · next ${topic.next}`))
          .when(overdue, (e2) => e2.child(div().text_color(t.blocked).child("overdue"))))));
      if (topic.open.length) kids.push(v_flex().gap(6).child(this.label(t, "Open questions"))
        .children(topic.open.slice(0, 5).map((q) => div().child(q))));
      if (topic.gaps.length) kids.push(v_flex().gap(6).child(this.label(t, "Terminology gaps"))
        .children(topic.gaps.map((g) => h_flex().gap(8).justify_between()
          .child(div().flex_1().min_w_0().truncate().child(`“${g.said}”`))
          .child(div().text_size(12).text_color(g.uses ? t.working : t.blocked).child(`${g.uses}/2`)))));
    }
    kids.push(div().flex_1());
    kids.push(v_flex().gap(6).p(12).rounded(8).bg(t.surface).border_1().border_color(t.border)
      .child(this.label(t, "Uncommitted changes"))
      .child(this.changes.length
        ? v_flex().gap(2).children(this.changes.slice(0, 12).map((c) => h_flex().gap(6).text_size(12)
            .child(div().w(16).text_color(c.code === "??" || c.code === "A" ? t.done : t.working).child(c.code === "??" ? "+" : c.code))
            .child(div().flex_1().min_w_0().truncate().text_color(t.muted).child(c.path))))
        : div().text_size(12).text_color(t.dim).child("Clean."))
      .when(this.changes.length > 12, (el) => el.child(div().text_size(12).text_color(t.dim).child(`+${this.changes.length - 12} more`)))
      .child(div().text_size(12).text_color(t.dim).child("End session → commit + push")));
    return root();
  }
}
