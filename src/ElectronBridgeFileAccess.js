/* 
 * This class provides file open and save in electron.
 */
export default class ElectronBridgeFileAccess {
    
    //========================================
    // Public
    //========================================
    
    constructor() {}
    
    /**
     * This method returns fileMetadata appropriate for a new workspace.
     */
    getNewFileMetadata() {
        return {};
    }
    
    /**
     * This method returns true if the workspace has an existing file to which 
     * is can be saved without opening a save dialog. 
     */
    directSaveOk(fileMetadata) {
        return ((fileMetadata)&&(fileMetadata.path));
    }

    /**  This method shows a file open dialog and then opens the 
     * selected file. */
    openFile(onOpen) {
        //use the context bridge api
        openSaveApi.openFile(onOpen);
    }

    /** This method shows a save dialog and then saves to the 
     * selected file. */
    saveFileAs(fileMetadata,data,onSave) {
        openSaveApi.saveFileAs(fileMetadata,data,onSave)
    }

    /** This method directly saves the file to the given file location. */
    saveFile(fileMetadata,data,onSave) {
        
		if((fileMetadata)&&(fileMetadata.path)) {
            //make sure we have file metadata
            openSaveApi.saveFile(fileMetadata,data,onSave);
        }
        else {
            openSaveApi.saveFileAs(fileMetadata,data,onSave)
        }
    }

}

