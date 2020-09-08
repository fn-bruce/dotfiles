" auto-install vim-plug
if empty(glob('~/.config/nvim/autoload/plug.vim'))
  silent !curl -fLo ~/.config/nvim/autoload/plug.vim --create-dirs
    \ https://raw.githubusercontent.com/junegunn/vim-plug/master/plug.vim
  autocmd VimEnter * PlugInstall | source $MYVIMRC
endif

call plug#begin('~/.config/nvim/.nvim/plugged') 

" +-+-+-+-+-+
" | General |
" +-+-+-+-+-+
Plug 'RRethy/vim-illuminate' " highlight all matches under cursor
Plug 'alvan/vim-closetag' " Auto close HTML tags
Plug 'christoomey/vim-titlecase' " Helps titlecasing text
Plug 'christoomey/vim-tmux-navigator' " Navigate between vim and tmux better
Plug 'glts/vim-magnum'
Plug 'glts/vim-radical' " Convert binary, hex, etc..
Plug 'jiangmiao/auto-pairs' " Insert or delete brackets, parenthesis, quotes in pair
Plug 'jremmen/vim-ripgrep' " word under cursor will be search if no arg is passed
Plug 'junegunn/gv.vim' " git commit browser
Plug 'justinmk/vim-sneak' " jump to any location specified by two characters
Plug 'liuchengxu/vim-which-key' " See what keys do like in emacs
Plug 'majutsushi/tagbar' " Tag viewer
Plug 'mattn/emmet-vim' " Snippets
Plug 'mhinz/vim-startify' " creates a start menu
Plug 'moll/vim-bbye' " delete all windows while keeping layout
Plug 'neoclide/coc.nvim', {'branch': 'release'} " Intellisense
Plug 'neomake/neomake' " Runs programs asynchronously
Plug 'norcalli/nvim-colorizer.lua' " Colorizer
Plug 'nvie/vim-flake8' " Style checker
Plug 'qpkorr/vim-bufkill' " Kill buffers better
Plug 'rhysd/git-messenger.vim' " reveal hidden message from Git under cursor quickly
Plug 'sheerun/vim-polyglot' " better syntax highlighting
Plug 'skywind3000/asyncrun.vim' " enable to run shell commands in background
Plug 'skywind3000/asynctasks.vim' " handle building/running/testing/deploying tasks imitating vscode's task system
Plug 'tmhedberg/SimpylFold' " Fold better
Plug 'tpope/vim-commentary' " Better commenting commands
Plug 'tpope/vim-fugitive' " run git commands
Plug 'tpope/vim-repeat' " Repeat stuff
Plug 'tpope/vim-rhubarb' " hub for fugitive
Plug 'tpope/vim-sleuth' " adjusts the indent for each file
Plug 'tpope/vim-speeddating'" modify dates faster
Plug 'tpope/vim-surround' " Auto surround
Plug 'turbio/bracey.vim', {'do': 'npm install --prefix server'} " live html server
Plug 'unblevable/quick-scope' " Text Navigation
Plug 'vim-airline/vim-airline' " Status line
Plug 'voldikss/vim-floaterm' " creates a floating/popup window
Plug 'ryanoasis/vim-devicons' " Gives plugins nice dev icons
Plug 'junegunn/goyo.vim' " zen mode
Plug 'ChristianChiarulli/far.vim' " Find and replace
Plug 'airblade/vim-gitgutter' " shows git diff in sign column
Plug 'mattn/vim-gist' " Easily Create Gists
Plug 'mattn/webapi-vim' " api for web

" Plug 'kien/ctrlp.vim' " Fuzzy finder
" Plug 'Xuyuanp/nerdtree-git-plugin' " Shows git status flags
" Plug 'scrooloose/nerdtree' " Navigate files in a tree fashion
" Plug 'luochen1990/rainbow' " Rainbow brackets
" Plug 'christoomey/vim-sort-motion' 
" Plug 'godlygeek/tabular' 
" Plug 'gmarik/Vundle.vim' 

" +-+-+-+-+-+
" | Themes  |
" +-+-+-+-+-+
Plug 'ayu-theme/ayu-vim' 
Plug 'dracula/vim', { 'as': 'dracula' } 
Plug 'vim-airline/vim-airline-themes' 
Plug 'tomasr/molokai' 
Plug 'morhetz/gruvbox' 
" Plug 'Yggdroot/indentLine' 

" +-+-+-+-+-+-+-+-+-+-+-+
" | Syntax Highlighting |
" +-+-+-+-+-+-+-+-+-+-+-+
" Plug 'vim-python/python-syntax' " Python
Plug 'MaxMEllon/vim-jsx-pretty' " JSX
Plug 'pangloss/vim-javascript' " JavaScript
Plug 'elzr/vim-json' " JSON
" Plug 'tiagofumo/vim-nerdtree-syntax-highlight' " NERDTree Plugin

call plug#end()

" Automatically install missing plugins on startup
autocmd VimEnter *
  \  if len(filter(values(g:plugs), '!isdirectory(v:val.dir)'))
  \|   PlugInstall --sync | q
  \| endif
