syntax on
filetype plugin indent on

set mouse=a
set hidden                              " Required to keep multiple buffers open multiple buffers
set wrap
set breakindent
set breakindentopt=sbr
set showbreak=↪\ 
set encoding=utf-8                      " The encoding displayed
set pumheight=10                        " Makes popup menu smaller
set fileencoding=utf-8                  " The encoding written to file
set cmdheight=1                         " More space for displaying messages
set splitbelow                          " Horizontal splits will automatically be below
set splitright                          " Vertical splits will automatically be to the right
set conceallevel=0                      " So that I can see `` in markdown files
set tabstop=2
set softtabstop=2
set shiftwidth=2                        " Change the number of space characters inserted for indentation
set smarttab                            " Makes tabbing smarter will realize you have 2 vs 4
set expandtab                           " Converts tabs to spaces
set smartindent                         " Makes indenting smart
set autoindent                          " Good auto indent
set laststatus=2                        " Always display the status line
set number                              " Line numbers
set relativenumber                      " Display relative numbers to current cursor location
set background=dark                     " tell vim what the background color looks like
" set showtabline=2                       " Always show tabs
set noshowmode                          " We don't need to see things like -- INSERT -- anymore
set nobackup                            " This is recommended by coc
set nowritebackup                       " This is recommended by coc
set shortmess+=c                        " Don't pass messages to |ins-completion-menu|.
set signcolumn=yes                      " Always show the signcolumn, otherwise it would shift the text each time
set updatetime=50                       " Faster completion
set incsearch
set guifont=Hack\ Nerd\ Font
set scrolloff=8
set completeopt=menu,menuone,noselect
set undodir=~/.config/nvim/.nvim/undodir
set undofile
set termguicolors
set nohlsearch
set cursorline

call plug#begin('~/.config/nvim/.nvim/plugged')

" Explorer
Plug 'kyazdani42/nvim-tree.lua'
Plug 'kyazdani42/nvim-web-devicons'

" LSP
Plug 'neovim/nvim-lspconfig'
Plug 'glepnir/lspsaga.nvim'

" Diagnostics
Plug 'folke/trouble.nvim'

" Completion
Plug 'neovim/nvim-lspconfig'
Plug 'hrsh7th/cmp-nvim-lsp'
Plug 'hrsh7th/cmp-buffer'
Plug 'hrsh7th/cmp-path'
Plug 'hrsh7th/cmp-cmdline'
Plug 'hrsh7th/nvim-cmp'

" Snippet
Plug 'L3MON4D3/LuaSnip'
Plug 'saadparwaiz1/cmp_luasnip'
Plug 'rafamadriz/friendly-snippets'

" Neovim Tree sitter
Plug 'nvim-treesitter/nvim-treesitter', {'do': ':TSUpdate'}
Plug 'nvim-treesitter/playground'

" Mappings
Plug 'tpope/vim-repeat'
Plug 'tpope/vim-surround'
Plug 'glts/vim-radical'
Plug 'glts/vim-magnum'
Plug 'tpope/vim-commentary'

" Automatic
Plug 'windwp/nvim-autopairs'
Plug 'alvan/vim-closetag'

" Git
Plug 'tpope/vim-fugitive'
Plug 'kdheepak/lazygit.nvim'

" Debugging
Plug 'mfussenegger/nvim-dap'
Plug 'nvim-telescope/telescope-dap.nvim'
Plug 'theHamsta/nvim-dap-virtual-text'

" Telescope
Plug 'nvim-lua/plenary.nvim'
Plug 'nvim-telescope/telescope.nvim'

" Theme
Plug 'morhetz/gruvbox'
" Plug 'ayu-theme/ayu-vim'
Plug 'Shatur/neovim-ayu'

" Indent Lines
Plug 'lukas-reineke/indent-blankline.nvim'

" Status Bar
Plug 'nvim-lualine/lualine.nvim'
Plug 'kyazdani42/nvim-web-devicons'

" Start Up Screen
Plug 'goolord/alpha-nvim'

" Markdown
Plug 'iamcco/markdown-preview.nvim', { 'do': 'cd app && npm install'  }

" LaTex
Plug 'lervag/vimtex'

" Zen Mode
Plug 'junegunn/goyo.vim'
Plug 'junegunn/limelight.vim'

" Terminal
Plug 'akinsho/toggleterm.nvim'

