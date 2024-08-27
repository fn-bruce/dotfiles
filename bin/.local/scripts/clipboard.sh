#!/bin/bash

choice=$(echo -e "Show Clipboard\nClear Clipboard" | rofi -dmenu -p "Choose Action:")

if [ "$choice" == "Show Clipboard" ]; then
  rofi -modi "clipboard:greenclip print" -show clipboard -run-command '{cmd}'
  notify-send "Clipboard" "Copied to clipboard" -u low
elif [ "$choice" == "Clear Clipboard" ]; then
  pkill greenclip && greenclip clear && greenclip daemon &
  notify-send "Clipboard" "Clipboard cleared" -u low
fi
