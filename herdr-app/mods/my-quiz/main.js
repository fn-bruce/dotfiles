// Quiz pane: shows questions from a JSON file, sends answers back to an agent's terminal.
//
// Open:  herdr-app do pane.split --direction right --mod my-quiz \
//          --props '{"file":"/abs/path/quiz.json","reply":"t6"}'
// file:  { "title": "...", "questions": [ { "id": "q1", "prompt": "markdown",
//          "passage"?: "quoted text", "choices"?: ["a", "b"] } ] }
// reply: terminal address that receives each answer (via `hc send`).
// The file is watched: rewrite it to push new questions; the pane resets to question 1.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, InputState, Input, TextView } from "gpui-base";
import { props, theme, readTextFile, watchFolder, exec, checking, nextCommand } from "herdr";

const dirOf = (p) => p.replace(/\/[^/]*$/, "") || "/";

export default class Quiz extends View {
  init(_props, cx) {
    this.raw = null;
    this.quiz = null;
    this.error = null;
    this.index = 0;
    this.choice = null;
    this.sending = false;
    this.sent = [];
    this.handle = cx.focus_handle();
    // One-line input: Enter fires "submit" (a textarea swallows Enter as a new line).
    this.answer = InputState.new({ placeholder: "Your answer… (Enter to send)" });
    this.answer.on("change", (_e, cx) => cx.notify());
    this.answer.on("submit", (_e, cx) => this.submit(cx));
    this.whyFocused = false;
    this.answer.on("focus", (_e, cx) => { this.whyFocused = true; cx.notify(); });
    this.answer.on("blur", (_e, cx) => { this.whyFocused = false; cx.notify(); });
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

  async load(file, cx) {
    const raw = await readTextFile(file);
    if (raw === this.raw) return;
    this.raw = raw;
    if (raw == null) { this.quiz = null; this.error = `Waiting for ${file}`; cx.notify(); return; }
    try {
      const q = JSON.parse(raw);
      if (!Array.isArray(q.questions) || q.questions.length === 0) throw new Error("no questions");
      this.quiz = q;
      this.error = null;
      this.index = 0;
      this.choice = null;
      this.sent = [];
      this.answer.set_value("");
      this.focusStart();
    } catch (e) {
      this.error = `Bad quiz file: ${e.message}`;
    }
    cx.notify();
  }

  // Multiple choice starts on the pane (letter keys pick); open questions start in the textarea.
  focusStart() {
    // No question left (waiting screen): focus the pane itself so the answer box,
    // which isn't drawn, doesn't hold the keyboard and block ctrl-a h/j/k/l.
    const q = this.current();
    if (!q || q.choices) this.handle.focus();
    else this.answer.focus();
  }

  current() {
    return this.quiz?.questions[this.index] ?? null;
  }

  submit(cx) {
    const q = this.current();
    const reply = props()?.reply;
    if (!q || this.sending) return;
    const text = this.answer.value().trim();
    if (q.choices && this.choice == null) return;
    if (!q.choices && !text) return;
    const n = this.quiz.questions.length;
    const lines = [`[quiz] ${this.quiz.title ?? "Quiz"} — ${q.id ?? `q${this.index + 1}`} (${this.index + 1}/${n})`];
    if (q.choices) lines.push(`Choice: ${String.fromCharCode(65 + this.choice)}. ${q.choices[this.choice]}`);
    if (text) lines.push(q.choices ? `Why: ${text}` : text);
    const msg = lines.join("\n");
    this.sending = true;
    cx.notify();
    cx.spawn(async (cx) => {
      try {
        if (reply) await exec("hc", ["send", reply, msg], { timeout: 600000 });
        this.sent.push(q.id ?? this.index);
        this.index += 1;
        this.choice = null;
        this.answer.set_value("");
        this.focusStart();
      } catch (e) {
        this.error = `Send failed: ${e.message ?? e}`;
      }
      this.sending = false;
      cx.notify();
    });
  }

  // Pane keys: A-Z or 1-9 pick a choice, Enter sends, Tab writes a "why".
  // In the why box: Enter sends (its own submit event), Esc goes back to the choices.
  key(e, cx) {
    const q = this.current();
    if (e.keystroke === "cmd-enter") { this.submit(cx); cx.stop_propagation(); return; }
    if (this.whyFocused) {
      if (e.keystroke === "escape" && q?.choices) { this.handle.focus(); cx.notify(); cx.stop_propagation(); }
      return;
    }
    if (!q?.choices) return;
    const k = e.keystroke;
    let i = -1;
    if (/^[a-z]$/.test(k)) i = k.charCodeAt(0) - 97;
    else if (/^[1-9]$/.test(k)) i = Number(k) - 1;
    if (i >= 0 && i < q.choices.length) { this.choice = i; cx.notify(); cx.stop_propagation(); return; }
    if (k === "enter") { this.submit(cx); cx.stop_propagation(); return; }
    if (k === "tab") { this.answer.focus(); cx.notify(); cx.stop_propagation(); }
  }

  render(cx) {
    const t = theme();
    const root = v_flex().id("quiz").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .size_full().bg(t.background).text_color(t.foreground).text_size(13.5).p(18).gap(14)
      .overflow_y_scrollbar();
    if (!this.quiz) return root.child(div().text_color(t.muted).child(this.error ?? "Loading…"));

    const n = this.quiz.questions.length;
    const header = h_flex().items_center().justify_between()
      .child(div().text_size(15).font_semibold().child(this.quiz.title ?? "Quiz"))
      .child(div().text_size(11.5).text_color(t.dim).child(`${Math.min(this.index + 1, n)} / ${n}`));

    const q = this.current();
    if (!q) {
      return root.child(header).child(div().text_color(t.muted)
        .child("Answers sent. Waiting for Claude — the next questions appear here."));
    }

    const button = (id, text, primary, enabled, action) => h_flex().id(id).h(32).px(14).items_center().rounded(8)
      .border_1().border_color(primary ? t.solid : t.input).bg(primary ? t.solid : t.raised)
      .text_color(primary ? t.solid_foreground : t.foreground).text_size(12.5).font_medium()
      .opacity(enabled ? 1 : 0.45).when(enabled, (el) => el.cursor_pointer().hover((s) => s.opacity(0.88)))
      .on_click((_e, cx) => { if (enabled) action(cx); }).child(text);

    const ready = q.choices ? this.choice != null : this.answer.value().trim().length > 0;

    return root
      .child(header)
      .when(Boolean(q.passage), (el) => el.child(
        div().border_l_2().border_color(t.accent).pl(12).text_color(t.muted)
          .child(TextView.markdown(`passage-${this.index}`, q.passage))))
      .child(TextView.markdown(`prompt-${this.index}`, q.prompt ?? ""))
      .when(Array.isArray(q.choices), (el) => el.child(v_flex().gap(6).children(
        q.choices.map((c, i) => h_flex().id(`choice-${i}`).px(12).py(8).rounded(8).gap(10).cursor_pointer()
          .border_1().border_color(this.choice === i ? t.accent : t.input)
          .bg(this.choice === i ? t.selected : t.surface).hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => { this.choice = i; this.handle.focus(); cx.notify(); })
          .child(div().text_color(t.dim).child(String.fromCharCode(65 + i)))
          .child(div().flex_1().child(c))))))
      .when(Array.isArray(q.choices), (el) => el.child(div().text_size(11.5).text_color(t.dim)
        .child(this.whyFocused ? "Why? (optional) · Enter send · Esc back to choices"
          : "A–Z / 1–9 pick · Enter send · Tab add a why")))
      .child(Input.new(this.answer).w_full().h(36).px(10).rounded(9).border_1().border_color(t.input)
        .bg(t.surface).text_size(13.5).text_color(t.foreground))
      .when(Boolean(this.error), (el) => el.child(div().text_color(t.blocked).text_size(12).child(this.error)))
      .child(h_flex().gap(8).justify_end().items_center()
        .child(div().flex_1().text_size(11.5).text_color(t.dim).child(props()?.reply ? "" : "No reply terminal: answers not sent."))
        .child(button("send", this.sending ? "Sending…" : "Send  ↵", true, ready && !this.sending, (cx) => this.submit(cx))));
  }
}

