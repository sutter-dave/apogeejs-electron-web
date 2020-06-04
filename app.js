import {apogeeutil,apogee,apogeeapp,apogeeui,apogeeview} from "./lib/apogeeAppBundle.es.js";
import ElectronBridgeAppConfigManager from "./ElectronBridgeAppConfigManager.js";
const { ApogeeView, initIncludePath } = apogeeview;

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
