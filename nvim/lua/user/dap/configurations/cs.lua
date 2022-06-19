return {
    {
      type = "coreclr",
      name = "launch - netcoredbg",
      request = "launch",
      program = function()
        local cwd = vim.fn.getcwd()
        return vim.fn.input('Path to dll: ', cwd .. '/bin/Debug/', 'file')
      end,
    },
    {
      type = "coreclr",
      name = "attach - netcoredbg",
      request = "attach",
      processId = function()
        local pid = require('dap.utils').pick_process()
        vim.fn.setenv('NETCOREDBG_ATTACH_PID', pid)
        return pid
      end,
    },
  }
