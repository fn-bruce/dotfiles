require('alpha').setup(require('alpha.themes.dashboard').config)
vim.api.nvim_command([[
autocmd FileType alpha set fillchars=eob:\ 
]])
