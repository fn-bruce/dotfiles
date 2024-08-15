#!/bin/bash
# toggleMicMute

# Arbitrary but unique message tag
msgTag="mymicmute"

# Toggle mute status of the microphone using amixer
amixer set Capture toggle >/dev/null

# Query amixer for the current mute status of the microphone
mute="$(amixer get Capture | grep -o '\[off\]\|\[on\]' | head -n1)"

if [[ "$mute" == "[off]" ]]; then
  # Show the microphone muted notification
  dunstify -a "toggleMicMute" -u low -i microphone-sensitivity-muted -h string:x-dunst-stack-tag:$msgTag "Microphone muted"
else
  # Show the microphone unmuted notification
  dunstify -a "toggleMicMute" -u low -i microphone-sensitivity-high -h string:x-dunst-stack-tag:$msgTag \
    "Microphone unmuted"
fi

# Play a sound when the microphone mute status is toggled (optional)
canberra-gtk-play -i audio-volume-change -d "toggleMicMute"
