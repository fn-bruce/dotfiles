" ======================== Start Up Settings ============
runtime bundle/pathogen/autoload/pathogen.vim
call pathogen#infect()

" Do not try to be VI compatible
set nocompatible
" Syntax highlighting
syntax enable
" Try to detect filetypes
filetype off
" UTF-8 Support
set encoding=utf-8

" set the runtime path to include Vundle and initialize
set rtp+=~/.vim/bundle/Vundle.vim
call vundle#begin()

Plugin 'VundleVim/Vundle.vim'
Plugin 'nathanaelkane/vim-indent-guides'
Plugin 'altercation/vim-colors-solarized'
Plugin 'ajh17/spacegray.vim'
Plugin 'kien/ctrlp.vim'
Plugin 'mbbill/undotree'
Plugin 'Vimjas/vim-python-pep8-indent'
Plugin 'tpope/vim-fugitive'
Plugin 'scrooloose/nerdtree'
Plugin 'Valloric/YouCompleteMe'
Plugin 'ervandew/supertab'
Plugin 'vim-syntastic/syntastic'
Plugin 'nvie/vim-flake8'
Plugin 'vim-airline/vim-airline'
Plugin 'vim-airline/vim-airline-themes'
Plugin 'dracula/vim'
Plugin 'wikitopian/hardmode'
" Plugin 'Konfekt/FastFold'

call vundle#end()

" Enable loading indent file for filetype
filetype plugin indent on

" THEME SETTINGS
let g:dracula_italic = 0
colorscheme dracula
highlight Normal ctermbg=None
set termguicolors

" INDENT SETTINGS
" let g:indent_guides_enable_on_vim_startup = 1
set ts=4 sw=4 et

" RELATIVE NUMBER
set number relativenumber
augroup numbertoggle
	autocmd!
	autocmd BufEnter,FocusGained,InsertLeave * set relativenumber
	autocmd BufLeave,FocusLost,InsertEnter * set norelativenumber
augroup end

" ============= USER SETTINGS ==================

" Set the leader key to ,
let mapleader = ','

let irdata = '_data'
let irdirs = {'backupdir': 'backup', 'dir': 'swap', 'undodir': 'undo'}
let irsplit = '/'
let irroot = '.vim'

" Checks OS
if has("win32")
    if has("autocmd")
        " Starts gvim in full screen mode
        autocmd GUIEnter * simalt ~x
        " Get rid of this flash crap whenever a buffer is entered
        autocmd GUIEnter * set visualbell t_vb=
    endif
    let irsplit = '\\'
    let irroot = 'vimfiles'

    " Remove special windows keys (copy/paste/etc)
    set keymodel=

    if has("gui_running")
        set guifont=Consolas:h11:cANSI
    endif

elseif has("unix")
    " Some attempts at nice fonts
    if has("gui_running")
        set guifont=Hack\ 11,Inconsolata\ 12,DejaVu\ Sans\ Mono\ 12,Courier\ 12
    endif

elseif has("gui_macvim")
    set lines=75
    set columns=78
    set guifont=Inconsolata\ 12,DejaVu\ Sans\ Mono\ 12,Courier\ 12
endif

" Let's create our _data directory in the vim root.
let irdirname = expand('~' . irsplit . irroot . irsplit . irdata)
if !isdirectory(irdirname)
    call mkdir(irdirname)
endif

" Path to dictionary for vim to use in completion
for wordfile in ['dictionary', 'thesaurus']
    let path = expand('~' . irsplit . irroot . irsplit .  wordfile . ".txt")
    let cmd = "set " . wordfile . "+=" . path
    exec cmd
endfor

" Create the dirs we need.  A little loop will do just fine.
" We'll also go ahead and assign the directories to their options.
for dir in keys(irdirs)
    let tmp = irdirname . irsplit . irdirs[dir]
    if !isdirectory(tmp)
        call mkdir(tmp)
    endif
    let cmd = "set " . dir . "=" . tmp
    exec cmd
endfor

if has("gui_running")
    augroup clear_cursor
        " Stolen from TPetticrew's vimrc
        " Remove line/column selection on inactive panes
        autocmd!
        autocmd WinEnter * setlocal cursorline
        autocmd WinLeave * setlocal nocursorline
        autocmd WinEnter * setlocal cursorcolumn
        autocmd WinLeave * setlocal nocursorcolumn
    augroup END

    " Highlight the cursor line
    set cul
    " Highlight the cursor column
    set cuc
    " Make the mouse disappear when in vim
    set mousehide
    " Give me just the code area. No need for toolbars
    set guioptions=ac
    " My colorsceme
	syntax enable
	set background=light
    " colorscheme hypsteria
    colorscheme dracula
    let g:molokai_original=0
