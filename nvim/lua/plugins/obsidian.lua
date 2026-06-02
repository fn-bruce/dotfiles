return {
  'obsidian-nvim/obsidian.nvim',
  version = '*',
  opts = {
    callbacks = {
      enter_note = function(_)
        local map = function(key, cmd, desc)
          vim.keymap.set('n', key, '<cmd>Obsidian ' .. cmd .. '<cr>', { buffer = true, desc = desc })
        end

        -- Creation
        map('<leader>on', 'new', 'New note')
        map('<leader>oN', 'new_from_template', 'New from template')
        map('<leader>ou', 'unique_note', 'New unique note')
        map('<leader>oi', 'template', 'Insert template')

        -- Navigation / Search
        map('<leader>of', 'quick_switch', 'Find note')
        map('<leader>os', 'search', 'Search notes')
        map('<leader>ob', 'backlinks', 'Backlinks')
        map('<leader>ot', 'tags', 'Tags')
        map('<leader>oT', 'toc', 'Table of contents')
        map('<leader>ol', 'links', 'Links in note')

        -- Daily notes
        map('<leader>od', 'today', 'Today')
        map('<leader>oD', 'dailies', 'Dailies list')
        map('<leader>o]', 'tomorrow', 'Tomorrow')
        map('<leader>o[', 'yesterday', 'Yesterday')

        -- Note actions
        map('<leader>or', 'rename', 'Rename note')
        map('<leader>op', 'paste_img', 'Paste image')

        -- Workspace
        map('<leader>ow', 'workspace', 'Switch workspace')

        -- Visual mode
        vim.keymap.set('v', '<leader>oe', '<cmd>Obsidian extract_note<cr>', { buffer = true, desc = 'Extract note' })
        vim.keymap.set('v', '<leader>oL', '<cmd>Obsidian link_new<cr>', { buffer = true, desc = 'Link to new note' })
        vim.keymap.set('v', '<leader>ol', '<cmd>Obsidian link<cr>', { buffer = true, desc = 'Link selection' })
      end,
    },
    legacy_commands = false,
    workspaces = {
      {
        name = 'personal',
        path = '~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Personal',
      },
      {
        name = 'work',
        path = '~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Work',
      },
    },
    templates = {
      folder = 'Templates', -- relative to workspace root
      date_format = '%Y-%m-%d',
      time_format = '%H:%M',
    },
    daily_notes = {
      folder = 'Daily',
    },
    frontmatter = {
      enabled = true,
      func = function(note)
        local out = require('obsidian.builtin').frontmatter(note)

        if not out.created then
          out.created = os.date '%Y-%m-%dT%H:%M:%S'
        end

        return out
      end,
      sort = { 'id', 'aliases', 'tags', 'created' },
    },
  },
}
