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

call plug#begin('~/.vim/plugged') " https://www.github.com/junegunn/vim-plug

" Plug 'christoomey/vim-sort-motion' " https://www.github.com/christoomey/vim-sort-motion
Plug 'Xuyuanp/nerdtree-git-plugin' " https://github.com/Xuyuanp/nerdtree-git-plugin
Plug 'Yggdroot/indentLine' " https://www.github.com/Yggdroot/indentLine
Plug 'alvan/vim-closetag' " https://www.github.com/alvan/vim-closetag
Plug 'christoomey/vim-system-copy' " https://www.github.com/christoomey/vim-system-copy
Plug 'christoomey/vim-titlecase' " https://www.github.com/christoomey/vim-titlecase
Plug 'elzr/vim-json' " https://github.com/elzr/vim-json
Plug 'gmarik/Vundle.vim' " https://www.github.com/gmarik/Vundle.vim
Plug 'godlygeek/tabular' " https://www.github.com/godlygeek/tabular
Plug 'jiangmiao/auto-pairs' " https://www.github.com/jiangmiao/auto-pairs
Plug 'kien/ctrlp.vim' " https://www.github.com/kien/ctrlp.vim
Plug 'neoclide/coc.nvim', {'branch': 'release'} " https://github.com/neoclide/coc.nvim
Plug 'neomake/neomake' " https://www.github.com/neomake/neomake
Plug 'nvie/vim-flake8' " https://www.github.com/nvie/vim-flake8
Plug 'scrooloose/nerdtree' " https://www.github.com/scrooloose/nerdtree
Plug 'tiagofumo/vim-nerdtree-syntax-highlight' " https://github.com/tiagofumo/vim-nerdtree-syntax-highlight
Plug 'tmhedberg/SimpylFold' " https://www.github.com/tmhedberg/SimpylFold
Plug 'tpope/vim-commentary' " https://www.github.com/tpope/vim-commentary
Plug 'tpope/vim-fugitive' " https://www.github.com/tpope/vim-fugitive
Plug 'tpope/vim-surround' " https://www.github.com/tpope/vim-surround
Plug 'christoomey/vim-tmux-navigator' " https://github.com/christoomey/vim-tmux-navigator

" Theres an issue with icon colors in current update (https://github.com/ryanoasis/vim-devicons/issues/330)
Plug 'ryanoasis/vim-devicons', {'commit': '58e57b6'} "https://github.com/ryanoasis/vim-devicons


" Theme
Plug 'ayu-theme/ayu-vim' " https://www.github.com/ayu-theme/ayu-vim
Plug 'dracula/vim', { 'as': 'dracula' } " https://www.github.com/dracula/vim
Plug 'vim-airline/vim-airline' " https://www.github.com/vim-airline/vim-airline
Plug 'vim-airline/vim-airline-themes' " https://www.github.com/vim-airline/vim-airline-themes
Plug 'tomasr/molokai' " https://github.com/tomasr/molokai
Plug 'morhetz/gruvbox' " https://github.com/morhetz/gruvbox

" Syntax Highlighting
Plug 'pangloss/vim-javascript' " https://github.com/pangloss/vim-javascript
Plug 'vim-python/python-syntax' " https://github.com/vim-python/python-syntax
Plug 'MaxMEllon/vim-jsx-pretty' " https://github.com/MaxMEllon/vim-jsx-pretty



call plug#end()


" ===================\
" 2. General Settings |
" ===================/
syntax on
filetype plugin indent on
set encoding=utf-8
set foldlevel=99
set foldmethod=indent
set nocompatible
set number relativenumber
set sidescroll=1
set splitbelow
set splitright
set background=dark
set mouse=a
set modifiable
set scrolloff=10
set cursorline

set termguicolors
colorscheme gruvbox
" let g:molokai_original = 1
" let g:rehash256 = 1

" =================\
" 3. Remapping Keys |
" =================/

" Remap leader to comma
let mapleader = ','

" save faster
nnoremap <leader>w :w<CR>

" split navigations
" nnoremap <C-J> <C-W><C-J>
" nnoremap <C-K> <C-W><C-K>
" nnoremap <C-L> <C-W><C-L>
" nnoremap <C-H> <C-W><C-H>

" enable folding with the spacebar
" nnoremap <space> za

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