else
    " Adapt colors for dark background
    set background=dark
    set t_Co=256

    augroup clear_cursor
        " Stolen from TPetticrew's vimrc
        " Remove line/column selection on inactive panes
        autocmd!
        autocmd WinEnter * setlocal cursorline
        autocmd WinLeave * setlocal nocursorline
    augroup END

    " Highlight the cursor line
    set cul
    " Make the mouse disappear when in vim
    set mousehide
endif

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
set ch=1
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
set virtualedit=all
" Search as I type
set incsearch
" Use the / instead of \
set shellslash
"No word wrap
" set nowrap
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

" Setup command to easily call to run python buffer
command! RunPythonBuffer call DoRunPythonBuffer()
" Run current buffer in python
noremap <leader>p :RunPythonBuffer<CR>
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

"spaces for indents
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

" auto insert other half of curley braces
inoremap { {}<Esc>i

" Run Python programs
autocmd Filetype python inoremap <C-R> <Esc>:w<CR>:!clear; python %<CR>
autocmd Filetype python nnoremap <buffer> <C-R> :w<CR>:!clear; python %<CR>
autocmd Filetype python vnoremap <C-R> <Esc>:w<CR>:!clear; python %<CR>

" Run C programs
autocmd Filetype c inoremap <buffer> <C-R> <Esc>:w<CR>:!clear; make<CR>
autocmd Filetype c nnoremap <buffer> <C-R> :w<CR>:!clear; make<CR>
autocmd Filetype c vnoremap <buffer> <C-R> <Esc>:w<CR>:!clear; make<CR>

" Pretty python highlight
let python_highlight_all=1

" Sets normal tab to switch between buffers
nnoremap <silent> <Tab> :bnext<CR>
nnoremap <silent> <S-Tab> :bprev<CR>

" changes the normal, insert, and visual cursor shape
" let &t_SI = "\<Esc>]50;CursorShape=1\x7"
" let &t_SR = "\<Esc>]50;CursorShape=2\x7"
" let &t_EI = "\<Esc>]50;CursorShape=0\x7"

" ============= KEY BINDINGS ====================

" Shortcut to grab last inserted text
noremap gV `[v`]
noremap gVV `[V`]

" Map to quickly open and reload my vimrc
noremap <leader>v :e $MYVIMRC<CR><C-W>_
noremap <silent> <leader>V :source $MYVIMRC<CR>:filetype detect<CR>:exe ":echo 'vimrc reloaded'"<CR>

" NERDTREE
noremap <leader>n :NERDTreeToggle<CR>

" ============= PLUGIN SETTINGS =================

" Python Indent
let g:python_pep8_indent_hang_closing = 1

" Supertab
let g:SuperTabDefaultCompletionType = "<C-N>"

" YouCompleteMe
let g:ycm_python_binary_path = '/Users/brucelee/.pyenv/shims/python3'
let g:ycm_autoclose_preview_window_after_completion = 1
map <leader>g :YcmCompleter GoToDefinitionElseDeclaration<CR>

" let g:ycm_python_interpreter_path = ''
" let g:ycm_python_sys_path = []
" let g:ycm_extra_conf_vim_data = [
"     \  'g:ycm_python_interpreter_path',
"     \  'g:ycm_python_sys_path'
"     \]
" let g:ycm_global_ycm_extra_conf = '~/global_extra_conf.py'

" Syntastic
set statusline+=%#warningmsg#
set statusline+=%{SyntasticStatuslineFlag()}
set statusline+=%*

let g:syntastic_always_populate_loc_list = 1
let g:syntastic_auto_loc_list = 1
let g:syntastic_check_on_open = 1
let g:syntastic_check_on_wq = 0
let g:syntastic_python_checkers = ['pylint']

" vim-airline
let g:airline#extensions#tabline#enabled = 1

" vim-airline-themes
let g:airline_theme='dracula'

" FastFold
" nmap zuz <Plug>(FastFoldUpdate)
" let g:fastfold_savehook = 1
" let g:fastfold_fold_command_suffixes =  ['x','X','a','A','o','O','c','C']
" let g:fastfold_fold_movement_commands = [']z', '[z', 'zj', 'zk']

" Hardmode
autocmd VimEnter,BufNewFile,BufReadPost * silent! call HardMode()
