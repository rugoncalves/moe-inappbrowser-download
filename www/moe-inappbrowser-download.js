var exec = require('cordova/exec');

function download(url, filename, contentType, successCallback, errorCallback){
    var options = {};
    var args = {
        url: url,
        filename: filename,
        contentType: contentType,
        options: options
    };
    document.addEventListener('deviceready', function () {
        setTimeout(function() {
            downloadDocument(args, function(entry, contentType){
                if (!!successCallback && typeof(successCallback) === 'function'){
                    successCallback(entry, contentType);
                }
            }, function(error){
                if (!!errorCallback && typeof(errorCallback) === 'function'){
                    errorCallback("1: " + error);
                }
            }); // call the function which will download the file 1s after the window is closed, just in case..
        }, 1000);
    });
}

function downloadDocument(args, successCallback, errorCallback){

    var uri = encodeURI(args.url);
    var filename = args.filename;
    var contentType = args.contentType;
    window.requestFileSystem(LocalFileSystem.PERSISTENT, 0, function (fs) {
        console.log('>>> file system open: ' + fs.name);
        fs.root.getFile(filename, { create: true, exclusive: false }, function (fileEntry) {

            var fileTransfer = new FileTransfer();

            fileTransfer.download(
                uri,
                fileEntry.toURL(),
                function(entry) {
                    if (!!successCallback && typeof(successCallback) === 'function'){
                        successCallback(entry, contentType);
                    }
                },
                function(error) {
                     if (!!errorCallback && typeof(errorCallback) === 'function'){
                        errorCallback("2: " + error);
                     }
                },
                false
            );
        }, function (err) { console.error('>>> error getting file! ' + err); });
    }, function (err) { console.error('>>> error getting persistent fs! ' + err); });
}

function isIphoneX() {
    try {
        const iphoneModel = window.device.model;
        const m = iphoneModel.match(/iPhone(\d+),?(\d+)?/);
        const model = +m[1];

        //https://www.theiphonewiki.com/wiki/Models#iPhone
        //10.1, 10.2, 10.4 and 10.5 are iphone 8 and 8 plus
        if (model > 10 && model != 10.1 && model != 10.2 && model != 10.4 && model != 10.5) { // is iphone X
            return true;
        }
    } catch (e) { }

    return false;
}

exports.close = function(){
    window.inAppBrowserRef.close();
}

