// Speed test popup: twin download/upload gauges on a log scale (1 to 1000 Mbps), split into
// five tiers (Crawl, Slow, Okay, Fast, Blazing). Opened from the command palette
// (mod.json title "Speed test") or `herdr-app do mod.open '{"name":"my-speed"}'`.
//
// The test is macOS's built-in `networkQuality -s`: download then upload in sequence. It
// takes ~20-30 s and moves real traffic, so it only starts on Enter / r / the Run button,
// never on open. It runs under `script` (a pseudo-terminal) so it prints a live
// "Downlink: X Mbps ... Uplink: Y Mbps" line several times a second; the log goes to a
// temp file that a 250 ms loop reads, moving the needles live (plus a ±2% shake, Ookla
// style). The "==== SUMMARY ====" block at the end gives the final numbers, kept in
// shared("my-speed.last") so reopening shows them. Closing mid-test drops that run.
//
// Mods can't rotate or paint paths, so the arcs are static SVGs (gauge-*.svg, drawn for a
// 280x150 box, hub at 140,140, radius 110) and the needle is a run of overlapping dots
// placed with absolute layout along the needle's angle. Each dot has a native transition on
// left/top, so the needle slides between readings instead of jumping.
//
// Ask Claude (a, or the button) reopens the popup taller as a chat about the last result
// (chat.js): the first message carries the measured facts, follow-ups continue the same
// `claude -p` session. The thread is kept per result in shared("my-speed.chat").
//
// Keys: enter or r run   a chat with Claude   esc close
//   chat: enter send   ctrl-d/ctrl-u scroll   ctrl-n new chat   ctrl-t continue in tab   ctrl-o back to result   esc close (the thread is kept)
// From the CLI: herdr-app do my-speed.run; herdr-app do my-speed.chat; herdr-app do my-speed.ask-<words-with-dashes>

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextView } from "gpui-base";
import { exec, theme, settings, props, closeOverlay, openOverlay, run, shared, setShared, checking, nextCommand, readTextFile } from "herdr";
import { gatherFacts, factsText, askClaude, chatDir } from "./chat.js";

const LAST = "my-speed.last";
const CHAT = "my-speed.chat";
const RUN = "my-speed.run"; // { log, at } while a test runs in the background
const RUN_MAX_MS = 180000; // a run with no exit line after this is treated as dead
const SIZE = { width: 820, height: 580 };
const CHAT_SIZE = { width: 820, height: 720 };
const MINI = 160 / 280; // compact gauge scale in chat
const GAUGE_W = 280;
const GAUGE_H = 150;
const HUB_X = 140;
const HUB_Y = 140;
const NEEDLE = 92;
const POLL_MS = 250;
const SLIDE = { duration: 240, easing: "ease-out" };
const LIVE_RE = /Downlink:\s*([\d.]+)\s*Mbps.*?Uplink:\s*([\d.]+)\s*Mbps/;

// The newest live reading in the log: lines end in \r (the tool redraws one line).
function lastReading(text) {
  const lines = (text ?? "").split(/[\r\n]+/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(LIVE_RE);
    if (m) return { down: Number(m[1]), up: Number(m[2]) };
  }
  return null;
}

function summary(text) {
  const num = (re) => { const m = (text ?? "").match(re); return m ? Number(m[1]) : null; };
  return {
    down: num(/Downlink capacity:\s*([\d.]+)\s*Mbps/),
    up: num(/Uplink capacity:\s*([\d.]+)\s*Mbps/),
    ping: num(/Idle Latency:\s*([\d.]+)\s*milli/),
  };
}

const shake = () => 0.98 + Math.random() * 0.04;

const TIERS = [
  { name: "Crawl", color: "#f7768e" },
  { name: "Slow", color: "#ff9e64" },
  { name: "Okay", color: "#e0af68" },
  { name: "Fast", color: "#9ece6a" },
  { name: "Blazing", color: "#7dcfff" },
];

// Upper bounds of the first four tiers, in Mbps; anything above the last is Blazing.
const BOUNDS = { down: [10, 25, 100, 500], up: [3, 10, 20, 100] };
const RANGES = {
  down: ["< 10", "10–25", "25–100", "100–500", "500+"],
  up: ["< 3", "3–10", "10–20", "20–100", "100+"],
};

