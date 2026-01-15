-- clear highlights on search when pressing <esc> in normal mode
vim.keymap.set('n', '<esc>', '<cmd>nohlsearch<cr>')

-- diagnostic keymaps
vim.keymap.set('n', '<leader>cq', vim.diagnostic.setloclist, { desc = 'Diagnostic Quickfix List' })

-- exit terminal mode
vim.keymap.set('t', '<esc><esc>', '<c-\\><c-n>', { desc = 'exit terminal mode' })

-- keybinds to make split navigation easier.
--  use ctrl+<hjkl> to switch between windows
vim.keymap.set('n', '<c-h>', '<c-w><c-h>', { desc = 'move focus to the left window' })
vim.keymap.set('n', '<c-l>', '<c-w><c-l>', { desc = 'move focus to the right window' })
vim.keymap.set('n', '<c-j>', '<c-w><c-j>', { desc = 'move focus to the lower window' })
vim.keymap.set('n', '<c-k>', '<c-w><c-k>', { desc = 'move focus to the upper window' })

-- shortcut for lazy
vim.keymap.set('n', '<leader>L', '<cmd>Lazy<cr>', { desc = 'Lazy' })

-- buffer quick navigation
vim.keymap.set('n', 'L', '<cmd>bn<cr>')
vim.keymap.set('n', 'H', '<cmd>bp<cr>')

-- buffer management
vim.keymap.set('n', '<leader>bd', '<cmd>bdelete<cr>', { desc = 'Delete buffer' })
vim.keymap.set('n', '<leader>bD', '<cmd>bdelete!<cr>', { desc = 'Force delete buffer' })
vim.keymap.set('n', '<leader>bo', '<cmd>%bdelete|edit#|bdelete#<cr>', { desc = 'Close other buffers' })
vim.keymap.set('n', '<leader>ba', '<cmd>%bdelete<cr>', { desc = 'Close all buffers' })
