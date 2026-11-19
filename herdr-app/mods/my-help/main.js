// Keybinds cheatsheet: ctrl-a ? (mod.open:my-help). Styled after the herdr TUI's help.
//
// Reads keys.json live through keys(), so a new binding shows up without touching this file.
// It lands in a group by GROUPS and gets a readable label from labels.json (LABELS); a binding with no label
// shows its command name behind a yellow "?". When keys.json changes, check labels.json and GROUPS.
//
// The leader is the first chord most multi-chord bindings share (ctrl-a); those keys show as
// "leader <key>" and the header says what the leader is. Bindings that differ only in their
// last key (ctrl-a h/j/k/l, cmd-1..9) fold into one chip; every key for one action shares a row.
// Rows whose action is in STOCK and that have no leader key (⌘c, ⌘q, ...) hide until `a`.
// CONFLICTS lists keys that shadow each other across sections, plain ctrl+letters programs
// need, and a key bound alone that also starts chords; their rows get a red "!".
//
// Keys, browsing: j/k scroll a row, d/u (or ctrl-d/ctrl-u) half a page, g/G top/bottom,
//   1-9 jump to a group, a show/hide stock keys, / search, esc or q close.
//   The scrollbar can be clicked and dragged.
// Keys, searching (all bindings; matches key, label or command; shows a flat list):
//   ↑/↓ or ctrl-j/ctrl-k move   enter run the highlighted binding   esc back to browsing
// From the CLI: herdr-app do my-help.key-j (any key, e.g. key-ctrl-d, key-shift-g, key-/, key-escape)
//
// A mod can show its own keys instead (my-prs ?): openOverlay({ mod: "my-help", kind: "dialog", props: { sheet } }) with
//   sheet = { title, subtitle, source, groups: [{ name, ansi, rows: [[keys, label], ...] }] }
// Those rows are display only: enter in search does nothing.

import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { keys, commands, run, props, closeOverlay, theme, settings, window as win, checking, nextCommand, readTextFile, appHome } from "herdr";

// Readable labels: mods/my-help/labels.json, by full action, then by command name (before ":").
// my-leader reads the same file (mods can't import across mod folders). Loaded in init.
let LABELS = {};

// First match wins; order is column order. `color` is a theme ansi index.
const GROUPS = [
  { name: "WORK", ansi: 3, re: /:my-(prs|tickets|drafts)$/ },
  { name: "PANES", ansi: 4, re: /^pane\.|close-pane/ },
  { name: "TABS", ansi: 2, re: /^tab\.(?!new:my-brain)/ },
  { name: "SPACES", ansi: 5, re: /^space\.|^my-spaces\./ },
  { name: "NAVIGATE", ansi: 6, re: /^agent\.|^my-agents\.|^mod\.open:(picker|my-urls)|^layout\.(toggle:sidebar|switch)/ },
  { name: "BRAIN", ansi: 3, re: /brain/ },
  { name: "TERMINAL", ansi: 7, re: /^terminal\.|^send:/ },
  { name: "APP", ansi: 1, re: /./ },
];

// Standard app keys (copy, quit, zoom...): hidden unless `a`, or the action also has a leader key.
const STOCK = new Set([
  "app.quit", "app.hide", "app.hide_others", "window.minimize", "app.help", "app.reset",
  "app.zoom_in", "app.zoom_out", "app.zoom_reset",
  "terminal.copy", "terminal.paste", "terminal.paste_image", "terminal.select_all",
]);

// send: rows other than the leader passthrough are readline plumbing (alt-left = word left).
const HIDDEN = (r) => r.key.startsWith("send:") && !r.leader;

