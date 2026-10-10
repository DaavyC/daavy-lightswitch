# Daavy's Lightswitch

Adds clickable light switches to Foundry VTT maps.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/C1I7209LY1)

## Features

- Players can turn lights on or off when the GM enables their switches.
- Player switches appear only for visible lights within the configured interaction range.
- Connected lights switch together as a circuit.
- Switches appear when Lighting controls are inactive.

## Circuits

GMs edit circuits with the Circuits tool under Lighting controls. Only the clicked light needs Allow player toggle enabled. Its switch controls every connected light.

| Action | Control |
| --- | --- |
| Connect lights | Drag between lights. |
| Continue a chain | Hold Ctrl or Command when finishing a connection. |
| Select linked lights | Hold Shift, then click or drag. |
| Select all linked lights | Press Ctrl+A or Command+A. |
| Remove selected connections | Press Delete or Backspace. |
| Remove one connection | Right-click the connection. |

## Settings

| Setting | Effect |
| --- | --- |
| Allow players by default | Allow players to toggle newly created lights. |
| Show switches to GMs | Show switch icons to GMs. Enabled by default. |
| Limit interaction range | Require a controlled token within range to use a switch. |
| Maximum range | Set the distance in grid squares. The default is 5, and the range is 0 to 20. |
| Apply range limit to GMs | Apply the range limit to GMs. GMs without a controlled token bypass the limit. |

## Installation

In Foundry VTT, open Add-on Modules, choose Install Module, and enter the manifest URL:

<https://github.com/DaavyC/daavy-lightswitch/releases/latest/download/module.json>

## Compatibility

- Requires Foundry VTT 14.
- Works with any game system.

## Credits

- Inspired by [Light Switch](https://foundryvtt.com/packages/light-switch) by TheRipper93.