const tierOf = (kind, mbps) => {
  const i = BOUNDS[kind].findIndex((b) => mbps < b);
  return i < 0 ? 4 : i;
};

// 1 Mbps sits at the left end, 1000 at the right; each x10 is a third of the arc.
const angleOf = (mbps) => {
  const t = Math.max(0, Math.min(1, Math.log10(Math.max(mbps, 1)) / 3));
  return Math.PI * (1 - t);
};

const fmt = (mbps) => (mbps >= 100 ? mbps.toFixed(0) : mbps.toFixed(1));

const clock = (ms) => {
  const d = new Date(ms);
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "AM" : "PM"}`;
};

export default class MySpeed extends View {
  init(p, cx) {
    this.chatMode = Boolean(p?.chat ?? props()?.chat);
    this.running = false;
    this.error = null;
    this.handle = cx.focus_handle();
    this.handle.focus();
    // The terminal takes the keyboard back right after the palette closes (my-urls retries the same way).
    for (const ms of [100, 300, 600]) cx.timer.after(ms, () => this.handle.focus());

    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "run") this.start(cx);
        if (c === "chat") this.openChat();
        // my-speed.ask-why-is-ping-high sends "why is ping high" (dashes are spaces)
        if (c.startsWith("ask-") && this.chatMode && this.input) { this.input.set_value(c.slice(4).replace(/-/g, " ")); this.send(cx); }
        cx.notify();
      }
    });

    if (this.chatMode) this.initChat(cx);
    // A test started earlier keeps running after the popup closes: pick its log back up.
    if (shared(RUN)) { this.running = true; this.live = { down: 0, up: 0, phase: "down" }; this.watch(cx); }
  }

  // ---- chat ----

  initChat(cx) {
    // The thread scrolls by hand (like my-prs): y is the offset in px; stick keeps it pinned to the newest message.
    this.y = 0; this.viewH = 0; this.contentH = 0; this.stick = true;
    this.input = InputState.new({ placeholder: "Ask anything about this result…" });
    this.input.on("change", (_e, cx) => cx.notify());
    this.input.on("submit", (_e, cx) => this.send(cx));
    this.input.focus();
    for (const ms of [100, 300, 600]) cx.timer.after(ms, () => this.input.focus());
    this.busy = false;

    const last = shared(LAST);
    if (!last) return;
    const saved = shared(CHAT);
    this.chat = saved && saved.at === last.at ? saved : { at: last.at, session: null, messages: [], facts: null };
    if (!this.chat.facts && !checking()) {
      cx.spawn(async (cx) => {
        const facts = await gatherFacts();
        if (this.chat?.at === last.at) { this.chat.facts = facts; this.saveChat(); }
        cx.notify();
      });
    }
    this.toBottom();
  }

  saveChat() {
    setShared(CHAT, { ...this.chat });
  }

  maxY() { return Math.max(0, this.contentH - this.viewH); }

  scrollTo(y) {
    this.y = Math.round(Math.min(Math.max(0, y), this.maxY()));
    this.stick = this.y >= this.maxY() - 2;
  }

  // Pin to the bottom; the content's next size change keeps it there.
  toBottom() { this.stick = true; this.y = this.maxY(); }

  // ctrl-d / ctrl-u: half the visible thread, like vim.
  scrollBy(dir) { this.scrollTo(this.y + dir * Math.max(40, this.viewH / 2)); }

  // Size changes from layout: stay on the bottom while stuck, else clamp.
  resized(cx) {
    const y = this.stick ? this.maxY() : Math.min(this.y, this.maxY());
    if (y !== this.y) { this.y = y; cx.notify(); }
  }

  // The popup can't resize itself: close and reopen at the other size.
  reopen(chat) {
    this.close();
    openOverlay({ mod: "my-speed", kind: "dialog", ...(chat ? CHAT_SIZE : SIZE), props: chat ? { chat: true } : {} });
  }

  openChat() {
    if (!shared(LAST) || this.running) return;
    this.reopen(true);
  }

  newChat() {
    if (!this.chat || this.busy) return;
    this.chat = { at: this.chat.at, session: null, messages: [], facts: this.chat.facts };
    this.saveChat();
    this.input.focus();
  }

  continueInTab() {
    if (!this.chat?.session) return;
    this.close();
    run("tab.new", { name: "Speed chat", folder: chatDir(), argv: ["claude", "--resume", this.chat.session] });
  }

  send(cx) {
    const text = this.input.value().trim();
    if (!text || this.busy || !this.chat) return;
    const last = shared(LAST);
    this.input.set_value("");
    this.chat.messages.push({ role: "you", text });
    this.busy = true;
    this.saveChat();
    this.toBottom();
    cx.notify();
    const first = !this.chat.session;
    const prompt = first ? `${factsText(last, this.chat.facts)}\n\nQuestion: ${text}` : text;
    cx.spawn(async (cx) => {
      try {
        const r = await askClaude(prompt, this.chat.session);
        this.chat.session = r.session;
        this.chat.messages.push({ role: "claude", text: r.text || "(no answer)" });
      } catch (e) {
        this.chat.messages.push({ role: "error", text: String(e?.message ?? e) });
      }
      this.busy = false;
      this.saveChat();
      this.toBottom();
      cx.notify();
    });
  }

  start(cx) {
    if (this.running || checking()) return;
    const log = `/tmp/herdr-my-speed-${Date.now()}.log`;
    this.running = true;
    this.error = null;
    this.live = { down: 0, up: 0, phase: "down" };
    setShared(RUN, { log, at: Date.now() });
    cx.notify();
    // Detached, so it outlives the popup; the exit line marks the end of the log.
    const sh = '( script -q /dev/null /usr/bin/networkQuality -s; echo "__EXIT=$?" ) > "$0" 2>&1 < /dev/null &';
    exec("/usr/bin/nohup", ["/bin/sh", "-c", sh, log], { timeout: 10000 }).catch(() => {});
    this.watch(cx);
  }

  // Polls the run's log: live readings while it runs, then the result.
  watch(cx) {
    cx.spawn(async (cx) => {
      while (this.running) {
        const run = shared(RUN);
        if (!run) { this.running = false; this.live = null; break; } // finished in another copy
        const text = (await readTextFile(run.log)) ?? "";
        const exit = text.match(/__EXIT=(\d+)/);
        if (exit || Date.now() - run.at > RUN_MAX_MS) {
          this.finish(run, text, exit ? Number(exit[1]) : null);
          break;
        }
        const now = lastReading(text);
        if (now) {
          const phase = now.up > 0 ? "up" : "down";
          this.live = {
            down: phase === "down" && now.down > 0 ? now.down * shake() : now.down,
            up: phase === "up" ? now.up * shake() : 0,
            shownDown: now.down,
            shownUp: now.up,
            phase,
          };
        }
        cx.notify();
        await cx.sleep(POLL_MS);
      }
      cx.notify();
    });
  }

  finish(run, text, code) {
    const sum = summary(text);
    const last = lastReading(text);
    const down = sum.down ?? last?.down;
    const up = sum.up ?? last?.up;
    if (code === 0 && down != null && up != null) {
      setShared(LAST, { down, up, ping: sum.ping != null ? Math.round(sum.ping) : null, iface: null, at: run.at });
    } else {
      const tail = text.replace(/__EXIT=\d+/, "").split(/[\r\n]+/).map((l) => l.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "").trim()).filter(Boolean).pop();
      this.error = code == null ? "The test stopped without a result" : tail || `networkQuality exited ${code}`;
    }
    setShared(RUN, null);
    exec("/bin/rm", ["-f", run.log]);
    this.running = false;
    this.live = null;
  }

  close() {
    closeOverlay(props().overlay);
  }

  key(e, cx) {
    const k = e.key;
    if (k === "escape") this.close();
    else if (this.chatMode) {
      if (e.keystroke === "ctrl-n") { if (!this.busy) this.newChat(); }
      else if (e.keystroke === "ctrl-d") this.scrollBy(1);
      else if (e.keystroke === "ctrl-u") this.scrollBy(-1);
      else if (e.keystroke === "ctrl-o") this.reopen(false);
      else if (e.keystroke === "ctrl-t") { if (this.chat?.session && !this.busy) this.continueInTab(); }
      else return false;
    }
    else if (k === "enter" || k === "r") this.start(cx);
    else if (k === "a") this.openChat();
    else return false;
    return true;
  }

  needle(kind, mbps, t, k = 1) {
    const a = angleOf(mbps);
    const dots = [];
    const d = k < 1 ? 3 : 4;
    for (let r = 0, i = 0; r <= NEEDLE; r += 2, i++) {
      const x = (HUB_X + r * Math.cos(a)) * k;
      const y = (HUB_Y - r * Math.sin(a)) * k;
      dots.push(div().id(`${kind}-n${i}`).absolute().left(x - d / 2).top(y - d / 2).size(d).rounded(d / 2).bg(t.foreground)
        .transition("left", SLIDE).transition("top", SLIDE));
    }
    return dots;
  }

  // A small gauge card for the chat view: dial left, number right.
  mini(kind, label, mbps, t, mono) {
    const tier = tierOf(kind, mbps);
    const w = GAUGE_W * MINI;
    const h = GAUGE_H * MINI;
    return h_flex().flex_1().min_w(0).items_center().gap(18).px(18).py(14).rounded(12).bg(t.surface).border_1().border_color(t.border)
      .child(div().relative().w(w).h(h).flex_none()
        .child(image(`mods/my-speed/gauge-${kind}.svg`).absolute().left(0).top(0).w(w).h(h))
        .children(this.needle(kind, mbps, t, MINI))
        .child(div().absolute().left(HUB_X * MINI - 5).top(HUB_Y * MINI - 5).size(10).rounded(5).bg(t.foreground)))
      .child(v_flex().gap(2)
        .child(div().text_size(11).font_semibold().text_color(t.muted).child(label))
        .child(h_flex().items_end().gap(6)
          .child(div().text_size(24).font_semibold().text_color(t.foreground).when(Boolean(mono), (el) => el.font_family(mono)).child(fmt(mbps)))
          .child(div().pb(4).text_size(12).text_color(t.muted).child("Mbps")))
        .child(div().text_size(13).font_semibold().text_color(TIERS[tier].color).child(TIERS[tier].name)));
  }

  renderChat(t, mono, last) {
    const kbd = (s) => div().px(6).py(1).rounded(4).border_1().border_color(t.input).text_size(11).text_color(t.foreground).child(s);
    const btn = (id, label, onClick, enabled = true) => h_flex().id(id).h(32).px(12).gap(8).items_center().rounded(7)
      .border_1().border_color(t.input).bg(t.raised).text_size(12.5).font_semibold()
      .text_color(enabled ? t.foreground : t.muted)
      .when(enabled, (el) => el.cursor_pointer().hover((s) => s.bg(t.hover)).on_click(onClick))
      .child(label);
    const spark = svg("mods/my-speed/spark.svg").size(14).text_color(t.ansi5);

    const header = h_flex().items_center().justify_between().px(24).pt(18).pb(14)
      .child(v_flex().gap(2)
        .child(div().text_size(16).font_semibold().text_color(t.foreground).child("Speed test"))
        .child(div().text_size(12).text_color(t.muted).child(last ? `Chat about the ${clock(last.at)} run` : "No result yet")))
      .child(h_flex().gap(10).items_center()
        .child(btn("chat-new", "New chat", () => this.newChat(), Boolean(this.chat?.messages.length) && !this.busy))
        .child(btn("chat-back", "← Result", () => this.reopen(false)))
        .child(h_flex().id("speed-esc").gap(6).items_center().px(6).py(4).rounded(5).cursor_pointer().hover((s) => s.bg(t.hover))
          .on_click(() => this.close())
          .child(kbd("esc")).child(div().text_size(12).text_color(t.muted).child("close"))));

    if (!last || !this.chat) {
      return v_flex().size_full().bg(t.popover).child(header)
        .child(div().p(24).text_color(t.muted).child("Run a speed test first, then ask about it."));
    }

    const gauges = h_flex().gap(16).px(24).flex_none()
      .child(this.mini("down", "DOWNLOAD", last.down, t, mono))
      .child(this.mini("up", "UPLOAD", last.up, t, mono));

    const msgs = this.chat.messages;
    const asked = msgs.filter((m) => m.role === "you").length;
    const panelHead = h_flex().items_center().gap(10).px(18).py(10).border_b_1().border_color(t.border)
      .child(spark)
      .child(div().text_size(11).font_semibold().text_color(t.ansi5).child("CLAUDE"))
      .child(div().text_size(11.5).text_color(t.muted).child(asked ? `${asked} question${asked > 1 ? "s" : ""}` : "new session"))
      .child(div().flex_1())
      .when(Boolean(this.chat.session) && !this.busy, (el) => el.child(
        div().id("chat-tab").text_size(12).text_color(t.accent).cursor_pointer().hover((s) => s.text_color(t.foreground))
          .on_click(() => this.continueInTab()).child("Continue in tab ↗")));

    let body;
    if (!msgs.length) {
      const f = this.chat.facts;
      const fact = (k, v) => h_flex().gap(6).text_size(12.5)
        .child(div().text_color(t.muted).child(k))
        .child(div().text_color(t.foreground).when(Boolean(mono), (el) => el.font_family(mono)).child(v));
      const ms = (v) => (v == null ? "—" : `${v} ms`);
      const card = v_flex().gap(6).px(16).py(12).rounded(10).bg(t.raised).border_1().border_color(t.border).min_w(420)
        .child(div().text_size(11).font_semibold().text_color(t.muted).child("CLAUDE WILL KNOW"))
        .child(h_flex().gap(14).child(fact("Speed", `${fmt(last.down)}↓ / ${fmt(last.up)}↑ Mbps`)).child(fact("idle ping", ms(last.ping))));
      if (!f) card.child(h_flex().gap(8).items_center().text_size(12.5).text_color(t.muted)
        .child(svg("mods/workspace-chrome/spinner.svg").size(12).text_color(t.muted).spin(900))
        .child(div().child("Checking Wi‑Fi and pinging your router…")));
      else {
        if (f.wifi) card.child(h_flex().gap(14)
          .child(fact("Wi‑Fi", [f.wifi.phy, f.wifi.channel].filter(Boolean).join(" · ") || "yes"))
          .when(f.wifi.rate != null, (el) => el.child(fact("link", `${f.wifi.rate} Mbps`))));
        else card.child(fact("Connection", f.kind ?? "unknown"));
        card.child(h_flex().gap(14).child(fact("Ping router", ms(f.gwPing))).child(fact("1.1.1.1", ms(f.netPing))));
      }
      body = v_flex().flex_1().min_h(0).items_center().justify_center().gap(14).p(20)
        .child(svg("mods/my-speed/spark.svg").size(26).text_color(t.ansi5))
        .child(div().text_size(15).font_semibold().text_color(t.foreground).child("Ask anything about this result"))
        .child(card);
    } else {
      const rows = msgs.map((m, i) => {
        if (m.role === "you") {
          return h_flex().w_full().justify_end().child(
            div().max_w(520).px(12).py(8).rounded(10).bg(t.raised).text_size(13).text_color(t.foreground).child(m.text));
        }
        if (m.role === "error") {
          return div().text_size(12.5).text_color(t.blocked).child(`Claude failed: ${m.text}`);
        }
        return div().w_full().text_size(13).text_color(t.foreground).child(TextView.markdown(`m-${i}`, m.text).selectable(true));
      });
      if (this.busy) rows.push(h_flex().gap(8).items_center().text_size(12).text_color(t.muted)
        .child(svg("mods/workspace-chrome/spinner.svg").size(12).text_color(t.ansi5).spin(900))
        .child(div().child(this.chat.session ? "Claude is thinking…" : "Starting a session…")));
      // Hand-scrolled frame (like my-prs): content sits at top -y, sizes come back from layout.
      const zoom = Number(settings()?.zoom) || 1;
      const thumb = this.contentH > this.viewH && this.viewH > 0
        ? div().absolute().right(3).w(4).rounded(2).bg(t.border)
          .top((this.y / this.contentH) * this.viewH).h(Math.max(24, (this.viewH / this.contentH) * this.viewH))
        : null;
      body = div().id("chat-frame").relative().flex_1().min_h(0).overflow_hidden()
        .on_scroll_wheel((e, cx) => { this.scrollTo(this.y - (e.delta?.y ?? 0) / zoom); cx.notify(); })
        .on_size_change((sz, cx) => { const h = sz.height / zoom; if (h !== this.viewH) { this.viewH = h; this.resized(cx); } })
        .child(v_flex().id("chat-thread").absolute().left(0).right(0).top(-this.y).px(18).py(16).gap(14)
          .on_size_change((sz, cx) => { const h = sz.height / zoom; if (h !== this.contentH) { this.contentH = h; this.resized(cx); } })
          .children(rows))
        .when(Boolean(thumb), (el) => el.child(thumb));
    }

    const canSend = !this.busy && this.input.value().trim().length > 0;
    const composer = h_flex().gap(10).items_center().px(12).py(10).border_t_1().border_color(t.border).bg(t.chrome)
      .child(h_flex().flex_1().h(36).px(12).items_center().rounded(8).border_1().border_color(t.accent).bg(t.background)
        .child(Input.new(this.input).flex_1().h_full().text_size(13).text_color(t.foreground)))
      .child(h_flex().id("chat-send").size(36).rounded(8).items_center().justify_center()
        .bg(canSend ? t.accent : t.raised).text_color(canSend ? t.accent_foreground : t.muted)
        .when(canSend, (el) => el.cursor_pointer().on_click((_e, cx) => this.send(cx)))
        .child(div().text_size(15).font_semibold().child("↑")));

    const panel = v_flex().flex_1().min_h(0).mx(24).mt(14).rounded(12).bg(t.surface).border_1().border_color(t.border).overflow_hidden()
      .child(panelHead).child(body).child(composer);

    return v_flex()
      .id("my-speed-chat")
      .track_focus(this.handle)
      .size_full()
      .bg(t.popover)
      .text_size(13)
      .on_key_down((e, cx) => {
        if (!this.key(e, cx)) return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(header)
      .child(gauges)
      .child(panel)
      .child(h_flex().justify_between().px(24).py(10).text_size(11.5).text_color(t.muted)
        .child(div().child("Claude has no tools here: it only sees the facts above."))
        .child(div().child("⏎ send · ^d/^u scroll · ^n new · ^t tab · ^o result · esc close")));
  }

  // mbps: the needle's value; shown: the number printed (live: unshaken); state: "live" | "wait" | null
  gauge(kind, label, mbps, t, mono, shown = mbps, state = null) {
    const has = typeof mbps === "number";
    const tier = has ? tierOf(kind, mbps) : -1;
    const ranges = RANGES[kind];

    const dial = div().relative().w(GAUGE_W).h(GAUGE_H).flex_none()
      .child(image(`mods/my-speed/gauge-${kind}.svg`).absolute().left(0).top(0).w(GAUGE_W).h(GAUGE_H))
      .when(has, (el) => el.children(this.needle(kind, mbps, t)))
      .child(div().absolute().left(HUB_X - 7).top(HUB_Y - 7).size(14).rounded(7).bg(t.foreground).border_2().border_color(t.raised));

    const value = state === "wait"
      ? div().h(40).flex().items_center().text_size(13).text_color(t.muted).child("Waiting for download…")
      : has
      ? h_flex().items_end().gap(6)
          .child(div().text_size(30).font_semibold().text_color(state === "live" ? t.accent : t.foreground).when(Boolean(mono), (el) => el.font_family(mono)).child(fmt(shown)))
          .child(div().pb(5).text_size(12).text_color(t.muted).child("Mbps"))
          .child(div().pb(5).pl(4).text_size(13).font_semibold().text_color(TIERS[tier].color).child(TIERS[tier].name))
      : div().h(40).flex().items_center().text_size(13).text_color(t.muted).child(this.running ? "Measuring…" : "No result yet");

    const legend = v_flex().w_full().gap(2).children(TIERS.map((tr, i) => {
      const on = i === tier;
      return h_flex().px(8).py(3).rounded(5).gap(10).items_center().text_size(12.5)
        .when(on, (el) => el.bg(t.hover))
        .child(div().size(10).rounded(3).flex_none().bg(tr.color))
        .child(div().flex_1().text_color(on ? t.foreground : t.muted).when(on, (el) => el.font_semibold()).child(tr.name))
        .child(div().text_color(on ? t.foreground : t.muted).when(Boolean(mono), (el) => el.font_family(mono)).child(ranges[i]));
    }));

    return v_flex().flex_1().min_w(0).items_center().gap(12).p(20).rounded(12).bg(t.surface).border_1().border_color(t.border)
      .child(dial)
      .child(v_flex().items_center().gap(2)
        .child(div().text_size(11).font_semibold().text_color(t.muted).child(label))
        .child(value))
      .child(legend);
  }

  render() {
    const t = theme();
    const mono = settings().font;
    const last = shared(LAST);
    const live = this.running ? this.live : null;
    if (this.chatMode) return this.renderChat(t, mono, last);

    const kbd = (s) => div().px(6).py(1).rounded(4).border_1().border_color(t.input).text_size(11).text_color(t.foreground).child(s);

    let status;
    if (this.running) {
      status = h_flex().gap(8).items_center()
        .child(svg("mods/workspace-chrome/spinner.svg").size(14).text_color(t.accent).spin(900))
        .child(div().text_color(t.foreground).child(live?.phase === "up" ? "Testing upload…" : "Testing download…"));
    } else if (this.error) {
      status = div().text_color(t.blocked).truncate().child(`Test failed: ${this.error}`);
    } else if (last) {
      const bits = [`Last run ${clock(last.at)}`];
      if (last.iface) bits.push(last.iface);
      if (last.ping != null) bits.push(`ping ${last.ping} ms`);
      status = div().text_color(t.muted).truncate().child(bits.join(" · "));
    } else {
      status = div().text_color(t.muted).child("Uses macOS networkQuality. Runs ~30 s and saturates your connection.");
    }

    const runBtn = h_flex().id("speed-run").px(12).py(6).gap(8).items_center().rounded(7)
      .when(this.running, (el) => el.bg(t.raised).text_color(t.muted))
      .when(!this.running, (el) => el.bg(t.solid).text_color(t.solid_foreground).cursor_pointer().hover((s) => s.opacity(0.9)))
      .on_click((_e, cx) => this.start(cx))
      .child(div().text_size(12.5).font_semibold().child(this.running ? "Running…" : last ? "Run again" : "Run test"))
      .when(!this.running, (el) => el.child(div().text_size(11).opacity(0.8).child("⏎")));

    const askBtn = h_flex().id("speed-ask").px(12).py(6).gap(8).items_center().rounded(7).border_1().border_color(t.input).bg(t.raised)
      .when(!last || this.running, (el) => el.text_color(t.muted))
      .when(Boolean(last) && !this.running, (el) => el.text_color(t.foreground).cursor_pointer().hover((s) => s.bg(t.hover)).on_click(() => this.openChat()))
      .child(svg("mods/my-speed/spark.svg").size(14).text_color(t.ansi5))
      .child(div().text_size(12.5).font_semibold().child("Ask Claude"))
      .child(div().text_size(11).text_color(t.muted).child("a"));

    return v_flex()
      .id("my-speed")
      .track_focus(this.handle)
      .size_full()
      .bg(t.popover)
      .text_size(13)
      .on_key_down((e, cx) => {
        if (!this.key(e, cx)) return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(
        h_flex().items_center().justify_between().px(24).pt(18).pb(14)
          .child(v_flex().gap(2)
            .child(div().text_size(16).font_semibold().text_color(t.foreground).child("Speed test"))
            .child(div().text_size(12).text_color(t.muted).child("Mbps, log scale · 1 → 1000")))
          .child(h_flex().gap(10).items_center()
            .child(askBtn)
            .child(runBtn)
            .child(h_flex().id("speed-esc").gap(6).items_center().px(6).py(4).rounded(5).cursor_pointer().hover((s) => s.bg(t.hover))
              .on_click(() => this.close())
              .child(kbd("esc")).child(div().text_size(12).text_color(t.muted).child("close")))),
      )
      .child(
        h_flex().flex_1().min_h(0).gap(16).px(24).items_start()
          .child(live
            ? this.gauge("down", "DOWNLOAD", live.down, t, mono, live.shownDown ?? live.down, live.phase === "down" ? "live" : null)
            : this.gauge("down", "DOWNLOAD", last?.down, t, mono))
          .child(live
            ? this.gauge("up", "UPLOAD", live.phase === "up" ? live.up : undefined, t, mono, live.shownUp ?? live.up, live.phase === "up" ? "live" : "wait")
            : this.gauge("up", "UPLOAD", last?.up, t, mono)),
      )
      .child(
        h_flex().items_center().justify_between().gap(16).px(24).py(12).mt(14).bg(t.chrome).border_t_1().border_color(t.border).text_size(12)
          .child(div().flex_1().min_w(0).child(status))
          .child(h_flex().flex_none().gap(4).text_color(t.muted)
            .child(div().child("FCC floor"))
            .child(div().text_color(t.foreground).when(Boolean(mono), (el) => el.font_family(mono)).child("100↓ / 20↑"))),
      );
  }
}
