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
set tabstop=4 softtabstop=4
set shiftwidth=4                        " Change the number of space characters inserted for indentation
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

call plug#begin('~/.config/nvim/.nvim/plugged')

Plug 'preservim/nerdtree'

" LSP
Plug 'neovim/nvim-lspconfig'
Plug 'nvim-lua/completion-nvim'

" Neovim Tree sitter
Plug 'nvim-treesitter/nvim-treesitter', {'do': ':TSUpdate'}
Plug 'nvim-treesitter/playground'

" Man Page View
Plug 'vim-utils/vim-man'

" Mappings
Plug 'tpope/vim-repeat'
Plug 'tpope/vim-surround'
Plug 'glts/vim-radical'
Plug 'glts/vim-magnum'
Plug 'tpope/vim-commentary'
Plug 'christoomey/vim-tmux-navigator'

" Automatic
Plug 'jiangmiao/auto-pairs'
Plug 'alvan/vim-closetag'

" Git
Plug 'tpope/vim-fugitive'

Plug 'junegunn/fzf', { 'do': { -> fzf#install() } }
Plug 'junegunn/fzf.vim'

" Theme
Plug 'morhetz/gruvbox' 

" Airline
Plug 'vim-airline/vim-airline'
Plug 'vim-airline/vim-airline-themes'


call plug#end() 


nnoremap <SPACE> <Nop>
let mapleader = " "

colorscheme gruvbox

" Makes relative number work good when navigating to different panes
augroup numbertoggle
	autocmd!
	autocmd BufEnter,FocusGained,InsertLeave,WinEnter * if &number | set relativenumber   | endif
	autocmd BufLeave,FocusLost,InsertEnter,WinLeave   * if &number | set norelativenumber | endif
augroup END

" Indentation for all files
autocmd BufNewFile,BufRead * set tabstop=2
autocmd BufNewFile,BufRead * set softtabstop=2
autocmd BufNewFile,BufRead * set shiftwidth=2
autocmd BufNewFile,BufRead * set expandtab
autocmd BufNewFile,BufRead * set autoindent

" Python indentation
autocmd BufNewFile,BufRead *.py set tabstop=4
autocmd BufNewFile,BufRead *.py set softtabstop=4
autocmd BufNewFile,BufRead *.py set shiftwidth=4
autocmd BufNewFile,BufRead *.py set colorcolumn=80

" HTML, JS, and CSS indentation
autocmd BufNewFile,BufRead *.html,*.js,*.css set tabstop=2
autocmd BufNewFile,BufRead *.html,*.js,*.css set shiftwidth=2
autocmd BufNewFile,BufRead *.html,*.js,*.css set softtabstop=2
autocmd BufNewFile,BufRead *.html set filetype=htmldjango

" JSON indentation
autocmd BufNewFile,BufRead *.json set tabstop=2
autocmd BufNewFile,BufRead *.json set shiftwidth=2
autocmd BufNewFile,BufRead *.json set softtabstop=2

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

" lsp stuff
nnoremap <leader>vd :lua vim.lsp.buf.definition()<CR>
nnoremap <leader>vi :lua vim.lsp.buf.implementation()<CR>
nnoremap <leader>vsh :lua vim.lsp.buf.signature_help()<CR>
nnoremap <leader>vrr :lua vim.lsp.buf.references()<CR>
nnoremap <leader>vrn :lua vim.lsp.buf.rename()<CR>
nnoremap <leader>vh :lua vim.lsp.buf.hover()<CR>
nnoremap <leader>vca :lua vim.lsp.buf.code_action()<CR>
nnoremap <leader>vsd :lua vim.lsp.util.show_line_diagnostics(); vim.lsp.util.show_line_diagnostics()<CR>

" source init.vim
nnoremap <Leader><CR> :so ~/.config/nvim/init.vim<CR>


" vim-airline-themes
let g:airline_theme='gruvbox'

" completion
let g:completion_matching_strategy_list = ['exact', 'substring', 'fuzzy']
" lua require('lspconfig').tsserver.setup{ on_attach=require('completion').on_attach }
" lua require('lspconfig').pyls.setup{ on_attach=require('completion').on_attach }
let g:completion_confirm_key = "\<C-y>"

" LSP
lua << EOF
  vim.lsp.handlers["textDocument/publishDiagnostics"] = vim.lsp.with(
    vim.lsp.diagnostic.on_publish_diagnostics, {
      -- Disable signs
      signs = false,
    }
  )
EOF

" fzf
let g:fzf_layout = { 'window': { 'width': 0.8, 'height': 0.8 } }
let $FZF_DEFAULT_OPTS='--reverse'

" vim-repeat
silent! call repeat#set("\<Plug>RadicalView", v:count)
silent! call repeat#set("\<Plug>RadicalCoerceToDecimal", v:count)
silent! call repeat#set("\<Plug>RadicalCoerceToHex", v:count)
silent! call repeat#set("\<Plug>RadicalCoerceToOctal", v:count)

" closetag
let g:closetag_filenames = '*.html,*.js,*.ts,*.jsx'

" treesitter
lua require('nvim-treesitter.configs').setup { highlight = { enable = true } }

" commentary
autocmd FileType javascript.jsx setlocal commentstring={/*\ %s\ */}

" NERDTree
nnoremap <leader>n :NERDTreeToggle<CR>
