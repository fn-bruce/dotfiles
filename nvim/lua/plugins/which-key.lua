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
      { '<leader>a', group = '[a]i', mode = { 'n', 'v' } },
      { '<leader>b', group = '[b]uffer' },
      { '<leader>c', group = '[c]ode', mode = { 'n', 'v' } },
      { '<leader>d', group = '[d]ebug' },
      { '<leader>g', group = '[g]it', mode = { 'n', 'v' } },
      { '<leader>l', group = '[l]eetcode' },

      -- obsidian
      { '<leader>o', group = '[o]bsidian', mode = { 'n', 'v' } },
      { '<leader>of', '<cmd>Obsidian quick_switch<cr>', desc = 'Find note' },
      { '<leader>os', '<cmd>Obsidian search<cr>', desc = 'Search notes' },
      { '<leader>on', '<cmd>Obsidian new<cr>', desc = 'New note' },
      { '<leader>ow', '<cmd>Obsidian workspace<cr>', desc = 'Switch workspace' },
      { '<leader>od', '<cmd>Obsidian today<cr>', desc = 'Today' },

      { '<leader>co', group = '[o]verseer' },
      { '<leader>s', group = '[s]earch' },
      { '<leader>u', group = '[u]i' },
    },
  },
}
