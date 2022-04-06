vim.api.nvim_command([[
silent! call repeat#set("\<Plug>RadicalView", v:count)
silent! call repeat#set("\<Plug>RadicalCoerceToDecimal", v:count)
silent! call repeat#set("\<Plug>RadicalCoerceToHex", v:count)
silent! call repeat#set("\<Plug>RadicalCoerceToOctal", v:count)
]])
