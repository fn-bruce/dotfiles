return {
  "stevearc/overseer.nvim",
  keys = {
    { "<leader>ow", "<cmd>OverseerToggle<cr>", desc = "Task list" },
    { "<leader>oo", "<cmd>OverseerRun<cr>", desc = "Run task" },
    { "<leader>oi", "<cmd>checkhealth overseer<cr>", desc = "Overseer Info" },
    { "<leader>ot", "<cmd>OverseerTaskAction<cr>", desc = "Task action" },

    { "<leader>oq", "<cmd>OverseerQuickAction<cr>", desc = "which_key_ignore" },
    { "<leader>ob", "<cmd>OverseerBuild<cr>", desc = "which_key_ignore" },
    { "<leader>oc", "<cmd>OverseerClearCache<cr>", desc = "which_key_ignore" },
  },
}
