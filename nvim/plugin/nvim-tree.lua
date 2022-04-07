vim.api.nvim_set_keymap('n', '<leader>e', ':NvimTreeToggle<CR>', {noremap = true, silent = true})

local events = require('nvim-tree.events')

events.on_nvim_tree_ready(function()
  print("Press g? for help")
end)

require('nvim-tree').setup {
  hijack_cursor = true,
  view = {
    signcolumn = "no",
  },
  actions = {
    open_file = {
      quit_on_open = true,
    },
  },
}
