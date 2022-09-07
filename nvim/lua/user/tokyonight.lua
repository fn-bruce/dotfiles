local status_ok, tokyonight = pcall(require, "tokyonight")
if not status_ok then
  return
end

tokyonight.setup({
  style = "night", -- The theme comes in three styles, `storm`, a darker variant `night` and `day`
})
