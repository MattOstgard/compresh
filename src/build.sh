#!/bin/bash
cd ../builds

# Delete the folder twice because sometimes it doesn't take
rm -R -f compresh-darwin-x64
rm -R -f compresh-darwin-x64

# Package it using https://www.npmjs.com/package/electron-packager
electron-packager ../ --platform=darwin --arch=x64 --overwrite --ignore "/builds" --prune

echo Compressing to "compresh_osx.tar.gz"

########### zip command was not compressing nearly as much as finder or tar.. so using tar instead
# zip it with args: quiet (-q), recursive (-r), make it as old as latest entry (-o), best compression (-9), and exclude ds_store files (-x)
# zip -q -r "compresh.zip" "compresh-darwin-x64/compresh.app" -x "*.DS_Store"

tar -C "compresh-darwin-x64" -cvzf "compresh_osx.tar.gz" "compresh.app"