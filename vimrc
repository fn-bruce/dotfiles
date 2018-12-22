~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
 [<s/brucelee/Projects/PythonProjects/bboy_combo_gen/bboy_combo_gen.py L:0/1 C:1
"bboy_combo_gen.py" 0L, 0C
1
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
~
 [] 1 [Git(master)] F:/Users/brucelee/Projects/PythonProjects/bboy_combo_gen/bboy_combo_gen.py L:0/1 C:1
Last login: Sat Dec 22 15:12:26 on console
    ~  j bboy                                                            
/Users/brucelee/Projects/PythonProjects/bboy_combo_gen
    ~/Projects/PythonProjects/bboy_combo_gen     master  vim bboy_combo_gen.py

    ~/Projects/PythonProjects/bboy_combo_gen     master  clear                                                                                                                                                                                                        






1    " ======================== Start Up Settings ============
  1 runtime bundle/pathogen/autoload/pathogen.vim
  2 call pathogen#infect()
  3
  4 " Do not try to be VI compatible
  5 set nocompatible
  6 " Syntax highlighting
  7 syntax on
  8 " Try to detect filetypes
  9 filetype off
 10
 11 " set the runtime path to include Vundle and initialize
 12 set rtp+=~/.vim/bundle/Vundle.vim
 13 call vundle#begin()
 14
 15 Plugin 'VundleVim/Vundle.vim'
 16 Plugin 'nathanaelkane/vim-indent-guides'
 17 Plugin 'altercation/vim-colors-solarized'
 18 Plugin 'ajh17/spacegray.vim'
 19 Plugin 'kien/ctrlp.vim'
 20 Plugin 'mbbill/undotree'
 21 Plugin 'Vimjas/vim-python-pep8-indent'
 22 Plugin 'tpope/vim-fugitive'
 23 Plugin 'scrooloose/nerdtree'
 24 Plugin 'davidhalter/jedi-vim'
 25 " Plugin 'ervandew/supertab'
 26 " Plugin 'Valloric/YouCompleteMe'
 27
 28 call vundle#end()
 29
 30 " Enable loading indent file for filetype
 31 filetype plugin indent on
 32
 33 " THEME SETTINGS
 34 colorscheme spacegray
 35 if has('gui_running')
 36     set background=light
 37 else
 38     set background=dark
 39 endif
 40
 41 " INDENT SETTINGS
 42 " let g:indent_guides_enable_on_vim_startup = 1
 43 set ts=4 sw=4 et
 44
 45 " RELATIVE NUMBER
 46 set number relativenumber
 47 augroup numbertoggle
 48     autocmd!
 49     autocmd BufEnter,FocusGained,InsertLeave * set relativenumber
 50     autocmd BufLeave,FocusLost,InsertEnter * set norelativenumber
 51 augroup end
 52
 53 " ============= USER SETTINGS ==================
 54
 55 " Set the leader key to ,
 56 let mapleader = ','
 57
 58 let irdata = '_data'
 59 let irdirs = {'backupdir': 'backup', 'dir': 'swap', 'undodir': 'undo'}
 60 let irsplit = '/'
 61 let irroot = '.vim'
 62
 63 " Checks OS
 64 if has("win32")
 65     if has("autocmd")
 66         " Starts gvim in full screen mode
 67         autocmd GUIEnter * simalt ~x
 68         " Get rid of this flash crap whenever a buffer is entered
 69         autocmd GUIEnter * set visualbell t_vb=
 70     endif
 [] 1  F:/Users/brucelee/.vimrc L:1/320 C:2
"~/.vimrc" 320L, 8778C
