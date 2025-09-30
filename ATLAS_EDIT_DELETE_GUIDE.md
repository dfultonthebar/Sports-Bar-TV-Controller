
# Atlas Configuration - Edit & Delete Guide

## Overview
The Atlas Configuration interface provides full editing and deletion capabilities for inputs, outputs, and configurations.

## Input Configuration - Edit & Delete Features

### Edit Input Name
- Click on the input name field at the top of each input card
- Type the new name directly
- Changes are saved automatically

### Edit Input Type
- Use the dropdown below the name to change between:
  - Microphone
  - Line Input
  - Dante Network
  - Zone Feed

### Edit Input Parameters
Each input card allows editing:
- **Physical Input Assignment** - Select which physical input (1-8) to use
- **Stereo Mode** - Choose Mono, Stereo Left, Stereo Right, or Full Stereo
- **Gain Control** - Slider from -20dB to +60dB
- **Processing Options** - Toggle checkboxes for:
  - Phantom Power (+48V) - for microphones
  - Low Cut Filter
  - Compressor
  - Noise Gate
- **3-Band EQ** - Adjust High, Mid, and Low bands (-12dB to +12dB)
- **Output Routing** - Check/uncheck which zones receive this input

### Delete Input
- Click the red trash icon button in the top-right of each input card
- System prevents deleting the last input (minimum of 1 required)
- Confirmation prompt appears before deletion

### Add New Input
- Click the "Add Input" button at the top of the inputs tab
- New input is created with the next available physical input

### Stereo Linking
- Link two mono inputs together for stereo operation
- Use the "Link with..." dropdown to pair inputs
- Click "Unlink" to separate paired inputs

## Output Configuration - Edit & Delete Features

### Edit Output Name
- Click on the output name field at the top of each output card
- Type the new name directly
- Changes are saved automatically

### Edit Output Type
- Use the dropdown below the name to change between:
  - Speaker Zone
  - Dante Output
  - Zone Feed

### Edit Output Parameters
Each output card allows editing:
- **Physical Output Assignment** - Select which physical output (1-8) to use
- **Level Control** - Slider from -60dB to +12dB
- **Delay** - Set delay in milliseconds (0-500ms)
- **Processing Options** - Toggle checkboxes for:
  - Mute
  - Compressor
  - Limiter
- **3-Band EQ** - Adjust High, Mid, and Low bands (-12dB to +12dB)

### Delete Output
- Click the red trash icon button in the top-right of each output card
- System prevents deleting the last output (minimum of 1 required)
- Confirmation prompt appears before deletion

### Add New Output
- Click the "Add Output" button at the top of the outputs tab
- New output is created with the next available physical output

### Output Grouping
- Create groups of outputs that control together
- Click "Create Group" to start a new group
- Click "+ [Adjacent Output]" for quick grouping with nearby zones
- Click "Leave Group" to remove an output from its group
- Grouped outputs show a GROUP badge with the group name

## Scene Management

### Save Configuration as Scene
- Click "Save Configuration" button
- Enter a scene name and description
- All current input/output settings are stored
- Scene appears in the Scene Recall tab

### Recall Scene
- Go to the Scene Recall tab
- Click "Recall" button on any saved scene
- All settings are restored to match the scene
- Confirmation message appears

### Delete Scene
- Currently scenes are stored locally
- Delete function can be added by clicking the trash icon (if implemented)

## Text Input Styling

### White Background Fields
All input boxes with white backgrounds now use:
- **Text Color**: Black (`text-black`)
- **Placeholder**: Gray (`text-gray-500`)
- **Border**: Light gray (`border-gray-200`)
- **Focus Ring**: Blue (`ring-blue-500`)

This ensures maximum readability when entering or editing values.

## Tips for Best Experience

1. **Save Configurations Frequently**: Use the "Save Configuration" button to preserve your settings as named scenes

2. **Use Descriptive Names**: Give inputs and outputs meaningful names like "DJ Mic", "Main Bar Zone", etc.

3. **Group Related Zones**: Create output groups for areas that always play together

4. **Test Before Saving**: Adjust settings and test audio before saving as a scene

5. **Physical Input Mapping**: Remember physical inputs on the processor are 1-based (Input 1, 2, 3, etc.)

## Color Scheme

The Atlas section uses a consistent blue color scheme:
- Background: Dark blue tones
- Primary accent: Teal/cyan for headers and icons
- Text on dark: Light blue tones (blue-100 through blue-400)
- Cards: White backgrounds with black text
- Interactive elements: Blue highlights

All purple text has been removed for better readability.
