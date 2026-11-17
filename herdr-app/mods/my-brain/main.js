// Second Brain status pane: reads the vault's wiki and shows what needs attention.
//
// Open:  herdr-app do pane.split --direction right --mod my-brain --props '{"vault":"/abs/vault"}'
//
// Sections: recall due (topics whose next_recall <= today), open terminology gaps
// (oldest first; shows only what Bruce said, never the precise term: that's the warm-up's
// answer), the top of the learning queue, and every topic with its level.
// Refreshes when anything under wiki/ changes, and hourly for the date.
import { View, div } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, theme, readTextFile, watchFolder, checking, nextCommand } from "herdr";
import * as fs from "fs/promises";

const LEVELS = ["heard-of", "read-about", "can-explain", "applied", "can-teach"];

const today = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const plain = (s) => s.replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, "$1").replace(/\*\*/g, "").trim();

function frontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  const meta = {};
  if (m) for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*?)\s*(#.*)?$/);
    if (kv) meta[kv[1]] = kv[2];
  }
  return meta;
}

// Rows of the first markdown table after `heading`, as arrays of cells.
function tableAfter(raw, heading) {
  const i = heading ? raw.indexOf(heading) : 0;
  if (i < 0) return [];
  const rows = [];
  let started = false;
  for (const line of raw.slice(i).split("\n").slice(heading ? 1 : 0)) {
    if (line.startsWith("|")) { started = true; rows.push(line.split("|").slice(1, -1).map((c) => c.trim())); }
    else if (started) break;
    else if (heading && line.startsWith("## ")) break;
  }
  return rows.slice(2); // drop header and separator
}

export default class Brain extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.data = null;
    this.error = null;
    this.vault = props()?.vault;
    if (!this.vault) { this.error = "No `vault` prop."; return; }
    if (checking()) return;
    cx.spawn(async (cx) => {
      await this.load(cx);
      for (;;) {
        await watchFolder(`${this.vault}/wiki`);
        await this.load(cx);
      }
    });
    cx.timer.every(3600000, (cx) => this.load(cx));
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        if (c === "focus") { this.handle.focus(); cx.notify(); }
      }
    });
  }

  async load(cx) {
    try {
      const dir = `${this.vault}/wiki/topics`;
      const names = (await fs.readdir(dir)).filter((n) => n.endsWith(".md")).sort();
      const topics = [];
      const gaps = [];
      for (const n of names) {
        const raw = (await readTextFile(`${dir}/${n}`)) ?? "";
        const meta = frontmatter(raw);
        const title = raw.match(/^# (.+)$/m)?.[1] ?? n.replace(/\.md$/, "");
        topics.push({ title, level: Number(meta.level ?? 0), status: meta.status, next: meta.next_recall, interval: meta.recall_interval });
        for (const row of tableAfter(raw, "## Terminology gaps")) {
          const [date, said, , , , status] = row;
          if (date && !/✅/.test(status ?? "")) gaps.push({ date, said: plain(said ?? ""), topic: title });
        }
      }
      gaps.sort((a, b) => a.date.localeCompare(b.date));
      const queueRaw = (await readTextFile(`${this.vault}/wiki/learning-queue.md`)) ?? "";
      const queue = tableAfter(queueRaw, "# Learning Queue")
        .map(([prio, topic, , , next]) => ({ prio, topic: plain(topic ?? ""), next: plain(next ?? "") }));
      this.data = { topics, gaps, queue, day: today() };
      this.error = null;
    } catch (e) {
      this.error = `Couldn't read the wiki: ${e.message ?? e}`;
    }
    cx.notify();
  }

  render() {
    const t = theme();
    const root = v_flex().id("brain").track_focus(this.handle).size_full().bg(t.background)
      .text_color(t.foreground).text_size(13).p(16).gap(18).overflow_y_scrollbar();
    if (!this.data) return root.child(div().text_color(t.muted).child(this.error ?? "Loading…"));
    const { topics, gaps, queue, day } = this.data;

    const section = (title, count, body) => v_flex().gap(7)
      .child(h_flex().gap(8).items_center()
        .child(div().text_size(11).font_semibold().text_color(t.dim).child(title.toUpperCase()))
        .when(count != null, (el) => el.child(div().text_size(11).text_color(t.dim).child(String(count)))))
      .child(body);
    const muted = (s) => div().text_color(t.muted).child(s);

    const due = topics.filter((x) => x.level >= 1 && x.next && x.next <= day)
      .map((x) => ({ ...x, late: daysBetween(x.next, day) }))
      .sort((a, b) => b.late - a.late);
    const upcoming = topics.filter((x) => x.next && x.next > day).sort((a, b) => a.next.localeCompare(b.next))[0];

    const recall = due.length
      ? v_flex().gap(5).children(due.map((x) => h_flex().gap(8).items_center()
          .child(div().w(8).h(8).rounded(4).bg(x.late > 0 ? t.blocked : t.working))
          .child(div().flex_1().child(x.title))
          .child(div().text_size(11.5).text_color(x.late > 0 ? t.blocked : t.dim)
            .child(x.late > 0 ? `${x.late}d overdue` : "due today"))))
      : muted(upcoming ? `Nothing due. Next: ${upcoming.title} on ${upcoming.next}.` : "Nothing due.");

    const gapList = gaps.length
      ? v_flex().gap(6).children(gaps.map((g, i) => v_flex().gap(1)
          .child(h_flex().gap(6)
            .child(div().text_size(11).text_color(i < 3 ? t.accent : t.dim).child(i < 3 ? "warm-up" : g.date))
            .child(div().text_size(11).text_color(t.dim).child(g.topic)))
          .child(div().text_color(t.foreground).child(`“${g.said.replace(/^"|"$/g, "")}”`))))
      : muted("No open gaps.");

    const top = queue[0];
    const queueBox = top
      ? v_flex().gap(4)
          .child(div().font_semibold().child(top.topic))
          .child(div().text_color(t.muted).text_size(12.5).child(`Next: ${top.next}`))
          .when(queue.length > 1, (el) => el.child(div().text_size(11.5).text_color(t.dim)
            .child(`+${queue.length - 1} more in the queue`)))
      : muted("Queue is empty.");

    const dots = (n) => h_flex().gap(3).children([0, 1, 2, 3, 4].map((i) =>
      div().w(7).h(7).rounded(4).bg(i < n ? t.accent : t.surface)));
    const topicList = v_flex().gap(6).children(topics.map((x) => h_flex().gap(8).items_center()
      .child(div().flex_1().truncate().child(x.title))
      .child(dots(x.level))
      .child(div().w(76).text_size(11).text_color(t.dim).child(LEVELS[x.level] ?? ""))));

    return root
      .child(h_flex().justify_between().items_center()
        .child(div().text_size(15).font_semibold().child("Second Brain"))
        .child(div().text_size(11.5).text_color(t.dim).child(day)))
      .child(section("Recall due", due.length, recall))
      .child(section("Terminology gaps", gaps.length, gapList))
      .child(section("Up next", null, queueBox))
      .child(section("Topics", topics.length, topicList))
      .when(Boolean(this.error), (el) => el.child(div().text_color(t.blocked).text_size(12).child(this.error)));
  }
}
