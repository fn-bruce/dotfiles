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

vim.api.nvim_set_keymap('n', '<leader>dh', ":lua require('dap').toggle_breakpoint()<CR>", {noremap = true, silent = true})
vim.api.nvim_set_keymap('n', '<leader>ds', ":lua require('dap').stop()<CR>", {noremap = true, silent = true})
vim.api.nvim_set_keymap('n', '<F5>', ":lua require('dap').continue()<CR>", {noremap = true, silent = true})
vim.api.nvim_set_keymap('n', '<F10>', ":lua require('dap').step_over()<CR>", {noremap = true, silent = true})
vim.api.nvim_set_keymap('n', '<F11>', ":lua require('dap').step_into()<CR>", {noremap = true, silent = true})
vim.api.nvim_set_keymap('n', '<F12>', ":lua require('dap').step_out()<CR>", {noremap = true, silent = true})
vim.api.nvim_set_keymap('n', '<leader>dk', ":lua require('dap').up()<CR>", {noremap = true, silent = true})
vim.api.nvim_set_keymap('n', '<leader>dj', ":lua require('dap').down()<CR>", {noremap = true, silent = true})
vim.api.nvim_set_keymap('n', '<leader>d_', ":lua require('dap').run_last()<CR><C-w>l", {noremap = true, silent = true})
vim.api.nvim_set_keymap('n', '<leader>dr', ":lua require('dap').repl.open({}, 'vsplit')<CR><C-w>l", {noremap = true, silent = true})
vim.api.nvim_set_keymap('n', '<leader>di', ":lua require('dap.ui.widgets').hover()<CR>", {noremap = true, silent = true})
vim.api.nvim_set_keymap('v', '<leader>di', ":lua require('dap.ui.variables').visual_hover()<CR>", {noremap = true, silent = true})
vim.api.nvim_set_keymap('n', '<leader>di', ":lua local widgets=require('dap.ui.widgets');widgets.centered_float(widgets.scopes)<CR>", {noremap = true, silent = true})

require('telescope').setup()
require('telescope').load_extension('dap')

vim.api.nvim_set_keymap('n', '<leader>df', ":Telescope dap frames<CR>", {noremap = true, silent = true})
vim.api.nvim_set_keymap('n', '<leader>db', ":Telescope dap list_breakpoints<CR>", {noremap = true, silent = true})

require('nvim-dap-virtual-text').setup()
