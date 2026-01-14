return {
  "kawre/leetcode.nvim",
  build = ":TSUpdate html", -- if you have `nvim-treesitter` installed
  dependencies = {
    -- include a picker of your choice, see picker section for more details
    "nvim-lua/plenary.nvim",
    "MunifTanjim/nui.nvim",
  },
  opts = {
    -- configuration goes here
  },
  keys = {
    { "<leader>lcq", "<cmd>Leet<cr>", desc = "Open Leetcode Menu" },
    { "<leader>lcl", "<cmd>Leet list<cr>", desc = "List Problems" },
    { "<leader>lcd", "<cmd>Leet desc<cr>", desc = "Toggle Description" },
    { "<leader>lcr", "<cmd>Leet run<cr>", desc = "Run Code" },
    { "<leader>lcs", "<cmd>Leet submit<cr>", desc = "Submit Solution" },
    { "<leader>lci", "<cmd>Leet info<cr>", desc = "Problem Info" },
    { "<leader>lcc", "<cmd>Leet console<cr>", desc = "Toggle Console" },
    { "<leader>lct", "<cmd>Leet tabs<cr>", desc = "Show Tabs" },
    { "<leader>lcy", "<cmd>Leet yank<cr>", desc = "Yank Solution" },
    { "<leader>lcn", "<cmd>Leet random<cr>", desc = "Random Problem" },
    { "<leader>lco", "<cmd>Leet open<cr>", desc = "Open in Browser" },
  }
}