exports.open = function (arg0, success, error) {
    var fileOpenMode = "open";
    var fileOpenModes = ["open", "dialog"];
    var autoFixHeaderSize = true;

    if (!arg0.inAppBrowserUrl || arg0.inAppBrowserUrl.length === 0){
        error("Please set the url parameter");
        return;
    }
    if (!arg0.buttonClassName || arg0.buttonClassName.length === 0){
        error("Please set the buttonClassName parameter");
        return;
    }
    if (arg0.fileOpenMode && fileOpenModes.includes(arg0.fileOpenMode)){
        fileOpenMode = arg0.fileOpenMode;
    }
    if (arg0.autoFixHeaderSize != undefined){
        autoFixHeaderSize = arg0.autoFixHeaderSize;
    }

    var url = arg0.inAppBrowserUrl;
    var inAppBrowserOptions = arg0.inAppBrowserOptions;
    var buttonClassName = arg0.buttonClassName;

    window.inAppBrowserRef = cordova.InAppBrowser.open(url, '_blank',  inAppBrowserOptions);

    //add viewport-fit=cover so we can fill the left and right sides of the notch (if it exists)
    var script = "var metaViewport = document.querySelector('meta[name=viewport]');" +
                 "var metaViewportContent = metaViewport.getAttribute('content') + ', user-scalable=no, viewport-fit=cover';" +
                 "metaViewport.setAttribute('content', metaViewportContent);";

    //add html classes to know if it is an iphonex and above with notch
    if (isIphoneX()){
        script += "document.getElementsByTagName(\"body\")[0].classList.add(\"iphone-x\");";
    }

    script += "(function(parent){" +
                    "const pattern = /.*\/(.+?)\.([a-z]+)/;" +
                    "const pathPattern = /^(?:[^\/]*(?:\/(?:\/[^\/]*\/?)?)?([^?]+)(?:\??.+)?)$/;" +
                    "parent.moedownloader = parent.moedownloader || {};" +
                    "parent.moedownloader.getFilename = function (url) {" +
                        "let fileName = 'unknown-filename';" +
                        "//Check if is REST API url" +
                        "if(url.search('/rest/moedownloader/') !== -1) {" +
                            "const new_url = new URL(url);" +
                            "const new_filename = new_url.searchParams.get('filename');" +
                            "if(new_filename !== null) {" +
                                "fileName = new_filename;" +
                            "}" +
                        "} else {" +
                            "const path = url.match(pathPattern)[1];" +
                            "const match = decodeURI(path).match(pattern);" +
                            "if(match){" +
                                "if(match.length > 2){" +
                                    "fileName = match[1] + '.' + match[2];" +
                                "} else if(match.length === 2){" +
                                    "fileName = match[1];" +
                                "}" +
                            "}" +
                        "}" +
                        "return fileName;" +
                    "}" +
                    "parent.moedownloader.download = function(e){" +
                        "if(e.target.href != undefined && e.target.href != '#') {" +
                            "e.preventDefault();" +
                            "e.stopPropagation();" +
                            "var args = { " +
                                "url: e.target.href, " +
                                "filename: parent.moedownloader.getFilename(e.target.href)" +
                            "};" +
                            "webkit.messageHandlers.cordova_iab.postMessage(JSON.stringify(args));" +
                        "}" +
                    "}" +
                    "parent.moedownloader.intervalFinder = function(){" +
                        "var listDownloadButtons = document.querySelectorAll('." + buttonClassName + ":not([data-init=\"set\"]');" +
                        "const platformButton = window.location + '#';" +
                        "listDownloadButtons.forEach(function(element){" +
                            "if (element && element.href && element.href !== platformButton) { " +
                                "element.addEventListener('click', parent.moedownloader.download);" +
                                "element.setAttribute('data-init', 'set');" +
                            "} else {" +
                                "console.warn('The following element has class «" + buttonClassName + "» but does not have a valid href: ', element);" +
                            "}" +
                        "});" +
                    "}" +
                    "parent.moedownloader.interval = setInterval(parent.moedownloader.intervalFinder, 500);" +
                "})(window);"

    window.inAppBrowserRef.addEventListener('loadstop', function() {
        window.inAppBrowserRef.executeScript({code: script});

        if(autoFixHeaderSize && cordova.platformId === 'ios') {
            window.inAppBrowserRef.insertCSS({ code: ".header {padding-top: env(safe-area-inset-top)} .content {margin-top: env(safe-area-inset-top)}" });
        }
    });

    window.inAppBrowserRef.addEventListener('message', function(args) {
        console.log('>>> MESSAGE RECEIVED FROM IN_APP_BROWSER' + JSON.stringify(args));
        download(args.data.url, args.data.filename, args.data.contentType, function(entry, contentType){
            if (fileOpenMode === "open"){
                cordova.plugins.fileOpener2.open(entry.toURL(), contentType,
                    function(e){
                        error(e);
                    },
                    function(){
                        success();
                    }
                );
            }
            if (fileOpenMode === "dialog"){
                if (cordova.platformId === 'android'){
                    cordova.plugins.fileOpener2.save(entry.toURL(), args.data.filename, contentType,
                        function(e){
                            error(e);
                        },
                        function(){
                            success();
                        }
                    );
                } else if(cordova.platformId === 'ios'){
                    cordova.plugins.fileOpener2.showOpenWithDialog(entry.toURL(), contentType,
                        function(e){
                            error(e);
                        },
                        function(){
                            success();
                        }
                    );
                }
            }
        }, function(e){
            error(e)
        });
    });
};
