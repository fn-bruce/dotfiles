local status_ok, ayu = pcall(require, "ayu")
if not status_ok then
  return
end

local colors = require("ayu.colors")

ayu.setup({
})
