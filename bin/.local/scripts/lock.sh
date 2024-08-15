#!/bin/bash

# suspend message display
pkill -u "$USER" -USR1 dunst

BLANK='#00000000'
CLEAR='#4D557B22'
DEFAULT='#4D557B'
TEXT='#4D557B'
WRONG='#D1726D'
VERIFYING='#FF9E64'
BACKGROUND='#1A1B26'

i3lock \
  --insidever-color=$CLEAR \
  --ringver-color=$VERIFYING \
  \
  --insidewrong-color=$CLEAR \
  --ringwrong-color=$WRONG \
  \
  --inside-color=$BLANK \
  --ring-color=$DEFAULT \
  --line-color=$BLANK \
  --separator-color=$DEFAULT \
  \
  --verif-color=$TEXT \
  --wrong-color=$TEXT \
  --time-color=$TEXT \
  --date-color=$TEXT \
  --layout-color=$TEXT \
  --keyhl-color=$WRONG \
  --bshl-color=$WRONG \
  \
  --screen 1 \
  --clock \
  --color=$BACKGROUND \
  --indicator \
  --time-str="%I:%M %p" \
  --date-str="%A, %m-%d-%Y" \
  --keylayout 1

# resume message display
pkill -u "$USER" -USR2 dunst
