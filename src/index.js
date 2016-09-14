// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

'use strict';

//TODO: ATC Compression. Currently there is only compressinator which is windows only. https://github.com/GPUOpen-Tools/Compressonator
// - At the moment the only way to run it on mac is to run it through
// [wine](https://dl.winehq.org/wine-builds/macosx/i686/winehq-staging-1.9.14.pkg), which requires
// [XQuartz](https://www.xquartz.org/), as well as mono and gecko which are auto installed.
// - This seems to be the only option on mac, and since it is too odd an installation to include with compresh, I will
// have to require wine and xquartz to be installed separately in order for ATC to work.
// - after installing wine the command to install compressonator would be:
// `wine msiexec /i "/Users/matt/Dropbox/Shared/SG_Vegas_WIP/compresh/bin/win/Compressonator.2008-12-18-v1.50.17311.msi" /qn`



// Initialize global PIXI variable.
// require('./bin/pixi.js');
// require('./bin/pixi-compressed-textures.js');

// //
// global.renderer = PIXI.autoDetectRenderer(10, 10, {resolution: window.devicePixelRatio || 1, transparent: true});
// document.body.appendChild(renderer.view);
// global.stage = new PIXI.Container();

// //
// PIXI.loader.add('test1', 'assets/bubble_64x64.png', {metadata: {choice: ['.dds']}})
//     .load(function(loader, resources) {
//         var spr1 = new PIXI.Sprite(resources.test1.texture);
//         stage.addChild(spr1);
//         renderer.resize(resources.test1.texture.width, resources.test1.texture.height);
//         renderer.render(stage);
//     });

///////////////////////////////



// For easier execution of shell commands: https://www.npmjs.com/package/shelljs
// const shell = require('shelljs');

// // GraphicsMagick: http://aheckmann.github.io/gm/
// const gm = require('gm');

// // https://github.com/lukeapage/pngjs
// const PNG = require('pngjs').PNG;





// standard node js things
global.$ = require('jQuery');
global.os = require('os');
global.path = require('path');
global.fs = require('fs');
global.electron = require('electron');
global.zlib = require('zlib');
// global.imagemin = require('imagemin');
// global.imageminMozjpeg = require('imagemin-mozjpeg');
// global.imageminPngquant = require('imagemin-pngquant');

// TODO: these should be removed in favor of an encoding and file extension specific commands defined in a json file
// global.PVR_TEX_TOOL_PATH = './bin/osx/pvr/PVRTexToolCLI';
// global.CRUNCH_PATH = './bin/osx/crunch';


function dirWalkSync(dir, extensions=[], filelist=[]) {
    let files = fs.readdirSync(dir);
    files.forEach(function(file) {
        if (fs.statSync(`${dir}/${file}`).isDirectory() && file.split(path.sep).pop() !== 'compressed') {
            filelist = dirWalkSync(`${dir}/${file}`, extensions, filelist);
        }
        else if (extensions.length === 0 || extensions.includes(path.extname(file))) {
            filelist.push(`${dir}/${file}`);
        }
    });
    return filelist;
}

