set nocompatible
filetype off

set rtp+=~/.vim/bundle/Vundle.vim
call vundle#begin()

Plugin 'VundleVim/Vundle.vim'
Plugin 'nathanaelkane/vim-indent-guides'
Plugin 'altercation/vim-colors-solarized'
Plugin 'valloric/youcompleteme'

call vundle#end()
filetype plugin indent on

syntax on

" THEME SETTINGS
colorscheme solarized
if has('gui_running')
	set background=light
else
	set background=dark
endif

" INDENT SETTINGS
let g:indent_guides_enable_on_vim_startup = 1
set ts=4 sw=4 et
let g:indent_guides_start_level = 2
let g:indent_guides_guide_size = 1

" RELATIVE NUMBER
set number relativenumber

" YOUCOMPLETEME SETTINGS
let g:ycm_global_ycm_extra_conf = "~/.vim/.ycm_extra_conf.py"
