#!/bin/bash

# Options for powermenu
options="Cancel\nLogout\nSuspend\nHibernate\nReboot\nShutdown"

# Get user choice
choice=$(echo -e $options | rofi -dmenu -i -p "Power Menu")

# Perform action based on choice
case $choice in
Logout)
  i3-msg exit
  ;;
Suspend)
  systemctl suspend
  ;;
Hibernate)
  systemctl hibernate
  ;;
Reboot)
  systemctl reboot
  ;;
Shutdown)
  systemctl poweroff
  ;;
*) ;;
esac
