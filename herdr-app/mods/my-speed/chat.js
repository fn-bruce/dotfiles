// Chat about a speed test result: facts gathered on this Mac, then `claude -p` turns,
// continued with --resume <session_id> so follow-ups remember the thread.
//
// Claude gets no tools (--tools "") and no MCP servers, so a turn is fast and changes
// nothing; it only reasons over the facts sent with the first message. Sessions live in
// ~/.cache/herdr-my-speed (claude keys sessions by folder), so "Continue in tab" can run
// `claude --resume <id>` there.

import { exec, home } from "herdr";

export const chatDir = () => `${home()}/.cache/herdr-my-speed`;

const SYSTEM = [
  "You answer questions about a home internet speed test shown in a small popup in the user's terminal app.",
  "The first message starts with the measured facts. Be concise: a short verdict, then a few bullets at most.",
  "Plain markdown, no tables, no headings larger than bold text.",
  "You have no tools: when a measurement would help, give the exact macOS command for the user to run.",
].join(" ");

// GUI apps don't inherit the shell PATH (nvm etc.), so find claude first (same as my-brain-chat).
const RUN_CLAUDE = `PATH="$HOME/.local/bin:$HOME/.claude/local:/opt/homebrew/bin:/usr/local/bin:$PATH"
command -v claude >/dev/null 2>&1 || for d in $(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | sort -rV); do [ -x "$d/claude" ] && PATH="$d:$PATH" && break; done
exec claude "$@"`;

// Default route, then ping the router and the internet, in one shell call (~2 s).
const NET_SH = `
gw=$(route -n get default 2>/dev/null | awk '/gateway:/{print $2}')
ifc=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')
echo "iface=$ifc"
echo "gw=$gw"
[ -n "$gw" ] && ping -c 5 -i 0.2 -q -t 4 "$gw" 2>/dev/null | awk -F/ '/round-trip/{print "gwping="$5}'
ping -c 5 -i 0.2 -q -t 4 1.1.1.1 2>/dev/null | awk -F/ '/round-trip/{print "netping="$5}'
`;

export async function gatherFacts() {
  const facts = { iface: null, kind: null, gwPing: null, netPing: null, wifi: null };
  try {
    const r = await exec("/bin/sh", ["-c", NET_SH], { timeout: 20000 });
    for (const line of r.stdout.split("\n")) {
      const [k, v] = line.split("=");
      if (k === "iface") facts.iface = v || null;
      if (k === "gwping" && v) facts.gwPing = Math.round(Number(v) * 10) / 10;
      if (k === "netping" && v) facts.netPing = Math.round(Number(v) * 10) / 10;
    }
  } catch { /* offline or no route: leave nulls */ }
  try {
    const r = await exec("/usr/sbin/system_profiler", ["SPAirPortDataType", "-json"], { timeout: 20000 });
    const ifs = JSON.parse(r.stdout).SPAirPortDataType?.[0]?.spairport_airport_interfaces ?? [];
    const cur = ifs.find((i) => i._name === facts.iface)?.spairport_current_network_information;
    if (cur) {
      // macOS hides signal without location access and reports "0 dBm": drop it then.
      const signal = cur.spairport_signal_noise && !cur.spairport_signal_noise.startsWith("0 dBm") ? cur.spairport_signal_noise : null;
      facts.wifi = {
        rate: cur.spairport_network_rate ?? null,
        phy: cur.spairport_network_phymode ?? null,
        channel: cur.spairport_network_channel ?? null,
        signal,
      };
    }
  } catch { /* not Wi-Fi, or system_profiler failed */ }
  facts.kind = facts.wifi ? "Wi-Fi" : facts.iface ? "wired or other" : null;
  return facts;
}

// The facts block sent once, ahead of the first question.
export function factsText(result, facts) {
  const lines = [
    `Speed test (macOS networkQuality, ${new Date(result.at).toString()}):`,
    `- download ${result.down.toFixed(1)} Mbps, upload ${result.up.toFixed(1)} Mbps`,
  ];
  if (result.ping != null) lines.push(`- idle latency ${result.ping} ms`);
  if (facts) {
    if (facts.kind) lines.push(`- connection: ${facts.kind}${facts.iface ? ` (${facts.iface})` : ""}`);
    if (facts.wifi) {
      const w = facts.wifi;
      lines.push(`- Wi-Fi: ${[w.phy, w.channel, w.rate != null ? `link rate ${w.rate} Mbps` : null, w.signal ? `signal/noise ${w.signal}` : null].filter(Boolean).join(", ")}`);
    }
    if (facts.gwPing != null) lines.push(`- ping to router: ${facts.gwPing} ms avg`);
    if (facts.netPing != null) lines.push(`- ping to 1.1.1.1: ${facts.netPing} ms avg`);
  }
  lines.push("Tiers used in the popup (Mbps): download <10 crawl, 10-25 slow, 25-100 okay, 100-500 fast, 500+ blazing; upload <3, 3-10, 10-20, 20-100, 100+.");
  return lines.join("\n");
}

// One turn. Returns { text, session } or throws with claude's message.
export async function askClaude(prompt, session) {
  const dir = chatDir();
  await exec("mkdir", ["-p", dir]);
  const args = ["-p", prompt, "--output-format", "json", "--tools", "", "--strict-mcp-config", "--append-system-prompt", SYSTEM];
  if (session) args.push("--resume", session);
  const r = await exec("/bin/sh", ["-c", RUN_CLAUDE, "sh", ...args], { cwd: dir, timeout: 300000 });
  let j = null;
  try { j = JSON.parse(r.stdout); } catch { /* not JSON: fall through */ }
  if (!j || j.is_error) {
    const why = j?.result || (r.stderr || r.stdout).trim().split("\n").pop() || `claude exited ${r.code}`;
    throw new Error(why);
  }
  return { text: String(j.result ?? "").trim(), session: j.session_id ?? session };
}
