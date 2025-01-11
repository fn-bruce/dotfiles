#!/bin/sh

mapwacom.sh -d "Wacom Intuos BT S Pen stylus" -s "HDMI-1"
xsetwacom set "Wacom Intuos BT S Pen stylus" Button 2 "key +ctrl z -ctrl"