" Indentation for all files
autocmd BufNewFile,BufRead * setlocal tabstop=4
autocmd BufNewFile,BufRead * set softtabstop=4
autocmd BufNewFile,BufRead * set shiftwidth=4
autocmd BufNewFile,BufRead * set expandtab
autocmd BufNewFile,BufRead * set autoindent
" autocmd BufNewFile,BufRead * set fileformat=unix

" Python indentation
autocmd BufNewFile,BufRead *.py set tabstop=4
autocmd BufNewFile,BufRead *.py set softtabstop=4
autocmd BufNewFile,BufRead *.py set shiftwidth=4
autocmd BufNewFile,BufRead *.py set textwidth=79
autocmd BufNewFile,BufRead *.py set colorcolumn=80
autocmd BufNewFile,BufRead *.py set fileformat=unix


" HTML, JS, and CSS indentation
autocmd BufNewFile,BufRead *.html,*.js,*.css set tabstop=2
autocmd BufNewFile,BufRead *.html,*.js,*.css set shiftwidth=2
autocmd BufNewFile,BufRead *.html,*.js,*.css set softtabstop=2

" JSON indentation
autocmd BufNewFile,BufRead *.json set tabstop=2
autocmd BufNewFile,BufRead *.json set shiftwidth=2
autocmd BufNewFile,BufRead *.json set softtabstop=2

" flag unnecessary whitespace
autocmd BufRead,BufNewFile *.py,*.pyw,*.c,*.h highlight ExtraWhitespace ctermbg=red guibg=red
autocmd BufRead,BufNewFile *.py,*.pyw,*.c,*.h match ExtraWhitespace /\s\+$/

" Highlight current line


" ==================\
" 5. Plugin Settings |
" ==================/

" tmux-vim-navigation
let g:tmux_navigator_disable_when_zoomed=1

" python syntax
let g:python_highlight_all=1

" auto-pairs
let g:AutoPairs = {'(':')', '[':']', '{':'}',"'":"'",'"':'"', '```':'```', '"""':'"""', "'''":"'''", "`":"`", "b'":"'", "f'":"'", "r'":"'"}

" SimpylFold
let g:SimpylFold_docstring_preview = 1

" indentLine
" let g:indentLine_char = ''
" let g:indentLine_first_char = ''
" let g:indentLine_char = '⎸'
" let g:indentLine_first_char = '⎸'
let g:indentLine_char = '▏'
let g:indentLine_first_char = '▏'
let g:indentLine_showFirstIndentLevel = 1
let g:indentLine_setColors = 1
autocmd Filetype json let g:indentLine_enabled = 0 " https://github.com/Yggdroot/indentLine/issues/172

" NERDTree
map <leader>n :NERDTreeToggle<CR>
autocmd bufenter * if (winnr("$") == 1 && exists("b:NERDTree") && b:NERDTree.isTabTree()) | q | endif
let NERDTreeIgnore=['\.pyc$', '\~$'] "ignore files in NERDTree

" vim-closetag
let g:closetag_filenames = "*.html,*.xhtml,*.phtml,*.php,*.jsx,*.js"

" flake8
autocmd FileType python map <leader>f :call flake8#Flake8()<CR>

" vim-airline
let g:airline_theme='molokai'
let g:airline#extensions#tabline#enabled = 1
let g:airline#extensions#tabline#fnamemod = ':t'

" neomake
" call neomake#configure#automake('nrwi', 500)

" vim-json
" let g:vim_json_syntax_conceal = 0 

" coc
command! -nargs=0 Prettier :CocCommand prettier.formatfile
let g:coc_global_extensions = [
    \ 'coc-snippets',
    \ 'coc-pairs',
    \ 'coc-tsserver',
    \ 'coc-eslint',
    \ 'coc-prettier',
    \ 'coc-json',
    \]
command! -nargs=0 Prettier :CocCommand prettier.formatFile

" From Readme
" if hidden is not set, TextEdit might fail.
set hidden " Some servers have issues with backup files, see #649 set nobackup set nowritebackup " Better display for messages set cmdheight=2 " You will have bad experience for diagnostic messages when it's default 4000.
set updatetime=300

" don't give |ins-completion-menu| messages.
set shortmess+=c

" always show signcolumns
set signcolumn=yes

" Use tab for trigger completion with characters ahead and navigate.
" Use command ':verbose imap <tab>' to make sure tab is not mapped by other plugin.
inoremap <silent><expr> <TAB>
      \ pumvisible() ? "\<C-n>" :
      \ <SID>check_back_space() ? "\<TAB>" :
      \ coc#refresh()
