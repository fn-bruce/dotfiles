local M = {}

function M.setup()
	local rt = require("rust-tools")
  local lsp_handlers = require("user.lsp.handlers")

	rt.setup({
		server = {
			on_attach = lsp_handlers.on_attach,
			capabilities = lsp_handlers.capabilities,
		},
    window = {
      border = { "╭", "─", "╮", "│", "╯", "─", "╰", "│" },
      floating = true,
    },
	})

end

return M
