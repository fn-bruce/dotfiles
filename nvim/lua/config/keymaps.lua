-- Keymaps are automatically loaded on the VeryLazy event
-- Default keymaps that are always set: https://github.com/LazyVim/LazyVim/blob/main/lua/lazyvim/config/keymaps.lua
-- Add any additional keymaps here

local map = vim.keymap.set
map("n", "<leader>ll", "<cmd>Lazy<cr>", { desc = "Lazy" })

local wk = require("which-key")
wk.add({
  { "<leader>l", group = "lazy/leetcode" },
  { "<leader>lc", group = "leetcode" },
})
