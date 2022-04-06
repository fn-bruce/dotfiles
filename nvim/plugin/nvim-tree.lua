vim.api.nvim_set_keymap('n', '<leader>e', ':NvimTreeToggle<CR>', {noremap = true})

require('nvim-tree').setup {
  actions = {
    open_file = {
      quit_on_open = true,
    },
  },
}
