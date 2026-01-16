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
      { '<leader>b', group = '[b]uffer' },
      { '<leader>c', group = '[c]ode', mode = { 'n', 'v' } },
      { '<leader>d', group = '[d]ebug' },
      { '<leader>g', group = '[g]it', mode = { 'n', 'v' } },
      { '<leader>l', group = '[l]eetcode' },
      { '<leader>o', group = '[o]verseer' },
      { '<leader>s', group = '[s]earch' },
      { '<leader>t', group = '[t]ab' },
      { '<leader>u', group = '[u]i' },
    },
  },
}
