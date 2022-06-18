local pid = vim.fn.getpid()
local omnisharp_bin = os.getenv("HOME") .. "/tools/omnisharp-osx-arm64-net6.0/OmniSharp"
return {
	handlers = {
		["textDocument/definition"] = require("omnisharp_extended").handler,
	},
	cmd = { omnisharp_bin, "--languageserver", "--hostPID", tostring(pid) },
}
