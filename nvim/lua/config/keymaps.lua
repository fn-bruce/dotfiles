-- clear highlights on search when pressing <esc> in normal mode
vim.keymap.set('n', '<esc>', '<cmd>nohlsearch<cr>')

-- diagnostic keymaps
vim.keymap.set('n', '<leader>cq', vim.diagnostic.setloclist, { desc = 'Diagnostic Quickfix List' })
vim.keymap.set('n', '<leader>ci', '<cmd>GuessIndent<cr>', { desc = 'Guess indent' })

-- exit terminal mode
vim.keymap.set('t', '<esc><esc>', '<c-\\><c-n>', { desc = 'exit terminal mode' })

-- shortcut for lazy
vim.keymap.set('n', '<leader>L', '<cmd>Lazy<cr>', { desc = 'Lazy' })

-- Move buffers
vim.keymap.set('n', '<S-h>', '<cmd>BufferLineCyclePrev<cr>')
vim.keymap.set('n', '<S-l>', '<cmd>BufferLineCycleNext<cr>')

-- buffer management
vim.keymap.set('n', '<leader>bd', '<cmd>bdelete<cr>', { desc = 'Delete buffer' })
vim.keymap.set('n', '<leader>bD', '<cmd>bdelete!<cr>', { desc = 'Force delete buffer' })
vim.keymap.set('n', '<leader>ba', '<cmd>%bdelete<cr>', { desc = 'Close all buffers' })
vim.keymap.set('n', '<leader>bo', function()
  local current = vim.api.nvim_get_current_buf()
  local buffers = vim.api.nvim_list_bufs()

  for _, buf in ipairs(buffers) do
    if buf ~= current and vim.api.nvim_buf_is_valid(buf) then
      local buftype = vim.api.nvim_get_option_value('buftype', { buf = buf })

      -- Only delete if it's not a terminal and not the current buffer
      if buftype ~= 'terminal' then
        vim.api.nvim_buf_delete(buf, { force = false })
      end
    end
  end
end, { desc = 'Close other buffers' })

-- notifications
vim.keymap.set('n', '<leader>un', function()
  require('mini.notify').clear()
end, { desc = 'Clear notifications' })

-- Paste without yanking selection
vim.keymap.set('v', 'p', '"_dP')

-- Toggle diagnostics
vim.keymap.set('n', '<leader>ud', function()
  vim.diagnostic.enable(not vim.diagnostic.is_enabled())
end, { desc = 'Toggle diagnostics' })
