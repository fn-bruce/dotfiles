return {
	type = "executable",
	command = vim.fn.stdpath("data") .. "/mason/bin/netcoredbg",
	args = {
		"--interpreter=vscode",
		string.format("--engineLogging=%s/netcoredbg.engine.log", vim.fn.stdpath("data")),
		string.format("--log=%s/netcoredbg.log", vim.fn.stdpath("data")),
	},
}
