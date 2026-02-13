-- Adds git related signs to tge gutter, as well as utilities for managing changes
return {
  {
    'lewis6991/gitsigns.nvim',
    opts = {
      signs = {
        add = { text = '┃' },
        change = { text = '┃' },
        delete = { text = '_' },
        topdelete = { text = '‾' },
        changedelete = { text = '~' },
        untracked = { text = '┆' },
      },
      signs_staged = {
        add = { text = '┃' },
        change = { text = '┃' },
        delete = { text = '_' },
        topdelete = { text = '‾' },
        changedelete = { text = '~' },
        untracked = { text = '┆' },
      },
      on_attach = function(bufnr)
        local gitsigns = require 'gitsigns'

        local function map(mode, l, r, opts)
          opts = opts or {}
          opts.buffer = bufnr
          vim.keymap.set(mode, l, r, opts)
        end

        -- Navigation
        map('n', ']c', function()
          if vim.wo.diff then
            vim.cmd.normal { ']c', bang = true }
          else
            gitsigns.nav_hunk 'next'
          end
        end, { desc = 'Jump to Next Git Change' })

        map('n', '[c', function()
          if vim.wo.diff then
            vim.cmd.normal { '[c', bang = true }
          else
            gitsigns.nav_hunk 'prev'
          end
        end, { desc = 'Jump to Previous Git Change' })

        -- Actions
        -- visual mode
        map('v', '<leader>gs', function()
          gitsigns.stage_hunk { vim.fn.line '.', vim.fn.line 'v' }
        end, { desc = 'Stage hunk' })
        map('v', '<leader>gr', function()
          gitsigns.reset_hunk { vim.fn.line '.', vim.fn.line 'v' }
        end, { desc = 'Reset hunk' })
        -- normal mode
        map('n', '<leader>gs', gitsigns.stage_hunk, { desc = 'Stage Hunk' })
        map('n', '<leader>gr', gitsigns.reset_hunk, { desc = 'Reset Hunk' })
        map('n', '<leader>gS', gitsigns.stage_buffer, { desc = 'Stage Buffer' })
        map('n', '<leader>gu', gitsigns.stage_hunk, { desc = 'Undo Stage Hunk' })
        map('n', '<leader>gR', gitsigns.reset_buffer, { desc = 'Reset Buffer' })
        map('n', '<leader>gp', gitsigns.preview_hunk, { desc = 'Preview Hunk' })
        map('n', '<leader>gb', gitsigns.blame_line, { desc = 'Blame Line' })
        map('n', '<leader>gd', gitsigns.diffthis, { desc = 'Diff Against Index' })
        map('n', '<leader>gD', function()
          gitsigns.diffthis '@'
        end, { desc = 'Diff Against Last Commit' })
        -- Toggles
        map('n', '<leader>ub', gitsigns.toggle_current_line_blame, { desc = 'Toggle Git Show Blame Line' })
      end,
    },
  },
}
