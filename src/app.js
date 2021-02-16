import apogeeutil from "../../test-node-libs/apogeejs-util-lib/v2.0.0-p1/apogeeUtilLib.js";
import * as apogeebase from "../../test-node-libs/apogeejs-base-lib/v2.0.0-p1/apogeeBaseLib.js";
import * as apogee from "../../test-node-libs/apogeejs-model-lib/v2.0.0-p1/apogeeModelLib.js";
import * as apogeeapp from "../../test-node-libs/apogeejs-app-lib/v2.0.0-p1/apogeeAppLib.js";
import * as apogeeui from "../../test-node-libs/apogeejs-ui-lib/v2.0.0-p1/apogeeUiLib.js";
import * as apogeeview from "../../test-node-libs/apogeejs-view-lib/v2.0.0-p1/apogeeViewLib.js";
import {ApogeeView} from "../../test-node-libs/apogeejs-appview-lib/v2.0.0-p1/apogeeAppViewLib.js";
import ElectronBridgeAppConfigManager from "./ElectronBridgeAppConfigManager.js";
const { initIncludePath } = apogeeview;

//expose these apogee libraries globally so plugins can use them
window.apogeeutil = apogeeutil;
window.apogeebase = apogeebase;
window.apogee = apogee;
window.apogeeapp = apogeeapp;
window.apogeeui = apogeeui;
window.apogeeview = apogeeview;

//__globals__.apogeeLog = (msg) => console.log(message);
__globals__.apogeeUserAlert = (msg) => apogeeview.showSimpleActionDialog(msg,null,["OK"]);
__globals__.apogeeUserConfirm = (msg,okText,cancelText,okAction,cancelAction,defaultToOk) => apogeeview.showSimpleActionDialog(msg,null,[okText,cancelText],[okAction,cancelAction]);
__globals__.apogeeUserConfirmSynchronous = (msg,okText,cancelText,defaultToOk) => confirm(msg);

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