inoremap <expr><S-TAB> pumvisible() ? "\<C-p>" : "\<C-h>"

function! s:check_back_space() abort
  let col = col('.') - 1
  return !col || getline('.')[col - 1]  =~# '\s'
endfunction

" Use <c-space> to trigger completion.
inoremap <silent><expr> <c-space> coc#refresh()

" Use <cr> to confirm completion, `<C-g>u` means break undo chain at current position.
" Coc only does snippet and additional edit on confirm.
inoremap <expr> <cr> pumvisible() ? "\<C-y>" : "\<C-g>u\<CR>"
" Or use `complete_info` if your vim support it, like:
" inoremap <expr> <cr> complete_info()["selected"] != "-1" ? "\<C-y>" : "\<C-g>u\<CR>"


" Use `[g` and `]g` to navigate diagnostics
nmap <silent> [g <Plug>(coc-diagnostic-prev)
nmap <silent> ]g <Plug>(coc-diagnostic-next)

" Remap keys for gotos
nmap <silent> gd <Plug>(coc-definition)
nmap <silent> gy <Plug>(coc-type-definition)
nmap <silent> gi <Plug>(coc-implementation)
nmap <silent> gr <Plug>(coc-references)

" Use K to show documentation in preview window
nnoremap <silent> K :call <SID>show_documentation()<CR>

function! s:show_documentation()
  if (index(['vim','help'], &filetype) >= 0)
    execute 'h '.expand('<cword>')
  else
    call CocAction('doHover')
  endif
endfunction

" Highlight symbol under cursor on CursorHold
autocmd CursorHold * silent call CocActionAsync('highlight')

" Remap for rename current word
nmap <F2> <Plug>(coc-rename)

" Remap for format selected region
xmap <leader>f  <Plug>(coc-format-selected)
nmap <leader>f  <Plug>(coc-format-selected)

augroup mygroup
  autocmd!
  " Setup formatexpr specified filetype(s).
  autocmd FileType typescript,json setl formatexpr=CocAction('formatSelected')
  " Update signature help on jump placeholder
  autocmd User CocJumpPlaceholder call CocActionAsync('showSignatureHelp')
augroup end

" Remap for do codeAction of selected region, ex: `<leader>aap` for current paragraph
xmap <leader>a  <Plug>(coc-codeaction-selected)
nmap <leader>a  <Plug>(coc-codeaction-selected)

" Remap for do codeAction of current line
nmap <leader>ac  <Plug>(coc-codeaction)
" Fix autofix problem of current line
nmap <leader>qf  <Plug>(coc-fix-current)

" Create mappings for function text object, requires document symbols feature of languageserver.
xmap if <Plug>(coc-funcobj-i)
xmap af <Plug>(coc-funcobj-a)
omap if <Plug>(coc-funcobj-i)
omap af <Plug>(coc-funcobj-a)

" Use <C-d> for select selections ranges, needs server support, like: coc-tsserver, coc-python
" nmap <silent> <C-d> <Plug>(coc-range-select)
" xmap <silent> <C-d> <Plug>(coc-range-select)

" Use `:Format` to format current buffer
command! -nargs=0 Format :call CocAction('format')

" Use `:Fold` to fold current buffer
command! -nargs=? Fold :call     CocAction('fold', <f-args>)

" use `:OR` for organize import of current buffer
command! -nargs=0 OR   :call     CocAction('runCommand', 'editor.action.organizeImport')

" Add status line support, for integration with other plugin, checkout `:h coc-status`
set statusline^=%{coc#status()}%{get(b:,'coc_current_function','')}

" Using CocList
" Show all diagnostics
nnoremap <silent> <space>a  :<C-u>CocList diagnostics<cr>
" Manage extensions
nnoremap <silent> <space>e  :<C-u>CocList extensions<cr>
" Show commands
nnoremap <silent> <space>c  :<C-u>CocList commands<cr>
" Find symbol of current document
nnoremap <silent> <space>o  :<C-u>CocList outline<cr>
" Search workspace symbols
nnoremap <silent> <space>s  :<C-u>CocList -I symbols<cr>
" Do default action for next item.
nnoremap <silent> <space>j  :<C-u>CocNext<CR>
" Do default action for previous item.
nnoremap <silent> <space>k  :<C-u>CocPrev<CR>
" Resume latest coc list
nnoremap <silent> <space>p  :<C-u>CocListResume<CR>

