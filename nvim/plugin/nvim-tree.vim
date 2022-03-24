" nnoremap <leader>e :NvimTreeToggle<CR>

" LSP
lua << EOF
require('nvim-tree').setup {
  actions = {
    open_file = {
      quit_on_open = true,
    },
  },
}
EOF
