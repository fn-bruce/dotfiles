return {
  'folke/which-key.nvim',
  event = 'vimenter', -- sets the loading event to 'vimenter'
  opts = {
    -- delay between pressing a key and opening which-key (milliseconds)
    -- this setting is independent of vim.o.timeoutlen
    delay = 0,
    icons = {
      mappings = vim.g.have_nerd_font,
      keys = {},
    },

    spec = {
      { '<leader>g', group = '[g]it' },
      { '<leader>o', group = '[o]verseer' },
      { '<leader>l', group = '[l]eetcode' },
      { '<leader>d', group = '[d]ebug' },
      { '<leader>c', group = '[c]ode' },
      { '<leader>s', group = '[s]earch' },
      { '<leader>t', group = '[t]oggle' },
      { '<leader>h', group = 'git [h]unk', mode = { 'n', 'v' } },
    },
  },
}
