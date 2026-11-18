// URL picker: ctrl-a u (mod.open:my-urls) lists every http(s) URL on the focused terminal
// pane's screen, newest first, fuzzy filtered, and opens the pick in the default browser.
//
// The text comes from herdr-core: `hc read <terminal> --lines 0` (the visible screen only,
// like tmux-urlview's capture-pane); mods have no direct read of a terminal's text. History
// is skipped on purpose: the first history read of an agent pane takes ~4 s while the core
// stitches it, the screen ~20 ms. Repeats collapse with a count; each row says how many
// lines up its newest mention sits. Nothing is written anywhere, so there is no y/n row.
//
// Keys: the filter input owns plain letters, so actions ride ctrl:
//   ↑/↓ or ctrl-j/ctrl-k move   enter open   ctrl-y copy   esc close
// From the CLI: herdr-app do mod.open --name my-urls; herdr-app do my-urls.key-ctrl-j

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { hc, theme, settings, props, closeOverlay, focused, panes, checking, nextCommand } from "herdr";

const ROW = 34;
const LIST_MAX = 360;
const SHOW_MAX = 78;
const URL_RE = /https?:\/\/[^\s<>"'`]+/g;

const lastLine = (s) => (s ?? "").trim().split("\n").filter(Boolean).pop() ?? "";
const count = (s, ch) => s.split(ch).length - 1;

// Prose puts punctuation after a link, and a ")" or "]" that closes a bracket opened
// before the URL is not part of it (one opened inside it is).
function clean(u) {
  for (;;) {
    const before = u;
    u = u.replace(/[.,;:!?'"]+$/, "");
    if (u.endsWith(")") && count(u, "(") < count(u, ")")) u = u.slice(0, -1);
    if (u.endsWith("]") && count(u, "[") < count(u, "]")) u = u.slice(0, -1);
    if (u === before) return u;
  }
}

// Newest first: walk the lines from the bottom. Each URL keeps its lowest mention.
function extract(text) {
  const lines = text.split("\n");
  const seen = new Map();
  for (let i = lines.length - 1; i >= 0; i--) {
    for (const m of lines[i].match(URL_RE) ?? []) {
      const url = clean(m);
      if (!/^https?:\/\/[^/]+/.test(url)) continue;
      const hit = seen.get(url);
      if (hit) hit.count++;
      else seen.set(url, { url, count: 1, up: lines.length - 1 - i });
    }
  }
  return [...seen.values()];
}

// fzf-style: every char of the term in order. Tighter spans rank first.
function fuzzy(term, s) {
  const lq = term.toLowerCase();
  const ls = s.toLowerCase();
  const hits = [];
  let j = 0;
  for (let i = 0; i < ls.length && j < lq.length; i++) if (ls[i] === lq[j]) { hits.push(i); j++; }
  if (j < lq.length) return null;
  return { hits, span: hits[hits.length - 1] - hits[0] };
}

// Runs of one color: host bright, path muted, matched letters in accent.
function segs(url, hits, t) {
  const set = new Set(hits);
  const hostEnd = url.indexOf("/", url.indexOf("//") + 2);
  const out = [];
  for (let i = 0; i < url.length; i++) {
    const hit = set.has(i);
    const color = hit ? t.accent : hostEnd < 0 || i < hostEnd ? t.foreground : t.muted;
    const last = out[out.length - 1];
    if (last && last.color === color && last.hit === hit) last.text += url[i];
    else out.push({ text: url[i], color, hit });
  }
  return out;
}

export default class MyUrls extends View {
  init(_props, cx) {
    this.acx = cx;
    this.filter = "";
    this.at = 0;
    this.scroll = 0;
    this.urls = [];
    this.state = "loading"; // loading | ready | mod | none | error
    this.error = null;

    const f = focused();
    const ps = panes();
    const pane = ps.find((p) => p.pane === f?.pane) ?? ps.find((p) => p.focused);
    this.terminal = f?.shown ?? f?.terminal ?? pane?.terminal ?? null;
    this.paneTitle = pane?.title ?? "this pane";
    this.paneMod = pane?.mod ?? null;

    this.handle = cx.focus_handle();
    this.input = InputState.new({ placeholder: "Filter URLs…" });
    this.input.on("change", (_e, cx) => { this.filter = this.input.value(); this.at = 0; cx.notify(); });
    this.input.on("submit", (_e, cx) => this.open(this.rows()[this.at], cx));
    this.input.focus();
    // The terminal takes the keyboard back right after the key chord (the shipped
    // picker and confirm retry the same way).
    for (const ms of [100, 300, 600]) cx.timer.after(ms, () => this.input.focus());

    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        // "key-<keystroke>" drives the picker from the command line, e.g. my-urls.key-ctrl-j
        if (c.startsWith("key-")) {
          const parts = c.slice(4).split("-");
          const key = parts.pop();
          this.key({ key, modifiers: { control: parts.includes("ctrl") } }, cx, true);
          cx.notify();
        }
      }
    });

    if (checking()) { this.state = "none"; return; }
    if (!this.terminal) { this.state = this.paneMod ? "mod" : "none"; return; }
    cx.spawn(async (cx) => { await this.load(); cx.notify(); });
  }

  async load() {
    try {
      this.urls = extract(await this.read());
      this.state = "ready";
    } catch (e) {
      this.error = String(e?.message ?? e);
      this.state = "error";
    }
  }

  async read() {
    const r = await hc(["read", this.terminal, "--lines", "0", "--json"]);
    if (r.code !== 0) throw new Error(lastLine(r.stderr) || `hc read exited ${r.code}`);
    try {
      return JSON.parse(r.stdout).text ?? "";
    } catch {
      return r.stdout;
    }
  }

  close() {
    closeOverlay(props().overlay);
  }

  // Every term of the filter must match as a subsequence; matched letters light up.
  rows() {
    const terms = this.filter.trim().split(/\s+/).filter(Boolean);
    const out = [];
    this.urls.forEach((u, i) => {
      let hits = [];
      let span = 0;
      for (const term of terms) {
        const m = fuzzy(term, u.url);
        if (!m) return;
        hits = hits.concat(m.hits);
        span += m.span;
      }
      out.push({ ...u, i, hits, span });
    });
    if (terms.length) out.sort((a, b) => a.span - b.span || a.i - b.i);
    return out;
  }

  open(r, cx) {
    if (!r) return;
    this.close();
    cx.open_url(r.url);
  }

  copy(r, cx) {
    if (!r) return;
    cx.write_to_clipboard(r.url);
    this.close();
  }

  // Enter reaches here only from the CLI: the input's submit handles the real key, and
  // handling both would open the URL twice.
  key(e, cx, fromCli) {
    const k = e.key;
    const ctrl = Boolean(e.modifiers?.control);
    const rows = this.rows();
    const n = rows.length;
    if (k === "escape") this.close();
    else if (k === "down" || (ctrl && (k === "j" || k === "n"))) this.at = n ? (this.at + 1) % n : 0;
    else if (k === "up" || (ctrl && (k === "k" || k === "p"))) this.at = n ? (this.at + n - 1) % n : 0;
    else if (ctrl && k === "y") this.copy(rows[this.at], cx);
    else if (k === "enter" && fromCli) this.open(rows[this.at], cx);
    else return false;
    return true;
  }

  render() {
    const t = theme();
    const mono = settings().font;
    const rows = this.rows();
    this.at = Math.max(0, Math.min(this.at, rows.length - 1));

    // A fixed strip of rows, scrolled only as far as keeping the selected row in view takes.
    const total = rows.length * ROW;
    const height = Math.min(LIST_MAX, total);
    const fixed = total > height;
    const maxScroll = Math.max(0, total - height);
    this.scroll = Math.max(0, Math.min(this.scroll, maxScroll));
    const top = this.at * ROW;
    if (top < this.scroll) this.scroll = top;
    if (top + ROW > this.scroll + height) this.scroll = top + ROW - height;
    const visible = (i) => !fixed || (i * ROW + ROW > this.scroll && i * ROW < this.scroll + height);

    const row = (r, i) => {
      const on = i === this.at;
      const shown = r.url.length > SHOW_MAX ? r.url.slice(0, SHOW_MAX - 1) + "…" : r.url;
      const el = h_flex()
        .id(`url-${r.i}`)
        .mx(4)
        .px(10)
        .h(ROW)
        .rounded(7)
        .gap(10)
        .items_center()
        .cursor_pointer()
        .when(on, (el) => el.bg(t.hover))
        .hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => this.open(r, cx))
        .child(h_flex().w(14).flex_none().justify_center().text_size(11).text_color(t.dim).child(String(i + 1)))
        .child(
          h_flex().flex_1().min_w(0).overflow_hidden().text_size(12.5)
            .when(Boolean(mono), (el) => el.font_family(mono))
            .children(segs(shown, r.hits, t).map((s) => div().flex_none().text_color(s.color).when(s.hit, (d) => d.font_semibold()).child(s.text))),
        )
        .when(r.count > 1, (el) => el.child(div().flex_none().px(6).py(1).rounded(5).bg(t.raised).text_size(11).text_color(t.muted).child(`×${r.count}`)))
        .child(div().flex_none().text_size(11).text_color(t.dim).child(r.up === 0 ? "last line" : `${r.up} up`));
      return fixed ? el.absolute().left(0).right(0).top(i * ROW - this.scroll) : el;
    };

    const note = (title, detail, color) =>
      v_flex().items_center().gap(6).px(10).pt(26).pb(22).text_center()
        .child(div().text_size(14).font_semibold().text_color(color ?? t.foreground).child(title))
        .when(Boolean(detail), (el) => el.child(div().max_w(440).text_size(12).text_color(t.dim).child(detail)));
    const notTerminal = "Only terminal panes have text to read. Move to one with ctrl-a h/j/k/l and press ctrl-a u again.";

    let body;
    if (this.state === "loading") body = note(`Reading ${this.paneTitle}…`);
    else if (this.state === "mod") body = note(`The focused pane is ${this.paneMod}, not a terminal`, notTerminal);
    else if (this.state === "none") body = note("No terminal pane is focused", notTerminal);
    else if (this.state === "error") body = note("Couldn't read the pane", this.error, t.blocked);
    else if (this.urls.length === 0)
      body = note("No URLs on screen", `Nothing on ${this.paneTitle}'s screen starts with http:// or https://.`);
    else if (rows.length === 0) body = note("Nothing matches the filter");
    else
      body = v_flex()
        .id("url-list")
        .h(height)
        .min_h(0)
        .when(fixed, (el) =>
          el.overflow_hidden().on_scroll_wheel((e, cx) => {
            this.scroll = Math.max(0, Math.min(this.scroll - (e.delta?.y ?? 0), maxScroll));
            // The selection follows the wheel, so the next frame doesn't scroll back to it.
            while (this.at < rows.length - 1 && this.at * ROW < this.scroll) this.at++;
            while (this.at > 0 && this.at * ROW + ROW > this.scroll + height) this.at--;
            cx.notify();
          }))
        .children(rows.map((r, i) => (visible(i) ? row(r, i) : null)).filter(Boolean));

    let countLabel = "";
    if (this.state === "ready") {
      const n = this.urls.length;
      if (rows.length !== n) countLabel = `${rows.length} of ${n}`;
      else countLabel = `${n} on screen${n ? " · newest first" : ""}`;
    }

    return v_flex()
      .id("my-urls")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      .p(18)
      .gap(10)
      .bg(t.popover)
      .text_size(13)
      .on_key_down((e, cx) => {
        if (!this.key(e, cx, false)) return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(
        h_flex().items_center().gap(10)
          .child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child("Open URL"))
          .child(div().text_size(11).text_color(t.dim).child(countLabel))
          .child(div().id("urls-esc").px(6).py(2).rounded(5).text_size(11).text_color(t.dim).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click(() => this.close()).child("Esc")),
      )
      .child(
        h_flex().h(36).flex_none().px(10).gap(8).items_center().rounded(9).border_1().border_color(t.accent).bg(t.background)
          .child(svg("mods/workspace-chrome/search.svg").size(15).text_color(t.dim))
          .child(Input.new(this.input).flex_1().h_full().text_size(12.8).text_color(t.foreground)),
      )
      .child(body)
      .child(
        h_flex().justify_end().gap(14).pt(6).border_t(1).border_color(t.border).text_size(11).text_color(t.dim)
          .child("↑↓ ctrl-j/k move")
          .child("⏎ open")
          .child("ctrl-y copy")
          .child("esc close"),
      );
  }
}
