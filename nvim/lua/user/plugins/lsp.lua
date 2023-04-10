local mason = require("mason")
local mason_lspconfig = require("mason-lspconfig")
local mason_null_ls = require("mason-null-ls")
local lspconfig = require("lspconfig")
local null_ls = require("null-ls")
local cmp_nvim_lsp = require("cmp_nvim_lsp")
local capabilities = cmp_nvim_lsp.default_capabilities()
local signs = {
  { name = "DiagnosticSignError", text = "" },
  { name = "DiagnosticSignWarn",  text = "" },
  { name = "DiagnosticSignHint",  text = "" },
  { name = "DiagnosticSignInfo",  text = "" },
}
local on_attach = function(client, bufnr)
  -- NOTE: Remember that lua is a real programming language, and as such it is possible
  -- to define small helper and utility functions so you don't have to repeat yourself
  -- many times.
  --
  -- In this case, we create a function that lets us more easily define mappings specific
  -- for LSP related items. It sets the mode, buffer and description for us each time.
  local nmap = function(keys, func, desc)
    if desc then
      desc = 'LSP: ' .. desc
    end

    vim.keymap.set('n', keys, func, { buffer = bufnr, desc = desc })
  end

  local which_key = require("which-key")
  which_key.register({
    d = { vim.lsp.buf.definition, "Goto Definition" },
    D = { vim.lsp.buf.declaration, "Goto Declaration" },
    r = { vim.lsp.buf.references, "Goto References" },
    i = { vim.lsp.buf.implementation, "Goto Implementation" },
    t = { vim.lsp.buf.type_definition, "Goto Type Definition" },
    j = { vim.diagnostic.goto_next, "Next Diagnostic" },
    k = { vim.diagnostic.goto_prev, "Previous Diagnostic" },
    s = { vim.diagnostic.signature_help, "Show Signature Help" },
    l = { vim.diagnostic.open_float, "Show Line Diagnostic" },
    q = { vim.diagnostic.setloclist, "Show Diagnostic Buffer" },
  }, { mode = "n", prefix = "g", noremap = true, silent = true })

  which_key.register({
    l = {
      name = "LSP",
      d = { require('telescope.builtin').lsp_document_symbols, "Document Symbols" },
      f = { vim.lsp.buf.format, "Format" },
      i = { "<cmd>LspInfo<cr>", "Info" },
      m = { "<cmd>Mason<cr>", "Mason" },
      a = { vim.lsp.buf.code_action, "Code Action" },
      r = { vim.lsp.buf.rename, "Rename" },
      R = { "LspRestart", "Restart" },
      w = { require('telescope.builtin').lsp_dynamic_workspace_symbols, "Workspace Symbols" },
    },
  }, { mode = "n", prefix = "<leader>", noremap = true, silent = true })

  -- See `:help K` for why this keymap
  nmap('K', vim.lsp.buf.hover, 'Hover Documentation')

  if client.name == "rust_analyzer" then
    nmap("K", require('rust-tools').hover_actions.hover_actions, "Hover Documentation")
    nmap("<F5>", require("rust-tools").runnables.runnables, "Run Rust")
  end
end
local servers = {
  sumneko_lua = {
    Lua = {
      diagnostics = {
        globals = { 'vim' }
      }
    }
  },
}
local diag_config = {
  virtual_text = false, -- disable virtual text
  signs = {
    active = signs,     -- show signs
  },
  update_in_insert = true,
  underline = true,
  severity_sort = true,
  float = {
    focusable = true,
    style = "minimal",
    border = "rounded",
    source = "always",
    header = "",
    prefix = "",
  },
}

vim.diagnostic.config(diag_config)

-- setup diagnostic signs
for _, sign in ipairs(signs) do
  vim.fn.sign_define(sign.name, {
    texthl = sign.name,
    text = sign.text,
    numhl = "",
  })
end

local handlers = {
  ["textDocument/hover"] = vim.lsp.with(vim.lsp.handlers.hover, { border = "rounded" }),
  ["textDocument/signatureHelp"] = vim.lsp.with(vim.lsp.handlers.signature_help, { border = "rounded" }),
}

-- mason
mason.setup()

-- lspconfig
mason_lspconfig.setup()
mason_lspconfig.setup_handlers({
  function(server_name)
    lspconfig[server_name].setup {
      handlers = handlers,
      on_attach = on_attach,
      capabilities = capabilities,
      settings = servers[server_name],
    }
  end,
  ["rust_analyzer"] = function()
    require("rust-tools").setup({
      server = {
        handlers = handlers,
        on_attach = on_attach,
        capabilities = capabilities,
        settings = {
          ["rust-analyzer"] = {
            inlayHints = { locationLinks = false }
          }
        }
      }
    })
  end
})

-- null-ls
mason_null_ls.setup({
  handlers = {
    function(source_name, methods)
      require("mason-null-ls.automatic_setup")(source_name, methods)
    end,
  }
})

null_ls.setup()
