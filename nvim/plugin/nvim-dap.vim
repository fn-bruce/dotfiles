lua << EOF
local dap = require('dap')
dap.adapters.node2 = {
  type = 'executable',
  command = 'node',
  args = {os.getenv('HOME') .. '/dev/microsoft/vscode-node-debug2/out/src/nodeDebug.js'},
}
dap.configurations.javascript = {
  {
    name = 'Launch',
    type = 'node2',
    request = 'launch',
    program = '${file}',
    cwd = vim.fn.getcwd(),
    sourceMaps = true,
    protocol = 'inspector',
    console = 'integratedTerminal',
  },
  {
    -- For this to work you need to make sure the node process is started with the `--inspect` flag.
    name = 'Attach to process',
    type = 'node2',
    request = 'attach',
    processId = require'dap.utils'.pick_process,
  },
}
vim.fn.sign_define('DapBreakpoint', {text='🔴', texthl='', linehl='', numhl=''})
vim.fn.sign_define('DapStopped', {text='🟡', texthl='', linehl='', numhl=''})
EOF
nnoremap <leader>dh :lua require('dap').toggle_breakpoint()<CR>
nnoremap <leader>ds :lua require('dap').stop()<CR>
nnoremap <F5> :lua require('dap').continue()<CR>
nnoremap <F10> :lua require('dap').step_over()<CR>
nnoremap <F11> :lua require('dap').step_into()<CR>
nnoremap <F12> :lua require('dap').step_out()<CR>
nnoremap <leader>dk :lua require('dap').up()<CR>
nnoremap <leader>dj :lua require('dap').down()<CR>
nnoremap <leader>d_ :lua require('dap').run_last()<CR><C-w>l
nnoremap <leader>dr :lua require('dap').repl.open({}, 'vsplit')<CR><C-w>l
nnoremap <leader>di :lua require('dap.ui.widgets').hover()<CR>
vnoremap <leader>di :lua require('dap.ui.variables').visual_hover()<CR>
nnoremap <leader>d? :lua local widgets=require('dap.ui.widgets');widgets.centered_float(widgets.scopes)<CR>
nnoremap <leader>de :lua require('dap').set_exception_breakpoints({"all"})<CR>

lua << EOF
require('telescope').setup()
require('telescope').load_extension('dap')
EOF

nnoremap <leader>df :Telescope dap frames<CR>
nnoremap <leader>db :Telescope dap list_breakpoints<CR>

lua << EOF
require('nvim-dap-virtual-text').setup()
EOF
