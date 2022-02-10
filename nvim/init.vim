syntax on
filetype plugin indent on

set mouse=a
set hidden                              " Required to keep multiple buffers open multiple buffers
set nowrap                              " Display long lines as just one line
set encoding=utf-8                      " The encoding displayed
set pumheight=10                        " Makes popup menu smaller
set fileencoding=utf-8                  " The encoding written to file
set cmdheight=2                         " More space for displaying messages
set splitbelow                          " Horizontal splits will automatically be below
set splitright                          " Vertical splits will automatically be to the right
set conceallevel=0                      " So that I can see `` in markdown files
set tabstop=2 softtabstop=2
set shiftwidth=2                        " Change the number of space characters inserted for indentation
set smarttab                            " Makes tabbing smarter will realize you have 2 vs 4
set expandtab                           " Converts tabs to spaces
set smartindent                         " Makes indenting smart
set autoindent                          " Good auto indent
set laststatus=2                        " Always display the status line
set number                              " Line numbers
set relativenumber                      " Display relative numbers to current cursor location
set background=dark                     " tell vim what the background color looks like
set showtabline=2                       " Always show tabs
set noshowmode                          " We don't need to see things like -- INSERT -- anymore
set nobackup                            " This is recommended by coc
set nowritebackup                       " This is recommended by coc
set shortmess+=c                        " Don't pass messages to |ins-completion-menu|.
set signcolumn=yes                      " Always show the signcolumn, otherwise it would shift the text each time
set updatetime=50                       " Faster completion
set incsearch
set guifont=Hack\ Nerd\ Font\ Mono
set scrolloff=8
set completeopt=menuone,noinsert,noselect
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

" Completion
Plug 'neovim/nvim-lspconfig'
Plug 'hrsh7th/cmp-nvim-lsp'
Plug 'hrsh7th/cmp-buffer'
Plug 'hrsh7th/cmp-path'
Plug 'hrsh7th/cmp-cmdline'
Plug 'hrsh7th/nvim-cmp'

" Snippet
Plug 'hrsh7th/vim-vsnip'
Plug 'hrsh7th/vim-vsnip-integ'

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

" Telescope
Plug 'nvim-lua/plenary.nvim'
Plug 'nvim-telescope/telescope.nvim'

" Theme
Plug 'morhetz/gruvbox' 
Plug 'ayu-theme/ayu-vim' 


" Airline
Plug 'vim-airline/vim-airline'
Plug 'vim-airline/vim-airline-themes'

" Elixir
Plug 'elixir-editors/vim-elixir'

call plug#end() 

nnoremap <SPACE> <Nop>
let mapleader = " "

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

" source init.vim
nnoremap <Leader><CR> :so ~/.config/nvim/init.vim<CR>