function deleteFolderRecursive(path) {
  if( fs.existsSync(path) ) {
    fs.readdirSync(path).forEach(function(file,index){
      var curPath = path + "/" + file;
      if(fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursive(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};


class QLog {
    constructor() {
        this.queue = [];
    }
    
    push(...items) {
        this.queue = this.queue.concat(items);
        return this;
    }

    print() {
        console.log(this.queue.join('\n'));
        this.queue = [];
        return this;
    }
}

global.qlog = new QLog();


class CompreshApp {

    constructor(options) {
        // this.files = {};
        this.imageInfos = {};
        this._tempFiles = [];
        this._queue = [];
        this._readyToConvert = [];
        this._completed = [];
        this._cmdQueue = [];
        this._cmdThreadsAvailable = os.cpus().length;
        this.outFolderName = 'compressed';
        this.progressIcons = ['◌', '○', '◔', '◔', '◗', '◗', '◕', '◕', '◍', '●', '✔'];
        this.totalSizes = {};
        this.preMultiplyAlpha = true;

        //////////////////////////////////////////////////////
        ///////////// TODO: add simulated download times while calculating sizes
        // // Speeds are from chrome v51.0 developer tool settings
        // // latency is in miliseconds, up and down are in megabits per second
        // this.networkSpeeds = [
        //     {name: 'Regular 3G', latency: 100, down: .75, up: .25},
        //     {name: 'Good 3G', latency: 40, down: 1.5, up: .75},
        //     {name: 'Regular 4G', latency: 20, down: 4, up: 3},
        //     {name: 'WiFi', latency: 2, down: 30, up: 15},
        // ];

        // // Default to `Good 3G` network simulation
        // this.networkSim = this.networkSpeeds[2];
        //////////////////////////////////////////////////////


        // Assign globals from main.js
        this.app = electron.remote.getGlobal('compreshGlobals').app;

        // after build and using exec the current directory returns as '/', so get the absolute path to resources/app/bin
        // /users/matt/dropbox/shared/SG_Vegas_wip/compresh/builds/compresh-darwin-x64/compresh/Contents/macOS/compresh
        this.bin = `${__dirname}/bin/`;
        this.crunchPath = `${this.bin}osx/crunch/crunch`;
        this.pvrTexToolPath = `${this.bin}osx/pvr/PVRTexToolCLI`;
        this.pngquantPath = `${this.bin}osx/pngquant/pngquant`;
        
        // Setup drag and drop listeners.
        // document.body.addEventListener('dragover', this.handleEvent, false);
        // document.body.addEventListener('drop', this.handleEvent, false);
        
        // Used to determine if an image is actually transparent.
        this.hiddenCanvas = document.createElement('canvas');
        this.hiddenCtx = this.hiddenCanvas.getContext("2d");

        //
        if (os.platform() === 'win32') {
            let errorMsg = 'Sorry, Windows is currently unsupported';
            console.error(errorMsg);

            $(document).ready( () => {
                $('header').append(`<x-error>${errorMsg}</x-error>`);
                $('x-dropzone').hide();
            });
        }

        // Setup Drag and drop events
        document.body.addEventListener('dragover', (event) => {
                event.stopPropagation();
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
        }, false);

        document.body.addEventListener('drop', this.handleFileDrop.bind(this), false);

        // Make all the items in the expandable list start out collapsed.
        $(document).ready( () => {
            $('.expandableList').find('li:has(ul)')
                .click( function(event) {
                    if (this == event.target) {
                        $(this).toggleClass('expanded');
                        $(this).children('ul').toggle('medium');
                    }
                    return false;
                })
                .addClass('collapsed')
                .children('ul')
                .hide();
        });




        // define our temp directory
        this.tempDir = `${this.app.getPath('temp')}compresh/`;
        // this.app.setPath('temp', this.tempDir);
        

        // Clean out the temp directory in case the app crashed last run
        deleteFolderRecursive(this.tempDir);

        // Recreate the temp folder
        if (!fs.existsSync(this.tempDir)){
            fs.mkdirSync(this.tempDir);
        }
    }

    isPow2(n) {
        if (typeof n !== 'number') {
            return 'Not a number'; 
        }
        return n && (n & (n - 1)) === 0;
    }

    nearestPow2(aSize){
        return Math.pow(2, Math.round(Math.log(aSize) / Math.log(2))); 
    }

    handleFileDrop(event) {
        //TEMP: http://www.html5rocks.com/en/tutorials/file/dndfiles/
        event.stopPropagation();
        event.preventDefault();

        // Put path in the queue
        for (let i = 0, f; f = event.dataTransfer.files[i]; i++) {
            //
            if (fs.lstatSync(f.path).isDirectory()) {
                let files = dirWalkSync(f.path, ['.png']);
                this._queue = this._queue.concat(files);
            }
            else if (f.type.match('image.*')) {
                this._queue.push(f.path);
            }
            else {
                alert('Unknown file type: ' + f.path);
            }
        }

        // Get ready to convert
        for (let imagePath of this._queue) {
            let imageInfo;

            //
            if (this.imageInfos[imagePath] === undefined) {
                // Create an empty imageInfo object
                this.imageInfos[imagePath] = {};
                imageInfo = this.imageInfos[imagePath];
            }
            else {
                imageInfo = this.imageInfos[imagePath];
                imageInfo.$slot.remove();
            }

            // Initialize imageInfo object
            imageInfo.path = imagePath;
            imageInfo.loaded = false;
            imageInfo.numCmdsProcessed = 0;
            imageInfo.shellCmds = [];
            
            // Default to source image path, but this will change if the image has to be resized or something similar.
            imageInfo.processedPath = imageInfo.path;

            // Initialize slot elements
            $('x-image-slots').show();
            $('x-dropzone').hide();
            $('x-image-slots').append(`<x-slot><x-thumb><img src="${imageInfo.path}"/></x-thumb><x-group><x-status/><x-info/></x-group></x-slot>`);
            
            // Assign elements to variables
            imageInfo.$slot   = $('x-image-slots').last().children('x-slot').last();
            imageInfo.$thumb  = imageInfo.$slot.children('x-thumb').last();
            imageInfo.$img    = imageInfo.$thumb.children('img').last();
            imageInfo.$group  = imageInfo.$slot.children('x-group').last();
            imageInfo.$status = imageInfo.$group.children('x-status').last();
            imageInfo.$info   = imageInfo.$group.children('x-info').last();
            
            // Setup the thumbnail image
            imageInfo.img = new Image();
            imageInfo.img.src = imageInfo.path;

            //
            imageInfo.$status.text('Unprocessed');

            //
            imageInfo.img.onload = ((imageInfo) => {
                // Image is not power of two, resize and save to a temporary image
                console.warn(`Image is not power of 2, resizing.\nPath: ${imageInfo.path}`);
                imageInfo.width = this.nearestPow2(imageInfo.img.width);
                imageInfo.height = this.nearestPow2(imageInfo.img.height);
                this.hiddenCanvas.width = imageInfo.width;
                this.hiddenCanvas.height = imageInfo.height;
                this.hiddenCtx.drawImage(imageInfo.img, 0, 0, this.hiddenCanvas.width, this.hiddenCanvas.height);

                // Test all pixels for non-white alpha channel
                imageInfo.hasAlpha = false;
                let imgData = this.hiddenCtx.getImageData(0, 0, this.hiddenCanvas.width, this.hiddenCanvas.height);
                for(let i = 3; i < imgData.data.length; i += 4) {
                    if (imgData.data[i] < 255) {
                        imageInfo.hasAlpha = true;
                        break;
                    }
                }

                // premultiply alpha
                // NOTE: this would be faster as a shader
                if (this.preMultiplyAlpha) {
                    for(let i = 3; i < imgData.data.length; i += 4) {
                        let alpha = imgData.data[i] / 255;
                        imgData.data[i - 3] *= alpha;
                        imgData.data[i - 2] *= alpha;
                        imgData.data[i - 1] *= alpha;
                    }
                }
                this.hiddenCtx.putImageData(imgData, 0, 0);

                //
                let newImg = electron.nativeImage.createFromDataURL(this.hiddenCanvas.toDataURL('image/png'));
                let pathData = path.parse(imageInfo.path);

                imageInfo.processedPath = `${this.tempDir}${this._tempFiles.length}_-_${pathData.name}.png`;
                this._tempFiles.push(imageInfo.processedPath);
                imageInfo.resized = true;
                
                // Write the file to disk and mark it as ready to convert
                fs.writeFile(imageInfo.processedPath, newImg.toPng(), ((imageInfo, err) => {
                    if (err) throw err;
                    this._readyToConvert.push(imageInfo.path);
                    if (this._queue.length === this._readyToConvert.length) {
                        this.doConversions();
                    }
                }).bind(this, imageInfo));
            }).bind(this, imageInfo);
        }
    }
    
    doConversions() {
        for (let imagePath of this._readyToConvert) {
            let imageInfo = this.imageInfos[imagePath];
            imageInfo.loaded = true;
            
            let formats = ['dds', 'pvr', 'etc1', 'png'];
            
            if (imageInfo.hasAlpha) {
                formats.push('etc1-alpha');
            }

            let args = {
                formats: formats,
                pvrEncoding: 'pvrtc1_4',
                maxMips: 1,
                discardTransparentPixels: true
            };
            imageInfo.shellCmds = this.getShellCmds(imageInfo, args);
            imageInfo.$status.text(`In Queue`);

            this.updateInfoLines(imageInfo);

            for (let cmd of imageInfo.shellCmds) {
                this._cmdQueue.push(cmd);
            }
        }
        this.doCmds();
    }

    doCmds() {
        let cmdsToRemoveFromQueue = [];
        for (let i in this._cmdQueue) {
            let cmdInfo = this._cmdQueue[i];
            let imageInfo = this.imageInfos[cmdInfo.path];
            
            if (this._cmdThreadsAvailable <= 0) {
                break;
            }

            else if (cmdInfo.threads <= this._cmdThreadsAvailable) {
                this._cmdThreadsAvailable -= cmdInfo.threads;
                cmdsToRemoveFromQueue.push(i);

                let exec = require('child_process').exec;
                let childProcess = exec(cmdInfo.cmd, ((imageInfo, cmdInfo, error, stdout, stderr) => {
                    cmdInfo.progress = 0.99;
                    imageInfo.numCmdsProcessed += 1;
                    if (error !== null) {
                        qlog.push(
                            '-------- ERROR WHILE COMPRESSING --------',
                            `COMMAND: ${cmdInfo.cmd}`,
                            `ERROR: ${error}`,
                            `STDOUT: ${stdout}`,
                            `STDERR: ${stderr}`
                        ).print();
                        
                        imageInfo.$status.text('ERROR');
                        imageInfo.$slot.toggleClass('error', true);
                    }
                    else {
                        imageInfo.$status.text(`Converting ${imageInfo.numCmdsProcessed}/${imageInfo.shellCmds.length}`);
                        cmdInfo.converted = true;
                        this.updateInfoLines(imageInfo);
                    }
                    
                    //
                    if (imageInfo.shellCmds.length === imageInfo.numCmdsProcessed) {
                        if (!imageInfo.$slot.hasClass('error')) {
                            imageInfo.$status.text('Done');
                        }
                        imageInfo.$slot.toggleClass('done', true);
                        this._completed.push(imageInfo.path);
                        if (this._completed.length === this._readyToConvert.length) {
                            this.onConversionsDone();
                        }
                    }

                    // Load up the next batch of commands
                    this._cmdThreadsAvailable += cmdInfo.threads;
                    this.doCmds();
                }).bind(this, imageInfo, cmdInfo));
                
                // TODO: use output to determine progress percent
                // childProcess.stdout.on('data', (chunk) => console.log(chunk));
                // childProcess.stderr.on('data', (chunk) => console.log(chunk));
            }
        }

        for (let i = cmdsToRemoveFromQueue.length -1; i >= 0; i--) {
            this._cmdQueue.splice(cmdsToRemoveFromQueue[i], 1);
        }
    }

    updateInfoLines(imageInfo) {
        let infoLines = [`Res: ${imageInfo.width}x${imageInfo.height}`];
        for (let cmdInfo of imageInfo.shellCmds) {
            let progressIcon = this.progressIcons[Math.floor(cmdInfo.progress * 10)];
            // let sizes = cmdInfo.sizes.calculated ? `⬇: ${cmdInfo.sizes.dlStr}, ${cmdInfo.sizes.dl_bppStr}, ${cmdInfo.sizes.dl_percentStr}; <b>RAM</b>: ${cmdInfo.sizes.ramStr}, ${cmdInfo.sizes.ram_bppStr}` : '';
            let sizes = cmdInfo.sizes.calculated ? `⬇: ${cmdInfo.sizes.dlStr}; <b>VRAM</b>: ${cmdInfo.sizes.ramStr}` : '';
            infoLines.push(`${progressIcon} ${path.basename(cmdInfo.outFile)} &nbsp;${sizes}`);
        }
        imageInfo.$info.html(infoLines.join('<br>\n'));

        // Show overall progress section
        $('x-overall-info').show();

        // Update overall progress
        let numCmds = 0;
        let progressSum = 0;
        let cmdsCompleted = 0;
        for (let i in this.imageInfos) {
            for (let cmdInfo of this.imageInfos[i].shellCmds) {
                numCmds++;
                progressSum += cmdInfo.progress;
                cmdsCompleted += cmdInfo.converted ? 1 : 0;
            }
        }
        
        if (numCmds !== 0) {
            let percent = Math.floor((progressSum / numCmds) * 100);
            let sourcesCount = Object.keys(this.imageInfos).length;
            let totalInfoStrings = [
                percent < 100 ? `${percent}%` : 'Completed',
                `${cmdsCompleted}/${numCmds} textures from ${sourcesCount} source${sourcesCount === 1 ? '' : 's'}`
            ];

            if (this.totalSizes.etc1 !== undefined) {
                 totalInfoStrings.push(
                    `⬇: ${this.totalSizes.etc1.dlStr}`,
                    `<b>VRAM</b>: ${this.totalSizes.etc1.ramStr}`,
                    'Sizes based on Android (ETC1)'
                );
            }
            $('x-overall-info').html(`${totalInfoStrings.join(' | ')}`);
        }
    }

    onConversionsDone() {
        for (let imagePath in this.imageInfos) {
            let imageInfo = this.imageInfos[imagePath];
            for (let cmdInfo of imageInfo.shellCmds) {
                if (cmdInfo.tempGzipFile === undefined) {
                    cmdInfo.tempGzipFile = `${this.tempDir}${this._tempFiles.length}_-_${path.basename(cmdInfo.outFile)}.tar.gz`;
                }
                
                this._tempFiles.push(cmdInfo.tempGzipFile);
                let gzipCmd = `tar -cvzf "${cmdInfo.tempGzipFile}" "${cmdInfo.outFile}"`;
                
                let exec = require('child_process').exec;
                exec(gzipCmd, ((imageInfo, cmdInfo, error, stdout, stderr) => {
                    if (error !== null || !fs.existsSync(cmdInfo.tempGzipFile)) {
                        qlog.push(
                            '--------------------- ERROR WHILE GETTING GZIP SIZE ---------------------',
                            (fs.existsSync(cmdInfo.tempGzipFile) ? '' : 'GZIPPED FILE WAS NOT WRITTEN!!\n'),
                            `COMMAND: ${gzipCmd}`,
                            '-',
                            `ERROR: ${error}`,
                            '-',
                            `STDOUT: ${stdout}`,
                            '-',
                            `STDERR: ${stderr}`
                        ).print();
                        return;
                    }

                    //
                    qlog.push(
                        '----------------------\n',
                        'Download and VRAM size report for source file:',
                        `${cmdInfo.outFile}\n`
                    );

                    
                    // FIX: sizes above should be in cmdInfo
                    // FIX: anything being compressed at square size will return the wrong image size because squaring is done via the pvrTexTool
                    let pixelCount = cmdInfo.width * cmdInfo.height;
                    
                    let ramSizeInBytes;
                    if (cmdInfo.sizes.ram_bpp === null)
                        ramSizeInBytes = fs.statSync(cmdInfo.outFile).size;
                    else
                        ramSizeInBytes = (pixelCount * cmdInfo.sizes.ram_bpp) / 8;
                    
                    //
                    let dlSizeInBytes = fs.statSync(cmdInfo.tempGzipFile).size;

                    // Convert to megabytes
                    cmdInfo.sizes.ram = ramSizeInBytes / 1000000;
                    cmdInfo.sizes.ramStr = `${Math.round(cmdInfo.sizes.ram * 100) / 100}MB`;
                    
                    // convert to bits and get bits per pixel
                    if (cmdInfo.sizes.ram_bpp === null)
                        cmdInfo.sizes.ram_bpp = (ramSizeInBytes * 8) / pixelCount;
                    cmdInfo.sizes.ram_bppStr = `${Math.round(cmdInfo.sizes.ram_bpp * 100) / 100}bpp`;
                    
                    // convert to megabytes
                    cmdInfo.sizes.dl = dlSizeInBytes / 1000000;
                    cmdInfo.sizes.dlStr = `${Math.round(cmdInfo.sizes.dl * 100) / 100}MB`;
                    
                    // convert to bits and get bits per pixel
                    cmdInfo.sizes.dl_bpp = (dlSizeInBytes * 8) / pixelCount;
                    cmdInfo.sizes.dl_bppStr = `${Math.round(cmdInfo.sizes.dl_bpp * 100) / 100}bpp`;
                    
                    // calculate gzip compression ratio compared to ram size
                    cmdInfo.sizes.dl_percent = cmdInfo.sizes.dl / cmdInfo.sizes.ram;
                    cmdInfo.sizes.dl_percentStr = `${Math.round(cmdInfo.sizes.dl_percent * 100)}%`;

                    cmdInfo.sizes.calculated = true;


                    // Make sure encoding exists in total sizes object
                    if (this.totalSizes[cmdInfo.encoding] === undefined)
                        this.totalSizes[cmdInfo.encoding] = {ram: 0, dl: 0};

                    // Add to overall sizes
                    let totalSizes = this.totalSizes[cmdInfo.encoding];
                    totalSizes.ram += cmdInfo.sizes.ram;
                    totalSizes.ramStr = `${Math.round(totalSizes.ram * 100) / 100}MB`;
                    totalSizes.dl += cmdInfo.sizes.dl;
                    totalSizes.dlStr = `${Math.round(totalSizes.dl * 100) / 100}MB`;


                    //
                    qlog.push(`Download size = ${cmdInfo.sizes.dlStr}; ${cmdInfo.sizes.dl_percentStr}; ${cmdInfo.sizes.dl_bppStr}`);
                    qlog.push(`RAM size = ${cmdInfo.sizes.ramStr}; ${cmdInfo.sizes.ram_bppStr}`);
                    qlog.print();

                    // Delete the gzipped file
                    fs.unlinkSync(cmdInfo.tempGzipFile);
                    if (fs.existsSync(cmdInfo.tempGzipFile)) {
                        console.warn('Failed to delete temporary file: ${cmdInfo.tempGzipFile}')
                    }

                    // Update progress gui
                    cmdInfo.progress = 1.0;
                    this.updateInfoLines(imageInfo);
                }).bind(this, imageInfo, cmdInfo));
            }
        }

        // Reset the queue arrays
        this._queue = [];
        this._readyToConvert = [];
        this._completed = [];
        this.totalSizes = {};
    }

    getShellCmds(imageInfo, args) {
        let cmdInfos = [];
        
        // For looking up what format belongs to what converter
        let crunchFormats = ['crn', 'dds'];
        let pvrTexToolFormats = ['pvr', 'etc1', 'etc1-alpha'];

        //
        let pathData = path.parse(imageInfo.path);
        let outDir = path.join(pathData.dir, this.outFolderName);
        let outPrefix = path.join(outDir, pathData.name);

        // Create the output directory
        if (!fs.existsSync(outDir)){
            fs.mkdirSync(outDir);
        }

        for (var i in args.formats) {
            var format = args.formats[i];

            // Initialize cmdInfo object
            let cmdInfo = {
                encoding: null,
                cmd: null,
                converted: false,
                outFile: null,
                previewImage: null,
                progress: 0,
                sizes: {
                    calculated: false,
                    dl: null,
                    dlStr: null,
                    dl_bpp: null,
                    dl_bppStr: null,
                    dl_percent: null,
                    dl_percentStr: null,
                    ram: null,
                    ramStr: null,
                    ram_bpp: null,
                    ram_bppStr: null,
                },
                threads: null,
                path: imageInfo.path,
                width: imageInfo.width,
                height: imageInfo.height
            }

            if (crunchFormats.includes(format)) {
                // Determine DXT encoding. DXT1 if image has no transparency, DXT5 if transparent.
                cmdInfo.encoding = (imageInfo.hasAlpha ? 'dxt5' : 'dxt1');

                cmdInfo.outFile = `${outPrefix}.${cmdInfo.encoding}.${format}`;
                cmdInfo.previewImage = `${cmdInfo.outFile}.png`;
                cmdInfo.threads = os.cpus().length;

                cmdInfo.cmd = `${this.crunchPath} -file "${imageInfo.processedPath}" -out "${cmdInfo.outFile}" -${cmdInfo.encoding} -fileformat ${format} ${args.maxMips <= 0 ? '' : '-maxmips ' + args.maxMips.toString()}`;
                cmdInfo.cmd += ` ; ${this.crunchPath} -file "${cmdInfo.outFile}" -out "${cmdInfo.previewImage}"`;
                
                //
                cmdInfos.push(cmdInfo);
            }
            else if (pvrTexToolFormats.includes(format)) {
                cmdInfo.encoding = format === 'pvr' ? args.pvrEncoding : 'etc1';
                
                // Shorten sub-extension as much as possible
                let subExtension;
                if (cmdInfo.encoding.startsWith('pvrtc1')) {
                    subExtension = 'pvr1';
                }
                else if (cmdInfo.encoding.startsWith('pvrtc2')) {
                    subExtension = 'pvr2';
                }
                else if (format === 'etc1-alpha') {
                    subExtension = 'etc1-alpha';
                }
                else {
                    subExtension = cmdInfo.encoding;
                }
                
                
                // TODO: when writing to etc, there should be an option to write to '.ktx' in addition to '.pvr'
                // let extension = cmdInfo.encoding.startsWith('etc') ? 'ktx' : 'pvr';
                let extension = 'pvr';

                cmdInfo.outFile = `${outPrefix}.${subExtension}.${extension}`;
                cmdInfo.previewImage = `${cmdInfo.outFile}.png`;
                cmdInfo.threads = cmdInfo.encoding === 'etc1' ? 1 : os.cpus().length;
                [cmdInfo.width, cmdInfo.height] = imageInfo.width > imageInfo.height ? [imageInfo.width, imageInfo.width] : [imageInfo.height, imageInfo.height];

                let cmdArray = [
                    `${this.pvrTexToolPath}`, // Executable
                    `-i "${imageInfo.processedPath}"`, // Input
                    `-o "${cmdInfo.outFile}"`, // Output
                    `-f ${cmdInfo.encoding}`, // Encoding format
                    (args.maxMips <= 0 ? '' : '-m ' + args.maxMips), // Number of mipmaps. Supplying nothing will create all mipmaps.
                    (args.discardTransparentPixels ? '-l' : ''), // Discard transparent pixels flag
                    // (args.preMultiplyAlpha ? '-p' : ''), // Premultiply flag
                    (format === 'pvr' ? '-square -' : ''), // Make image square if saving as pvr
                    (cmdInfo.encoding === 'etc1' ? '-q etcfastperceptual' : ''), // ETC1 only uses only one thread while compresseing so runs extremely slow with default values, so compress on a lower quality setting
                    `-d "${cmdInfo.previewImage}"`,
                ];

                if (format === 'etc1-alpha') {
                    cmdArray = cmdArray.concat([
                        // Make RGB be the alpha channel
                        `-red "${imageInfo.processedPath}",a`,
                        `-green "${imageInfo.processedPath}",a`,
                        `-blue "${imageInfo.processedPath}",a`,
                    ]);
                }

                cmdInfo.cmd = cmdArray.join(' ');
                //
                cmdInfos.push(cmdInfo);
            }
            else if (format === 'png') {
                cmdInfo.encoding = 'png_8bit'
                cmdInfo.outFile = `${outPrefix}.png`;
                cmdInfo.previewImage = cmdInfo.outFile;
                cmdInfo.threads = os.cpus().length;
                cmdInfo.sizes.ram_bpp = imageInfo.hasAlpha ? 32 : 24;
                let cmdArray = [
                    `${this.pngquantPath}`,
                    `--force --verbose`,
                    `--output "${cmdInfo.outFile}"`,
                    `"${imageInfo.path}"`,
                ];
                cmdInfo.cmd = cmdArray.join(' ');
                cmdInfos.push(cmdInfo);
            }
            else {
                alert('UNKNOWN FORMAT: ' + format);
            }
        }
        
        return cmdInfos;
    }
}

global.compresh = new CompreshApp();



