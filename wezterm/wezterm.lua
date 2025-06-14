-- Pull in the wezterm API
local wezterm = require("wezterm")

-- This will hold the configuration.
local config = wezterm.config_builder()

-- This is where you actually apply your config choices

config.color_scheme = "tokyonight_night"

config.font = wezterm.font("MesloLGS Nerd Font Mono")
config.font_size = 19

config.enable_tab_bar = false

config.window_decorations = "RESIZE"

-- config.window_background_opacity = 0.8
-- config.macos_window_background_blur = 20

config.window_padding = {
	top = 10,
	right = 0,
	left = 10,
	bottom = 0,
}

-- and finally, return the configuration to wezterm
return config
