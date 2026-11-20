// Scratch Claude: a throwaway claude for quick questions that belong to no project.
//
// Open/toggle: `mod.open:my-scratch` (cmd-j anywhere in Herdr, or leader .).
//
// Opened as an invisible 1x1 popup that acts and closes itself at once:
// - A peek is up -> close it. Claude keeps running.
// - Claude alive -> peek it again.
// - No live claude -> wipe SCRATCH_DIR, start a fresh `claude` there, peek it.
// `/exit` in claude throws it away; the next open starts fresh in an empty folder.
//
// Shown with the app's terminal.peek, not openOverlay: a peek gives the terminal the keyboard,
// while a window or dialog overlay holding a terminal block does not (and pane.focus can't
// reach a terminal there: "no such pane").
//
// The folder is fixed (not mktemp) so claude's "trust this folder?" prompt is answered only once;
// its contents are wiped every time a new scratch starts.

import { View, div } from "gpui-kit";
import { props, run, exec, home, closeOverlay, checking } from "herdr";

const SCRATCH_DIR = "/tmp/claude-scratch";
const NAME = "scratch-claude";
// GUI apps don't get the shell PATH (nvm), so start claude through a login+interactive zsh.
const ARGV = ["/bin/zsh", "-lic", "exec claude"];

async function hcJson(args) {
  const r = await exec("hc", [args[0], "--json", ...args.slice(1)]).catch(() => null);
  if (!r || r.code !== 0) return null;
  try { return JSON.parse(r.stdout); } catch { return null; }
}

// Close the launcher popup first: closing it after the peek hands the keyboard back to the pane below.
function peek(addr, own) {
  closeOverlay(own);
  run("terminal.peek", { terminal: addr });
}

async function open(own) {
  const t = await hcJson(["get", NAME]);
  if (t?.state === "live") return peek(t.address, own);
  if (t) await exec("hc", ["rm", NAME]).catch(() => {});
  await exec("rm", ["-rf", SCRATCH_DIR]).catch(() => {});
  await exec("mkdir", ["-p", SCRATCH_DIR]);
  const n = await hcJson(["run", "--bg", "--no-parent", "--name", NAME, "--label", "scratch=1", "--cwd", SCRATCH_DIR, "--", ...ARGV]);
  if (n?.address) peek(n.address, own);
}

// Is a peek up? focused() can't tell: the leader popup hands the keyboard back to the pane below
// before this runs. `herdr-app status` lists a peek as a "layout" overlay.
async function peekOpen() {
  const r = await exec(`${home()}/.local/bin/herdr-app`, ["status"]).catch(() => null);
  try { return JSON.parse(r?.stdout ?? "").overlays?.includes("layout") ?? false; } catch { return false; }
}

export default class Scratch extends View {
  init(_p, cx) {
    if (checking()) return;
    const own = props().overlay;
    cx.spawn(async (cx) => {
      try {
        if (await peekOpen()) {
          // Close this popup, then the peek under it (overlay.close takes the top dialog, never toasts).
          closeOverlay(own);
          run("overlay.close", {});
        } else {
          await open(own);
        }
      } finally { closeOverlay(own); }
      cx.notify();
    });
  }

  render() { return div(); }
}
