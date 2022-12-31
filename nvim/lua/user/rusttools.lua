local M = {}

function M.setup()
  local codelldb_path = vim.env.HOME .. "/.vscode/extensions/vadimcn.vscode-lldb-1.8.1/adapter/codelldb"
  local liblldb_path = vim.env.HOME .. "/.vscode/extensions/vadimcn.vscode-lldb-1.8.1/lldb/lib/liblldb.dylib"
  local opts = {
    hover_actions = {
      border = {
        { "╭", "FloatBorder" },
        { "─", "FloatBorder" },
        { "╮", "FloatBorder" },
        { "│", "FloatBorder" },
        { "╯", "FloatBorder" },
        { "─", "FloatBorder" },
        { "╰", "FloatBorder" },
        { "│", "FloatBorder" },
      },
      auto_focus = true,
    },
    dap = {
      adapter = require("rust-tools.dap").get_codelldb_adapter(codelldb_path, liblldb_path),
    },
    server = {
      on_attach = require("user.lsp.handlers").on_attach,
      capabilities = require("user.lsp.handlers").capabilities,
      settings = {
        ["rust-analyzer"] = {
          inlayHints = { locationLinks = false }
        }
      }
    },
  }

  require("rust-tools").setup(opts)
end

return M
