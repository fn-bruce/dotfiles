local status_ok, ns = pcall(require, "nvim-surround")
if not status_ok then
	return
end

ns.setup()
