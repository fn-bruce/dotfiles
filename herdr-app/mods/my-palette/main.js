// Command palette that also lists mods: leader : (mod.open:my-palette).
//
// The built-in palette (app.palette) only knows app commands; mods can't add to it. This one
// lists, in order:
//   Recent    the last picks (shared("my-palette.recent"), persisted)
//   Mods      every mod whose mod.json has a "title" and an "overlay" (opened with mod.open),
//             found by listing mods/ on open, so a new popup mod shows up by itself
//   Keys      every keys.json action (global + leader), labelled from my-help/labels.json
//   App       every app command from commands() that needs no argument
//   Built-in palette…  falls back to app.palette for anything missing here
// Each row shows its key (leader keys as "leader x"). Typing filters all rows, fzf style.
//
// Keys: ↑/↓ or ctrl-j/ctrl-k move   enter run   esc close
// From the CLI: herdr-app do mod.open '{"name":"my-palette"}'; herdr-app do my-palette.key-ctrl-j

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { exec, keys, commands, run, props, closeOverlay, theme, settings, shared, setShared, checking, nextCommand, readTextFile, appHome, window as win } from "herdr";

const ROW = 34;
const LIST_MAX = 420;
const RECENT = "my-palette.recent";
const RECENT_MAX = 5;
const SELF = new Set(["my-palette", "my-leader"]);
const LEADER_SECTION = "mod:leader";

const KIND = {
  recent: { name: "recent", ansi: 8 },
  mod: { name: "mod", ansi: 6 },
  key: { name: "key", ansi: 4 },
  app: { name: "app", ansi: 5 },
};

const MAC = { cmd: "⌘", alt: "⌥", shift: "⇧", ctrl: "⌃" };
const NAMED = { left: "←", right: "→", up: "↑", down: "↓", enter: "⏎", backspace: "⌫", tab: "⇥", escape: "esc", space: "space" };

function parseAction(a) {
  if (a && typeof a === "object") return a;
  if (typeof a === "string" && a.startsWith("{")) {
    try { return JSON.parse(a); } catch { /* plain string */ }
  }
  return a;
}

// Same keying as my-help: "tab.new" + {mod: "my-brain-chat"} -> "tab.new:my-brain-chat".
function actionKey(a) {
  if (typeof a === "string") return a;
  const arg = a.args?.mod ?? a.args?.name ?? Object.values(a.args ?? {})[0];
  return arg != null && typeof arg !== "object" ? `${a.command}:${arg}` : a.command;
}

function chord(c, mac) {
  const parts = c.split("-");
  let key = parts.pop();
  if (key === "" && parts[parts.length - 1] === "") { parts.pop(); key = "-"; }
  const mods = parts.map((m) => (mac ? MAC[m] ?? m : m + "-")).join("");
  return [mods, NAMED[key] ?? key].filter(Boolean).join(mac ? "" : "");
}

// "tab.new" -> "Tab: new", "app.zoom_in" -> "App: zoom in"
function humanize(name) {
  const [area, ...rest] = name.split(".");
  const what = rest.join(" ").replace(/[_-]/g, " ");
  return `${area[0].toUpperCase()}${area.slice(1)}: ${what}`;
}

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// fzf-style subsequence; a plain substring ranks first, earlier is better.
function score(term, s) {
  const lq = term.toLowerCase();
  const ls = s.toLowerCase();
  const at = ls.indexOf(lq);
  if (at >= 0) return at === 0 || ls[at - 1] === " " ? at : 50 + at;
  let j = 0;
  let first = -1;
  let last = -1;
  for (let i = 0; i < ls.length && j < lq.length; i++) {
    if (ls[i] === lq[j]) { if (first < 0) first = i; last = i; j++; }
  }
  return j < lq.length ? null : 200 + (last - first);
}

