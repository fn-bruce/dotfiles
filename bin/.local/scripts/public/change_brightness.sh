#!/bin/bash
# changeBrightness

# Arbitrary but unique message tag
msgTag="mybrightness"

# Change the brightness using brightnessctl
brightnessctl set "$@" >/dev/null

# Query brightnessctl for the current brightness level
brightness="$(brightnessctl get)"
max_brightness="$(brightnessctl max)"
brightness_percentage=$((100 * brightness / max_brightness))

# Show the brightness notification
dunstify -a "changeBrightness" -u low -i display-brightness-high -h string:x-dunst-stack-tag:$msgTag \
  -h int:value:"$brightness_percentage" "Brightness: ${brightness_percentage}%"

# Play the brightness changed sound (optional, remove if not needed)
canberra-gtk-play -i audio-volume-change -d "changeBrightness"
