#!/bin/sh

USER_RESOURCES=$HOME/.Xresources
USER_MODMAP=$HOME/.Xmodmap
SYS_RESOURCES=/etc/X11/xinit/.Xresources
SYS_MODMAP=/etc/X11/xinit/.Xmodmap

# merge in defaults and keymaps
if [ -f $SYS_RESOURCES ]; then
  xrdb -merge $SYS_RESOURCES
fi

if [ -f $SYS_MODMAP ]; then
  xmodmap $SYS_MODMAP
fi

if [ -f "$USER_RESOURCES" ]; then
  xrdb -merge "$USER_RESOURCES"
fi

if [ -f "$USER_MODMAP" ]; then
  xmodmap "$USER_MODMAP"
fi

# start some nice programs
if [ -d /etc/X11/xinit/xinitrc.d ]; then
  for f in /etc/X11/xinit/xinitrc.d/?*.sh; do
    [ -x "$f" ] && . "$f"
  done
  unset f
fi

LAPTOP_KB_ID=$(xinput list --id-only "AT Translated Set 2 keyboard")

setxkbmap -device "$LAPTOP_KB_ID" -option altwin:swap_lalt_lwin
setxkbmap -device "$LAPTOP_KB_ID" -option altwin:swap_alt_win
setxkbmap -device "$LAPTOP_KB_ID" -option caps:escape
xset r rate 300 50

picom &
exec i3
