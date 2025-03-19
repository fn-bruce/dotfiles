#!/bin/bash
# toggleMicMute - Toggles microphone mute status using pactl for PulseAudio/PipeWire

# Arbitrary but unique message tag
msgTag="mymicmute"

# Toggle microphone mute status
pactl set-source-mute @DEFAULT_SOURCE@ toggle

# Get the current mute status
mute_status=$(pactl get-source-mute @DEFAULT_SOURCE@ | awk '{print $2}')

if [[ "$mute_status" == "yes" ]]; then
  # Microphone is now muted
  dunstify -a "toggleMicMute" -u low -i microphone-sensitivity-muted -h string:x-dunst-stack-tag:$msgTag "Microphone muted"
else
  # Microphone is now unmuted
  dunstify -a "toggleMicMute" -u low -i microphone-sensitivity-high -h string:x-dunst-stack-tag:$msgTag "Microphone unmuted"
fi

# Optional: Play a sound to indicate mute/unmute status
canberra-gtk-play -i audio-volume-change -d "toggleMicMute"
