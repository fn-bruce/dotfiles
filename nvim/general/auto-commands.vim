" Makes relative number work good when navigating to different panes
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
" autocmd BufNewFile,BufRead *.py set textwidth=79
autocmd BufNewFile,BufRead *.py set colorcolumn=80
autocmd BufNewFile,BufRead *.py set fileformat=unix


" HTML, JS, and CSS indentation
autocmd BufNewFile,BufRead *.html,*.js,*.css set tabstop=2
autocmd BufNewFile,BufRead *.html,*.js,*.css set shiftwidth=2
autocmd BufNewFile,BufRead *.html,*.js,*.css set softtabstop=2
autocmd BufNewFile,BufRead *.html set filetype=htmldjango

" JSON indentation
autocmd BufNewFile,BufRead *.json set tabstop=2
autocmd BufNewFile,BufRead *.json set shiftwidth=2
autocmd BufNewFile,BufRead *.json set softtabstop=2

" flag unnecessary whitespace
autocmd BufRead,BufNewFile *.py,*.pyw,*.c,*.h highlight ExtraWhitespace ctermbg=red guibg=red
autocmd BufRead,BufNewFile *.py,*.pyw,*.c,*.h match ExtraWhitespace /\s\+$/
