-- .---------.
-- | PLUGINS |
-- '---------'

local lazy = require("lazy")
local plugins = {

  -- SURROUNDING
  "kylechui/nvim-surround",

  -- AI
  "github/copilot.vim",

  -- BDELETE
  "moll/vim-bbye",

  -- COLORIZER
  "norcalli/nvim-colorizer.lua",

  -- ALPHA
  "goolord/alpha-nvim",

  -- NOTIFY
  "rcarriga/nvim-notify",

  -- TERMINAL
  "akinsho/toggleterm.nvim",

  -- LSP
  "neovim/nvim-lspconfig",
  "jose-elias-alvarez/null-ls.nvim",
  "williamboman/mason.nvim",
  "williamboman/mason-lspconfig.nvim",
  "jayp0521/mason-null-ls.nvim",
  "simrat39/rust-tools.nvim",

  -- DAP
  "mfussenegger/nvim-dap",

  -- CMP
  "neovim/nvim-lspconfig",
  "hrsh7th/cmp-nvim-lsp",
  "hrsh7th/cmp-buffer",
  "hrsh7th/cmp-path",
  "hrsh7th/cmp-cmdline",
  "hrsh7th/nvim-cmp",
  "saadparwaiz1/cmp_luasnip",

  -- SNIPPET
  "L3MON4D3/LuaSnip",
  "rafamadriz/friendly-snippets",


  -- SYNTAX HIGHLIGHTING
  "nvim-treesitter/nvim-treesitter",
  "nvim-treesitter/nvim-treesitter-textobjects",
  "nvim-treesitter/playground",

  -- THEMES
  "folke/tokyonight.nvim",

  -- STATUS LINE
  "nvim-lualine/lualine.nvim",

  -- GIT
  "tpope/vim-fugitive",
  "tpope/vim-rhubarb",
  "lewis6991/gitsigns.nvim",

  -- COMMENT
  "numToStr/Comment.nvim",

  -- INDENT
  "lukas-reineke/indent-blankline.nvim",

  -- TREE
  "nvim-tree/nvim-tree.lua",
  "nvim-tree/nvim-web-devicons",

  -- TELESCOPE
  "nvim-telescope/telescope.nvim",
  "nvim-lua/plenary.nvim",
  "nvim-telescope/telescope-ui-select.nvim",

  -- WHICH-KEY
  "folke/which-key.nvim",

  -- BUFFER
  "akinsho/bufferline.nvim",

  -- AUTO PAIR
  "windwp/nvim-ts-autotag",
  "windwp/nvim-autopairs",
}
local opts = {}

lazy.setup(plugins, opts)
