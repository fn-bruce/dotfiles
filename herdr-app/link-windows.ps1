# Link this folder's Herdr app config into %USERPROFILE%\.config\herdr-app on Windows.
#
# Files are linked one by one (not the whole folder) so Windows gets
# keys.windows.json as its keys.json while macOS keeps keys.json.
# Needs Developer Mode or an elevated shell for symlinks.
#
# Usage: pwsh -File herdr-app\link-windows.ps1

$ErrorActionPreference = "Stop"
$src = $PSScriptRoot
$dst = Join-Path $env:USERPROFILE ".config\herdr-app"

# target (relative to $dst) -> source (relative to $src)
$links = [ordered]@{
  "settings.json"            = "settings.json"
  "keys.json"                = "keys.windows.json"
  "themes\tokyo-night.json"  = "themes\tokyo-night.json"
  "layouts\my-main.json"     = "layouts\my-main.json"
  "mods\my-spaces"           = "mods\my-spaces"
  "mods\my-agents"           = "mods\my-agents"
}

foreach ($entry in $links.GetEnumerator()) {
  $target = Join-Path $dst $entry.Key
  $source = Join-Path $src $entry.Value
  New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
  if (Test-Path $target) {
    $item = Get-Item $target -Force
    if ($item.LinkType -eq "SymbolicLink") { Remove-Item $target -Force -Recurse:$false }
    else {
      $backup = "$target.bak-$(Get-Date -Format yyyyMMddHHmmss)"
      Move-Item $target $backup
      Write-Host "backed up $target -> $backup"
    }
  }
  New-Item -ItemType SymbolicLink -Path $target -Target $source | Out-Null
  Write-Host "linked $target -> $source"
}

# settings.json plays ../herdr/sounds/caught-pokemon.mp3: the TUI's herdr folder
# must sit next to herdr-app.
$sound = Join-Path $env:USERPROFILE ".config\herdr\sounds\caught-pokemon.mp3"
if (-not (Test-Path $sound)) {
  Write-Warning "missing $sound - link the dotfiles herdr folder to $env:USERPROFILE\.config\herdr for the alert sound"
}

Write-Host "done. Restart Herdr so it picks up the linked files."
