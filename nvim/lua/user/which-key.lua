local status_ok, wk = pcall(require, "which-key")
if not status_ok then
	return
end

wk.setup({
  window = {
		border = { "╭", "─", "╮", "│", "╯", "─", "╰", "│" },
  },
  layout = {
    align = "center",
  },
})

-- normal mode
wk.register({
	d = { vim.lsp.buf.definition, "Goto Definition" },
	D = { vim.lsp.buf.declaration, "Goto Declaration" },
	r = { vim.lsp.buf.references, "Goto References" },
	I = { vim.lsp.buf.implementation, "Goto Implementation" },
	s = { vim.diagnostic.signature_help, "Show line diagnostic" },
	l = { vim.diagnostic.open_float, "Show signature help" },
}, { mode = "n", prefix = "g", noremap = true, silent = true })

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
		s = { "<cmd>lua vim.lsp.buf.signature_help()<cr>", "Signature Help" },
		q = { "<cmd>lua vim.diagnostic.setloclist()<cr>", "Set Local List" },
		D = { "<cmd>lua vim.lsp.buf.declaration()<cr>", "Declaration" },
		d = { "<cmd>lua vim.lsp.buf.definition()<cr>", "Definition" },
		j = { vim.diagnostic.goto_next, "Next Diagnostic" },
		k = { vim.diagnostic.goto_prev, "Previous Diagnostic" },
		l = { "<cmd>lua vim.diagnostic.open_float()<cr>", "View Diagnostic" },
	},
	m = {
		name = "Markdown",
		g = { "<cmd>Glow<cr>", "Glow" },
		p = { "<cmd>MarkdownPreview<cr>", "Preview" },
	},
	r = {
		name = "Rust",
    h = {
      name = "Hints/Hover",
      s = { "<cmd>RustSetInlayHints<cr>", "Set Inlay Hints" },
      d = { "<cmd>RustDisableInlayHints<cr>", "Disable Inlay Hints" },
      t = { "<cmd>RustToggleInlayHints<cr>", "Toggle Inlay Hints" },
    },
		r = { "<cmd>RustRunnables<cr>", "Runnables" },
		d = { "<cmd>RustDebuggables<cr>", "Debuggables" },
		v = { "<cmd>RustViewCrateGraph<cr>", "View Crate Graph" },
		w = { "<cmd>RustReloadWorkspace<cr>", "Reload Workspae" },
    c = { "<cmd>RustOpenCargo<cr>", "Cargo" },
    m = {
      name = "Move",
      u = { "<cmd>RustMoveItemUp<cr>", "Item Up" },
      d = { "<cmd>RustMoveItemDown<cr>", "Item Down" },
    },
    e = { "<cmd>RustExpandMacro<cr>", "Expand Macro" },
    l = { "<cmd>RustJoinLines<cr>", "Join Lines" },
    p = { "<cmd>RustParentModule<cr>", "Parent Module" },
		-- sb = { "<cmd>RustStartStandaloneServerForBuffer<Cr>", "Start Standalone Server For Buffer" },
		-- ss = { "<cmd>RustSSR<Cr>", "Server Side Rendering" },
		-- xd = { "<cmd>RustOpenExternalDocs<Cr>", "Open External Docs" },
	},
	w = {
		name = "Web",
		r = {
			name = "Rest",
			r = { "<Plug>RestNvim", "Run" },
			p = { "<Plug>RestNvimPreview", "Preview" },
			l = { "<Plug>RestNvimLast", "Last" },
		},
	},
	["/"] = { "<cmd>lua require('Comment.api').toggle_current_linewise()<cr>", "Comment" },
}, { mode = "n", prefix = "<leader>", noremap = true, silent = true })

-- visual block mode
wk.register({
	["/"] = { "<ESC><CMD>lua require('Comment.api').toggle_linewise_op(vim.fn.visualmode())<cr>", "Comment" },
}, { mode = "x", prefix = "<leader>", noremap = true, silent = true })
