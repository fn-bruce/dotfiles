" ==================================================
" >                                                <
" >               Bruce's .vimrc                   <
" >                                                <
" ==================================================

runtime bundle/pathogen/autoload/pathogen.vim
call pathogen#infect()

set rtp+=~/.vim/bundle/Vundle.vim
call vundle#begin()

Plugin 'VundleVim/Vundle.vim'
Plugin 'altercation/vim-colors-solarized'
Plugin 'ajh17/spacegray.vim'
Plugin 'kien/ctrlp.vim'
Plugin 'jeetsukumaran/vim-buffergator'
Plugin 'mbbill/undotree'
Plugin 'Vimjas/vim-python-pep8-indent'
Plugin 'tpope/vim-fugitive'
Plugin 'scrooloose/nerdtree'
Plugin 'ervandew/supertab'
Plugin 'vim-syntastic/syntastic'
Plugin 'nvie/vim-flake8'
Plugin 'vim-airline/vim-airline'
Plugin 'vim-airline/vim-airline-themes'
Plugin 'dracula/vim'
Plugin 'wikitopian/hardmode'
Plugin 'mechatroner/rainbow_csv'

call vundle#end()

" =====================================
" >          Theme Settings           <
" =====================================
let g:dracula_italic = 0
let g:dracula_colorterm = 0
colorscheme dracula
highlight Normal ctermbg=None
set termguicolors
set number relativenumber
set background=dark
set t_Co=256

" =====================================
" >           User Settings           <
" =====================================

set nocompatible
syntax enable
set encoding=utf-8
filetype plugin indent on

" Set the leader key to ,
let mapleader = ','

" Remove line/column selection on inactive panes
augroup clear_cursor

    autocmd!
    autocmd WinEnter * setlocal cursorline
    autocmd WinLeave * setlocal nocursorline
augroup END

" Highlight the cursor line
set cursorline

" Make the mouse disappear when in vim
set mousehide

" Disable Arrow Keys
inoremap <Up> <nop>
inoremap <Down> <nop>
inoremap <Left> <nop>
inoremap <Right> <nop>
noremap <Up> <nop>
noremap <Down> <nop>
noremap <Left> <nop>
noremap <Right> <nop>

" Make command line one line high
" set ch=1

" Keep 3 lines when scrolling
set scrolloff=3

" Always set autoindenting on
set autoindent

" Turn off erroring and beeping
set noerrorbells

" Show title in console title bar
set title

" Don't jump to first character when paging
set nostartofline

" Start,indent,eol
set backspace=2

" Show matching <> (html mainly) as well
set matchpairs+=<:>

" Jump to matching brace immediately after insert
set showmatch

" Time vim will sit on the matching brace
set matchtime=3

" Abbreviate messages
set shortmess=atI

" Highlight search items
set hlsearch

" Tab complete commands
set wildmenu

" Complete from a Dictionary if possible
set complete+=,k

" List longest first. Don't know if I want this
" set wildmode=list:longest,full
" Whoever wanted to modify a .pyc?
set wildignore+=*.pyc

" Commandline remembrance
" set history=10000
" Give me lots of Undos
set undolevels=10000

" Let my cursor go everywhere
" set virtualedit=all
" Search as I type
set incsearch

" Use the / instead of \
set shellslash

"No word wrap
set nowrap

" Settings for vim to remember stuff on startup :help viminfo
set viminfo='1000,h

" Always show status line
set laststatus=2

" Harder to explain but an awesome statusline just for me
" %r tells me if the file is readonly
" %{fugitive#statusline()} Lets me know what Git branch I'm in.
" %{expand('%:p')} gives me the full path to the file
" %l/%L current line and total lines
" %v current column
" set statusline=\ [%r]\ %n\ %{fugitive#statusline()}\ F:%{expand('%:p')}\ L:%l/%L\ C:%v
" This removes the characters between split windows (and some other junk)
set fillchars="-"

" This allows vim to work with buffers more liberally. So no warnings when
" switching modified buffers
set hidden

" Persistent undos
set undofile

" What information to save when creating a session.
set sessionoptions=buffers,resize,winpos,winsize

" Turning the mosue off.  Suck it mouse users.
set mouse=""

" Setting the language to everything NOT American English.
set spelllang=en_gb,en_nx,en_au,en_ca

" Ensure that all my auto formatting is minimal
set formatoptions=""

if has("autocmd")

    " I've set up these groups at the recommendation of Steve Losh's
    " Learn Vimscript the Hardway
    augroup clear_whitespace

        " Automatically delete trailing white spaces
        autocmd!
        autocmd BufEnter,BufRead,BufWrite * silent! %s/[\r \t]\+$//
        autocmd BufEnter *.php :%s/[ \t\r]\+$//e
    augroup END

    augroup set_working_path

        " Set current directory to that of the opened files
        autocmd!
        autocmd BufEnter,BufWrite * silent! lcd %:p:h
    augroup END

    augroup set_filetypes

        " Set some filtype stuff up
        autocmd!
        autocmd BufRead,BufNewFile *.ma setf mel
		autocmd BufRead,BufNewFile *.ms setf maxscript
        autocmd BufRead,BufNewFile SConstruct setf python
    augroup END

    augroup set_tabbing

        " Filetype specific tabbing
        autocmd!

        " autocmd FileType * setlocal ts=4 sts=4 sw=4 noexpandtab cindent
        autocmd FileType python,vim,vimrc setlocal ts=4 sts=4 sw=4 expandtab
        autocmd FileType html,ruby setlocal ts=2 sts=2 sw=2 expandtab
    augroup END

    augroup set_text_width

        " Set default textwidth
        autocmd!
        autocmd BufEnter * let b:textwidth=80
        autocmd Filetype python let b:textwidth=79
    augroup END
endif

