return {
	type = "executable",
	command = os.getenv("HOME") .. "/tools/netcoredbg/netcoredbg",
	args = { "--interpreter=vscode" },
}
