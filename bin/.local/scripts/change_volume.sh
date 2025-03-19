#!/bin/bash
# changeVolume using pactl for PipeWire/PulseAudio

# Arbitrary but unique message tag
msgTag="myvolume"

# Adjust the volume
if [[ "$1" == "up" ]]; then
  pactl set-sink-volume @DEFAULT_SINK@ +5%
elif [[ "$1" == "down" ]]; then
  pactl set-sink-volume @DEFAULT_SINK@ -5%
elif [[ "$1" == "toggle" ]]; then
  pactl set-sink-mute @DEFAULT_SINK@ toggle
else
  echo "Usage: $0 {up|down|toggle}"
  exit 1
fi

# Query pactl for the current volume and mute status
volume=$(pactl get-sink-volume @DEFAULT_SINK@ | awk '{print $5}' | tr -d '%')
mute=$(pactl get-sink-mute @DEFAULT_SINK@ | awk '{print $2}')

# Ensure volume does not exceed 100%
if [[ "$volume" -gt 100 ]]; then
  pactl set-sink-volume @DEFAULT_SINK@ 100%
  volume=100
fi

# Check if volume is muted
if [[ "$mute" == "yes" ]]; then
  dunstify -a "changeVolume" -u low -i audio-volume-muted -h string:x-dunst-stack-tag:$msgTag "Volume muted"
else
  dunstify -a "changeVolume" -u low -i audio-volume-high -h string:x-dunst-stack-tag:$msgTag \
    -h int:value:"$volume" "Volume: ${volume}%"
fi

# Play the volume changed sound
canberra-gtk-play -i audio-volume-change -d "changeVolume"
