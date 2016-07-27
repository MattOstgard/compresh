![compresh screenshot](./help/header.jpg)

# Compresh
A refreshingly easy WebGL image compression tool.

### What it is?
Compresh makes converting to device specific GPU compressed image formats drag-and-drop easy. GPU compressed images allow more textures in memory at once than regular image formats like jpg or png at close to the same download size (assuming the server is setup to gzip files). Compresh is currently in alpha and has limited options.

### Why Compresh?
Compressing to different webgl texture formats requires an artist to install multiple tools and learn more options than are really necessary in most cases. Compresh tries to simplify that process to make the conversion process quick and easy so artists can get back to doing what they love rather than doing a bunch of busy work.

### Install Instructions
Download: https://www.dropbox.com/s/s66x6o3gnhl2nlh/compresh_osx.tar.gz?dl=0
Unzip the file and then copy the Compresh app to your Applications folder

### Usage
Just drag and drop .png images or folders onto the window and it will convert to multiple formats for different devices and place the new files in a folder called "compressed" in the same folder as the source image. It also creates a quantized png (very small lossy png).
After conversion, size reports will be displayed for download size (assuming the server is setup to gzip everything) and video memory (VRAM) for each image as well as totals for all images.

### Extra tid-bits
- Currently only runs on OS X. Windows support coming.
- The defaults are setup to work with pixi.js and pixi-compressed-textures plugin which expect premultiplied textures. Phaser currently (July 2017) does not have a compressed texture plugin but will likely expect premultiplied images as well.
- It automatically detects if an alpha channel exists and picks the appropriate format
- If image is not power of two it will automatically resize it to the nearest power of two size.
- PVRTC (iOS format) requires textures to be square and the image will be resized to square based on the largest length between width and height. Other formats will not be made square.

### ATC on OS X
Compresh does not currently support ATC because third party converters with OSX/Unix support could not be found. There are a couple of things that might support it in the future (Compressonator or Crunch), but in the meantime OSX users will have to use Wine to install and run Compressonator. Here are instructions:
  1. Download and install [xQuartz](https://www.xquartz.org/) which is required for wine to work.
  2. Download and install [Wine](https://www.winehq.org/download/)
  3. Download [32 bit version of compressonator](http://developer.amd.com/tools-and-sdks/archive/games-cgi/the-compressonator/)
  4. To install compressonator start `Wine Staging`, cd to where you downloaded compressonator, enter `wine msiexec /i Compressonator.2008-12-18-v1.50.1731.msi`
  5. Setup with all of the default settings.
  6. In finder browse to (or press cmd+shift+g and paste this): `~/.wine/drive_c/Program Files/AMD/The Compressonator 1.50/` then double click `TheCompressonator.exe` to run it.
  7. You can now open images and convert them. Access your computer's directories through the `Z:` Drive
