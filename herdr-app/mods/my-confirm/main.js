// Asks before something destructive, e.g. "Close pane?". Opened as a
// dialog with props { title, detail, command: { name, args } } or commands: [{ name, args }, ...]
// (run in order).
// y or Enter confirms (runs the command); n, q or Esc cancels.

import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay, theme } from "herdr";

export default class MyConfirm extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.handle.focus();
    // The terminal takes the keyboard back right after a key chord opens the
    // dialog (prompt and picker retry the same way), so ask again shortly.
    for (const ms of [100, 300, 600]) cx.timer.after(ms, () => { if (!this.handle.is_focused()) this.handle.focus(); });
  }

  yes() {
    const p = props();
    closeOverlay(p.overlay);
    for (const c of p.commands ?? [p.command]) if (c) run(c.name, c.args ?? {});
  }

  no() {
    closeOverlay(props().overlay);
  }

  render(cx) {
    const t = theme();
    const p = props() ?? {};
    const button = (id, label, bg, fg, onClick) =>
      h_flex().id(id).h(32).px(14).items_center().rounded(8).border_1().border_color(id === "no" ? t.input : bg).bg(bg).text_color(fg).cursor_pointer().hover((s) => s.opacity(0.88)).on_click(onClick).child(label);
    return v_flex()
      .id("my-confirm")
      .track_focus(this.handle)
      .on_click(() => this.handle.focus())
      .on_key_down((e, cx) => {
        switch (e.key) {
          case "y": case "enter": this.yes(); break;
          case "n": case "q": case "escape": this.no(); break;
          default: return;
        }
        cx.stop_propagation();
      })
      .size_full()
      .min_h(0)
      .p(18)
      .gap(12)
      .rounded(8)
      .bg(t.popover)
      .text_size(13)
      .child(h_flex().items_center().child(div().flex_1().text_size(15).font_semibold().text_color(t.foreground).child(p.title ?? "Are you sure?")).child(div().text_size(11).text_color(t.dim).child("y / n")))
      .child(div().flex_1().min_h(0).overflow_y_scrollbar().text_color(t.muted).child(p.detail ?? ""))
      .child(
        h_flex()
          .justify_end()
          .gap(8)
          .text_size(12)
          .child(button("no", "Cancel  n", t.raised, t.foreground, () => this.no()))
          .child(button("yes", "Confirm  y", t.solid, t.solid_foreground, () => this.yes())),
      );
  }
}
