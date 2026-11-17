// Article reader pane: renders a markdown file (with optional YAML frontmatter) as a
// readable column, scrolled with vim keys.
//
// Open:  herdr-app do pane.split --direction right --mod my-reader --props '{"file":"/abs/article.md"}'
//
// Keys:  j k        line down / up          d u / space        half page (ctrl- too)
//        f b        full page (ctrl- too)    gg G               top / bottom
//        + -        font size               o   open the source URL  q   close the pane
//
// Mod scroll areas can't be moved by pixels from code, so the content sits in a clipped
// frame and is shifted with `top(-y)`; its measured height bounds y.
import { View, div } from "gpui-kit";
import { v_flex, h_flex, TextView } from "gpui-base";
import { props, theme, readTextFile, watchFolder, nextCommand, run, exec, focused, checking } from "herdr";

const LINE = 44;
const dirOf = (p) => p.replace(/\/[^/]*$/, "") || "/";

function parse(raw) {
  const meta = {};
  let body = raw;
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (m) {
    for (const line of m[1].split("\n")) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
    }
    body = raw.slice(m[0].length);
  }
  return { meta, body: body.trim() };
}

export default class Reader extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.y = 0;
    this.viewH = 0;
    this.contentH = 0;
    this.pendingG = false;
    this.doc = null;
    this.error = null;
    this.font = Number(localStorage.getItem("font")) || 16;
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
        if (c === "focus") { this.handle.focus(); cx.notify(); }
      }
    });
    this.handle.focus();
    cx.timer.after(150, () => this.handle.focus());
  }

  async load(file, cx) {
    const raw = await readTextFile(file);
    if (raw == null) { this.error = `No such file: ${file}`; cx.notify(); return; }
    if (raw === this.raw) return;
    this.raw = raw;
    this.doc = parse(raw);
    this.error = null;
    cx.notify();
  }

  maxY() {
    return Math.max(0, this.contentH - this.viewH);
  }

  scrollTo(y, cx) {
    this.y = Math.round(Math.min(Math.max(0, y), this.maxY()));
    cx.notify();
  }

  key(e, cx) {
    const k = e.keystroke;
    const ch = e.key_char;
    const half = Math.max(LINE, this.viewH / 2);
    const page = Math.max(LINE, this.viewH - LINE);
    const was = this.pendingG;
    this.pendingG = false;
    if (k === "j" || k === "down") this.scrollTo(this.y + LINE, cx);
    else if (k === "k" || k === "up") this.scrollTo(this.y - LINE, cx);
    else if (k === "d" || k === "ctrl-d" || k === "space") this.scrollTo(this.y + half, cx);
    else if (k === "u" || k === "ctrl-u" || k === "shift-space") this.scrollTo(this.y - half, cx);
    else if (k === "f" || k === "ctrl-f" || k === "pagedown") this.scrollTo(this.y + page, cx);
    else if (k === "b" || k === "ctrl-b" || k === "pageup") this.scrollTo(this.y - page, cx);
    else if (k === "shift-g" || ch === "G" || k === "end") this.scrollTo(this.maxY(), cx);
    else if (k === "home") this.scrollTo(0, cx);
    else if (k === "g") { if (was) this.scrollTo(0, cx); else this.pendingG = true; }
    else if (ch === "+" || k === "=" || k === "shift-=") this.setFont(this.font + 1, cx);
    else if (ch === "-" || k === "-") this.setFont(this.font - 1, cx);
    else if (k === "o" && this.doc?.meta.url) exec("open", [this.doc.meta.url]);
    else if (k === "q") { const pane = focused()?.pane; if (pane) run("pane.close", { pane }); }
    else return;
    cx.stop_propagation();
  }

  setFont(size, cx) {
    this.font = Math.min(26, Math.max(12, size));
    try { localStorage.setItem("font", String(this.font)); } catch {}
    cx.notify();
  }

  render() {
    const t = theme();
    const root = div().id("reader").track_focus(this.handle).on_key_down((e, cx) => this.key(e, cx))
      .relative().size_full().overflow_hidden().bg(t.background).text_color(t.foreground)
      .on_size_change((s, cx) => { this.viewH = s.height; this.scrollTo(this.y, cx); })
      .on_scroll_wheel((e, cx) => this.scrollTo(this.y - (e.delta?.y ?? 0), cx));
    if (!this.doc) {
      return root.child(div().p(24).text_color(t.muted).child(this.error ?? "Loading…"));
    }
    const { meta, body } = this.doc;
    const byline = [meta.author, meta.sitename ?? meta.hostname, meta.date].filter(Boolean).join(" · ");
    const pct = this.maxY() > 0 ? Math.round((this.y / this.maxY()) * 100) : 100;

    const column = v_flex().w_full().max_w(720).px(28).pt(36).pb(96).gap(6).text_size(this.font)
      .when(Boolean(meta.title), (el) => el.child(
        div().text_size(this.font + 12).font_semibold().pb(4).child(meta.title)))
      .when(Boolean(byline), (el) => el.child(div().text_size(this.font - 3).text_color(t.dim).pb(18).child(byline)))
      .child(TextView.markdown("article", body));

    // Scrollbar: thumb length = share of the article on screen, position = progress.
    const track = Math.max(0, this.viewH - 16);
    const fits = this.contentH <= this.viewH || this.contentH === 0;
    const thumbH = fits ? track : Math.max(28, (this.viewH / this.contentH) * track);
    const thumbTop = fits ? 0 : (this.y / this.maxY()) * (track - thumbH);

    return root
      .child(h_flex().id("content").absolute().left(0).right(0).top(-this.y).justify_center()
        .on_size_change((s, cx) => { this.contentH = s.height; this.scrollTo(this.y, cx); })
        .child(column))
      .when(!fits && track > 0, (el) => el
        .child(div().absolute().right(4).top(8).w(4).h(track).rounded(2).bg(t.surface))
        .child(div().absolute().right(4).top(8 + thumbTop).w(4).h(thumbH).rounded(2).bg(t.dim)))
      .child(div().absolute().right(16).bottom(8).px(8).py(2).rounded(5).bg(t.surface)
        .text_size(11).text_color(t.dim).child(`${pct}%  ·  j/k  d/u  f/b  gg/G  q`));
  }
}
