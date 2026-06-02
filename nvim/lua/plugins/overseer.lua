return {
  'stevearc/overseer.nvim',
  keys = {
    { '<leader>cot', '<cmd>OverseerToggle<cr>', desc = 'Task list' },
    { '<leader>coo', '<cmd>OverseerRun<cr>', desc = 'Run task' },
    { '<leader>coi', '<cmd>checkhealth overseer<cr>', desc = 'Overseer Info' },
    { '<leader>coT', '<cmd>OverseerTaskAction<cr>', desc = 'Task Action' },
    { '<leader>coq', '<cmd>OverseerQuickAction<cr>', desc = 'which_key_ignore' },
    { '<leader>cob', '<cmd>OverseerBuild<cr>', desc = 'which_key_ignore' },
    { '<leader>coc', '<cmd>OverseerClearCache<cr>', desc = 'which_key_ignore' },
  },
}
