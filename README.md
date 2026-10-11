# Daavy's Lightswitch

Adds clickable light switches to Foundry VTT maps.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/C1I7209LY1)

## Features

- Players can turn lights on or off when the GM enables their switches.
- Player switches appear only for visible lights within the configured interaction range.
- Connected lights switch together as a circuit.
- Switches appear when Lighting controls are inactive.

## Light settings

Each light has a **Light Switch** group with these options:

| Setting | Effect |
| --- | --- |
| Allow players to use this switch | Allow players to turn the light and all connected lights on or off. |
| Switch icon | Use an image or GIF as the switch. The default switch appears if the field is blank or the image cannot load. |

Custom icons appear normally when lights are on and dim when lights are off. GIFs animate when the light is on and show their first frame when it is off.

## Circuits

GMs edit circuits with the **Circuits** tool under Lighting controls. Only the clicked light needs **Allow players to use this switch** enabled. Its switch controls every connected light.

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
| Allow players by default | Allow players to turn new lights on and off. |
| Show switches to GMs | Show switch icons to GMs. Enabled by default. |
| Default switch icon | Set the initial image or GIF for new lights. Leave blank to use the default switch. |
| Limit interaction range | Require a controlled token within range to use a switch. |
| Maximum range | Set the range from 0 to 20 grid squares. The default is 5. |
| Apply range limit to GMs | Apply the range limit to GMs. GMs without a controlled token bypass the limit. |

## Installation

In Foundry VTT, open Add-on Modules, choose Install Module, and enter the manifest URL:

<https://github.com/DaavyC/daavy-lightswitch/releases/latest/download/module.json>

## Compatibility

- Requires Foundry VTT 14.
- Works with any game system.

## Credits

- Inspired by [Light Switch](https://foundryvtt.com/packages/light-switch) by TheRipper93.
