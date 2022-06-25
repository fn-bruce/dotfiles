if os.getenv("HOMEBREW_PREFIX") ~= nil then
  vim.g["python3_host_prog"] = os.getenv("HOMEBREW_PREFIX") .. "/bin/python3"
else
  vim.g["python3_host_prog"] = "/usr/bin/python3"
end
