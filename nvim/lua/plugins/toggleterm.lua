return {
  {
    'akinsho/toggleterm.nvim',
    version = '*',
    keys = {
      {
        '<C-/>',
        '<cmd>ToggleTerm<cr>',
        mode = { 'n', 't' },
        desc = 'Toggle terminal',
      },
      {
        '<C-_>',
        '<cmd>ToggleTerm<cr>',
        mode = { 'n', 't' },
        desc = 'Toggle terminal',
      },
    },
    opts = {
      shade_terminals = false,
    },
  },
}
