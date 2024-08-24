#!/bin/bash

# You can call this script like this:
# $./volume.sh up
# $./volume.sh down
# $./volume.sh mute

case $1 in
up)
  ~/.local/scripts/change_volume.sh 10%+
  ;;
down)
  ~/.local/scripts/change_volume.sh 10%-
  ;;
mute)
  ~/.local/scripts/change_volume.sh toggle
  ;;
esac
