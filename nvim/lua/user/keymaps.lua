-- .---------.
-- | KEYMAPS |
-- '---------'

-- remap space as leader key
vim.keymap.set("", "<Space>", "<Nop>", { noremap = true, silent = true })

-- Remap for dealing with word wrap
vim.keymap.set('n', 'k', "v:count == 0 ? 'gk' : 'k'", { expr = true, silent = true })
vim.keymap.set('n', 'j', "v:count == 0 ? 'gj' : 'j'", { expr = true, silent = true })

-- Close buffers
vim.keymap.set("n", "<S-q>", "<cmd>Bdelete!<CR>", { noremap = true, silent = true })

-- Naviagate buffers
vim.keymap.set("n", "<S-l>", ":bnext<CR>", { noremap = true, silent = true })
vim.keymap.set("n", "<S-h>", ":bprevious<CR>", { noremap = true, silent = true })

-- Better window navigation
vim.keymap.set("n", "<C-h>", "<C-w>h", { noremap = true, silent = true })
vim.keymap.set("n", "<C-j>", "<C-w>j", { noremap = true, silent = true })
vim.keymap.set("n", "<C-k>", "<C-w>k", { noremap = true, silent = true })
vim.keymap.set("n", "<C-l>", "<C-w>l", { noremap = true, silent = true })

local which_key = require("which-key")
which_key.register({
  [";"] = { "<cmd>Alpha<cr>", "Dashboard" },
  e = { "<cmd>NvimTreeToggle<cr>", "Explorer" },
  f = {
    name = "Find",
    c = { function()
      require("telescope.builtin").current_buffer_fuzzy_find(require("telescope.themes").get_dropdown {
        windblend = 10,
        previewer = false,
      })
    end, "Current Buffer" },
    f = { require("telescope.builtin").find_files, "Files" },
    g = { require("telescope.builtin").live_grep, "Grep" },
    p = { require("telescope.builtin").projects, "Projects" },
    b = { require("telescope.builtin").buffers, "Buffers" },
    r = { require("telescope.builtin").oldfiles, "Recently Used Files" },
    h = { require("telescope.builtin").help_tags, "Help Tags" },
    w = { require("telescope.builtin").grep_string, "Current Word" },
    d = { require("telescope.builtin").diagnostics, "Diagnostics" },
  },
  g = {
    name = "Git",
    g = { "<cmd>lua _LAZYGIT_TOGGLE()<cr>", "GUI" },
  },
  h = { "<cmd>nohlsearch<cr>", "Clear Highlights" },
  n = { "<cmd>ene <BAR> startinsert <cr>", "New File" },
  q = { require("notify").dismiss, "Quit Notification" },
}, { mode = "n", prefix = "<leader>", noremap = true, silent = true })
