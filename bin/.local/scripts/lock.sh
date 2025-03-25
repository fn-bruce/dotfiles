#!/bin/bash

USER=brucen
export DISPLAY=:0
export XAUTHORITY="/home/$USER/.Xauthority"
export DBUS_SESSION_BUS_ADDRESS="unix:path=/run/user/$(id -u $USER)/bus"

# You can log output here if needed
echo "Locking at $(date)" >>/tmp/betterlockscreen.log
betterlockscreen -l dim >>/tmp/betterlockscreen.log 2>&1
