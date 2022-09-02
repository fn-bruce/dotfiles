local M = {}

function M.setup()
	local rt = require("rust-tools")
	local lsp_handlers = require("user.lsp.handlers")
	rt.setup({
		server = {
			on_attach = lsp_handlers.on_attach,
			capabilities = lsp_handlers.capabilities,
		},
		hover_actions = {
			border = {
				{ "╭", "FloatBorder" },
				{ "─", "FloatBorder" },
				{ "╮", "FloatBorder" },
				{ "│", "FloatBorder" },
				{ "╯", "FloatBorder" },
				{ "─", "FloatBorder" },
				{ "╰", "FloatBorder" },
				{ "│", "FloatBorder" },
			},
			auto_focus = true,
		},
	})
end

return M