" Signature Help Enhances
Plug 'ray-x/lsp_signature.nvim'

call plug#end()

nnoremap <SPACE> <Nop>
let mapleader = " "

let ayucolor="dark"
colorscheme ayu

" Makes relative number work good when navigating to different panes
augroup numbertoggle
	autocmd!
	autocmd BufEnter,FocusGained,InsertLeave,WinEnter * if &number | set relativenumber   | endif
	autocmd BufLeave,FocusLost,InsertEnter,WinLeave   * if &number | set norelativenumber | endif
augroup END

" Replace currently selected text with default register without yanking it
vnoremap <leader>p "_dP

" Copy text to clipboard
nnoremap <leader>y "+y
vnoremap <leader>y "+y
nnoremap <leader>Y gg"+yG

" resize
noremap <leader>+ :vertical resize +5<CR>
nnoremap <leader>- :vertical resize -5<CR>

" move block vertically
vnoremap J :m '>+1<CR>gv=gv
vnoremap K :m '<-2<CR>gv=gv

" disable providers
let g:loaded_perl_provider = 0
let g:loaded_python_provider = 0

" file indents
autocmd BufNewFile,BufRead *.cs set tabstop=4
autocmd BufNewFile,BufRead *.cs set softtabstop=4
autocmd BufNewFile,BufRead *.cs set shiftwidth=4

autocmd BufNewFile,BufRead,BufEnter *.rs set tabstop=4
autocmd BufNewFile,BufRead,BufEnter *.rs set softtabstop=4
autocmd BufNewFile,BufRead,BufEnter *.rs set shiftwidth=4

" gray
highlight! CmpItemAbbrDeprecated guibg=NONE gui=strikethrough guifg=#808080
" blue
highlight! CmpItemAbbrMatch guibg=NONE guifg=#569CD6
highlight! CmpItemAbbrMatchFuzzy guibg=NONE guifg=#569CD6
" light blue
highlight! CmpItemKindVariable guibg=NONE guifg=#9CDCFE
highlight! CmpItemKindInterface guibg=NONE guifg=#9CDCFE
highlight! CmpItemKindText guibg=NONE guifg=#9CDCFE
" pink
highlight! CmpItemKindFunction guibg=NONE guifg=#C586C0
highlight! CmpItemKindMethod guibg=NONE guifg=#C586C0
" front
highlight! CmpItemKindKeyword guibg=NONE guifg=#D4D4D4
highlight! CmpItemKindProperty guibg=NONE guifg=#D4D4D4
highlight! CmpItemKindUnit guibg=NONE guifg=#D4D4D4

augroup CppRun
  autocmd!
  autocmd filetype cpp nnoremap <F5> :wa<CR>:!tmux split-window 'g++ % ; ./a.out ; read'<CR><CR>
  autocmd filetype cpp inoremap <F5> <ESC>:wa<CR>:!tmux split-window 'g++ % ; ./a.out ; read'<CR><CR>
augroup END

augroup DotNetRun
  autocmd!
  autocmd filetype cs nnoremap <F5> :wa<CR>:!tmux split-window 'dotnet run ; read'<CR><CR>
  autocmd filetype cs inoremap <F5> <ESC>:wa<CR>:!tmux split-window 'dotnet run ; read'<CR><CR>
augroup END

augroup CargoRun
  autocmd!
  autocmd filetype rust nnoremap <F5> :wa<CR>:!tmux split-window 'cargo run ; read'<CR><CR>
  autocmd filetype rust inoremap <F5> <ESC>:wa<CR>:!tmux split-window 'cargo run ; read'<CR><CR>
augroup END

" window movement
inoremap <C-h> <C-\><C-N><C-w>h
inoremap <C-j> <C-\><C-N><C-w>j
inoremap <C-k> <C-\><C-N><C-w>k
inoremap <C-l> <C-\><C-N><C-w>l
nnoremap <C-h> <C-w>h
nnoremap <C-j> <C-w>j
nnoremap <C-k> <C-w>k
nnoremap <C-l> <C-w>l

" split vertical
nnoremap <leader>% :vertical split<CR>

" split horizontal
nnoremap <leader>" :split<CR>

" autocmd TermOpen * setlocal nonumber norelativenumber
autocmd TermOpen,BufWinEnter,WinEnter term://* startinsert
