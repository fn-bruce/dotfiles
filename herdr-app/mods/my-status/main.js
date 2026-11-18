// Status bar (clone of workspace-status) that also answers key commands:
// "close-pane" (ctrl-a x) asks (my-confirm: y/n) before closing the focused pane, since
// pane.close itself never confirms. Closing the last pane of a space's last tab would make
// Herdr ask a second time, so that case closes the space already confirmed; when it is
// the last space, a fresh one is opened first so Herdr never sits empty.

import { View, div, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { spaces, agents, panes, focused, theme, run, window, keys, nextCommand, openOverlay, shared } from "herdr";

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

  render() {
    const t = theme();
    const space = spaces().find(s => s.active);
    const label = (icon, text) => h_flex().gap(6).items_center().child(svg(`mods/workspace-chrome/${icon}.svg`).size(13)).child(text);
    return h_flex().size_full().px(14).gap(16).items_center().bg(t.chrome).border_t(1).border_color(t.border).text_size(11.8).text_color(t.muted)
      .child(label(space?.machine ? "server" : "monitor", space?.machine ?? "This computer"))
      .when(Boolean(space?.branch), el => el.child(label("branch", space.branch)))
      .child(div().flex_1())
      // my-leader sets shared "leader" while it waits for the key after ctrl-a.
      .when(shared("leader") === true, el => el.child(
        div().px(6).rounded(3).bg(t.accent).text_color(t.accent_foreground).text_size(10.5).font_bold().child("LEADER")));
  }
}
