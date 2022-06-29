local status_ok, wk = pcall(require, "which-key")
if not status_ok then
	return
end

wk.setup()

-- normal mode
wk.register({
	e = { "<cmd>NvimTreeToggle<cr>", "Open File Explorer" },
	h = { "<cmd>nohlsearch<cr>", "Clear Highlights" },
	c = {
		name = "Crates",
		t = { "<cmd>lua require('crates').toggle()<cr>", "Toggle" },
		r = { "<cmd>lua require('crates').reload()<cr>", "Reload" },
		v = { "<cmd>lua require('crates').show_versions_popup()<cr>", "Versions" },
		f = { "<cmd>lua require('crates').show_features_popup()<cr>", "Features" },
		u = { "<cmd>lua require('crates').update_crate()<cr>", "Update" },
		a = { "<cmd>lua require('crates').update_all_crates()<cr>", "Update All" },
		U = { "<cmd>lua require('crates').upgrade_crate()<cr>", "Upgrade" },
		A = { "<cmd>lua require('crates').upgrade_all_crates()<cr>", "Upgrade All" },
		H = { "<cmd>lua require('crates').open_homepage()<cr>", "Open Homepage" },
		R = { "<cmd>lua require('crates').open_repository()<cr>", "Open Repository" },
		D = { "<cmd>lua require('crates').open_documentation()<cr>", "Open Documentation" },
		C = { "<cmd>lua require('crates').open_crates_io()<cr>", "Open Crates IO" },
	},
	d = {
		name = "Debug",
		b = { "<cmd>lua require('dap').toggle_breakpoint()<cr>", "Toggle Breakpoint" },
		c = { "<cmd>lua require('dap').continue()<cr>", "Continue" },
		i = { "<cmd>lua require('dap').step_into()<cr>", "Step Into" },
		o = { "<cmd>lua require('dap').step_over()<cr>", "Step Over" },
		O = { "<cmd>lua require('dap').step_out()<cr>", "Step Out" },
		r = { "<cmd>lua require('dap').repl.toggle()<cr>", "Toggle REPL" },
		l = { "<cmd>lua require('dap').run_last()<cr>", "Run Last" },
		u = { "<cmd>lua require('dapui').toggle()<cr>", "Toggle UI" },
		t = { "<cmd>lua require('dap').terminate()<cr>", "Terminate" },
	},
	f = {
		name = "Find",
		f = { "<cmd>Telescope find_files<cr>", "File" },
		t = { "<cmd>Telescope live_grep<cr>", "Text" },
		p = { "<cmd>Telescope projects<cr>", "Projects" },
		b = { "<cmd>Telescope buffers<cr>", "Buffers" },
	},
	g = {
		name = "Git",
		g = { "<cmd>lua _LAZYGIT_TOGGLE()<cr>", "GUI" },
	},
	l = {
		f = { "<cmd>lua vim.lsp.buf.formatting()<cr>", "Format" },
		i = { "<cmd>LspInfo<cr>", "Info" },
		I = { "<cmd>LspInstallInfo<cr>", "Install Info" },
		a = { "<cmd>lua vim.lsp.buf.code_action()<cr>", "Code Action" },
		r = { "<cmd>lua vim.lsp.buf.rename()<cr>", "Rename" },
		s = { "<cmd>lua vim.lsp.buf.signature_help()<CR>", "Signature Help" },
		q = { "<cmd>lua vim.diagnostic.setloclist()<CR>", "Set Local List" },
    D = { "<cmd>lua vim.lsp.buf.declaration()<CR>", "Declaration" },
    d = { "<cmd>lua vim.lsp.buf.definition()<CR>", "Definition" },
    j = { vim.diagnostic.goto_next, "Next Diagnostic" },
    k = { vim.diagnostic.goto_prev, "Previous Diagnostic" },
    l = { "<cmd>lua vim.diagnostic.open_float()<CR>", "View Diagnostic" },
	},
	m = {
		name = "Markdown",
		g = { "<cmd>Glow<CR>", "Glow" },
		p = { "<cmd>MarkdownPreview<CR>", "Preview" },
	},
	r = {
		name = "Rest",
		r = { "<Plug>RestNvim", "Run" },
		p = { "<Plug>RestNvimPreview", "Preview" },
		l = { "<Plug>RestNvimLast", "Last" },
	},
	["/"] = { "<cmd>lua require('Comment.api').toggle_current_linewise()<cr>", "Comment" },
}, { mode = "n", prefix = "<leader>", noremap = true, silent = true })

-- visual block mode
wk.register({
	["/"] = { "<ESC><CMD>lua require('Comment.api').toggle_linewise_op(vim.fn.visualmode())<CR>", "Comment" },
}, { mode = "x", prefix = "<leader>", noremap = true, silent = true })