// Plain ctrl+letters that shells and editors rely on (AGENTS.md "Keys").
const RISKY = {
  c: "interrupt", d: "EOF / exit", l: "clear screen", r: "history search", w: "delete word",
  a: "line start", e: "line end", u: "delete line", k: "kill to end", z: "suspend", "[": "escape",
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

// "tab.new" + {mod: "my-brain-chat"} -> "tab.new:my-brain-chat"; strings stay as they are.
function actionKey(a) {
  if (typeof a === "string") return a;
  const arg = a.args?.mod ?? a.args?.name ?? Object.values(a.args ?? {})[0];
  return arg != null && typeof arg !== "object" ? `${a.command}:${arg}` : a.command;
}

const labelled = (key) => Boolean(LABELS[key] || LABELS[key.split(":")[0]]);

function label(key) {
  if (LABELS[key]) return LABELS[key];
  const base = key.split(":")[0];
  if (LABELS[base]) return LABELS[base];
  if (key.startsWith("send:")) return "type " + JSON.stringify(key.slice(5));
  return key;
}

// One chord ("cmd-shift-]") -> { mods: "⌘⇧", key: "]" }.
function chord(c, mac) {
  const parts = c.split("-");
  let key = parts.pop();
  if (key === "" && parts[parts.length - 1] === "") { parts.pop(); key = "-"; } // "cmd--"
  const mods = parts.map((m) => (mac ? MAC[m] ?? m : m + "-")).join("");
  return { mods, key: NAMED[key] ?? key };
}

// A whole binding ("ctrl-a shift-c") -> { leader: true, chip: "⇧ c" }.
function display(keysStr, leader, mac, section) {
  let chords = keysStr.trim().split(/\s+/);
  const isLeader = section === LEADER_SECTION || (leader != null && chords.length > 1 && chords[0] === leader);
  if (isLeader && section !== LEADER_SECTION) chords = chords.slice(1);
  return { leader: isLeader, chip: chords.map((c) => { const p = chord(c, mac); return [p.mods, p.key].filter(Boolean).join(" "); }).join(" ") };
}

// "1 2 3 … 9" -> "1–9"
function foldDigits(list) {
  const nums = list.map(Number);
  const run = nums.every((n, i) => Number.isInteger(n) && (i === 0 || n === nums[i - 1] + 1));
  return run && list.length > 2 ? `${list[0]}–${list[list.length - 1]}` : list.join(" ");
}

// Leader keys live in keys.json's "mod:leader" section as single keys ("x"), run by the
// my-leader popup that the leader chord (global "ctrl-a": "mod.open:my-leader") opens.
// No such section: fall back to the first chord most multi-chord bindings share.
const LEADER_SECTION = "mod:leader";
const OPENER = "mod.open:my-leader";

function leaderOf(all) {
  const opener = all.find((k) => k.section === "global" && actionKey(parseAction(k.action)) === OPENER);
  if (opener) return opener.keys.trim();
  const count = {};
  for (const b of all) {
    const chords = b.keys.trim().split(/\s+/);
    if (chords.length > 1) count[chords[0]] = (count[chords[0]] ?? 0) + 1;
  }
  return Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function findConflicts(all, leader, mac) {
  const out = [];
  const bad = new Set();
  const id = (k) => (k.section === LEADER_SECTION ? `${leader} ${k.keys}` : k.keys);
  const flag = (k, reason) => { bad.add(id(k)); out.push({ ...display(k.keys, leader, mac, k.section), reason }); };

  // The same keys doing different things in different sections: the more specific one wins.
  const byKeys = new Map();
  for (const k of all) byKeys.set(id(k), [...(byKeys.get(id(k)) ?? []), k]);
  for (const [, list] of byKeys) {
    const acts = new Set(list.map((k) => actionKey(parseAction(k.action))));
    if (list.length > 1 && acts.size > 1) {
      bad.add(id(list[0]));
      out.push({ ...display(list[0].keys, leader, mac, list[0].section), reason: list.map((k) => `${k.section}: ${label(actionKey(parseAction(k.action)))}`).join(" vs ") });
    }
  }
  const firsts = new Set(all.map((k) => k.keys.trim().split(/\s+/)).filter((c) => c.length > 1).map((c) => c[0]));
  for (const k of all) {
    const chords = k.keys.trim().split(/\s+/);
    // Leader keys are pressed inside the popup, never seen by programs; the leader is chosen.
    if (chords.length !== 1 || k.section === LEADER_SECTION || k.keys.trim() === leader) continue;
    const m = /^ctrl-(.)$/.exec(chords[0]);
    if (m && RISKY[m[1]]) flag(k, `programs use ctrl-${m[1]} (${RISKY[m[1]]})`);
    if (firsts.has(chords[0])) flag(k, `bound alone but also starts chords`);
  }
  return { conflicts: out, bad, id };
}

// A mod's own sheet in the shape build() returns.
function sheetData(sheet) {
  const groups = (sheet.groups ?? []).map((g) => ({ name: g.name, ansi: g.ansi ?? 7,
    rows: (g.rows ?? []).map(([k, label]) => ({ chips: [{ chip: k, leader: false }], label, mkey: "", raw: [k], action: null, hasLeader: false, stock: false, unlabeled: false, conflict: false })) }));
  return { leader: null, mac: true, groups, conflicts: [], entries: groups.flatMap((g) => g.rows), sheet };
}

function build() {
  const mac = (win()?.platform ?? (globalThis.process?.platform === "win32" ? "windows" : "macos")) === "macos";
  const all = keys();
  const leader = leaderOf(all);
  const { conflicts, bad, id: rawId } = findConflicts(all, leader, mac);

  // 1. Fold bindings that differ only in their last key into one chip.
  const rows = new Map();
  for (const k of all) {
    const action = parseAction(k.action);
    const key = actionKey(action);
    if (key === OPENER) continue; // the header shows the leader
    let chords = k.keys.trim().split(/\s+/);
    const inSection = k.section === LEADER_SECTION;
    const isLeader = inSection || (leader != null && chords.length > 1 && chords[0] === leader);
    if (isLeader && !inSection) chords = chords.slice(1);
    const head = chords.slice(0, -1).map((c) => { const p = chord(c, mac); return p.mods + p.key; });
    const last = chord(chords[chords.length - 1], mac);
    const base = key.split(":")[0];
    const id = [k.section, isLeader, head.join(" "), last.mods, base, LABELS[key] ? key : ""].join("|");
    let r = rows.get(id);
    if (!r) {
      r = { leader: isLeader, pre: [...head, last.mods].filter(Boolean).join(" "), keys: [], action, key, raw: [] };
      rows.set(id, r);
    }
    if (!r.keys.includes(last.key)) r.keys.push(last.key);
    r.raw.push(rawId(k));
  }

  // 2. Every chip for one action shares a row.
  const entries = new Map();
  for (const r of [...rows.values()].filter((r) => !HIDDEN(r))) {
    const mkey = r.keys.length > 1 && !LABELS[r.key] ? r.key.split(":")[0] : r.key;
    let e = entries.get(mkey);
    if (!e) {
      e = { mkey, label: label(mkey), unlabeled: !labelled(mkey), action: r.action, chips: [], raw: [] };
      entries.set(mkey, e);
    }
    e.chips.push({ leader: r.leader, chip: [r.pre, foldDigits(r.keys)].filter(Boolean).join(" ") });
    e.raw.push(...r.raw);
  }
  const list = [...entries.values()];
  for (const e of list) {
    e.chips.sort((a, b) => Number(b.leader) - Number(a.leader));
    e.hasLeader = e.chips.some((c) => c.leader);
    e.stock = !e.hasLeader && (STOCK.has(e.mkey) || STOCK.has(e.mkey.split(":")[0]));
    e.conflict = e.raw.some((k) => bad.has(k));
  }

  const groups = GROUPS.map((g) => ({ ...g, rows: [] }));
  for (const e of list) groups.find((g) => g.re.test(e.mkey)).rows.push(e);
  for (const g of groups) g.rows.sort((a, b) => Number(b.hasLeader) - Number(a.hasLeader));
  return { leader, mac, conflicts, groups: groups.filter((g) => g.rows.length), entries: list };
}

// Greedy: each group goes to the shorter column.
function columns(groups, n) {
  const cols = Array.from({ length: n }, () => []);
  const h = cols.map(() => 0);
  for (const g of groups) {
    const i = h.indexOf(Math.min(...h));
    cols[i].push(g);
    h[i] += g.rows.length + 2;
  }
  return cols;
}

// Body height: mod.json's dialog height (660) minus header 44, search 40, footer 34, borders.
const VIEW = 540;
const PAD = 18;
const ROW = 26; // browsing row
const HEAD = 22; // group title
const GAP = 22; // between groups
const FROW = 36; // search row (34 + 2 gap)
const KEYW = 232; // browsing key column
const TRACK = VIEW - 8;

export default class MyHelp extends View {
  init(_props, cx) {
    cx.spawn(async (cx) => {
      try { LABELS = JSON.parse((await readTextFile(`${appHome()}/mods/my-help/labels.json`)) ?? "{}"); } catch { LABELS = {}; }
      cx.notify();
    });
    this.filter = "";
    this.at = 0;
    this.scroll = 0;
    this.searching = false;
    this.showAll = false;
    this.drag = null;
    this.handle = cx.focus_handle();
    this.input = InputState.new({ placeholder: "press / to search by command or shortcut" });
    this.input.on("change", (_e, cx) => { this.filter = this.input.value(); this.at = 0; this.scroll = 0; cx.notify(); });
    this.input.on("submit", (_e, cx) => this.exec(this.matches()[this.at]));
    this.input.on("focus", (_e, cx) => { if (!this.searching) { this.searching = true; this.scroll = 0; cx.notify(); } });
    this.handle.focus();
    if (checking()) return;
    // The terminal takes the keyboard back right after the chord (same retry as my-urls).
    for (const ms of [100, 300, 600]) cx.timer.after(ms, () => (this.searching ? this.input : this.handle).focus());
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (!c.startsWith("key-")) continue;
        const rest = c.slice(4);
        const parts = rest === "-" ? [] : rest.split("-");
        const key = rest === "-" ? "-" : parts.pop();
        if (key === "enter" && this.searching) this.exec(this.matches()[this.at]);
        else if (this.searching && !parts.length && key.length === 1 && key !== "/") {
          this.input.set_value(this.filter + key); this.filter += key; this.at = 0;
        } else this.key({ key, modifiers: { control: parts.includes("ctrl"), shift: parts.includes("shift") } });
        cx.notify();
      }
    });
  }

  close() {
    closeOverlay(props().overlay);
  }

  matches() {
    const f = this.filter.trim().toLowerCase();
    if (!f) return [];
    const { entries, leader } = this.data;
    return entries.filter((e) =>
      [e.label, e.mkey, ...e.chips.map((c) => (c.leader ? "leader " : "") + c.chip), ...e.raw, e.hasLeader ? leader : ""]
        .some((s) => s && s.toLowerCase().includes(f)),
    );
  }

  // Runs the row's binding. send: rows type into a terminal; nothing to run here.
  exec(e) {
    if (!e?.action) return;
    const a = e.action;
    if (typeof a === "string" && a.startsWith("send:")) return;
    this.close();
    if (typeof a === "object") return run(a.command, a.args ?? {});
    const i = a.indexOf(":");
    if (i < 0) return run(a);
    const name = a.slice(0, i);
    const first = commands().find((c) => c.name === name)?.args?.[0]?.name;
    run(name, first ? { [first]: a.slice(i + 1) } : {});
  }

  browse() {
    this.searching = false;
    this.input.set_value("");
    this.filter = "";
    this.at = 0;
    this.scroll = 0;
    this.handle.focus();
  }

  key(e) {
    const k = e.key;
    const ctrl = Boolean(e.modifiers?.control);
    const shift = Boolean(e.modifiers?.shift);
    if (this.searching) {
      const n = this.matches().length;
      if (k === "escape") this.browse();
      else if (k === "down" || (ctrl && (k === "j" || k === "n"))) this.at = n ? (this.at + 1) % n : 0;
      else if (k === "up" || (ctrl && (k === "k" || k === "p"))) this.at = n ? (this.at + n - 1) % n : 0;
      else return false;
      return true;
    }
    if (k === "escape" || k === "q") this.close();
    else if (k === "/") { this.searching = true; this.scroll = 0; this.input.focus(); }
    else if (k === "j" || k === "down") this.scroll += ROW;
    else if (k === "k" || k === "up") this.scroll -= ROW;
    else if (k === "d") this.scroll += VIEW / 2;
    else if (k === "u") this.scroll -= VIEW / 2;
    else if (k === "G" || (k === "g" && shift)) this.scroll = Infinity;
    else if (k === "g") this.scroll = 0;
    else if (k === "a") { this.showAll = !this.showAll; this.scroll = 0; }
    else if (/^[1-9]$/.test(k) && this.jumps?.[Number(k) - 1] != null) this.scroll = this.jumps[Number(k) - 1];
    else return false;
    return true;
  }

  render() {
    const t = theme();
    const color = (i) => t[`ansi${i}`] ?? t.accent;
    const mono = settings().font;
    const sheet = props()?.sheet;
    this.data = sheet ? sheetData(sheet) : build();
    const { leader, mac, groups, conflicts, entries } = this.data;
    const leaderName = leader ? (() => { const c = chord(leader, false); return c.mods + c.key; })() : null;
    const warn = t.ansi3 ?? t.accent;
    const danger = t.blocked ?? t.ansi1 ?? t.accent;

    const kbd = (text) =>
      div().flex_none().px(6).rounded(4).border_1().border_b_2().border_color(t.border).bg(t.raised)
        .text_size(12).text_color(t.foreground).child(text);
    const chipEl = (c) =>
      h_flex().flex_none().gap(5).items_center()
        .when(c.leader, (el) => el.child(div().text_size(11).font_medium().text_color(t.accent).child("leader")))
        .child(kbd(c.chip));
    const chips = (list, w) => h_flex().w(w).flex_none().gap(8).items_center().overflow_hidden().children(list.map(chipEl));
    const mark = (e) =>
      e.conflict ? div().w(10).flex_none().font_bold().text_color(danger).child("!")
        : e.unlabeled ? div().w(10).flex_none().font_bold().text_color(warn).child("?")
          : div().w(10).flex_none();
    const labelEl = (e, c) => div().flex_1().min_w(0).truncate().text_color(e.unlabeled ? t.dim : c).when(e.unlabeled, (d) => d.italic()).child(e.label);

    const filtering = this.searching && Boolean(this.filter.trim());
    const matches = this.matches();
    const hiddenCount = entries.filter((e) => e.stock).length;
    const unlabeled = entries.filter((e) => e.unlabeled).length;
    let content;
    let total;
    this.jumps = [];
    if (!filtering) {
      const shown = groups.map((g) => ({ ...g, rows: g.rows.filter((e) => this.showAll || !e.stock) })).filter((g) => g.rows.length);
      const cH = conflicts.length ? HEAD + conflicts.length * ROW + GAP : 0;
      const cols = columns(shown, 2);
      // Each group's y in the content, for 1-9 jumps (numbered in column order).
      let n = 0;
      const numbered = cols.map((col) => {
        let y = PAD + cH;
        return col.map((g, i) => {
          if (i) y += GAP;
          this.jumps.push(y - PAD);
          const out = { ...g, n: ++n };
          y += HEAD + g.rows.length * ROW;
          return out;
        });
      });
      total = PAD * 2 + cH + Math.max(0, ...cols.map((col) => col.reduce((h, g, i) => h + (i ? GAP : 0) + HEAD + g.rows.length * ROW, 0)));
      const groupEl = (g) =>
        v_flex()
          .child(h_flex().h(HEAD).gap(8).items_start().text_size(11)
            .child(div().text_color(t.dim).child(String(g.n)))
            .child(div().font_bold().text_color(color(g.ansi)).child(g.name)))
          .children(g.rows.map((e) =>
            h_flex().h(ROW).flex_none().gap(10).items_center().text_size(12.5)
              .child(chips(e.chips, KEYW))
              .child(mark(e))
              .child(labelEl(e, t.muted)),
          ));
      content = v_flex().px(22).py(PAD)
        .when(conflicts.length > 0, (el) => el.child(
          v_flex().mb(GAP)
            .child(div().h(HEAD).text_size(11).font_bold().text_color(danger).child(`CONFLICTS (${conflicts.length})`))
            .children(conflicts.map((c) =>
              h_flex().h(ROW).flex_none().gap(10).items_center().text_size(12.5)
                .child(chips([c], KEYW))
                .child(div().w(10).flex_none().font_bold().text_color(danger).child("!"))
                .child(div().flex_1().min_w(0).overflow_hidden().text_color(danger).child(c.reason)),
            )),
        ))
        .child(h_flex().items_start().gap(32).children(
          numbered.map((col) => v_flex().flex_1().min_w(0).gap(GAP).children(col.map(groupEl))),
        ));
    } else if (!matches.length) {
      total = 0;
      content = div().pt(26).text_center().text_color(t.dim).child("no matching keybinds");
    } else {
      this.at = Math.min(this.at, matches.length - 1);
      total = 20 + matches.length * FROW;
      // Keep the highlighted row in view.
      const top = 10 + this.at * FROW;
      if (top < this.scroll) this.scroll = top - 10;
      if (top + FROW > this.scroll + VIEW) this.scroll = top + FROW - VIEW + 10;
      content = v_flex().gap(2).px(10).py(10).children(
        matches.map((e, i) => {
          const on = i === this.at;
          return h_flex().id(`kb-${i}`).h(FROW - 2).flex_none().px(12).gap(12).rounded(6).items_center().text_size(13).cursor_pointer()
            .when(on, (el) => el.bg(t.selected ?? t.hover))
            .hover((s) => s.bg(t.hover))
            .on_click(() => this.exec(e))
            .child(div().w(14).font_bold().text_color(t.accent).child(on ? "›" : ""))
            .child(chips(e.chips, 300))
            .child(mark(e))
            .child(labelEl(e, t.foreground))
            .child(div().flex_none().text_size(11.5).text_color(t.dim).child(e.mkey));
        }),
      );
    }
    const maxScroll = Math.max(0, total - VIEW);
    this.scroll = Math.max(0, Math.min(this.scroll, maxScroll));
    // Scrollbar thumb: its length is the visible share, its top the scroll position.
    const thumb = maxScroll ? Math.max(32, Math.round((VIEW * VIEW) / total)) : 0;
    const thumbTop = maxScroll ? Math.round((this.scroll / maxScroll) * (TRACK - thumb)) : 0;
    this.maxScroll = maxScroll;
    this.thumb = thumb;

    const hint = (k, what) => h_flex().gap(6).child(div().text_color(t.foreground).child(k)).child(what);
    const stat = (text, c) => div().text_size(11.5).text_color(c).child(text);

    return v_flex()
      .id("my-help")
      .track_focus(this.handle)
      .size_full()
      .min_h(0)
      .bg(t.popover)
      .when(Boolean(mono), (el) => el.font_family(mono))
      .on_key_down((e, cx) => {
        if (!this.key(e)) return;
        cx.stop_propagation();
        cx.notify();
      })
      .on_mouse_move((e, cx) => {
        if (!this.drag) return;
        const per = this.maxScroll / Math.max(1, TRACK - this.thumb);
        this.scroll = this.drag.scroll + (e.position.y - this.drag.y) * per;
        cx.notify();
      })
      .on_mouse_up("left", () => { this.drag = null; })
      .child(
        h_flex().h(44).flex_none().px(18).items_center().justify_between().border_b(1).border_color(t.border)
          .child(h_flex().gap(12).items_center()
            .child(div().text_size(13).font_bold().text_color(t.accent).child(sheet?.title ?? "KEYBINDS"))
            .child(div().text_size(12).text_color(t.dim).child(sheet ? (sheet.subtitle ?? "") : "herdr"))
            .when(!this.showAll && hiddenCount > 0, (el) => el.child(stat(`${hiddenCount} stock hidden`, t.dim)))
            .when(unlabeled > 0, (el) => el.child(stat(`? ${unlabeled} unlabeled`, warn)))
            .when(conflicts.length > 0, (el) => el.child(stat(`! ${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"}`, danger))))
          .when(Boolean(leaderName), (el) => el.child(
            h_flex().gap(8).items_center().text_size(12).text_color(t.dim)
              .child(div().font_bold().text_color(t.accent).child("leader"))
              .child("=")
              .child(div().px(8).py(2).rounded(4).bg(t.accent).text_color(t.accent_foreground).font_bold().child(leaderName)),
          )),
      )
      .child(
        h_flex().h(40).flex_none().px(18).gap(10).items_center().border_b(1)
          .border_color(this.searching ? t.accent : t.border)
          .when(this.searching, (el) => el.bg(t.raised))
          .child(div().text_size(13).font_bold().text_color(t.accent).child("/"))
          .child(Input.new(this.input).flex_1().h_full().text_size(13).text_color(t.foreground))
          .when(filtering, (el) => el.child(div().text_size(11.5).text_color(t.dim).child(`${matches.length} match${matches.length === 1 ? "" : "es"}`))),
      )
      .child(
        div().id("kb-body").h(VIEW).flex_none().relative().overflow_hidden()
          .on_scroll_wheel((e, cx) => {
            this.scroll = Math.max(0, Math.min(this.scroll - (e.delta?.y ?? 0), maxScroll));
            cx.notify();
          })
          .child(div().absolute().left(0).right(0).top(-this.scroll).child(content))
          .when(maxScroll > 0, (el) => el.child(
            // Click to jump there, drag to scroll.
            div().id("kb-track").absolute().top(4).right(0).w(14).h(TRACK).cursor_pointer()
              .on_mouse_down("left", (e, cx) => {
                const ly = e.local_position?.y;
                if (ly != null) this.scroll = Math.max(0, Math.min(((ly - thumb / 2) / Math.max(1, TRACK - thumb)) * maxScroll, maxScroll));
                this.drag = { y: e.position.y, scroll: this.scroll };
                cx.stop_propagation();
                cx.notify();
              })
              .child(div().absolute().top(0).bottom(0).right(4).w(6).rounded(3).bg(t.border))
              .child(div().absolute().top(thumbTop).right(4).w(6).h(thumb).rounded(3).bg(this.drag ? t.foreground : t.muted)),
          )),
      )
      .child(
        h_flex().h(34).flex_none().px(18).gap(18).items_center().border_t(1).border_color(t.border).bg(t.background)
          .text_size(11.5).text_color(t.dim)
          .children(this.searching
            ? [hint("↑ ↓", "move"), ...(sheet ? [] : [hint("⏎", "run")]), hint("esc", "back")]
            : [hint("j k", "scroll"), hint("d u", "half page"), hint("g G", "top/end"), hint("1–9", "group"),
               ...(sheet ? [] : [hint("a", this.showAll ? "hide stock" : "show all")]), hint("/", "search"), hint("esc", "close")])
          .child(div().flex_1())
          .child(sheet ? (sheet.source ?? "") : mac ? "keys.json" : "keys.windows.json"),
      );
  }
}
