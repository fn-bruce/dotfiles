-- nazzgate windows
vim.keymap.set("n", "<C-h>", "<C-w>h", { desc = "Move to left window" })
vim.keymap.set("n", "<C-j>", "<C-w>j", { desc = "Move to bottom window" })
vim.keymap.set("n", "<C-k>", "<C-w>k", { desc = "Move to top window" })
vim.keymap.set("n", "<C-l>", "<C-w>l", { desc = "Move to right window" })

-- Resize submode: press `r` then h/j/k/l/z repeatedly. Any other key exits.
vim.keymap.set("n", "r", function()
  local zoomed = false
  local saved_layout = nil

  while true do
    vim.cmd("redraw")
    vim.api.nvim_echo({ { "-- RESIZE -- (h/j/k/l to resize, z to toggle zoom, any other key to exit)", "ModeMsg" } }, false, {})

    local ok, char = pcall(vim.fn.getcharstr)
    if not ok or char == "" or char == "\27" then break end -- Esc or interrupt

    if char == "h" then
      vim.cmd("vertical resize -2")
    elseif char == "l" then
      vim.cmd("vertical resize +2")
    elseif char == "j" then
      vim.cmd("resize +2")
    elseif char == "k" then
      vim.cmd("resize -2")
    elseif char == "z" then
      if zoomed then
        if saved_layout then
          vim.fn.winrestcmd()
          vim.cmd(saved_layout)
        end
        zoomed = false
      else
        saved_layout = vim.fn.winrestcmd()
        vim.cmd("wincmd _ | wincmd |") -- max height + max width
        zoomed = true
      end
    else
      -- feed unhandled key back so it behaves normally
      vim.api.nvim_feedkeys(char, "n", false)
      break
    end
  end

  vim.api.nvim_echo({ { "" } }, false, {})
end, { desc = "Window resize submode" })

-- clear highlights on search when pressing <esc> in normal mode
vim.keymap.set('n', '<esc>', '<cmd>nohlsearch<cr>')

-- diagnostic keymaps
vim.keymap.set('n', '<leader>cd', vim.diagnostic.open_float, { desc = 'Line Diagnostics' })
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

-- clear notifications
vim.keymap.set('n', '<leader>un', function()
  require('snacks.notifier').hide()
end, { desc = 'Clear notifications' })

-- show notification history
vim.keymap.set('n', '<leader>n', function()
  require('snacks.notifier').show_history()
end, { desc = 'Clear notifications' })

-- Paste without yanking selection
vim.keymap.set('v', 'p', '"_dP')

-- Toggle diagnostics
vim.keymap.set('n', '<leader>ud', function()
  vim.diagnostic.enable(not vim.diagnostic.is_enabled())
  if vim.diagnostic.is_enabled() then
    vim.notify 'Diagnostics On'
  else
    vim.notify 'Diagnostics Off'
  end
end, { desc = 'Toggle diagnostics' })

-- Toggle text wrap
vim.keymap.set('n', '<leader>uw', function()
  vim.wo.wrap = not vim.wo.wrap
  if vim.wo.wrap then
    vim.notify 'Text Wrap On'
  else
    vim.notify 'Text Wrap Off'
  end
end, { desc = 'Toggle text wrap' })

-- Toggle zoom
vim.keymap.set('n', '<leader>z', function()
  local function zoom_in()
    vim.cmd [[tab split]]
    vim.o.showtabline = 0
    vim.api.nvim_tabpage_set_var(0, 'zoom', 'zoom')
  end

  local function zoom_out()
    vim.cmd [[mkview]]
    vim.o.showtabline = 1
    vim.cmd [[tab close]]
    vim.cmd [[loadview]]
  end

  if not vim.t['zoom'] then
    zoom_in()
  elseif vim.t['zoom'] == 'zoom' then
    zoom_out()
  end
end, { desc = 'Toggle zoom' }) -- Toggle zoom

-- ctrl+backspace deletes a word
vim.keymap.set('i', '<C-h>', '<C-w>', { desc = 'Delete word before cursor' })