" Echo current file path and put in middle mouse buffer
noremap <leader>f :let @*=expand('%:p')<CR>:echom @*<CR>

" Move around split panes easier
nnoremap <C-J> <C-W><C-J>
nnoremap <C-K> <C-W><C-K>
nnoremap <C-L> <C-W><C-L>
nnoremap <C-H> <C-W><C-H>

" More natural split opening
set splitbelow
set splitright

" Number of spaces that a pre-existing tab is equal to.
au BufRead,BufNewFile *py,*pyw,*.c,*.h set tabstop=4

" spaces for indents
au BufRead,BufNewFile *.py,*pyw set shiftwidth=4
au BufRead,BufNewFile *.py set softtabstop=4
au BufRead,BufNewFile *.py,*.pyw set expandtab

" JSON settings
au! BufRead,BufNewFile *.json set filetype=json
augroup json_autocmd
  autocmd!
  autocmd FileType json set autoindent
  autocmd FileType json set formatoptions=tcq2l
  autocmd FileType json set textwidth=78 shiftwidth=2
  autocmd FileType json set softtabstop=2 tabstop=8
  autocmd FileType json set expandtab
  autocmd FileType json set foldmethod=syntax
augroup END

" Run Python programs
autocmd Filetype python inoremap <C-R> <Esc>:w<CR>:!clear; python3 %<CR>
autocmd Filetype python nnoremap <buffer> <C-R> :w<CR>:!clear; python3 %<CR>
autocmd Filetype python vnoremap <C-R> <Esc>:w<CR>:!clear; python3 %<CR>

" Run C programs
autocmd Filetype c inoremap <buffer> <C-R> <Esc>:w<CR>:!clear; make<CR>
autocmd Filetype c nnoremap <buffer> <C-R> :w<CR>:!clear; make<CR>
autocmd Filetype c vnoremap <buffer> <C-R> <Esc>:w<CR>:!clear; make<CR>

" Run Bash Scripts
autocmd Filetype sh inoremap <buffer> <C-R> <Esc>:w<CR>:!clear; ./%<CR>
autocmd Filetype sh nnoremap <buffer> <C-R> :w<CR>:!clear; ./%<CR>
autocmd Filetype sh vnoremap <buffer> <C-R> <Esc>:w<CR>:!clear; ./%<CR>

" Pretty python highlight
let python_highlight_all=1

" Opens a new empty buffer
nnoremap <leader>T :enew<CR>

" Sets normal tab to switch between buffers
nnoremap <leader>l :bnext<CR>
nnoremap <leader>h :bprevious<CR>

" Close the current buffer and move to the previous one
nnoremap <leader>bq :bp <BAR> bd #<CR>

" Show all open buffers and their status
nnoremap <leader>bl :ls<CR>


" =====================================
" >            Key Bindings           <
" =====================================

" Shortcut to grab last inserted text
noremap gV `[v`]
noremap gVV `[V`]

" Map to quickly open and reload my vimrc
noremap <leader>v :e $MYVIMRC<CR><C-W>_
noremap <silent> <leader>V :source $MYVIMRC<CR>:filetype detect<CR>:exe ":echo 'vimrc reloaded'"<CR>

" NERDTREE
noremap <leader>n :NERDTreeToggle<CR>

" =====================================
" >         Plugin Settings           <
" =====================================


" =====================================
"               NERD Tree
" =====================================
let NERDTreeShowHidden = 1


" =====================================
"            Python Indent
" =====================================
let g:python_pep8_indent_hang_closing = 1


" =====================================
"               Supertab
" =====================================
let g:SuperTabDefaultCompletionType = "<C-N>"


" =====================================
"             Syntastic
" =====================================
set statusline+=%#warningmsg#
set statusline+=%{SyntasticStatuslineFlag()}
set statusline+=%*

let g:syntastic_always_populate_loc_list = 1
let g:syntastic_auto_loc_list = 1
let g:syntastic_check_on_open = 1
let g:syntastic_check_on_wq = 0
let g:syntastic_python_checkers = ['pylint']


" =====================================
"                CtrlP
" =====================================
" Setup some default ignores
let g:ctrlp_custom_ignore = {
    \ 'dir':  '\v[\/](\.(git|hg|svn)|\_site)$',
    \ 'file': '\v\.(exe|so|dll|class|png|jpg|jpeg)$',
\}

" Use the nearest .git directory as the cwd
" This makes a lot of sense if you are working on a project that is in version
" control. It also supports works with .svn, .hg, .bzr.
let g:ctrlp_working_path_mode = 'r'

" Use a leader instead of the actual named binding
noremap <leader>p :CtrlP<CR>

" Easy bindings for its various modes
nnoremap <leader>bb : CtrlPBuffer<CR>
nnoremap <leader>bm : CtrlPMixed<CR>
nnoremap <leader>bs : CtrlPMRU<CR>


" =====================================
"             Buffergator
" =====================================
" Use the right side of the screen
let g:buffergator_viewport_split_policy = 'R'

" I want my own keymappings...
let g:buffergator_suppress_keymaps = 1

" Looper buffers
"let g:buffergator_mru_cycle_loop = 1

" Go to the previous buffer open
nnoremap <leader>jj :BuffergatorMruCyclePrev<CR>

" Go to the next buffer open
nnoremap <leader>kk :BuffergatorMruCycleNext<CR>

" View the entire list of buffers open
nnoremap <leader>bl :BuffergatorOpen<CR>


" =====================================
"              vim-airline
" =====================================
let g:airline#extensions#tabline#enabled = 1


" =====================================
"          vim-airline-themes
" =====================================
let g:airline_theme='dracula'


" =====================================
"             Hardmode
" =====================================
" autocmd VimEnter,BufNewFile,BufReadPost * silent! call HardMode()

