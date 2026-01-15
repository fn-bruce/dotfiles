return {
  'kawre/leetcode.nvim',
  build = ':TSUpdate html', -- if you have `nvim-treesitter` installed
  lazy = false,
  dependencies = {
    -- include a picker of your choice, see picker section for more details
    'nvim-lua/plenary.nvim',
    'MunifTanjim/nui.nvim',
  },
  opts = {
    -- configuration goes here
  },
  keys = {
    { '<leader>lo', '<cmd>Leet<cr>', desc = 'Open Leetcode Menu' },
    { '<leader>ll', '<cmd>Leet list<cr>', desc = 'List Problems' },
    { '<leader>ld', '<cmd>Leet desc<cr>', desc = 'Toggle Description' },
    { '<leader>lr', '<cmd>Leet run<cr>', desc = 'Run Code' },
    { '<leader>lR', '<cmd>Leet reset<cr>', desc = 'Reset Code' },
    { '<leader>ls', '<cmd>Leet submit<cr>', desc = 'Submit Solution' },
    { '<leader>li', '<cmd>Leet info<cr>', desc = 'Problem Info' },
    { '<leader>lc', '<cmd>Leet console<cr>', desc = 'Toggle Console' },
    { '<leader>lt', '<cmd>Leet tabs<cr>', desc = 'Show Tabs' },
    { '<leader>ly', '<cmd>Leet yank<cr>', desc = 'Yank Solution' },
    { '<leader>lz', '<cmd>Leet random<cr>', desc = 'Random Problem' },
    { '<leader>lO', '<cmd>Leet open<cr>', desc = 'Open in Browser' },
  },
}
