vim.opt.clipboard = "unnamedplus" -- allows neovim to access the system clipboard
vim.opt.mouse = "a" -- allow the mouse to be used in neovim
vim.opt.hidden = true
vim.opt.encoding = "utf-8" -- The encoding displayed
vim.opt.pumheight = 10 -- pop up menu height
vim.opt.fileencoding = "utf-8" -- the encoding written to a file
vim.opt.cmdheight = 1 -- more space in the neovim command line for displaying messages
vim.opt.splitbelow = true -- Horizontal splits will automatically be below
vim.opt.splitright = true -- Vertical splits will automatically be to the right
vim.opt.conceallevel = 0 -- so that `` is visible in markdown files
vim.opt.tabstop = 2 -- insert 2 spaces for a tab
vim.opt.shiftwidth = 2 -- the number of spaces inserted for each indentation
vim.opt.smarttab = true -- Makes tabbing smarter will realize you have 2 vs 4
vim.opt.expandtab = true -- convert tabs to spaces
vim.opt.autoindent = true -- Good auto indent
vim.opt.laststatus = 3
vim.opt.number = true -- set numbered lines
vim.opt.relativenumber = false -- Display relative numbers to current cursor location
vim.opt.showmode = false -- we don't need to see things like -- INSERT -- anymore
vim.opt.backup = false -- creates a backup file
vim.opt.writebackup = false -- if a file is being edited by another program (or was written to file while editing with another program), it is not allowed to be edited
vim.opt.shortmess:append("c") -- Don't pass messages to |ins-completion-menu|.
vim.opt.signcolumn = "yes" -- always show the sign column, otherwise it would shift the text each time
vim.opt.updatetime = 300 -- faster completion (4000ms default)
vim.opt.incsearch = true
vim.opt.guifont = "monospace:h17" -- the font used in graphical neovim applications
vim.opt.scrolloff = 8 -- is one of my fav
vim.opt.sidescrolloff = 8
vim.opt.completeopt = { "menuone", "noselect" } -- mostly just for cmp
vim.opt.undodir = os.getenv("HOME") .. "/undodir"
vim.opt.undofile = true -- enable persistent undo
vim.opt.termguicolors = true -- set term gui colors (most terminals support this)
vim.opt.hlsearch = true -- highlight all matches on previous search pattern
vim.opt.cursorline = true -- highlight the current line
vim.opt.wrap = false -- display lines as one long line
vim.opt.ignorecase = true -- ignore case in search patterns
vim.opt.showtabline = 0 -- always show tabs
vim.opt.smartcase = true -- smart case
vim.opt.smartindent = true -- make indenting smarter again
vim.opt.swapfile = false -- creates a swapfile
vim.opt.timeoutlen = 250 -- time to wait for a mapped sequence to complete (in milliseconds)
vim.opt.showcmd = false
vim.opt.ruler = false
vim.opt.numberwidth = 4 -- set number column width to 2 {default 4}
vim.opt.fillchars.eob = " "

-- vim.opt.background = "dark"                     -- tell vim what the background color looks like
-- vim.opt.whichwrap:append("<,>,[,],h,l")
-- vim.opt.iskeyword:append("-")
