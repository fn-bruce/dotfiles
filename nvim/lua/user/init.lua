require("user.variables")
require("user.options")
require("user.keymaps")
require("user.plugins")
require("user.autocommands")

if not vim.g.vscode then
  require("user.colorscheme")
  require("user.cmp")
  require("user.telescope")
  require("user.treesitter")
  require("user.autopairs")
  require("user.comment")
  require("user.gitsigns")
  require("user.nvim-tree")
  require("user.bufferline")
  require("user.lualine")
  require("user.project")
  require("user.impatient")
  require("user.illuminate")
  require("user.alpha")
  require("user.toggleterm")
  require("user.lsp")
  require("user.dap")
  require("user.rest")
  require("user.glow")
  require("user.markdown-preview")
  require("user.crates-nvim")
  require("user.cmp-tabnine")
  require("user.which-key")
  require("user.ayu")
  require("user.colorizer")
end
