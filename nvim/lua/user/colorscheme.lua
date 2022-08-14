local colorscheme = "gruvbox"

local status_ok, _ = pcall(vim.cmd, "colorscheme " .. colorscheme)
if not status_ok then
	return
end

-- Remove red blocks that appear while hovering definition
vim.cmd([[
highlight markdownError guifg=None guibg=None
]])