export default class MyPalette extends View {
  init(_props, cx) {
    this.filter = "";
    this.at = 0;
    this.scroll = 0;
    this.labels = {};
    this.mods = [];

    this.handle = cx.focus_handle();
    this.input = InputState.new({ placeholder: "Run a command or open a mod…" });
    this.input.on("change", (_e, cx) => { this.filter = this.input.value(); this.at = 0; this.scroll = 0; cx.notify(); });
    this.input.on("submit", (_e, cx) => this.pick(this.rows()[this.at]));
    this.input.focus();
    // The terminal takes the keyboard back right after the leader popup closes (my-urls does the same).
    for (const ms of [100, 300, 600]) cx.timer.after(ms, () => this.input.focus());

    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c.startsWith("key-")) {
          const parts = c.slice(4).split("-");
          const key = parts.pop();
          this.key({ key, modifiers: { control: parts.includes("ctrl") } }, true);
          cx.notify();
        }
      }
    });

    cx.spawn(async (cx) => {
      await this.load(() => cx.notify());
      cx.notify();
    });
  }

  // Labels first (cheap, and they make the list readable), then the mods scan.
  async load(drawn) {
    const home = appHome();
    try {
      this.labels = JSON.parse((await readTextFile(`${home}/mods/my-help/labels.json`)) ?? "{}");
    } catch { this.labels = {}; }
    drawn();
    if (checking()) return;
    try {
      const r = await exec("/bin/ls", ["-1", `${home}/mods`]);
      const names = r.stdout.split("\n").map((s) => s.trim()).filter((n) => n && !SELF.has(n));
      const found = [];
      for (const name of names) {
        try {
          const j = JSON.parse((await readTextFile(`${home}/mods/${name}/mod.json`)) ?? "null");
          if (j?.title && j?.overlay) found.push({ name, title: j.title });
        } catch { /* no or bad mod.json */ }
      }
      // A cloned my-x replaces the shipped x it came from.
      // My own mods first.
      this.mods = found
        .filter((m) => !found.some((o) => o.name === `my-${m.name}`))
        .sort((a, b) => Number(!a.name.startsWith("my-")) - Number(!b.name.startsWith("my-")));
    } catch { this.mods = []; }
  }

  label(key) {
    return this.labels[key] ?? this.labels[key.split(":")[0]] ?? null;
  }

  // Every runnable row, before filtering.
  all() {
    const mac = (win()?.platform ?? "macos") === "macos";
    const chips = new Map();
    const bound = [];
    // Leader bindings first: they are the ones set up by hand.
    const ks = keys().filter((k) => k.section === LEADER_SECTION).concat(keys().filter((k) => k.section === "global"));
    for (const k of ks) {
      const a = parseAction(k.action);
      if (typeof a === "string" && a.startsWith("send:")) continue;
      const id = actionKey(a);
      if (/:\d+$/.test(id)) continue; // tab.select:1..9 and friends: one row each is noise
      const chip = k.section === LEADER_SECTION
        ? `leader ${k.keys.split(/\s+/).map((c) => chord(c, mac)).join(" ")}`
        : k.keys.split(/\s+/).map((c) => chord(c, mac)).join(" ");
      if (!chips.has(id)) { chips.set(id, chip); bound.push({ id, action: a }); }
      else if (k.section === LEADER_SECTION) chips.set(id, chip); // the leader key reads best
    }

    const rows = [];
    const seen = new Set();
    const add = (r) => { if (seen.has(r.id)) return; seen.add(r.id); rows.push({ ...r, chip: chips.get(r.id) ?? null }); };

    for (const m of this.mods) {
      add({ id: `mod.open:${m.name}`, kind: "mod", title: m.title, hint: m.name, action: { command: "mod.open", args: { name: m.name } } });
    }
    for (const b of bound) {
      if (b.id === "mod.open:my-palette" || b.id === "mod.open:my-leader") continue;
      const l = this.label(b.id);
      add({ id: b.id, kind: "key", title: l ? cap(l) : b.id, hint: b.id, action: b.action });
    }
    for (const c of commands()) {
      if (c.args.some((a) => a.required)) continue;
      const l = this.labels[c.name];
      add({ id: c.name, kind: "app", title: l ? cap(l) : humanize(c.name), hint: c.name, about: c.about, action: c.name });
    }
    add({ id: "app.palette", kind: "app", title: "Built-in palette…", hint: "app.palette", action: "app.palette" });
    return rows;
  }

  rows() {
    const all = this.all();
    const terms = this.filter.trim().split(/\s+/).filter(Boolean);
    if (!terms.length) {
      const recent = (shared(RECENT) ?? [])
        .map((id) => all.find((r) => r.id === id))
        .filter(Boolean)
        .map((r) => ({ ...r, kind: "recent" }));
      const ids = new Set(recent.map((r) => r.id));
      return [...recent, ...all.filter((r) => !ids.has(r.id))];
    }
    const out = [];
    all.forEach((r, i) => {
      let total = 0;
      for (const t of terms) {
        const s = score(t, r.title);
        const h = score(t, r.hint);
        const best = s == null ? (h == null ? null : h + 100) : s;
        if (best == null) return;
        total += best;
      }
      out.push({ r, total, i });
    });
    out.sort((a, b) => a.total - b.total || a.i - b.i);
    return out.map((o) => o.r);
  }

  close() {
    closeOverlay(props().overlay);
  }

  pick(r) {
    if (!r) return;
    const recent = [r.id, ...(shared(RECENT) ?? []).filter((id) => id !== r.id)].slice(0, RECENT_MAX);
    setShared(RECENT, recent);
    this.close();
    const a = r.action;
    if (typeof a === "object") return run(a.command, a.args ?? {});
    const i = a.indexOf(":");
    if (i < 0) return run(a);
    const name = a.slice(0, i);
    const first = commands().find((c) => c.name === name)?.args?.[0]?.name;
    run(name, first ? { [first]: a.slice(i + 1) } : {});
  }

  // Enter reaches here only from the CLI: the input's submit handles the real key.
  key(e, fromCli) {
    const k = e.key;
    const ctrl = Boolean(e.modifiers?.control);
    const n = this.rows().length;
    if (k === "escape") this.close();
    else if (k === "down" || (ctrl && (k === "j" || k === "n"))) this.at = n ? (this.at + 1) % n : 0;
    else if (k === "up" || (ctrl && (k === "k" || k === "p"))) this.at = n ? (this.at + n - 1) % n : 0;
    else if (k === "enter" && fromCli) this.pick(this.rows()[this.at]);
    else return false;
    return true;
  }

  render() {
    const t = theme();
    const mono = settings().font;
    const rows = this.rows();
    this.at = Math.max(0, Math.min(this.at, rows.length - 1));

    const total = rows.length * ROW;
    const height = Math.min(LIST_MAX, total);
    const maxScroll = Math.max(0, total - height);
    this.scroll = Math.max(0, Math.min(this.scroll, maxScroll));
    const top = this.at * ROW;
    if (top < this.scroll) this.scroll = top;
    if (top + ROW > this.scroll + height) this.scroll = top + ROW - height;
    const visible = (i) => i * ROW + ROW > this.scroll && i * ROW < this.scroll + height;

    const row = (r, i) => {
      const on = i === this.at;
      const kind = KIND[r.kind];
      return h_flex()
        .id(`row-${r.kind}-${r.id}`)
        .absolute().left(4).right(4).top(i * ROW - this.scroll)
        .h(ROW).px(10).gap(10).rounded(7).items_center().cursor_pointer()
        .when(on, (el) => el.bg(t.hover))
        .hover((s) => s.bg(t.hover))
        .on_click(() => this.pick(r))
        .child(div().w(46).flex_none().text_size(10.5).font_semibold().text_color(t[`ansi${kind.ansi}`]).child(kind.name.toUpperCase()))
        .child(div().flex_none().text_size(13).text_color(t.foreground).when(on, (el) => el.font_semibold()).child(r.title))
        .child(div().flex_1().min_w(0).truncate().text_size(11.5).text_color(t.dim).when(Boolean(mono), (el) => el.font_family(mono)).child(r.kind === "mod" || r.title === r.hint ? "" : r.hint))
        .when(Boolean(r.chip), (el) => el.child(div().flex_none().px(6).py(1).rounded(5).border_1().border_color(t.border).text_size(11).text_color(t.muted).child(r.chip)));
    };

    const sel = rows[this.at];
    const body = rows.length === 0
      ? v_flex().items_center().py(28).child(div().text_size(13).text_color(t.muted).child("Nothing matches"))
      : div().id("palette-list").relative().h(height).overflow_hidden()
          .on_scroll_wheel((e, cx) => {
            this.scroll = Math.max(0, Math.min(this.scroll - (e.delta?.y ?? 0), maxScroll));
            while (this.at < rows.length - 1 && this.at * ROW < this.scroll) this.at++;
            while (this.at > 0 && this.at * ROW + ROW > this.scroll + height) this.at--;
            cx.notify();
          })
          .children(rows.map((r, i) => (visible(i) ? row(r, i) : null)).filter(Boolean));

    return v_flex()
      .id("my-palette")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      .p(14)
      .gap(10)
      .bg(t.popover)
      .text_size(13)
      .on_key_down((e, cx) => {
        if (!this.key(e, false)) return;
        cx.stop_propagation();
        cx.notify();
      })
      .child(
        h_flex().h(38).flex_none().px(12).gap(8).items_center().rounded(9).border_1().border_color(t.accent).bg(t.background)
          .child(div().text_size(14).text_color(t.accent).child("›"))
          .child(Input.new(this.input).flex_1().h_full().text_size(13).text_color(t.foreground)),
      )
      .child(body)
      .child(
        h_flex().items_center().gap(12).px(6).text_size(11).text_color(t.dim)
          .child(div().flex_1().min_w(0).truncate().child(sel?.about ? sel.about : `${rows.length} entries`))
          .child(div().flex_none().child("↑↓ move · ⏎ run · esc close")),
      );
  }
}
