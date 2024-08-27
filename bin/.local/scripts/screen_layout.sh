#!/bin/bash

# Define the directory containing the scripts
SCRIPTS_DIR="$HOME/.screenlayout"

# Check if the directory exists
if [ ! -d "$SCRIPTS_DIR" ]; then
  echo "Directory $SCRIPTS_DIR does not exist."
  exit 1
fi

# Generate a list of script names in title case without extensions
script_titles=($(ls "$SCRIPTS_DIR" | sed -e 's/\.[^.]*$//' -e 's/.*/\L&/' -e 's/\b[a-z]/\u&/g'))

# Use rofi to select a script by title
selected_title=$(printf "%s\n" "${script_titles[@]}" | rofi -dmenu -p "Select a screen layout:")

# Find the corresponding script file
if [ -n "$selected_title" ]; then
  script_file=$(ls "$SCRIPTS_DIR" | grep -i "^${selected_title// /}.*$")
  bash "$SCRIPTS_DIR/$script_file"
else
  echo "No script selected."
fi
