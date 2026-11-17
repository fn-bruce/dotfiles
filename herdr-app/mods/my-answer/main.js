// Answer pane: free-recall answers in the "X because Y, so Z" skeleton, sent back to an
// agent's terminal.
//
// Open:  herdr-app do pane.split --direction right --mod my-answer \
//          --props '{"file":"/abs/path/answer.json","reply":"t6"}'
// file:  { "title": "...", "prompt": "markdown", "passage"?: "quoted text",
//          "mode"?: "xyz" | "free" }      (default "xyz")
// reply: terminal address that receives the answer (via `hc send`).
// The file is watched: rewrite it to ask the next question; the boxes clear.
//
// Keys: Cmd+Enter sends from any box. Enter is a new line (answers are prose).
import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextareaState, Textarea, TextView } from "gpui-base";
import { props, theme, readTextFile, watchFolder, exec, checking, nextCommand } from "herdr";

const dirOf = (p) => p.replace(/\/[^/]*$/, "") || "/";

const FIELDS = {
  xyz: [
    { key: "x", label: "X — claim", hint: "What is true?" },
    { key: "y", label: "Y — reason", hint: "because…" },
    { key: "z", label: "Z — consequence", hint: "so…" },
  ],
  free: [{ key: "a", label: "Answer", hint: "In your own words…" }],
};

