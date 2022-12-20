return {
	type = "executable",
	command = os.getenv("HOME") .. "/.debuggers/debugpy/bin/python3",
	args = { "-m", "debugpy.adapter" },
}
