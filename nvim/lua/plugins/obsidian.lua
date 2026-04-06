return {
  'obsidian-nvim/obsidian.nvim',
  version = '*',
  opts = {
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
  },
}
