nnoremap <leader>e :NvimTreeToggle<CR>

let g:nvim_tree_quit_on_open = 1

" LSP
lua << EOF
require('nvim-tree').setup {}
EOF
