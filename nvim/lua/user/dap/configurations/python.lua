return {
	{
		type = "python",
		request = "launch",
		name = "Launch file",
		program = "${file}",
		pythonPath = function()
			local cwd = vim.fn.getcwd()
			if vim.fn.executable(cwd .. "/venv/bin/python3") == 1 then
				return cwd .. "/venv/bin/python3"
			elseif vim.fn.executable(cwd .. "/.venv/bin/python3") == 1 then
				return cwd .. "/.venv/bin/python3"
			else
				return "/usr/bin/python3"
			end
		end,
	},
}
