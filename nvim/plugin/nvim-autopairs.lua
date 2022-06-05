local nvim_pairs = require("nvim-autopairs")
local rule = require('nvim-autopairs.rule')

nvim_pairs.setup({
  disable_filetype = { "TelescopePrompt", "vim" },
  enable_check_bracket_line = false,
  check_ts = true,
    ts_config = {
        lua = {'string'},-- it will not add a pair on that treesitter node
        javascript = {'template_string'},
        java = false,-- don't check treesitter on java
    }
})

local ts_conds = require('nvim-autopairs.ts-conds')

-- press % => %% only while inside a comment or string
nvim_pairs.add_rules({
  rule("%", "%", "lua")
    :with_pair(ts_conds.is_ts_node({'string','comment'})),
  rule("$", "$", "lua")
    :with_pair(ts_conds.is_not_ts_node({'function'}))
})
