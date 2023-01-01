local status_ok, mason_lspconfig = pcall(require, "mason-lspconfig")
if not status_ok then
  return
end

mason_lspconfig.setup()
mason_lspconfig.setup_handlers {

  function(server_name)
    require("lspconfig")[server_name].setup {}
  end,

  ["rust_analyzer"] = function()
    require("user.rusttools").setup()
  end
}
