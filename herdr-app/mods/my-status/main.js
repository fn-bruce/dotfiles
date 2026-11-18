// Status bar (clone of workspace-status) that also answers key commands:
// "close-pane" (ctrl-a x) asks (my-confirm: y/n) before closing the focused pane, since
// pane.close itself never confirms. Closing the last pane of a space's last tab would make
// Herdr ask a second time, so that case closes the space already confirmed; when it is
// the last space, a fresh one is opened first so Herdr never sits empty.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, panes, focused, theme, run, window, keys, nextCommand, openOverlay } from "herdr";

export default class MyStatus extends View {
  init(_props, cx) {
    cx.spawn(async () => {
      for (;;) {
        const c = await nextCommand();
        if (c === "close-pane") this.closePane();
      }
    });
  }

  closePane() {
    const id = focused()?.pane;
    const ps = panes();
    const pane = ps.find((p) => p.pane === id) ?? ps.find((p) => p.focused);
    if (!pane) return;
    const all = spaces();
    const space = all.find((s) => s.tabs.some((t) => t.id === pane.tab));
    const lastInTab = ps.filter((p) => p.tab === pane.tab).length === 1;
    const lastTab = lastInTab && space && space.tabs.length === 1;
    const lastSpace = lastTab && all.length === 1;
    const what = pane.title || pane.cwd || "This pane";
    let detail = `${what} closes and its program stops.`;
    let commands = [{ name: "pane.close", args: { pane: pane.pane } }];
    if (lastSpace) {
      detail += " It is the last one, so a fresh space opens in its place.";
      // New first, then close: Herdr never has zero spaces. An explicit machine
      // starts the new space in that machine's home rather than the old folder.
      commands = [
        { name: "space.new", args: { machine: space.machine ?? "" } },
        { name: "space.close", args: { id: space.id, confirmed: true } },
      ];
    } else if (lastTab) {
      detail += ` Its space "${space.name}" closes with it.`;
      commands = [{ name: "space.close", args: { id: space.id, confirmed: true } }];
    }
    openOverlay({
      mod: "my-confirm",
      kind: "dialog",
      width: 400,
      height: 160,
      props: { title: "Close pane?", detail, commands },
    });
  }

  // The palette key as actually bound, not a hardcoded one; without a
  // binding the hint stays useful ("commands") instead of lying.
  hint(t) {
    const mac = window()?.platform === "macos";
    const mod = { cmd: mac ? "⌘" : "Ctrl+", ctrl: mac ? "⌃" : "Ctrl+", shift: mac ? "⇧" : "Shift+", alt: mac ? "⌥" : "Alt+", option: mac ? "⌥" : "Alt+" };
    const b = keys().find((k) => k.section === "global" && k.action === "app.palette");
    const parts = b && b.keys.endsWith("--") ? [...b.keys.slice(0, -2).split("-"), "-"] : b?.keys.split("-");
    const key = parts && parts.map((p) => mod[p.toLowerCase()] ?? p.toUpperCase()).join("");
    return key ? `${key}  commands` : "commands";
  }

  render() {
    const t = theme();
    const space = spaces().find(s => s.active);
    const list = agents();
    const needs = list.filter(a => a.status === "blocked").length;
    const label = (icon, text) => h_flex().gap(6).items_center().child(svg(`mods/workspace-chrome/${icon}.svg`).size(13)).child(text);
    return h_flex().size_full().px(14).gap(16).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
      .child(label(space?.machine ? "server" : "monitor", space?.machine ?? "This computer"))
      .when(Boolean(space?.branch), el => el.child(label("branch", space.branch)))
      .child(h_flex().gap(6).items_center().child(div().size(6).rounded(3).bg(t.dim)).child(`${list.length} agents`)
        .when(needs > 0, el => el.child(div().text_color(t.blocked).child(`· ${needs} needs you`))))
      .child(div().flex_1())
      .child(div().id("palette").text_color(t.dim).on_click(() => run("app.palette")).child(this.hint(t)));
  }
}
