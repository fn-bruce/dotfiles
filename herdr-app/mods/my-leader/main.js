// Leader mode: the leader chord (keys.json global "ctrl-a": "mod.open:my-leader") opens this as
// an invisible 1x1 popup that only catches the next key. While it is open, shared "leader" is
// true and my-status shows a small LEADER badge in the status bar (like tmux's prefix marker).
//
// The next key is looked up in keys.json's "mod:leader" section (single keys: "x", "|",
// "shift-c", "ctrl-a") and run here, then the popup closes. No mod is named "leader", so the
// app itself never runs that section: this popup is the only thing that does, exactly once.
// esc, a key with no binding, or a click elsewhere just closes it. ctrl-a ? opens the cheatsheet.
//
// send:<text> actions (ctrl-a ctrl-a sends a literal ctrl-a) are pressed into the focused
// terminal with `hc keys`, which types keys without the Enter that `hc send` adds.
//
// From the CLI: herdr-app do my-leader.key-x (key-shift-c, key-ctrl-a, key-escape, ...)

import { View, div } from "gpui-kit";
import { keys, commands, run, props, closeOverlay, focused, hc, notify, checking, nextCommand, shared, setShared } from "herdr";

const SECTION = "mod:leader";
const OPENER = "mod.open:my-leader";
const MODIFIER_KEYS = new Set(["shift", "control", "ctrl", "alt", "option", "cmd", "platform", "function", "fn", "super"]);

function parseAction(a) {
  if (a && typeof a === "object") return a;
  if (typeof a === "string" && a.startsWith("{")) {
    try { return JSON.parse(a); } catch { /* plain string */ }
  }
  return a;
}

function actionKey(a) {
  if (typeof a === "string") return a;
  const arg = a.args?.mod ?? a.args?.name ?? Object.values(a.args ?? {})[0];
  return arg != null && typeof arg !== "object" ? `${a.command}:${arg}` : a.command;
}

// "\u0001" -> ["ctrl+a"]; "\u001bb" -> ["alt+b"]; other characters press as themselves.
function sendKeys(text) {
  const out = [];
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 27 && i + 1 < text.length) { out.push(`alt+${text[++i]}`); continue; }
    if (c === 13) out.push("enter");
    else if (c === 9) out.push("tab");
    else if (c === 27) out.push("esc");
    else if (c === 127) out.push("backspace");
    else if (c < 32) out.push(`ctrl+${String.fromCharCode(c + 96)}`);
    else out.push(text[i]);
  }
  return out;
}

export default class MyLeader extends View {
  init(_props, cx) {
    this.done = false;
    // The sidebar mod (my-agents, my-spaces) that had the keyboard when the chord was pressed,
    // read now because this popup takes the keyboard from it.
    this.sidebar = shared("sidebar") || null;
    this.handle = cx.focus_handle();
    this.handle.focus();
    if (checking()) return;
    setShared("leader", true);
    // The terminal can take the keyboard back right after the chord (as in my-urls).
    for (const ms of [50, 150, 400]) cx.timer.after(ms, () => { if (!this.done) this.handle.focus(); });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (!c.startsWith("key-")) continue;
        const rest = c.slice(4);
        const parts = rest === "-" ? [] : rest.split("-");
        const key = rest === "-" ? "-" : parts.pop();
        this.press({ key, keystroke: rest, key_char: parts.length ? undefined : key, modifiers: {} }, cx);
      }
    });
  }

  bindings() {
    return keys().filter((k) => k.section === SECTION);
  }

  // The binding for this key event: the chord as GPUI spells it ("shift-c"), else the
  // character it types ("|" for shift-\, "?" for shift-/).
  find(e) {
    const list = this.bindings();
    const tries = [e.keystroke, e.key_char, e.key].filter(Boolean);
    for (const t of tries) {
      const hit = list.find((k) => k.keys.trim() === t);
      if (hit) return hit;
    }
    return null;
  }

  dismiss() {
    if (this.done) return;
    this.done = true;
    setShared("leader", false);
    closeOverlay(props().overlay);
  }

  // Lifecycle hook: runs however the overlay goes (dismiss above, the app's Esc, quit), so the
  // status bar badge never sticks.
  async close() {
    if (!checking()) setShared("leader", false);
  }

  press(e, cx) {
    if (this.done) return true;
    if (MODIFIER_KEYS.has(e.key)) return false;
    if (e.key === "escape") { this.dismiss(); return true; }
    const hit = this.find(e);
    this.dismiss();
    if (hit) this.exec(parseAction(hit.action), cx);
    return true;
  }

  // pane.go:right while a sidebar holds the keyboard: the app still counts the last terminal
  // pane as focused, so pane.go would start there and skip it. Hand the keyboard back to that
  // pane the way the sidebar's own l/Escape does.
  sidebarBack(a) {
    if (!this.sidebar) return false;
    const dir = typeof a === "string" ? (a === "pane.go:right" ? "right" : null) : a.command === "pane.go" ? a.args?.direction : null;
    if (dir !== "right") return false;
    run(`${this.sidebar}.back`);
    return true;
  }

  exec(a, cx) {
    if (this.sidebarBack(a)) return;
    if (typeof a === "object") return run(a.command, a.args ?? {});
    if (a.startsWith("send:")) {
      const f = focused();
      const terminal = f?.shown ?? f?.terminal;
      if (!terminal) return;
      cx.spawn(async () => {
        const r = await hc(["keys", terminal, ...sendKeys(a.slice(5))]);
        if (r.code !== 0) notify({ title: "Leader: couldn't send keys", body: (r.stderr || r.stdout).trim(), level: "error" });
      });
      return;
    }
    const i = a.indexOf(":");
    if (i < 0) return run(a);
    const name = a.slice(0, i);
    const first = commands().find((c) => c.name === name)?.args?.[0]?.name;
    run(name, first ? { [first]: a.slice(i + 1) } : {});
  }

  render() {
    return div()
      .id("my-leader")
      .track_focus(this.handle)
      .size_full()
      .on_key_down((e, cx) => {
        if (this.press(e, cx)) cx.stop_propagation();
      })
      .on_mouse_down_out(() => this.dismiss());
  }
}
