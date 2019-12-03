" ============================= \
"  ___                           \
" | _ )_ _ _  _ __ ___ _ _ __     \
" | _ \ '_| || / _/ -_) '_/ _|     |
" |___/_|  \_,_\__\___|_| \__|    /
"                                /
" ============================= /


" ============================= \
" Table of contents:             |
"   1. Plugins                   |
"   2. General Settings          |
"   3. Remapping Keys            |
"   4. Automatic Commands        |
"   5. Plugin Settings           |
" ============================= /


" ==========\
" 1. Plugins |
" ==========/


call plug#begin('~/.vim/plugged')

Plug 'Valloric/YouCompleteMe', { 'do': './install.py' }
Plug 'Yggdroot/indentLine'
Plug 'alvan/vim-closetag'
Plug 'ayu-theme/ayu-vim'
Plug 'christoomey/vim-sort-motion'
Plug 'christoomey/vim-system-copy'
Plug 'christoomey/vim-titlecase'
Plug 'gmarik/Vundle.vim'
Plug 'jiangmiao/auto-pairs'
Plug 'kien/ctrlp.vim'
Plug 'neomake/neomake'
Plug 'nvie/vim-flake8'
Plug 'scrooloose/nerdtree'
Plug 'tmhedberg/SimpylFold'
Plug 'tpope/vim-commentary'
Plug 'tpope/vim-fugitive'
Plug 'tpope/vim-surround'
Plug 'vim-airline/vim-airline'
Plug 'vim-airline/vim-airline-themes'
Plug 'godlygeek/tabular'

call plug#end()


" ===================\
" 2. General Settings |
" ===================/


syntax on
filetype plugin indent on
set nocompatible
set encoding=utf-8
" set nowrap
set sidescroll=1
set number relativenumber
set termguicolors
set background=dark
set splitbelow
set splitright
set foldmethod=indent
set foldlevel=99

colorscheme ayu
let ayucolor="mirage"


" =================\
" 3. Remapping Keys |
" =================/


" Remap leader to comma
let mapleader = ','

" save faster
nnoremap <leader>w :w<CR>

" split navigations
nnoremap <C-J> <C-W><C-J>
nnoremap <C-K> <C-W><C-K>
nnoremap <C-L> <C-W><C-L>
nnoremap <C-H> <C-W><C-H>

" enable folding with the spacebar
nnoremap <space> za

" open html files quickly
autocmd Filetype html nnoremap <leader>r :w<CR>:!open %<CR><CR>


" =====================\
" 4. Automatic Commands |
" =====================/


" makes relative number work good when navigating to different panes
augroup numbertoggle
	autocmd!
	autocmd BufEnter,FocusGained,InsertLeave,WinEnter * if &number | set relativenumber   | endif
	autocmd BufLeave,FocusLost,InsertEnter,WinLeave   * if &number | set norelativenumber | endif
augroup END

" PIP 8 indentation
autocmd BufNewFile,BufRead *.py set tabstop=4
autocmd BufNewFile,BufRead *.py set softtabstop=4
autocmd BufNewFile,BufRead *.py set shiftwidth=4
autocmd BufNewFile,BufRead *.py set textwidth=79
autocmd BufNewFile,BufRead *.py set expandtab
autocmd BufNewFile,BufRead *.py set autoindent
autocmd BufNewFile,BufRead *.py set fileformat=unix

" indentation for all files
autocmd BufNewFile,BufRead * set tabstop=4
autocmd BufNewFile,BufRead * set softtabstop=4
autocmd BufNewFile,BufRead * set shiftwidth=4
autocmd BufNewFile,BufRead * set expandtab
autocmd BufNewFile,BufRead * set autoindent
" autocmd BufNewFile,BufRead * set fileformat=unix

" HTML, JS, and CSS indentation
autocmd BufNewFile,BufRead *.html,*.js,*.css setlocal tabstop=2 shiftwidth=2 softtabstop=2

" flag unnecessary whitespace
autocmd BufRead,BufNewFile *.py,*.pyw,*.c,*.h highlight ExtraWhitespace ctermbg=red guibg=red
autocmd BufRead,BufNewFile *.py,*.pyw,*.c,*.h match ExtraWhitespace /\s\+$/


" ==================\
" 5. Plugin Settings |
" ==================/


" SimpylFold
let g:SimpylFold_docstring_preview = 1

" YouComplete
let g:ycm_autoclose_preview_window_after_completion=1
map <leader>g:YcmCompleter GoToDefinitionElseDeclaration<CR>

" indentLine
let g:indentLine_char = ''
let g:indentLine_first_char = ''
let g:indentLine_showFirstIndentLevel = 1
let g:indentLine_setColors = 0

" NERDTree
map <leader>n :NERDTreeToggle<CR>
autocmd bufenter * if (winnr("$") == 1 && exists("b:NERDTree") && b:NERDTree.isTabTree()) | q | endif
let NERDTreeIgnore=['\.pyc$', '\~$'] "ignore files in NERDTree

" flake8
autocmd FileType python map <leader>f :call flake8#Flake8()<CR>

" vim-airline
let g:airline_theme='base16'
let g:airline#extensions#tabline#enabled = 1

" neomake
call neomake#configure#automake('nrwi', 500)
