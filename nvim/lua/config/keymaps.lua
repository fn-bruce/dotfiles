-- clear highlights on search when pressing <esc> in normal mode
vim.keymap.set('n', '<esc>', '<cmd>nohlsearch<cr>')

-- diagnostic keymaps
vim.keymap.set('n', '<leader>cq', vim.diagnostic.setloclist, { desc = 'Diagnostic Quickfix List' })

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
vim.keymap.set('n', '<leader>bo', '<cmd>%bdelete|edit#|bdelete#<cr>', { desc = 'Close other buffers' })
vim.keymap.set('n', '<leader>ba', '<cmd>%bdelete<cr>', { desc = 'Close all buffers' })

-- notifications
vim.keymap.set('n', '<leader>un', function()
  require('mini.notify').clear()
end, { desc = 'Clear notifications' })

-- Paste without yanking selection
vim.keymap.set('v', 'p', '"_dP')
