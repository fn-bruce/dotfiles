#!/bin/bash
# changeBrightness - Adjust brightness in clean 5% increments

# Arbitrary but unique message tag
msgTag="mybrightness"

# Get current and max brightness levels
current_brightness=$(brightnessctl get)
max_brightness=$(brightnessctl max)

# Calculate the current brightness percentage (rounded properly)
brightness_percentage=$(((100 * current_brightness + max_brightness / 2) / max_brightness))

# Round brightness percentage to the nearest multiple of 5
rounded_brightness_percentage=$(((brightness_percentage / 5) * 5))

# Adjust brightness in 5% steps
if [[ "$1" == "up" ]]; then
  new_brightness_percentage=$((rounded_brightness_percentage + 5))
elif [[ "$1" == "down" ]]; then
  new_brightness_percentage=$((rounded_brightness_percentage - 5))
else
  echo "Usage: $0 {up|down}"
  exit 1
fi

# Ensure brightness stays within valid range (0-100%)
if [[ "$new_brightness_percentage" -gt 100 ]]; then
  new_brightness_percentage=100
elif [[ "$new_brightness_percentage" -lt 0 ]]; then
  new_brightness_percentage=0
fi

# Convert percentage back to actual brightness value
new_brightness=$((max_brightness * new_brightness_percentage / 100))

# Apply new brightness
brightnessctl set "$new_brightness" >/dev/null

# Show the brightness notification
dunstify -a "changeBrightness" -u low -i display-brightness-high -h string:x-dunst-stack-tag:$msgTag \
  -h int:value:"$new_brightness_percentage" "Brightness: ${new_brightness_percentage}%"

# Play the brightness changed sound (optional, remove if not needed)
canberra-gtk-play -i audio-volume-change -d "changeBrightness"
