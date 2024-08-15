#!/bin/bash

# Define the initial screenshot options
options="Full Screen\nActive Window\nSelect Area"

# Use rofi to display the initial options
chosen=$(echo -e "$options" | rofi -dmenu -i -p "Screenshot")

# Function to display save/copy/edit options
save_copy_or_edit() {
  local file_path=$1
  local save_copy_edit_options="Save Image\nCopy to Clipboard\nEdit with Pinta"
  local save_copy_edit_chosen=$(echo -e "$save_copy_edit_options" | rofi -dmenu -i -p "Save, Copy or Edit")

  case "$save_copy_edit_chosen" in
  "Save Image")
    mv "$file_path" ~/Pictures/Screenshots/
    notify-send "Screenshot saved to ~/Pictures/Screenshots/"
    ;;
  "Copy to Clipboard")
    xclip -selection clipboard -t image/png -i "$file_path"
    rm "$file_path"
    notify-send "Screenshot copied to clipboard"
    ;;
  "Edit with Pinta")
    mv "$file_path" ~/Pictures/Screenshots/temp_screenshot.png
    pinta ~/Pictures/Screenshots/temp_screenshot.png &
    ;;
  *)
    exit 1
    ;;
  esac
}

# Generate a unique file path
file_name=$(date +%Y-%m-%d-%T)-screenshot.png
temp_file="/tmp/$file_name"

# Take action based on the initial choice
case "$chosen" in
"Full Screen")
  scrot "$temp_file"
  save_copy_or_edit "$temp_file"
  ;;
"Active Window")
  scrot -u "$temp_file"
  save_copy_or_edit "$temp_file"
  ;;
"Select Area")
  scrot --select --line mode=edge "$temp_file"
  save_copy_or_edit "$temp_file"
  ;;
*)
  exit 1
  ;;
esac