export default class Answer extends View {
  init(_props, cx) {
    this.raw = null;
    this.task = null;
    this.error = null;
    this.sent = false;
    this.sending = false;
    this.handle = cx.focus_handle();
    this.boxes = {};
    for (const f of [...FIELDS.xyz, ...FIELDS.free]) {
      const s = TextareaState.new({ placeholder: f.hint });
      s.set_auto_grow(3, 12);
      this.prev = this.prev ?? {};
      this.prev[f.key] = "";
      s.on("change", (_e, cx) => {
        // Enter moves to the next box, or sends from the last one. The textarea has
        // already typed the newline: spot a one-character change that added a "\n"
        // (a paste adds more than one character, so it keeps its line breaks) and remove it.
        const before = this.prev[f.key];
        const v = s.value();
        this.prev[f.key] = v;
        const typedNewline = v.length === before.length + 1 && v.split("\n").length > before.split("\n").length;
        if (typedNewline) {
          let i = 0;
          while (i < before.length && v[i] === before[i]) i++;
          const cleaned = v.slice(0, i) + v.slice(i + 1);
          this.prev[f.key] = cleaned;
          s.set_value(cleaned);
          if (f.key === this.lastKey()) this.submit(cx);
          else this.move(1, cx);
        }
        cx.notify();
      });
      // A textarea keeps plain Enter as a new line; its submit event carries the modifiers.
      s.on("submit", (e, cx) => { if (e?.secondary) this.submit(cx); });
      s.on("focus", () => { this.current = f.key; });
      s.on("blur", () => { if (this.current === f.key) this.current = null; });
      this.boxes[f.key] = s;
    }
    const file = props()?.file;
    if (!file) { this.error = "No `file` prop."; return; }
    if (checking()) return;
    cx.spawn(async (cx) => {
      await this.load(file, cx);
      for (;;) {
        await watchFolder(dirOf(file));
        await this.load(file, cx);
      }
    });
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") { this.focusStart(); cx.notify(); }
      }
    });
  }

  lastKey() {
    const f = this.fields();
    return f[f.length - 1].key;
  }

  fields() {
    return FIELDS[this.task?.mode === "free" ? "free" : "xyz"];
  }

  // With nothing to answer, focus the pane itself so ctrl-a h/j/k/l still works.
  focusStart() {
    if (this.task && !this.sent) this.boxes[this.fields()[0].key].focus();
    else this.handle.focus();
  }

  async load(file, cx) {
    const raw = await readTextFile(file);
    if (raw === this.raw) return;
    this.raw = raw;
    if (raw == null) { this.task = null; this.error = `Waiting for ${file}`; cx.notify(); return; }
    try {
      const t = JSON.parse(raw);
      if (!t.prompt) throw new Error("no prompt");
      this.task = t;
      this.error = null;
      this.sent = false;
      for (const [k, s] of Object.entries(this.boxes)) { s.set_value(""); this.prev[k] = ""; }
      this.focusStart();
    } catch (e) {
      this.error = `Bad answer file: ${e.message}`;
    }
    cx.notify();
  }

  values() {
    return this.fields().map((f) => ({ ...f, text: this.boxes[f.key].value().trim() }));
  }

  ready() {
    const v = this.values();
    return this.task?.mode === "free" ? v[0].text.length > 0 : v.every((f) => f.text.length > 0);
  }

  submit(cx) {
    if (!this.task || this.sent || this.sending || !this.ready()) return;
    const reply = props()?.reply;
    const lines = [`[answer] ${this.task.title ?? "Answer"}`];
    for (const f of this.values()) lines.push(this.task.mode === "free" ? f.text : `${f.label}: ${f.text}`);
    const msg = lines.join("\n");
    this.sending = true;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        if (reply) await exec("hc", ["send", reply, msg], { timeout: 600000 });
        this.sent = true;
        this.handle.focus();
      } catch (e) {
        this.error = `Send failed: ${e.message ?? e}`;
      }
      this.sending = false;
      cx.notify();
    });
  }

  // Tab / Shift+Tab move between boxes. If the textarea already typed a tab character,
  // strip it back out.
  move(step, cx) {
    const keys = this.fields().map((f) => f.key);
    const i = keys.indexOf(this.current);
    if (i < 0) return false;
    const box = this.boxes[keys[i]];
    const v = box.value();
    if (v.includes("\t")) box.set_value(v.replace(/\t/g, ""));
    const next = keys[(i + step + keys.length) % keys.length];
    this.boxes[next].focus();
    cx.notify();
    return true;
  }

  key(e, cx) {
    const k = e.keystroke;
    if (k === "cmd-enter") { this.submit(cx); cx.stop_propagation(); }
    else if (k === "tab" && this.move(1, cx)) cx.stop_propagation();
    else if (k === "shift-tab" && this.move(-1, cx)) cx.stop_propagation();
  }

  render() {
    const t = theme();
    const root = v_flex().id("answer").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .size_full().bg(t.background).text_color(t.foreground).text_size(13.5).p(18).gap(12)
      .overflow_y_scrollbar();
    if (!this.task) return root.child(div().text_color(t.muted).child(this.error ?? "Loading…"));

    const header = div().text_size(15).font_semibold().child(this.task.title ?? "Answer");
    if (this.sent) {
      return root.child(header).child(div().text_color(t.muted)
        .child("Sent. Waiting for Claude — the next question appears here."));
    }

    const ready = this.ready();
    const box = (f) => v_flex().gap(5)
      .child(div().text_size(11.5).font_semibold().text_color(t.accent).child(f.label))
      .child(Textarea.new(this.boxes[f.key]).w_full().p(10).rounded(9).border_1().border_color(t.input)
        .bg(t.surface).text_size(13.5).text_color(t.foreground));

    return root
      .child(header)
      .when(Boolean(this.task.passage), (el) => el.child(
        div().border_l_2().border_color(t.accent).pl(12).text_color(t.muted)
          .child(TextView.markdown("passage", this.task.passage))))
      .child(TextView.markdown("prompt", this.task.prompt))
      .children(this.fields().map(box))
      .when(Boolean(this.error), (el) => el.child(div().text_color(t.blocked).text_size(12).child(this.error)))
      .child(h_flex().gap(8).items_center()
        .child(div().flex_1().text_size(11.5).text_color(t.dim)
          .child(props()?.reply ? "Enter / Tab: next box · Enter in the last box: send · Shift+Tab: back" : "No reply terminal: answer not sent."))
        .child(h_flex().id("send").h(32).px(14).items_center().rounded(8)
          .border_1().border_color(t.solid).bg(t.solid).text_color(t.solid_foreground)
          .text_size(12.5).font_medium().opacity(ready && !this.sending ? 1 : 0.45)
          .when(ready, (el) => el.cursor_pointer().hover((s) => s.opacity(0.88)))
          .on_click((_e, cx) => this.submit(cx))
          .child(this.sending ? "Sending…" : "Send  ⌘↵")));
  }
}
