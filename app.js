import apogeeutil from "./lib/apogeeUtilLib.es.js";
import * as apogee from "./lib/apogeeCoreLib.es.js";
import * as apogeeapp from "./lib/apogeeAppLib.es.js";
import * as apogeeui from "./lib/apogeeUiLib.es.js";
import * as apogeeview from "./lib/apogeeViewLib.es.js";
import { ApogeeView, initIncludePath } from "./lib/apogeeViewLib.es.js";
import ElectronBridgeAppConfigManager from "./ElectronBridgeAppConfigManager.js";

//expose these apogee libraries globally so plugins can use them
window.apogeeutil = apogeeutil;
window.apogee = apogee;
window.apogeeapp = apogeeapp;
window.apogeeui = apogeeui;
window.apogeeview = apogeeview;

let appView;

window.init = function(includeBasePathInfo) {
    //initialize the include paths separately
    initIncludePath(includeBasePathInfo);
    
    //use cutnpaste file access
    let appConfigManager = new ElectronBridgeAppConfigManager();
    
    //create the application
    appView = new ApogeeView("appContainer",appConfigManager);
}

window.getWorkspaceIsDirty = function() {
    return appView.getApp().getWorkspaceIsDirty();
}
