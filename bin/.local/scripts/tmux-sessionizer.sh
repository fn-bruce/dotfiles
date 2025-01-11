#!/usr/bin/env bash

if [[ $# -eq 1 ]]; then
  selected=$1
else
  selected=$(find ~/projects/scratchpad/ ~/projects/personal ~/projects/work ~/projects/learning ~/projects/other ~/projects/prototypes ~/ -mindepth 1 -maxdepth 1 -type d | fzf)
fi

if [[ -z $selected ]]; then
  exit 0
fi

selected_name=$(basename "$selected" | tr . _)
tmux_running=$(pgrep tmux)

if [[ -z $TMUX ]] && [[ -z $tmux_running ]]; then
  # Create a new tmux session with the "dev" window
  tmux new-session -d -s "$selected_name" -c "$selected" -n "dev"
  # Create a second window named "build"
  tmux new-window -t "$selected_name" -n "build" -c "$selected"
  # Attach to the tmux session starting in the "dev" window
  tmux select-window -t "$selected_name:dev"
  tmux attach-session -t "$selected_name"
  exit 0
fi

if ! tmux has-session -t="$selected_name" 2>/dev/null; then
  # Create a detached session with "dev" and "build" windows
  tmux new-session -d -s "$selected_name" -c "$selected" -n "dev"
  tmux new-window -t "$selected_name" -n "build" -c "$selected"
fi

# Switch to the session
tmux switch-client -t "$selected_name"
