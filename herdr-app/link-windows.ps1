# Link this folder's Herdr app config into %USERPROFILE%\.config\herdr-app on Windows.
#
# Files are linked one by one (not the whole folder) so Windows gets
# keys.windows.json as its keys.json while macOS keeps keys.json.
#
# Symlinks need Developer Mode or an elevated shell. Without either, folders
# fall back to junctions (still live) and files fall back to copies (re-run
# after editing them in dotfiles, or re-run elevated to get real symlinks).
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
  "mods\my-quiz"             = "mods\my-quiz"
  "mods\my-reader"           = "mods\my-reader"
  "mods\my-answer"           = "mods\my-answer"
  "mods\my-brain"            = "mods\my-brain"
  "mods\my-status"           = "mods\my-status"
  "mods\my-confirm"          = "mods\my-confirm"
  "mods\my-tickets"          = "mods\my-tickets"
}

$script:copied = @()

function Link-Item([string]$target, [string]$source) {
  New-Item -ItemType Directory -Force -Path (Split-Path $target) | Out-Null
  if (Test-Path $target) {
    $item = Get-Item $target -Force
    if ($item.LinkType -in @("SymbolicLink", "Junction")) {
      # Remove the link itself, never the files it points at.
      $item.Delete()
    }
    else {
      $backup = "$target.bak-$(Get-Date -Format yyyyMMddHHmmss)"
      Move-Item $target $backup
      Write-Host "backed up $target -> $backup"
    }
  }
  try {
    New-Item -ItemType SymbolicLink -Path $target -Target $source -ErrorAction Stop | Out-Null
    Write-Host "linked $target -> $source"
  }
  catch {
    if (Test-Path $source -PathType Container) {
      New-Item -ItemType Junction -Path $target -Target $source | Out-Null
      Write-Host "junction $target -> $source"
    }
    else {
      Copy-Item $source $target
      $script:copied += $target
      Write-Host "copied $source -> $target (no symlink permission)"
    }
  }
}

foreach ($entry in $links.GetEnumerator()) {
  Link-Item (Join-Path $dst $entry.Key) (Join-Path $src $entry.Value)
}

# settings.json plays ../herdr/sounds/caught-pokemon.mp3: the TUI's herdr folder
# must sit next to herdr-app. Link just its sounds folder from the dotfiles repo.
Link-Item (Join-Path $env:USERPROFILE ".config\herdr\sounds") (Join-Path $src "..\herdr\sounds" | Resolve-Path).Path

if ($script:copied.Count -gt 0) {
  Write-Warning "no symlink permission: these are copies, not links. Enable Developer Mode (Settings > System > For developers) or re-run from an elevated shell to link them:`n  $($script:copied -join "`n  ")"
}

Write-Host "done. Restart Herdr so it picks up the linked files."
