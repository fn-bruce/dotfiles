return {
  'folke/which-key.nvim',
  event = 'vimenter', -- sets the loading event to 'vimenter'
  opts = {
    -- delay between pressing a key and opening which-key (milliseconds)
    -- this setting is independent of vim.o.timeoutlen
    delay = 250,
    icons = {
      mappings = vim.g.have_nerd_font,
      keys = {},
    },

    spec = {
      { '<leader>u', group = '[u]i' },
      { '<leader>g', group = '[g]it', mode = { 'n', 'v' } },
      { '<leader>o', group = '[o]verseer' },
      { '<leader>l', group = '[l]eetcode' },
      { '<leader>d', group = '[d]ebug' },
      { '<leader>c', group = '[c]ode', mode = { 'n', 'v' } },
      { '<leader>s', group = '[s]earch' },
    },
  },
}
