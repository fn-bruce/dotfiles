return {
  'folke/zen-mode.nvim',
  cmd = 'ZenMode',
  keys = {
    { '<leader>Z', '<cmd>ZenMode<cr>', desc = 'Zen mode' },
  },
  opts = {
    window = {
      width = 80, -- text column width; also accepts a fraction like 0.6
      options = {
        wrap = true,
        linebreak = true, -- wrap at word boundaries
      },
    },
  },
}
