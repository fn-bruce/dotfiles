local win = require("lspconfig.ui.windows")
local _default_opts = win.default_opts

win.default_opts = function(options)
	local opts = _default_opts(options)
  opts.border = { "╭", "─", "╮", "│", "╯", "─", "╰", "│" }
	return opts
end
