set encoding=utf-8
syntax on


set nocompatible
filetype off

set rtp+=~/.vim/bundle/Vundle.vim
call vundle#begin()

" Plugin 'vim-syntastic/syntastic'
Plugin 'Valloric/YouCompleteMe'
Plugin 'Yggdroot/indentLine'
Plugin 'alvan/vim-closetag'
Plugin 'ayu-theme/ayu-vim'
Plugin 'gmarik/Vundle.vim'
Plugin 'jiangmiao/auto-pairs'
Plugin 'kien/ctrlp.vim'
Plugin 'nvie/vim-flake8'
Plugin 'scrooloose/nerdtree'
Plugin 'tmhedberg/SimpylFold'
Plugin 'tpope/vim-fugitive'
Plugin 'tpope/vim-surround'
Plugin 'tpope/vim-commentary'
Plugin 'vim-airline/vim-airline'
Plugin 'vim-airline/vim-airline-themes'
Plugin 'christoomey/vim-system-copy'
Plugin 'christoomey/vim-sort-motion'
Plugin 'christoomey/vim-titlecase'

call vundle#end()
filetype plugin indent on

" Theme Settings
set termguicolors
set background=dark
colorscheme ayu
let ayucolor="mirage"

" remap leader to ,
let mapleader = ','

" save quicker
nnoremap <leader>w :w<CR>

" don't wrap text
set nowrap

" sensible side scroll
set sidescroll=1

" relative line numbers
set number relativenumber

augroup numbertoggle
	autocmd!
	autocmd BufEnter,FocusGained,InsertLeave,WinEnter * if &number | set relativenumber   | endif
	autocmd BufLeave,FocusLost,InsertEnter,WinLeave   * if &number | set norelativenumber | endif
augroup END

"split navigations
nnoremap <C-J> <C-W><C-J>
nnoremap <C-K> <C-W><C-K>
nnoremap <C-L> <C-W><C-L>
nnoremap <C-H> <C-W><C-H>

" more natural split opening
set splitbelow
set splitright

" enable folding
set foldmethod=indent
set foldlevel=99

" enable folding with the spacebar
nnoremap <space> za

" PIP 8 indentation
autocmd BufNewFile,BufRead *.py set tabstop=4
autocmd BufNewFile,BufRead *.py set softtabstop=4
autocmd BufNewFile,BufRead *.py set shiftwidth=4
autocmd BufNewFile,BufRead *.py set textwidth=79
autocmd BufNewFile,BufRead *.py set expandtab
autocmd BufNewFile,BufRead *.py set autoindent
autocmd BufNewFile,BufRead *.py set fileformat=unix

" HTML indentation
autocmd BufRead,BufNewFile *.htm,*.html setlocal tabstop=2 shiftwidth=2 softtabstop=2

" indentation for all files
autocmd BufNewFile,BufRead * set tabstop=4
autocmd BufNewFile,BufRead * set softtabstop=4
autocmd BufNewFile,BufRead * set shiftwidth=4
autocmd BufNewFile,BufRead * set expandtab
autocmd BufNewFile,BufRead * set autoindent
autocmd BufNewFile,BufRead * set fileformat=unix

" flag unnecessary whitespace
autocmd BufRead,BufNewFile *.py,*.pyw,*.c,*.h highlight ExtraWhitespace ctermbg=red guibg=red
autocmd BufRead,BufNewFile *.py,*.pyw,*.c,*.h match ExtraWhitespace /\s\+$/

" SimpylFold Settings
let g:SimpylFold_docstring_preview = 1

" YouComplete Settings
let g:ycm_autoclose_preview_window_after_completion=1
map <leader>g  :YcmCompleter GoToDefinitionElseDeclaration<CR>

" syntastic settings
" set statusline+=%#warningmsg#
" set statusline+=%{SyntasticStatuslineFlag()}
" set statusline+=%*

let g:syntastic_always_populate_loc_list = 1
let g:syntastic_auto_loc_list = 1
let g:syntastic_check_on_open = 1
let g:syntastic_check_on_wq = 0

" indentLine Settings
let g:indentLine_char = ''
let g:indentLine_first_char = ''
let g:indentLine_showFirstIndentLevel = 1
let g:indentLine_setColors = 0

" NERDTree Settings
map <leader>n :NERDTreeToggle<CR>
autocmd bufenter * if (winnr("$") == 1 && exists("b:NERDTree") && b:NERDTree.isTabTree()) | q | endif
let NERDTreeIgnore=['\.pyc$', '\~$'] "ignore files in NERDTree

" flake8 Setings
autocmd FileType python map <leader>f :call flake8#Flake8()<CR>

" vim-airline Settings
let g:airline_theme='base16'
