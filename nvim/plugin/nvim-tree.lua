vim.api.nvim_set_keymap('n', '<leader>e', ':NvimTreeToggle<CR>', {noremap = true, silent = true})

require('nvim-tree').setup {
  hijack_cursor = true,
  sort_by = "filetype",
  view = {
    signcolumn = "no",
  },
  actions = {
    open_file = {
      quit_on_open = true,
    },
  },
}
