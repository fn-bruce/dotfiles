return {
  'obsidian-nvim/obsidian.nvim',
  version = '*',
  ft = 'markdown', -- so opening a note loads the plugin and fires enter_note
  cmd = 'Obsidian',
  keys = {
    -- Entry points: valid from ANY buffer (operate on the default/first workspace)
    { '<leader>on', '<cmd>Obsidian new<cr>', desc = 'New note' },
    { '<leader>oN', '<cmd>Obsidian new_from_template<cr>', desc = 'New from template' },
    { '<leader>ou', '<cmd>Obsidian unique_note<cr>', desc = 'New unique note' },
    { '<leader>of', '<cmd>Obsidian quick_switch<cr>', desc = 'Find note' },
    { '<leader>os', '<cmd>Obsidian search<cr>', desc = 'Search notes' },
    { '<leader>ot', '<cmd>Obsidian tags<cr>', desc = 'Tags' },
    { '<leader>od', '<cmd>Obsidian today<cr>', desc = 'Today' },
    { '<leader>oD', '<cmd>Obsidian dailies<cr>', desc = 'Dailies list' },
    { '<leader>o]', '<cmd>Obsidian tomorrow<cr>', desc = 'Tomorrow' },
    { '<leader>o[', '<cmd>Obsidian yesterday<cr>', desc = 'Yesterday' },
    { '<leader>ow', '<cmd>Obsidian workspace<cr>', desc = 'Switch workspace' },
  },
  opts = {
    callbacks = {
      enter_note = function(_)
        local map = function(key, cmd, desc, mode)
          vim.keymap.set(mode or 'n', key, '<cmd>Obsidian ' .. cmd .. '<cr>', { buffer = true, desc = desc })
        end

        -- Note-context actions: only meaningful inside the current note
        map('<leader>oi', 'template', 'Insert template')
        map('<leader>ob', 'backlinks', 'Backlinks')
        map('<leader>oT', 'toc', 'Table of contents')
        map('<leader>ol', 'links', 'Links in note')
        map('<leader>or', 'rename', 'Rename note')
        map('<leader>op', 'paste_img', 'Paste image')

        -- Visual mode (act on the selection in the current note)
        map('<leader>oe', 'extract_note', 'Extract note', 'v')
        map('<leader>oL', 'link_new', 'Link to new note', 'v')
        map('<leader>ol', 'link', 'Link selection', 'v')
      end,
    },
    legacy_commands = false,
    workspaces = {
      { name = 'personal', path = '~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Personal' },
      { name = 'work', path = '~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Work' },
    },
    templates = {
      folder = 'templates',
      date_format = '%Y-%m-%d-%a',
      time_format = '%H:%M',
      customizations = {
        ['daily'] = { notes_subdir = 'daily' },
        ['fleeting'] = { notes_subdir = 'fleeting' },
        ['literature'] = { notes_subdir = 'literature' },
        ['permanent'] = { notes_subdir = 'permanent' },
        ['reference'] = { notes_subdir = 'reference' },
      },
    },
    daily_notes = { folder = 'daily' },
    frontmatter = { enabled = false },
  },
}
