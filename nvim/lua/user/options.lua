-- .---------.
-- | OPTIONS |
-- '---------'

-- general options
vim.opt.termguicolors = true -- set term gui colors (most terminals support this)
vim.opt.clipboard = "unnamedplus" -- Yanked test is copied into clipboard
vim.opt.splitbelow = true -- Horizontal splits will automatically be below
vim.opt.splitright = true -- Vertical splits will automatically be to the right
vim.opt.number = true -- set numbered lines
vim.opt.relativenumber = true -- Display relative numbers to current cursor location
vim.opt.cursorline = true -- highlight the current line
vim.opt.mouse = "a" -- allow the mouse to be used in neovim
vim.opt.whichwrap:append("<,>,[,],h,l") -- allows you to wrap when you move all the way right
vim.opt.hlsearch = true -- highlight all matches on previous search pattern
vim.opt.fillchars.eob = " "
vim.opt.hidden = true
vim.opt.timeoutlen = 250 -- time to wait for a mapped sequence to complete (in milliseconds)
vim.opt.conceallevel = 0 -- so that `` is visible in markdown files
vim.opt.formatoptions = vim.opt.formatoptions - { "c","r","o" }

-- gui options
-- vim.opt.guifont = "monospace:h17" -- the font used in graphical neovim applications

-- wrapping options
vim.opt.wrap = true
vim.opt.showbreak = "↪ "

-- tabline options
vim.opt.showtabline = 0

-- encoding options
vim.opt.encoding = "utf-8"
-- vim.opt.fileencoding = "utf-8"

-- scrolling options
vim.opt.scrolloff = 8
vim.opt.sidescrolloff = 8

-- file related options
vim.opt.backup = false -- creates a backup file
vim.opt.writebackup = false -- if a file is being edited by another program (or was written to file while editing with another program), it is not allowed to be edited
vim.opt.swapfile = false -- creates a swapfile
vim.opt.undodir = os.getenv("HOME") .. "/undodir"
vim.opt.undofile = true -- enable persistent undo

-- search and replace options
vim.opt.ignorecase = true
vim.opt.smartcase = true 
vim.opt.incsearch = true

-- tab/indent options
vim.opt.smarttab = true -- Makes tabbing smarter will realize you have 2 vs 4
vim.opt.expandtab = true -- convert tabs to spaces
vim.opt.autoindent = true -- Good auto indent
vim.opt.smartindent = true -- make indenting smarter again
vim.opt.tabstop = 2 -- insert 2 spaces for a tab
vim.opt.shiftwidth = 2 -- the number of spaces inserted for each indentation

-- left column options
vim.opt.numberwidth = 4 -- set number column width to 2 {default 4}
vim.opt.signcolumn = "yes" -- always show the sign column, otherwise it would shift the text each time

-- status line options
vim.opt.ruler = false -- for displaying the page location percentage
vim.opt.showmode = false -- we don't need to see things like -- INSERT -- anymore
vim.opt.showcmd = false -- doesn't show command being typed at bottom right
vim.opt.laststatus = 3

-- cmd line options
vim.opt.cmdheight = 1 -- more space in the neovim command line for displaying messages

-- folding options
vim.opt.foldlevelstart = 99
vim.opt.foldmethod = "expr"
vim.opt.foldexpr = "nvim_treesitter#foldexpr()"

-- completion options
vim.opt.pumheight = 10 -- pop up menu height
vim.opt.updatetime = 300 -- faster completion (4000ms default)
vim.opt.completeopt = { "menuone", "noselect" } -- mostly just for cmp
vim.opt.shortmess:append("c") -- Don't pass messages to |ins-completion-menu|.

-- I have no idea what these options do exactly
-- vim.opt.iskeyword:append("-")
