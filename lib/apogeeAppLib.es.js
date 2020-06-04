// File: apogeeAppLib.es.js
// Version: 1.0.0-p1
// Copyright (c) 2016-2020 Dave Sutter
// License: MIT

import apogeeutil from './apogeeUtilLib.es.js';
import { Model, doAction } from './apogeeCoreLib.es.js';

/* 
 * This is a mixin to give event functionality.
 */
var EventManager = {};
    
/** This serves as the constructor. */
EventManager.eventManagerMixinInit = function() {
     /** This field holds the event listeners
    * @private */
    this.listenerTable = {};
    
    /** This field holds the event handlers
    * @private */
    this.handlerTable = {};
};

/** This method adds a listener for the given event. */
EventManager.addListener = function(eventName, callback) {
    var callbackList = this.listenerTable[eventName];
    if(!callbackList) {
        callbackList = [];
        this.listenerTable[eventName] = callbackList;
    }
    //make sure the object is not already in the list
    for(var i = 0; i < callbackList.length; i++) {
        var c = callbackList[i];
        if(c == callback) {
            return;
        }
    }
    //add to the list
    callbackList.push(callback);
};

/** This method removes a listener for the event. */
EventManager.removeListener = function(eventName, callback) {
    var callbackList = this.listenerTable[eventName];
    if(callbackList) {
        var index = callbackList.indexOf(callback);
        if(index >= 0) {
            callbackList.splice(index,1);
        }
    }
};

/** THis method dispatches an event. */
EventManager.hasListeners = function(eventName) {
    return this.listenerTable[eventName] ? true : false;
};

/** THis method dispatches an event. */
EventManager.dispatchEvent = function(eventName, eventData) {
    var callbackList = this.listenerTable[eventName];
    if(callbackList) {
        for(var i = 0; i < callbackList.length; i++) {
            var callback = callbackList[i];
            callback.call(null,eventData);
        }
    }
};


/** This method adds a handler. */
EventManager.addHandler = function(handlerName, callback) {
    this.handlerTable[handlerName] = callback;
};

/** This method clears a handler. */
EventManager.removeHandler = function(handlerName) {
    delete this.handlerTable[handlerName];
};

/** This method calls a handler by name and returns the result. If no 
 * handler is found undefined is returned. */
EventManager.callHandler = function(handlerName, handlerData) {
    var callback = this.handlerTable[handlerName];
    if(callback) {
        return callback(handlerData)
    }
    else {
        return undefined;
    }
};

/** This resets all the listeners and handlers */
EventManager.clearListenersAndHandlers = function() {
    this.listenerTable = {};
    this.handlerTable = {};
};

/** This is a class for the field object formalism. It is used to store fields
 * and track modifications. It allows you to lock the object so that no more changes
 * can be made. */
class FieldObject {

    /** constructor.
     * - objectType - a text only string giving the name of the object type. This
     * is used in the id string.
     * - instanceToCopy - if this argument is defined, the created instance will be a shallow copy
     * of the this passed instance. By default it will have the updated fields flag cleared, but this
     * can be changed with the "keepUpdatedFixed" flag The new instance will be unlocked.
     * - keepUpdatedFixed - This should only be used when an instance is copied. If this is true
     * the copied instance will keep the same fields updated flags. Otherwise they will be cleared.
     * - specialCaseIdValue - This can be set if you wnt to create a new instance with a specific ID value. 
     * This should be done only in special circumstances. One example is "redo" creation of an object (after an undo)
     * subsequent commands for this object will reference its original ID. This is a way to set the ID of the recreaeted
     * object to match the original.
     */
    constructor(objectType,instanceToCopy,keepUpdatedFixed,specialCaseIdValue) {
        if(!instanceToCopy) {
            if(specialCaseIdValue) {
                this.id = specialCaseIdValue;
            }
            else {
                this.id = _createId(objectType);
            }
            this.objectType = objectType;
        }
        else {
            this.id = instanceToCopy.id;
            this.objectType = instanceToCopy.objectType;

        }

        this.fieldMap = {};
        if(instanceToCopy) {
            Object.assign(this.fieldMap,instanceToCopy.fieldMap);
        }

        this.updated = {};
        if(keepUpdatedFixed) {
            Object.assign(this.updated,instanceToCopy.updated);
        }

        this.isLocked = false;
    }

    /** This sets a field value. It will throw an exception if the object is locked. */
    setField(name,value) {
        if(this.isLocked) {
            throw new Error("Attempting to set a value on a locked object.");
        }

        this.fieldMap[name] = value;
        this.updated[name] = true;
    }

    /** This will clear the value of a field. */
    clearField(name) {
        if(this.fieldMap[name] !== undefined) {
            delete this.fieldMap[name];
            this.updated[name] = true;
        }
    }

    /** This ges a field value, by name. */
    getField(name) {
        return this.fieldMap[name];
    }

    /** This method locks the object. On instantiation the object is unlocked and
     * fields can be set. Once it it locked the fields can not be changed. */
    lock() {
        this.isLocked = true;
    }

    getIsLocked() {
        return this.isLocked;
    }

    /** This returns a map of the updated fields for this object.  */
    getUpdated() {
        return this.updated;
    }

    /** This returns true if the given field is updated. */
    isFieldUpdated(field) {
        return this.updated[field] ? true : false;
    }

    /** This returns true if any fields in the give list have been updated. */
    areAnyFieldsUpdated(fieldList) {
        return fieldList.some( field => this.updated[field]);
    }

    /** This method should be implemented for any object using this mixin. 
     * This should give a unique identifier for all objects of the given object type, below.
     * A unique id may optionally be generated using the statid FieldObject method createId. */
    getId() {
        return this.id;
    }

    /** Thie method should be implemented for any object using this method. 
     * It identifies the type of object. */
    getType() {
        return this.objectType;
    }

    /** This static functions returns the type of an object given the ID. */
    static getTypeFromId(id) {
        let typeEnd = id.indexOf("|");
        if(typeEnd < 0) {
            throw new Error("Invalid ID");
        }
        else {
            return id.substr(0,typeEnd);
        }
    }

    /** This static function indicates if the given ID is an object of the given type. */
    static idIsTypeOf(id,type) {
        return id.startsWith(type + "|");
    }

    /** This loads the current field object to have a copy of the data from the given field object.
     * The update field is however cleared. This method will throw an exception is you try to copy 
     * into a loacked object. */
    copyFromFieldsObject(otherFieldObject) {
        if(this.isLocked) {
            throw new Error("Attempting to copy fields into a locked object.");
        }

        for(name in otherFieldObject.fieldMap) {
            this.fieldMap[name] = otherFieldObject.fieldMap[name];
        }
        this.updated = {};
    }

    //================================
    // Static Methods
    //================================

    

}

/** This function generates a ID that is unique over the span of this application execution (until the 
 * integers wrap). This is suitable for creating the field object ID for an instance.
 * At some point we shouldhandle wrapping, and the three cases it can cause - negative ids, 0 id, and most seriously,
 * a reused id.
 * 
 * Currently planned future solution to wrapping: make this an operation issue. And event can be issued when we 
 * have reached given id values. Then it is the responsibility of the operator to restart the sytems. This is probably safer
 * than trying to com eup with some clever remapping solution. */
function _createId(objectType) {
    return objectType + "|" + nextId++;
}

/** This is used for Id generation.
 * @private */
let nextId = 1;

/* 
 * This class manages the command history for undo/redo.
 * 
 * Commands that can be undone are stored in a circular queue with a length that is optionally 
 * settable at startup. (Otherwise a default len this used.)
 * 
 * Some rules for the undo/redo queue:
 * - only a max number of commands are stored
 * - when a command is undone or redone, the next undo and redo position is updated
 * - new commands are inserted replacing the next redo command (if there is one, otherwise they areput at the end)
 * - once the max number of commands are reached, additional added commands replace he oldeest command in the queue
 * 
 * The command manager fires an event each time the command history is updated.
 */
class CommandHistory {
    constructor(commandManager, eventManager, optionalUndoCommandCount) {
        this.commandManager = commandManager;
        this.eventManager = eventManager;
        this.undoCommandCount = (optionalUndoCommandCount !== undefined) ? optionalUndoCommandCount : CommandHistory.DEFAULT_UNDO_COMMAND_COUNT;
        this.clearHistory();
    }
    
    /** This method executes the given command and, if applicable, adds it to the queue. */
    addToHistory(undoCommand,redoCommand,description) {
        
        if((!undoCommand)||(!redoCommand)) {
            alert("Both the undo command and redo command must be provided");
            return;
        }
        
        var command = {};
        command.redoCmd = redoCommand;
        command.undoCmd = undoCommand;
        command.desc = description;
        
        this._saveCommand(command);

        //set workspace dirty whenever a command is added to history (description as argument thrown in gratuitiously, or now)
        this.eventManager.dispatchEvent("workspaceDirty",command.desc);
    }
    
    /** This method clears the undo/redo history. */
    clearHistory() {
        //set a fixed size array for our circular queue
        this.undoQueue = new Array(this.undoCommandCount);
        
        //we will keep cmd index values that DO NOT wrap.
        //we will assume we do not overflow the integers for now
        //to get an array index, we convert from cmd index to array index with a function using modulo
        
        //this where we will put the next added command
        this.nextInsertCmdIndex = 0;
        //this is last index that has a valid command, but only if it is greater than or equal to our first cmd index
        this.lastUsedCmdIndex = -1;
        //this is the first command index that has a valid command, but only if it is less than or equal to the last command index.
        this.firstUsedCmdIndex = 0;
        
        if(this.eventManager) {
            this.eventManager.dispatchEvent("historyUpdate",this);
        }
        
    }
    
    /** If there is an undo command, this method will return the description if there
     * is one or an empty string. If there is no undo command, this method will return
     * the value null. */
    getNextUndoDesc() {
        let command = this._getNextUndoCommand(false);
        if(command) {
            if(command.desc) {
                return command.desc
            }
            else {
                return "";
            }
        }
        else {
            return null;
        }
    }
    
    /** If there is an redo command, this method will return the description if there
     * is one or an empty string. If there is no undo command, this method will return
     * the value null.*/
    getNextRedoDesc() {
        let command = this._getNextRedoCommand(false);
        if(command) {
            if(command.desc) {
                return command.desc
            }
            else {
                return "";
            }
        }
        else {
            return null;
        }
    }
    
    /** This method undoes the next command to be undone. */
    undo() {
        let command = this._getNextUndoCommand(true);
        if((command)&&(command.undoCmd)) {
            let commandSuccess = this.commandManager.executeCommand(command.undoCmd,true);
            if(!commandSuccess) {
                this._commandUndoneFailed();
            }
        }
        else {
            //the ui should not let us get here
            alert("There is not command to undo");
        }  
    }
    
    /** This method redones the next command to be redone. */
    redo() {
        let command = this._getNextRedoCommand(true);
        if((command)&&(command.redoCmd)) {
            let commandSuccess = this.commandManager.executeCommand(command.redoCmd,true);
            if(!commandSuccess) {
                this._commandRedoneFailed();
            }
        }
        else {
            //the ui should not let us get here
            alert("There is not command to redo");
        }  
    }
    
    //=================================
    // Private Methods
    //=================================

    //-------------------------
    // These functions manage the undo queue
    //-------------------------
    
    _saveCommand(command) {
        let oldNextCmdIndex = this.nextInsertCmdIndex;
        let oldLastCmdIndex = this.lastUsedCmdIndex;
        let oldFirstCmdIndex = this.firstUsedCmdIndex;
        
        let insertArrayIndex = this._getArrayIndex(this.nextInsertCmdIndex);
        this.undoQueue[insertArrayIndex] = command;
        
        //update cmd index vlues
        // -last used index is the one just added
        this.lastUsedCmdIndex = this.nextInsertCmdIndex;
        // -next insert index is one more than the previous (wrapping is NOT done in the cmd index values, only in the array index values)
        this.nextInsertCmdIndex++;
        
        // -set the first used index
        if(oldFirstCmdIndex > oldLastCmdIndex) {
            //we need to set a valid value
            this.firstUsedCmdIndex == oldNextCmdIndex;
        }
        else {
            //check for wrapping commands
            let oldFirstArrayIndex = this._getArrayIndex(oldFirstCmdIndex);
            if(insertArrayIndex == oldFirstArrayIndex) {
                this.firstUsedCmdIndex++;
            }
        }
        
        //clear out any now unreachable redo commands
        if(this.nextInsertCmdIndex <= oldLastCmdIndex) {
            this._clearCommands(this.nextInsertCmdIndex,oldLastCmdIndex);
        }    
    }
    
    _getNextUndoCommand(doQueuePositionUpdate) {
        if((this.nextInsertCmdIndex - 1 >= this.firstUsedCmdIndex)&&(this.nextInsertCmdIndex - 1 <= this.lastUsedCmdIndex)) {
            let undoArrayIndex = this._getArrayIndex(this.nextInsertCmdIndex - 1);
            
            //update the queue positions, if requested
            if(doQueuePositionUpdate) {
                this.nextInsertCmdIndex--;
                
                //notify of change to command history
                if(this.eventManager) {
                    this.eventManager.dispatchEvent("historyUpdate",this);
                }
                
            }
            
            return this.undoQueue[undoArrayIndex];
        }
        else {
            //no available command
            return null;
        }
    }
    
    _getNextRedoCommand(doQueuePositionUpdate) {
        if((this.nextInsertCmdIndex >= this.firstUsedCmdIndex)&&(this.nextInsertCmdIndex <= this.lastUsedCmdIndex)) {
            let redoArrayIndex = this._getArrayIndex(this.nextInsertCmdIndex);
            
            //update the queue positions, if requested
            if(doQueuePositionUpdate) {
                this.nextInsertCmdIndex++;
                
                //notify of change to command history
                if(this.eventManager) {
                    this.eventManager.dispatchEvent("historyUpdate",this);
                }
            }
            
            return this.undoQueue[redoArrayIndex];
        }
        else {
            return null;
        }
    }
    
    _commandUndoneFailed() {
        //clear the undone command so it can not be redone (at the current position this.nextInsertCmdIndex)
        //and clear all commands previous to this one
        this._clearCommands(this.firstUsedCmdIndex,this.nextInsertCmdIndex);
        this.firstUsedCmdIndex = this.nextInsertCmdIndex;
        //we also need to update the last used index if it was the cmd we just failed to undo
        if(this.lastUsedCmdIndex === this.nextInsertCmdIndex) {
            this.lastUsedCmdIndex--;
        }
        
        //notify of change to command history
        if(this.eventManager) {
            this.eventManager.dispatchEvent("historyUpdate",this);
        }
    }
    
    _commandRedoneFailed() {
        //clear the redone command so it can not be undone (at the current position this.nextInsertCmdIndex-1)
        //and clear all commands after to this one
        this._clearCommands(this.nextInsertCmdIndex-1,this.lastUsedCmdIndex);
        this.lastUsedCmdIndex = this.nextInsertCmdIndex-1;
        //we also need to update the first used index if it was the cmd we just failed to redo
        if(this.firstUsedCmdIndex === this.nextInsertCmdIndex-1) {
            this.firstUsedCmdIndex++;
        }
        
        //notify of change to command history
        if(this.eventManager) {
            this.eventManager.dispatchEvent("historyUpdate",this);
        }
    }
    
    _getArrayIndex(cmdIndex) {
        return cmdIndex % this.undoCommandCount;
    }
    
    _clearCommands(startCmdIndex,endCmdIndex) {
        for(var cmdIndex = startCmdIndex; cmdIndex <= endCmdIndex; cmdIndex++) {
            let arrayIndex = this._getArrayIndex(cmdIndex);
            this.undoQueue[arrayIndex] = undefined;
        }
    }
}

/** This is the default number of stored undo/redo commands */
CommandHistory.DEFAULT_UNDO_COMMAND_COUNT = 50;

/* 
 * This class manages executing commands and storign and operating the command history for undo/redo.
 * It provides standarde error handling for the commands in addition to managing undo/redo or commands.
 * 
 * Command Structure:
 * {
 *      type - This is a string giving the command type. This will be used to dispatch
 *      the command to the proper execution function. The string should correspond to 
 *      a command that was registered with the regiter command function.  
 *     
 *     ?: setsDirty?
 *     
 *     ?: noUndo?
 *     
 *     (everything else depends on the specific command)
 * }
 * 
 * Command Object - Should be registered with "registerFunction". It should contain the following things:
 * - function executeCommand(workspaceManager,commandData,optionalAsynchOnComplete) = This exectues the command and return a commandResult object.
 * - function createUnfoCommand(workspceUI,commandData) - This creates an undo command json from the given command json.
 * - object commandInfo - This is metadata for the command:
 *      - type - A string giving the name of the command type
 *      - targetType - This identifies the type of the command target (what the command acts on) This may be missing if there is no event.
 *      - event - This is the name of the event the command will fire. (It should be "created", "updated", "deleted" or missing if there is no event) 
 *
 * Command functions should throw an error if they fail to execute. If there is no error thrown it is assumed the command completed 
 * successfully.
 */
class CommandManager {
    constructor(app) {
        this.app = app;

        this.commandHistory = new CommandHistory(this,app);

        this.commandInProgress = false;
        this.commandQueue = [];
    }
    
    /** This method executes the given command and, if applicable, adds it to the queue. 
     * Supress history does not add this command to the history. It is used by the history for
     * undo commands/redo commands.
    */
    executeCommand(command,suppressFromHistory) {

        //make sure we only exectue one command at a time. For now just give up if this happens
        if(this.commandInProgress) {
            alert("Command ettempted while another in progress. Ignored");
            return false;
        }

        //get a mutable workspace manager instance
        let oldWorkspaceManager = this.app.getWorkspaceManager();
        let newWorkspaceManager;
        if(oldWorkspaceManager) {
            newWorkspaceManager = oldWorkspaceManager.getMutableWorkspaceManager();
        }
        else {
            //instantiate a new empty workspace manager
            newWorkspaceManager = this.app.createWorkspaceManager();
        }

        var commandObject = CommandManager.getCommandObject(command.type);
        let undoCommand;
        let description;

        let undoError = false;
        let undoErrorMsg;
        let commandError = false;
        let commandErrrorMsg;

        if(commandObject) {
            //create the undo command - handle this error separately from command error
            try {
                //create undo command before doing command (since it may depend on current state)
                if((!suppressFromHistory)&&(commandObject.createUndoCommand)) {   
                    undoCommand = commandObject.createUndoCommand(newWorkspaceManager,command);  
                }

            }
            catch(error) {
                if(error.stack) console.error(error.stack);

                undoError = true;
                undoErrorMsg = error.toString();
            }

            //execute the command
            try {
                //read the desrition (this needs to be improved)
                description = commandObject.commandInfo.type;

                //execute the command
                commandObject.executeCommand(newWorkspaceManager,command);
            }
            catch(error) {
                if(error.stack) console.error(error.stack);

                commandError = true;
                commandErrrorMsg = error.toString();
            }
        }
        else {
            commandError = true;
            commandErrrorMsg = "Command type not found: " + command.type;
        }

        //--------------------------
        // Accept or reject update
        //--------------------------

        //if the command succceeded, update the workspace manager instance
        let commandDone;
        if(!commandError) {
            //success - commit accept change - set (or clear) the workspace
            if(newWorkspaceManager.getIsClosed()) {
                this.app.clearWorkspaceManager();
            }
            else {
                this.app.setWorkspaceManager(newWorkspaceManager);
            }

            //add to history if the command was done and there is an undo command
            if(undoCommand) {   
                this.commandHistory.addToHistory(undoCommand,command,description);
            }

            //fire events!!
            let changeMap = newWorkspaceManager.getChangeMap();
            let changeList = this._changeMapToChangeList(changeMap);

            newWorkspaceManager.lockAll();

            this._publishEvents(changeList);

            if(undoError) {
                //process an error on creating the history - clear the current history
                this.commandHistory.clearHistory();
                alert("The command was succesful but there was an error in the history. Undo is not available. Error: " + undoErrorMsg);
            }

            commandDone = true;
        }
        else {
            //failure - keep the old workspace 
            alert("Command failed: " + commandErrrorMsg);

            commandDone = false;
        }

        this.commandInProgress = false;
        return commandDone;
    }

    /** This returns the command history. */
    getCommandHistory() {
        return this.commandHistory;
    }

    //=========================================
    // Private Methods
    //=========================================

    _changeMapToChangeList(changeMap) {
        let changeList = [];
        for(let id in changeMap) {
            let changeMapEntry = changeMap[id];
            if(changeMapEntry.action != "transient") {
                let changeListEntry = {};
                changeListEntry.target = changeMapEntry.instance;
                changeListEntry.eventName = changeMapEntry.action;
                changeList.push(changeListEntry);
            }
        }
        return changeList;
    }

    /** This fires all the necessary events for the given command result */
    _publishEvents(changeList) {
        changeList.forEach( changeEntry => {
            //fire event
            if(changeEntry.eventName) {
                this.app.dispatchEvent(changeEntry.eventName,changeEntry.target);
            } 
        });
    }

    //=========================================
    // Static Methods
    //=========================================
    
    /** This message does a standard error alert for the user. If the error is
     * fatal, meaning the application is not in a stable state, the flag isFatal
     * should be set to true. Otherwise it can be omitted or set to false.  */
    static errorAlert(errorMsg) {
        alert(errorMsg);
    }
    
    /** This registers a command. The command object should hold two functions,
     * executeCommand(workspaceManager,commandData,optionalAsynchOnComplete) and, if applicable, createUndoCommand(workspaceManager,commandData)
     * and it should have the metadata commandInfo.
     */
    static registerCommand(commandObject) {
        
        //repeat warning
        let existingCommandObject = CommandManager.commandMap[commandObject.commandInfo.type];
        if(existingCommandObject) {
            alert("The given command already exists in the command manager: " + commandObject.commandInfo.type + ". It will be replaced with the new command");
        }
        
        CommandManager.commandMap[commandObject.commandInfo.type] = commandObject;
    }
    
    static getCommandObject(commandType) {
        return CommandManager.commandMap[commandType];
    }
    
}

/** This is a map of commands accessibly to the command manager. */
CommandManager.commandMap = {};

/** This class manages links and other reference entries, loading the references and
 * creating the UI tree elements for display of the references.
 * 
 * Any links needed for the page are managed externally by the Link Loader, which
 * allows multiple users to request the same link.
 */
class ReferenceManager extends FieldObject {

    constructor(app,instanceToCopy,keepUpdatedFixed) {
        super("referenceManager",instanceToCopy,keepUpdatedFixed);

        this.app = app;
        
        let referenceClassArray = ReferenceManager.getReferenceClassArray();
        this.referenceClassMap = {};
        referenceClassArray.forEach(referenceClass => {
            this.referenceClassMap[referenceClass.REFERENCE_TYPE] = referenceClass;
        });

        //==============
        //Fields
        //==============
        //Initailize these if this is a new instance
        if(!instanceToCopy) {
            //create empty reference map
            this.setField("referenceEntryMap",{});
        }

        //==============
        //Working variables
        //==============
        this.viewStateCallback = null;
        this.cachedViewState = null;

        this.workingChangeMap = {};

        //add a change map entry for this object
        this.workingChangeMap[this.getId()] = {action: instanceToCopy ? "referenceManager_updated" : "referenceManager_created", instance: this};
    }

    //====================================
    // Methods
    //====================================

    getApp() {
        return this.app;
    }

    //====================================
    // Reference Lifecycle Methods
    //====================================

    
    /** This method creates a reference entry. This does nto however load it, to 
     * do that ReferenceEntry.loadEntry() method must be called.  */
    createEntry(entryCommandData) {
        let oldEntryMap = this.getField("referenceEntryMap");
        //check if we already have this reference entry. Do not re-load it if we do.
        let entryKey = this._getEntryKey(entryCommandData.entryType,entryCommandData.url);
        let referenceEntry = oldEntryMap[entryKey];
        if(!referenceEntry) {
            //load the entry
            let referenceEntryClass = this.referenceClassMap[entryCommandData.entryType];
            if(!referenceEntryClass) throw new Error("Entry type nopt found: " + entryCommandData.entryType);
            referenceEntry = new referenceEntryClass(entryCommandData);
            this.registerRefEntry(referenceEntry);
        }
        return referenceEntry;
    }

    // updateEntry(entryType,url,entryData) {
    //     let refEntryId = this.lookupRefEntryId(entryType,url);
    //     if(!refEntryId) throw new Error("Reference entry not found. " + entryType + ":" + url);

    //     let referenceEntry = this.getMutableRefEntryById(refEntryId);
    //     if(!referenceEntry) throw new Error("Reference entry not found. refEntryId: " + refEntryId);

    //     //update entry
    //     let targetUrl = (entryData.newUrl !== undefined) ? entryData.newUrl : referenceEntry.getUrl();
    //     let targetNickname = (entryData.newNickname !== undefined) ? entryData.newNickname : referenceEntry.getNickname();
    //     referenceEntry.updateData(this.workspaceManager,targetUrl,targetNickname);

    //     this.registerRefEntry(referenceEntry);

    // }

    // removeEntry(entryType,url) {
    //     let refEntryId = this.lookupRefEntryId(entryType,url);
    //     if(!refEntryId) throw new Error("Reference entry not found. " + entryType + ":" + url);

    //     let referenceEntry = getMutableRefEntryById(refEntryId);
    //     if(!referenceEntry) throw new Error("Reference entry not found. refEntryId: " + refEntryId);

    //     referenceEntry.remove();

    //     this.unregisterRefEntry(referenceEntry);

    // }

    /** This method should be called when the parent is closed. It removes all links. */
    close() {
        let entryMap = this.getField("referenceEntryMap");
        for(let key in entryMap) {
            let referenceEntry = entryMap[key];
            referenceEntry.removeEntry();
        }
    }

    //====================================
    // Reference Owner Functionality
    //====================================

    /** The change map lists the changes to the referenceEntrys and model. This will only be
     * valid when the ReferenceManager is unlocked */
    getChangeMap() {
        return this.workingChangeMap;
    }

    /** This method locks the reference manager and all reference entries. */
    lockAll() {
        this.workingChangeMap = null;

        let referenceEntryMap = this.getField("referenceEntryMap");
        for(let id in referenceEntryMap) {
            referenceEntryMap[id].lock();
        }
        this.lock();
    }

    getRefEntryById(refEntryId) {
        return this.getField("referenceEntryMap")[refEntryId];
    }

    /** This method gets a mutable ref entry. If the current ref entry is mutable it returns
     * that. If not, it creates a mutable copy and registers the new mutable copy. It returns
     * null if the reference entry ID is not found. */
    getMutableRefEntryById(refEntryId) {
        let oldRefEntryMap = this.getField("referenceEntryMap");
        var oldRefEntry = oldRefEntryMap[refEntryId];
        if(oldRefEntry) {
            if(oldRefEntry.getIsLocked()) {
                //create an unlocked instance of the ref entry
                let newRefEntry = new oldRefEntry.constructor(null,oldRefEntry);

                //register this instance
                this.registerRefEntry(newRefEntry);

                return newRefEntry;
            }
            else {
                return oldRefEntry;
            }
        }
        else {
            return null;
        }
    }

    /** This method returns the ref entry ID for a given entry type and url. */
    lookupRefEntryId(entryType,url) {
        let urlMap = this.getField("urlMap");
        let entryKey = this._getEntryKey(entryType,url);
        return urlMap[entryKey];
    }

    /** This method returns the ref entry for a given entry type and url. */
    lookupEntry(entryType,url) {
        let refEntryId = this.lookupRefEntryId(entryType,url);
        if(refEntryId) {
            return this.getRefEntryById(refEntryId);
        }
        else {
            return null;
        }
    }

    /** This method stores the reference entry instance. It must be called when a
     * new reference entry is created and when a reference entry instance is replaced. */
    registerRefEntry(referenceEntry) {
        let refEntryId = referenceEntry.getId();
        let oldRefEntryMap = this.getField("referenceEntryMap");
        let oldRefEntry = oldRefEntryMap[refEntryId];

        //create the udpated map
        let newRefEntryMap = {};
        Object.assign(newRefEntryMap,oldRefEntryMap);
        newRefEntryMap[refEntryId] = referenceEntry;
        this.setField("referenceEntryMap",newRefEntryMap);

        //update the url map for this entry
        let oldUrlMap = this.getField("urlMap");
        let newUrlMap = {};
        Object.assign(newUrlMap,oldUrlMap);
        let newUrlKey = this._getEntryKey(referenceEntry.getEntryType(),referenceEntry.getUrl());
        if(oldRefEntry) {
            let oldUrlKey = this._getEntryKey(referenceEntry.getEntryType(),referenceEntry.getUrl());
            //delete the old entry id the key changed
            if(oldUrlKey != newUrlKey) {
                delete newUrlMap[oldUrlKey];
            }
        }
        newUrlMap[newUrlKey] = refEntryId;
        this.setField("urlMap",newUrlMap);

        //update the change map
        let oldChangeEntry = this.workingChangeMap[refEntryId];  
        let newAction; 
        if(oldChangeEntry) {
            //we will assume the events come in order
            //the only scenarios assuming order are:
            //created then updated => keep action as created
            //updated then updated => no change
            //we will just update the referenceEntry
            newAction = oldChangeEntry.action;
        }
        else {
            //new action will depend on if we have the ref entry in our old ref entry map
            newAction = oldRefEntryMap[refEntryId] ? "referenceEntry_updated" : "referenceEntry_created"; 
        }
        this.workingChangeMap[refEntryId] = {action: newAction, instance: referenceEntry};
    }

    /** This method takes the local actions needed when a referenceEntry is deleted. It is called internally. */
    unregisterRefEntry(referenceEntry) {
        let refEntryId = referenceEntry.getId();

        //update the referenceEntry map
        let oldRefEntryMap = this.getField("referenceEntryMap");
        let newRefEntryMap = {};
        Object.assign(newRefEntryMap,oldRefEntryMap);
        //remove the given referenceEntry
        delete newRefEntryMap[refEntryId];
        //save the updated map
        this.setField("referenceEntryMap",newRefEntryMap);

        //update the url map
        let oldUrlMap = this.getField("urlMap");
        let newUrlMap = {};
        Object.assign(newUrlMap,oldUrlMap);
        for(let urlKey in newUrlMap) {
            let urlRefEntryId = newUrlMap[urlKey];
            if(urlRefEntryId == refEntryId) {
                delete newUrlMap[urlKey];
            }
        }
        this.setField("urlMap",newUrlMap);

        //update the change map
        let oldChangeEntry = this.workingChangeMap[refEntryId];
        let newChangeEntry;
        if(oldChangeEntry) {
            //handle the case of an existing change entry
            if(oldChangeEntry.action == "referenceEntry_created") {
                //referenceEntry created and deleted during this action - flag it as transient
                newChangeEntry = {action: "transient", instance: referenceEntry};
            }
            else if(oldChangeEntry.action == "referenceEntry_updated") {
                newChangeEntry = {action: "referenceEntry_deleted", instance: referenceEntry};
            }
            else {
                //this shouldn't happen. If it does there is no change to the action
                //we will just update the referenceEntry
                newChangeEntry = {action: oldChangeEntry.action, instance: referenceEntry};
            }
        }
        else {
            //add a new change entry
            newChangeEntry = {action: "referenceEntry_deleted", instance: referenceEntry};
        }
        this.workingChangeMap[refEntryId] = newChangeEntry;  
    }


    //====================================
    // open and save methods
    //====================================

    setViewStateCallback(viewStateCallback) {
        this.viewStateCallback = viewStateCallback;
    }

    getCachedViewState() {
        return this.cachedViewState;
    }

    /** This method opens the reference entries. An on references load callback 
     * can be passed and it will be a called when all references are loaded, with the
     * load completion command result for each. The return value for this function is the
     * initial command result for starting the refernce loading.
     */
    load(workspaceManager,json) {

        let entryLoadedPromises = [];
        
        //load the reference entries
        if(json.refEntries) {

            //construct the load function
            let loadRefEntry = refEntryJson => {
                //create the entry (this does not actually load it)
                let referenceEntry = this.createEntry(refEntryJson);

                //load the entry - this will be asynchronous
                let loadEntryPromise = referenceEntry.loadEntry(workspaceManager);
                entryLoadedPromises.push(loadEntryPromise);
            };

            //load each entry
            json.refEntries.forEach(loadRefEntry);
        }

        //set the view state
        if(json.viewState !== undefined) {
            this.cachedViewState = json.viewState;
        }

        //create the return promise
        let referencesLoadedPromise;
        if(entryLoadedPromises.length > 0) {
            referencesLoadedPromise = Promise.all(entryLoadedPromises);
        }
        else {
            referencesLoadedPromise = Promise.resolve();
        }
        return referencesLoadedPromise;
    }

    /** This method opens the reference entries, from the structure returned from
     * the save call. It returns a promise that
     * resolves when all entries are loaded. 
     */
    toJson() {
        let json = {};
        let entryMap = this.getField("referenceEntryMap");
        let entriesJson = [];
        for(let key in entryMap) {
            let refEntry = entryMap[key];
            entriesJson.push(refEntry.toJson());
        }
        if(entriesJson.length > 0) {
            json.refEntries = entriesJson;
        }
    
        //set the view state
        if(this.viewStateCallback) {
            this.cachedViewState = this.viewStateCallback();
            if(this.cachedViewState) json.viewState = this.cachedViewState;
        }

        return json;
    }

    //=================================
    // Private
    //=================================

    _getEntryKey(entryType,url) {
        return entryType + "|"  + url;
    }

    /** This method returns the reference entry type classes which will be used in the app. */
    static getReferenceClassArray() {
        return ReferenceManager.referenceClassArray;
    }

    /** This method sets the reference entry type classes. */
    static setReferenceClassArray(referenceClassArray) {
        ReferenceManager.referenceClassArray = referenceClassArray;
    }
    
}

/** This is the base functionality for a component. */
class Component extends FieldObject {

    constructor(member,modelManager,instanceToCopy,keepUpdatedFixed) {
        super("component",instanceToCopy,keepUpdatedFixed);

        //inheriting objects can pass functions here to be called on cleanup, save, etc
        this.cleanupActions = [];
        
        //==============
        //Fields
        //==============
        //Initailize these if this is a new instance
        if(!instanceToCopy) {
            modelManager.registerComponent(this);
            this.setField("member",member);
            modelManager.registerMember(member.getId(),this,true);
        }

        //==============
        //Working variables
        //==============
        this.viewStateCallback = null;
        this.cachedViewState = null;
    }

    /** If an extending object has any cleanup actions, a callback should be passed here.
     * The callback will be executed in the context of the current object. */
    addCleanupAction(cleanupFunction) {
        this.cleanupActions.push(cleanupFunction);
    }

    //==============================
    // Public Instance Methods
    //==============================

    /** This method returns the base member for this component. To see if this
     * field has been updated, check the "member" field of the component.  
     * To access other child members for compound components, use the access those fields using
     * the getField method. The field name is the "member." + the variable name of the field. */
    getMember() {
        return this.getField("member");
    }

    /** This method returns true if the data from a given named member field has changed. */
    isMemberDataUpdated(memberFieldName) {
        return this.isMemberFieldUpdated(memberFieldName,"data");
    }

    /** This method returns true if the given member field has been updated. */
    isMemberFieldUpdated(memberFieldName,memberFieldFieldName) {
        if(this.isFieldUpdated(memberFieldName)) {
            let member = this.getField(memberFieldName);
            return member.isFieldUpdated(memberFieldFieldName);
        }
        else {
            return false;
        }
    }

    /** This method returns true if the given member field has been updated. */
    areAnyMemberFieldsUpdated(memberFieldName,memberFieldFieldNameList) {
        if(this.isFieldUpdated(memberFieldName)) {
            let member = this.getField(memberFieldName);
            return member.areAnyFieldsUpdated(memberFieldFieldNameList);
        }
        else {
            return false;
        }
    }
    
    /** This method returns the ID for the field. It is fixed for the duration of the application.
     * it is not persistent between running the application different time. */
    getMemberId() {
        return this.getField("member").getId();
    }

    /** This method returns the name of the component. To see if the value has been updated, check 
     * the component field name "member" and the member field name "name".
     */
    getName() {
        return this.getField("member").getName();
    }

    /** This method returns the name of the member including the full path.
     * To check if the full name has changed, use the isFullNameChanged method of the member. */
    getFullName(modelManager) {
        return this.getField("member").getFullName(modelManager.getModel());
    }

    /** This method returns a display name for the member object. */
    getDisplayName(useFullPath,modelManagerForFullPathOnly) {
        if(useFullPath) {
            return this.getFullName(modelManagerForFullPathOnly);
        }
        else {
            return this.getName();
        }
    }

    /** This method returns true if the display name field is updated. This method exists because
     * display name is potentially a compound field and this is a systematic way to see if it has changed.
     * Components modifying the getDisplayName method should also update this method.
     * Note this method only applies when useFullPath = false. If you are using useFullPath = true, also
     * check if the fullName has changed. */
    isDisplayNameUpdated() {
        return this.isMemberFieldUpdated("member","name");
    }

    getParentComponent(modelManager) {
        let model = modelManager.getModel();
        let parent = this.getField("member").getParentMember(model);
        if(parent) {
            let componentId = modelManager.getComponentIdByMemberId(parent.getId());
            return modelManager.getComponentByComponentId(componentId);
        }
        else {
            return null;
        }
    }

    setViewStateCallback(viewStateCallback) {
        this.viewStateCallback = viewStateCallback;
    }

    getCachedViewState() {
        return this.cachedViewState;
    }

    //------------------
    // serialization
    //------------------

    /** This serializes the component. */
    toJson(modelManager) {
        var json = {};
        json.type = this.constructor.uniqueName;

        //TO DO 

        if(this.displayState) {
            json.displayState = this.displayState;
        }
        
        //allow the specific component implementation to write to the json
        if(this.writeToJson) {
            this.writeToJson(json,modelManager);
        }

        if(this.viewStateCallback) {
            this.cachedViewState = this.viewStateCallback();
            if(this.cachedViewState) json.viewState = this.cachedViewState;
        }
        
        return json;
    }

    /** This is used to deserialize the component. */
    loadStoredData(json) {
        if(!json) json = {};
        
        //take any immediate needed actions
        
        //set the tree state
        if(json.viewState !== undefined) {
            this.cachedViewState = json.viewState;
        }
        
        //allow the component implemnetation ro read from the json
        if(this.readDataFromJson) {
            this.readDataFromJson(json);
        }

        //allow the component implemnetation ro read from the json
        if(this.readPropsFromJson) {
            this.readPropsFromJson(json);
        }
    }

    /** This is used to update properties, such as from the set properties form. */
    loadPropertyValues(json) {     
        if(this.readPropsFromJson) {
            this.readPropsFromJson(json);
        }
    }
    //==============================
    // Protected Instance Methods
    //==============================

    //This method should optionally be populated by an extending object.
    //** This method reads any necessary component implementation-specific stored data
    // * from the json. This should be used for stored data that is NOT updated when properties are updated. OPTIONAL */
    //readDataFromJson(json);

    //This method should optionally be populated by an extending object.
    //** This method reads any necessary component implementation-specific properties data
    // * from the json. This is also use when updating properties. OPTIONAL */
    //readPropsFromJson(json);

    //This method should optionally be populated by an extending object.
    //** This method writes any necessary component implementation-specific data
    // * to the json. OPTIONAL */
    //writeToJson(json,modelManager);

    /** This method cleans up after a delete. Any extending object that has delete
     * actions should pass a callback function to the method "addClenaupAction" */
    onDelete() {
        
        //execute cleanup actions
        for(var i = 0; i < this.cleanupActions.length; i++) {
            this.cleanupActions[i].call(this);
        }
    }

    /** This method extends the member udpated function from the base.
     * @protected */    
    memberUpdated(updatedMember) {
        
        let member = this.getField("member");
        if(updatedMember.getId() == member.getId()) {
            this.setField("member",updatedMember);
        }
        else {
            //there was an update to an internal field
            let internalMemberName = "member." + updatedMember.getName();
            this.setField(internalMemberName,updatedMember);
            
            //for now we will assume the internal members do not have their name update!!!
            //maybe I should add a error check 
        }
    }

    /** This method is used for setting initial values in the property dialog. 
     * If there are additional property lines, in the generator, this method should
     * be extended to give the values of those properties too. */
    getPropertyValues() {
        
        var member = this.getField("member");
        
        var values = {};
        values.name = member.getName();
        values.parentId = member.getParentId();

        if(member.constructor.generator.readProperties) {
            member.constructor.generator.readProperties(member,values);
        }
        if(this.readExtendedProperties) {
            this.readExtendedProperties(values);
        }
        return values;
    }

    //======================================
    // Static methods
    //======================================

    /** This function creates a json to create the member for a new component instance. 
     * It uses default values and then overwrites in with optionalBaseValues (these are intended to be base values outside of user input values)
     * and then optionalOverrideValues (these are intended to be user input values) */
    static createMemberJson(componentClass,optionalInputProperties,optionalBaseValues) {
        var json = apogeeutil.jsonCopy(componentClass.DEFAULT_MEMBER_JSON);
        if(optionalBaseValues) {
            for(var key in optionalBaseValues) {
                json[key]= optionalBaseValues[key];
            }
        }
        if(optionalInputProperties) {
            //add the base component values
            if(optionalInputProperties.name !== undefined) json.name = optionalInputProperties.name;
            
            //add the specific member properties for this component type
            if(componentClass.transferMemberProperties) {
                componentClass.transferMemberProperties(optionalInputProperties,json);
            }
        }
        
        return json;
    }

    /** This function merges values from two objects containing component property values. */
    static createComponentJson(componentClass,optionalInputProperties,optionalBaseValues) {
        //copy the base properties
        var newPropertyValues = optionalBaseValues ? apogeeutil.jsonCopy(optionalBaseValues) : {};
        
        //set the type
        newPropertyValues.type = componentClass.uniqueName;
        
        //add in the input property Value
        if((optionalInputProperties)&&(componentClass.transferComponentProperties)) {
            componentClass.transferComponentProperties(optionalInputProperties,newPropertyValues);
        }
        
        return newPropertyValues;
    }
}

//======================================
// All components should have a generator to create the component
// from a json. See existing components for examples.
//======================================

/** This component represents a json table object. */
class JsonTableComponent extends Component {
    
        
    constructor(member,modelManager,instanceToCopy,keepUpdatedFixed) {
        //extend edit component
        super(member,modelManager,instanceToCopy,keepUpdatedFixed);

        //==============
        //Fields
        //==============
        //Initailize these if this is a new instance
        if(!instanceToCopy) {
            //default view
            this.setField("dataView",JsonTableComponent.DEFAULT_DATA_VIEW);
        }
    };

    getDataView() {
        let dataView = this.getField("dataView");
        if(!dataView) dataView = JsonTableComponent.DEFAULT_DATA_VIEW;
        return dataView;
    }

    setDataView(dataView) {
        let oldDataView = this.getField("dataView");
        if(oldDataView != dataView) {
            this.setField("dataView",dataView);
        }
    }

    //==============================
    // serialization
    //==============================

    writeToJson(json,modelManager) {
        json.dataView = this.getDataView();
    }

    readPropsFromJson(json) {
        if(json.dataView !== undefined) {
            this.setDataView(json.dataView);
        }
    }

    //======================================
    // properties
    //======================================

    /** This returns the current values for the member and component properties in the  
     * proeprties dialog. */
    readExtendedProperties(values) {
        values.dataView = this.getDataView();
    }

    //======================================
    // Static methods
    //======================================

    /** This optional static function reads property input from the property 
     * dialog and copies it into a member property json. It is not needed for
     * this componnet. */
    //transferMemberProperties(inputValues,propertyJson) {
    //}

    /** This optional static function reads property input from the property 
     * dialog and copies it into a component property json. */
    static transferComponentProperties(inputValues,propertyJson) {
        if(inputValues.dataView !== undefined) {
            propertyJson.dataView = inputValues.dataView;
        }
    }
}

//======================================
// This is the component generator, to register the component
//======================================


/** This is the display name for the type of component */
JsonTableComponent.displayName = "Data Cell";
/** This is the univeral uniaue name for the component, used to deserialize the component. */
JsonTableComponent.uniqueName = "apogeeapp.JsonCell";

JsonTableComponent.DEFAULT_MEMBER_JSON = {
    "type": "apogee.JsonMember"
};

/** This component represents a table object. */
class FunctionComponent extends Component {

    constructor(member,modelManager,instanceToCopy,keepUpdatedFixed) {
        //extend edit component
        super(member,modelManager,instanceToCopy,keepUpdatedFixed);
    };

    /** This overrides the get title method of member to return the function declaration. */
    getDisplayName(useFullPath,modelManagerForFullPathOnly) {
        var name = useFullPath ? this.getFullName(modelManagerForFullPathOnly) : this.getName();
        let member = this.getMember();
        var argList = member.getArgList();
        var argListString = argList.join(",");
        return name + "(" + argListString + ")";
    }

    /** This method returns true if the display name field is updated. This method exists because
     * display name is potentially a compound field and this is a systematic way to see if it has changed.
     * Components modifying the getDisplayName method should also update this method.
     * Note this method only applies when useFullPath = false. We currently don't implement a method to see
     * if the full name was updated. */
    isDisplayNameUpdated() {
        return this.getMember().areAnyFieldsUpdated(["name","argList"]);
    }

    static transferMemberProperties(inputValues,propertyJson) {
        if(inputValues.argListString != undefined) { 
            if(!propertyJson.updateData) propertyJson.updateData = {};
            propertyJson.updateData.argList = apogeeutil.parseStringArray(inputValues.argListString);
        }
    }
   
}

//======================================
// This is the component generator, to register the component
//======================================

FunctionComponent.displayName = "Function Cell";
FunctionComponent.uniqueName = "apogeeapp.FunctionCell";

FunctionComponent.DEFAULT_MEMBER_JSON = {
    "type": "apogee.FunctionMember"
};

// Mappable:: interface
// There are several things that positions can be mapped through.
// Such objects conform to this interface.
//
//   map:: (pos: number, assoc: ?number) → number
//   Map a position through this object. When given, `assoc` (should
//   be -1 or 1, defaults to 1) determines with which side the
//   position is associated, which determines in which direction to
//   move when a chunk of content is inserted at the mapped position.
//
//   mapResult:: (pos: number, assoc: ?number) → MapResult
//   Map a position, and return an object containing additional
//   information about the mapping. The result's `deleted` field tells
//   you whether the position was deleted (completely enclosed in a
//   replaced range) during the mapping. When content on only one side
//   is deleted, the position itself is only considered deleted when
//   `assoc` points in the direction of the deleted content.

// Recovery values encode a range index and an offset. They are
// represented as numbers, because tons of them will be created when
// mapping, for example, a large number of decorations. The number's
// lower 16 bits provide the index, the remaining bits the offset.
//
// Note: We intentionally don't use bit shift operators to en- and
// decode these, since those clip to 32 bits, which we might in rare
// cases want to overflow. A 64-bit float can represent 48-bit
// integers precisely.

const lower16 = 0xffff;
const factor16 = Math.pow(2, 16);

function makeRecover(index, offset) { return index + offset * factor16 }
function recoverIndex(value) { return value & lower16 }
function recoverOffset(value) { return (value - (value & lower16)) / factor16 }

// ::- An object representing a mapped position with extra
// information.
class MapResult {
  constructor(pos, deleted = false, recover = null) {
    // :: number The mapped version of the position.
    this.pos = pos;
    // :: bool Tells you whether the position was deleted, that is,
    // whether the step removed its surroundings from the document.
    this.deleted = deleted;
    this.recover = recover;
  }
}

// :: class extends Mappable
// A map describing the deletions and insertions made by a step, which
// can be used to find the correspondence between positions in the
// pre-step version of a document and the same position in the
// post-step version.
class StepMap {
  // :: ([number])
  // Create a position map. The modifications to the document are
  // represented as an array of numbers, in which each group of three
  // represents a modified chunk as `[start, oldSize, newSize]`.
  constructor(ranges, inverted = false) {
    this.ranges = ranges;
    this.inverted = inverted;
  }

  recover(value) {
    let diff = 0, index = recoverIndex(value);
    if (!this.inverted) for (let i = 0; i < index; i++)
      diff += this.ranges[i * 3 + 2] - this.ranges[i * 3 + 1];
    return this.ranges[index * 3] + diff + recoverOffset(value)
  }

  // : (number, ?number) → MapResult
  mapResult(pos, assoc = 1) { return this._map(pos, assoc, false) }

  // : (number, ?number) → number
  map(pos, assoc = 1) { return this._map(pos, assoc, true) }

  _map(pos, assoc, simple) {
    let diff = 0, oldIndex = this.inverted ? 2 : 1, newIndex = this.inverted ? 1 : 2;
    for (let i = 0; i < this.ranges.length; i += 3) {
      let start = this.ranges[i] - (this.inverted ? diff : 0);
      if (start > pos) break
      let oldSize = this.ranges[i + oldIndex], newSize = this.ranges[i + newIndex], end = start + oldSize;
      if (pos <= end) {
        let side = !oldSize ? assoc : pos == start ? -1 : pos == end ? 1 : assoc;
        let result = start + diff + (side < 0 ? 0 : newSize);
        if (simple) return result
        let recover = makeRecover(i / 3, pos - start);
        return new MapResult(result, assoc < 0 ? pos != start : pos != end, recover)
      }
      diff += newSize - oldSize;
    }
    return simple ? pos + diff : new MapResult(pos + diff)
  }

  touches(pos, recover) {
    let diff = 0, index = recoverIndex(recover);
    let oldIndex = this.inverted ? 2 : 1, newIndex = this.inverted ? 1 : 2;
    for (let i = 0; i < this.ranges.length; i += 3) {
      let start = this.ranges[i] - (this.inverted ? diff : 0);
      if (start > pos) break
      let oldSize = this.ranges[i + oldIndex], end = start + oldSize;
      if (pos <= end && i == index * 3) return true
      diff += this.ranges[i + newIndex] - oldSize;
    }
    return false
  }

  // :: ((oldStart: number, oldEnd: number, newStart: number, newEnd: number))
  // Calls the given function on each of the changed ranges included in
  // this map.
  forEach(f) {
    let oldIndex = this.inverted ? 2 : 1, newIndex = this.inverted ? 1 : 2;
    for (let i = 0, diff = 0; i < this.ranges.length; i += 3) {
      let start = this.ranges[i], oldStart = start - (this.inverted ? diff : 0), newStart = start + (this.inverted ? 0 : diff);
      let oldSize = this.ranges[i + oldIndex], newSize = this.ranges[i + newIndex];
      f(oldStart, oldStart + oldSize, newStart, newStart + newSize);
      diff += newSize - oldSize;
    }
  }

  // :: () → StepMap
  // Create an inverted version of this map. The result can be used to
  // map positions in the post-step document to the pre-step document.
  invert() {
    return new StepMap(this.ranges, !this.inverted)
  }

  toString() {
    return (this.inverted ? "-" : "") + JSON.stringify(this.ranges)
  }

  // :: (n: number) → StepMap
  // Create a map that moves all positions by offset `n` (which may be
  // negative). This can be useful when applying steps meant for a
  // sub-document to a larger document, or vice-versa.
  static offset(n) {
    return n == 0 ? StepMap.empty : new StepMap(n < 0 ? [0, -n, 0] : [0, 0, n])
  }
}

StepMap.empty = new StepMap([]);

// :: class extends Mappable
// A mapping represents a pipeline of zero or more [step
// maps](#transform.StepMap). It has special provisions for losslessly
// handling mapping positions through a series of steps in which some
// steps are inverted versions of earlier steps. (This comes up when
// ‘[rebasing](/docs/guide/#transform.rebasing)’ steps for
// collaboration or history management.)
class Mapping {
  // :: (?[StepMap])
  // Create a new mapping with the given position maps.
  constructor(maps, mirror, from, to) {
    // :: [StepMap]
    // The step maps in this mapping.
    this.maps = maps || [];
    // :: number
    // The starting position in the `maps` array, used when `map` or
    // `mapResult` is called.
    this.from = from || 0;
    // :: number
    // The end position in the `maps` array.
    this.to = to == null ? this.maps.length : to;
    this.mirror = mirror;
  }

  // :: (?number, ?number) → Mapping
  // Create a mapping that maps only through a part of this one.
  slice(from = 0, to = this.maps.length) {
    return new Mapping(this.maps, this.mirror, from, to)
  }

  copy() {
    return new Mapping(this.maps.slice(), this.mirror && this.mirror.slice(), this.from, this.to)
  }

  // :: (StepMap, ?number)
  // Add a step map to the end of this mapping. If `mirrors` is
  // given, it should be the index of the step map that is the mirror
  // image of this one.
  appendMap(map, mirrors) {
    this.to = this.maps.push(map);
    if (mirrors != null) this.setMirror(this.maps.length - 1, mirrors);
  }

  // :: (Mapping)
  // Add all the step maps in a given mapping to this one (preserving
  // mirroring information).
  appendMapping(mapping) {
    for (let i = 0, startSize = this.maps.length; i < mapping.maps.length; i++) {
      let mirr = mapping.getMirror(i);
      this.appendMap(mapping.maps[i], mirr != null && mirr < i ? startSize + mirr : null);
    }
  }

  // :: (number) → ?number
  // Finds the offset of the step map that mirrors the map at the
  // given offset, in this mapping (as per the second argument to
  // `appendMap`).
  getMirror(n) {
    if (this.mirror) for (let i = 0; i < this.mirror.length; i++)
      if (this.mirror[i] == n) return this.mirror[i + (i % 2 ? -1 : 1)]
  }

  setMirror(n, m) {
    if (!this.mirror) this.mirror = [];
    this.mirror.push(n, m);
  }

  // :: (Mapping)
  // Append the inverse of the given mapping to this one.
  appendMappingInverted(mapping) {
    for (let i = mapping.maps.length - 1, totalSize = this.maps.length + mapping.maps.length; i >= 0; i--) {
      let mirr = mapping.getMirror(i);
      this.appendMap(mapping.maps[i].invert(), mirr != null && mirr > i ? totalSize - mirr - 1 : null);
    }
  }

  // :: () → Mapping
  // Create an inverted version of this mapping.
  invert() {
    let inverse = new Mapping;
    inverse.appendMappingInverted(this);
    return inverse
  }

  // : (number, ?number) → number
  // Map a position through this mapping.
  map(pos, assoc = 1) {
    if (this.mirror) return this._map(pos, assoc, true)
    for (let i = this.from; i < this.to; i++)
      pos = this.maps[i].map(pos, assoc);
    return pos
  }

  // : (number, ?number) → MapResult
  // Map a position through this mapping, returning a mapping
  // result.
  mapResult(pos, assoc = 1) { return this._map(pos, assoc, false) }

  _map(pos, assoc, simple) {
    let deleted = false, recoverables = null;

    for (let i = this.from; i < this.to; i++) {
      let map = this.maps[i], rec = recoverables && recoverables[i];
      if (rec != null && map.touches(pos, rec)) {
        pos = map.recover(rec);
        continue
      }

      let result = map.mapResult(pos, assoc);
      if (result.recover != null) {
        let corr = this.getMirror(i);
        if (corr != null && corr > i && corr < this.to) {
          if (result.deleted) {
            i = corr;
            pos = this.maps[corr].recover(result.recover);
            continue
          } else {
(recoverables || (recoverables = Object.create(null)))[corr] = result.recover;
          }
        }
      }

      if (result.deleted) deleted = true;
      pos = result.pos;
    }

    return simple ? pos : new MapResult(pos, deleted)
  }
}

function TransformError(message) {
  let err = Error.call(this, message);
  err.__proto__ = TransformError.prototype;
  return err
}

TransformError.prototype = Object.create(Error.prototype);
TransformError.prototype.constructor = TransformError;
TransformError.prototype.name = "TransformError";

// ::- Abstraction to build up and track an array of
// [steps](#transform.Step) representing a document transformation.
//
// Most transforming methods return the `Transform` object itself, so
// that they can be chained.
class Transform {
  // :: (Node)
  // Create a transform that starts with the given document.
  constructor(doc) {
    // :: Node
    // The current document (the result of applying the steps in the
    // transform).
    this.doc = doc;
    // :: [Step]
    // The steps in this transform.
    this.steps = [];
    // :: [Node]
    // The documents before each of the steps.
    this.docs = [];
    // :: Mapping
    // A mapping with the maps for each of the steps in this transform.
    this.mapping = new Mapping;
  }

  // :: Node The starting document.
  get before() { return this.docs.length ? this.docs[0] : this.doc }

  // :: (step: Step) → this
  // Apply a new step in this transform, saving the result. Throws an
  // error when the step fails.
  step(object) {
    let result = this.maybeStep(object);
    if (result.failed) throw new TransformError(result.failed)
    return this
  }

  // :: (Step) → StepResult
  // Try to apply a step in this transformation, ignoring it if it
  // fails. Returns the step result.
  maybeStep(step) {
    let result = step.apply(this.doc);
    if (!result.failed) this.addStep(step, result.doc);
    return result
  }

  // :: bool
  // True when the document has been changed (when there are any
  // steps).
  get docChanged() {
    return this.steps.length > 0
  }

  addStep(step, doc) {
    this.docs.push(this.doc);
    this.steps.push(step);
    this.mapping.appendMap(step.getMap());
    this.doc = doc;
  }
}

function findDiffStart(a, b, pos) {
  for (let i = 0;; i++) {
    if (i == a.childCount || i == b.childCount)
      return a.childCount == b.childCount ? null : pos

    let childA = a.child(i), childB = b.child(i);
    if (childA == childB) { pos += childA.nodeSize; continue }

    if (!childA.sameMarkup(childB)) return pos

    if (childA.isText && childA.text != childB.text) {
      for (let j = 0; childA.text[j] == childB.text[j]; j++)
        pos++;
      return pos
    }
    if (childA.content.size || childB.content.size) {
      let inner = findDiffStart(childA.content, childB.content, pos + 1);
      if (inner != null) return inner
    }
    pos += childA.nodeSize;
  }
}

function findDiffEnd(a, b, posA, posB) {
  for (let iA = a.childCount, iB = b.childCount;;) {
    if (iA == 0 || iB == 0)
      return iA == iB ? null : {a: posA, b: posB}

    let childA = a.child(--iA), childB = b.child(--iB), size = childA.nodeSize;
    if (childA == childB) {
      posA -= size; posB -= size;
      continue
    }

    if (!childA.sameMarkup(childB)) return {a: posA, b: posB}

    if (childA.isText && childA.text != childB.text) {
      let same = 0, minSize = Math.min(childA.text.length, childB.text.length);
      while (same < minSize && childA.text[childA.text.length - same - 1] == childB.text[childB.text.length - same - 1]) {
        same++; posA--; posB--;
      }
      return {a: posA, b: posB}
    }
    if (childA.content.size || childB.content.size) {
      let inner = findDiffEnd(childA.content, childB.content, posA - 1, posB - 1);
      if (inner) return inner
    }
    posA -= size; posB -= size;
  }
}

// ::- A fragment represents a node's collection of child nodes.
//
// Like nodes, fragments are persistent data structures, and you
// should not mutate them or their content. Rather, you create new
// instances whenever needed. The API tries to make this easy.
class Fragment {
  constructor(content, size) {
    this.content = content;
    // :: number
    // The size of the fragment, which is the total of the size of its
    // content nodes.
    this.size = size || 0;
    if (size == null) for (let i = 0; i < content.length; i++)
      this.size += content[i].nodeSize;
  }

  // :: (number, number, (node: Node, start: number, parent: Node, index: number) → ?bool, ?number)
  // Invoke a callback for all descendant nodes between the given two
  // positions (relative to start of this fragment). Doesn't descend
  // into a node when the callback returns `false`.
  nodesBetween(from, to, f, nodeStart = 0, parent) {
    for (let i = 0, pos = 0; pos < to; i++) {
      let child = this.content[i], end = pos + child.nodeSize;
      if (end > from && f(child, nodeStart + pos, parent, i) !== false && child.content.size) {
        let start = pos + 1;
        child.nodesBetween(Math.max(0, from - start),
                           Math.min(child.content.size, to - start),
                           f, nodeStart + start);
      }
      pos = end;
    }
  }

  // :: ((node: Node, pos: number, parent: Node) → ?bool)
  // Call the given callback for every descendant node. The callback
  // may return `false` to prevent traversal of a given node's children.
  descendants(f) {
    this.nodesBetween(0, this.size, f);
  }

  // : (number, number, ?string, ?string) → string
  textBetween(from, to, blockSeparator, leafText) {
    let text = "", separated = true;
    this.nodesBetween(from, to, (node, pos) => {
      if (node.isText) {
        text += node.text.slice(Math.max(from, pos) - pos, to - pos);
        separated = !blockSeparator;
      } else if (node.isLeaf && leafText) {
        text += leafText;
        separated = !blockSeparator;
      } else if (!separated && node.isBlock) {
        text += blockSeparator;
        separated = true;
      }
    }, 0);
    return text
  }

  // :: (Fragment) → Fragment
  // Create a new fragment containing the combined content of this
  // fragment and the other.
  append(other) {
    if (!other.size) return this
    if (!this.size) return other
    let last = this.lastChild, first = other.firstChild, content = this.content.slice(), i = 0;
    if (last.isText && last.sameMarkup(first)) {
      content[content.length - 1] = last.withText(last.text + first.text);
      i = 1;
    }
    for (; i < other.content.length; i++) content.push(other.content[i]);
    return new Fragment(content, this.size + other.size)
  }

  // :: (number, ?number) → Fragment
  // Cut out the sub-fragment between the two given positions.
  cut(from, to) {
    if (to == null) to = this.size;
    if (from == 0 && to == this.size) return this
    let result = [], size = 0;
    if (to > from) for (let i = 0, pos = 0; pos < to; i++) {
      let child = this.content[i], end = pos + child.nodeSize;
      if (end > from) {
        if (pos < from || end > to) {
          if (child.isText)
            child = child.cut(Math.max(0, from - pos), Math.min(child.text.length, to - pos));
          else
            child = child.cut(Math.max(0, from - pos - 1), Math.min(child.content.size, to - pos - 1));
        }
        result.push(child);
        size += child.nodeSize;
      }
      pos = end;
    }
    return new Fragment(result, size)
  }

  cutByIndex(from, to) {
    if (from == to) return Fragment.empty
    if (from == 0 && to == this.content.length) return this
    return new Fragment(this.content.slice(from, to))
  }

  // :: (number, Node) → Fragment
  // Create a new fragment in which the node at the given index is
  // replaced by the given node.
  replaceChild(index, node) {
    let current = this.content[index];
    if (current == node) return this
    let copy = this.content.slice();
    let size = this.size + node.nodeSize - current.nodeSize;
    copy[index] = node;
    return new Fragment(copy, size)
  }

  // : (Node) → Fragment
  // Create a new fragment by prepending the given node to this
  // fragment.
  addToStart(node) {
    return new Fragment([node].concat(this.content), this.size + node.nodeSize)
  }

  // : (Node) → Fragment
  // Create a new fragment by appending the given node to this
  // fragment.
  addToEnd(node) {
    return new Fragment(this.content.concat(node), this.size + node.nodeSize)
  }

  // :: (Fragment) → bool
  // Compare this fragment to another one.
  eq(other) {
    if (this.content.length != other.content.length) return false
    for (let i = 0; i < this.content.length; i++)
      if (!this.content[i].eq(other.content[i])) return false
    return true
  }

  // :: ?Node
  // The first child of the fragment, or `null` if it is empty.
  get firstChild() { return this.content.length ? this.content[0] : null }

  // :: ?Node
  // The last child of the fragment, or `null` if it is empty.
  get lastChild() { return this.content.length ? this.content[this.content.length - 1] : null }

  // :: number
  // The number of child nodes in this fragment.
  get childCount() { return this.content.length }

  // :: (number) → Node
  // Get the child node at the given index. Raise an error when the
  // index is out of range.
  child(index) {
    let found = this.content[index];
    if (!found) throw new RangeError("Index " + index + " out of range for " + this)
    return found
  }

  // :: (number) → ?Node
  // Get the child node at the given index, if it exists.
  maybeChild(index) {
    return this.content[index]
  }

  // :: ((node: Node, offset: number, index: number))
  // Call `f` for every child node, passing the node, its offset
  // into this parent node, and its index.
  forEach(f) {
    for (let i = 0, p = 0; i < this.content.length; i++) {
      let child = this.content[i];
      f(child, p, i);
      p += child.nodeSize;
    }
  }

  // :: (Fragment) → ?number
  // Find the first position at which this fragment and another
  // fragment differ, or `null` if they are the same.
  findDiffStart(other, pos = 0) {
    return findDiffStart(this, other, pos)
  }

  // :: (Fragment) → ?{a: number, b: number}
  // Find the first position, searching from the end, at which this
  // fragment and the given fragment differ, or `null` if they are the
  // same. Since this position will not be the same in both nodes, an
  // object with two separate positions is returned.
  findDiffEnd(other, pos = this.size, otherPos = other.size) {
    return findDiffEnd(this, other, pos, otherPos)
  }

  // : (number, ?number) → {index: number, offset: number}
  // Find the index and inner offset corresponding to a given relative
  // position in this fragment. The result object will be reused
  // (overwritten) the next time the function is called. (Not public.)
  findIndex(pos, round = -1) {
    if (pos == 0) return retIndex(0, pos)
    if (pos == this.size) return retIndex(this.content.length, pos)
    if (pos > this.size || pos < 0) throw new RangeError(`Position ${pos} outside of fragment (${this})`)
    for (let i = 0, curPos = 0;; i++) {
      let cur = this.child(i), end = curPos + cur.nodeSize;
      if (end >= pos) {
        if (end == pos || round > 0) return retIndex(i + 1, end)
        return retIndex(i, curPos)
      }
      curPos = end;
    }
  }

  // :: () → string
  // Return a debugging string that describes this fragment.
  toString() { return "<" + this.toStringInner() + ">" }

  toStringInner() { return this.content.join(", ") }

  // :: () → ?Object
  // Create a JSON-serializeable representation of this fragment.
  toJSON() {
    return this.content.length ? this.content.map(n => n.toJSON()) : null
  }

  // :: (Schema, ?Object) → Fragment
  // Deserialize a fragment from its JSON representation.
  static fromJSON(schema, value) {
    if (!value) return Fragment.empty
    if (!Array.isArray(value)) throw new RangeError("Invalid input for Fragment.fromJSON")
    return new Fragment(value.map(schema.nodeFromJSON))
  }

  // :: ([Node]) → Fragment
  // Build a fragment from an array of nodes. Ensures that adjacent
  // text nodes with the same marks are joined together.
  static fromArray(array) {
    if (!array.length) return Fragment.empty
    let joined, size = 0;
    for (let i = 0; i < array.length; i++) {
      let node = array[i];
      size += node.nodeSize;
      if (i && node.isText && array[i - 1].sameMarkup(node)) {
        if (!joined) joined = array.slice(0, i);
        joined[joined.length - 1] = node.withText(joined[joined.length - 1].text + node.text);
      } else if (joined) {
        joined.push(node);
      }
    }
    return new Fragment(joined || array, size)
  }

  // :: (?union<Fragment, Node, [Node]>) → Fragment
  // Create a fragment from something that can be interpreted as a set
  // of nodes. For `null`, it returns the empty fragment. For a
  // fragment, the fragment itself. For a node or array of nodes, a
  // fragment containing those nodes.
  static from(nodes) {
    if (!nodes) return Fragment.empty
    if (nodes instanceof Fragment) return nodes
    if (Array.isArray(nodes)) return this.fromArray(nodes)
    if (nodes.attrs) return new Fragment([nodes], nodes.nodeSize)
    throw new RangeError("Can not convert " + nodes + " to a Fragment" +
                         (nodes.nodesBetween ? " (looks like multiple versions of prosemirror-model were loaded)" : ""))
  }
}

const found = {index: 0, offset: 0};
function retIndex(index, offset) {
  found.index = index;
  found.offset = offset;
  return found
}

// :: Fragment
// An empty fragment. Intended to be reused whenever a node doesn't
// contain anything (rather than allocating a new empty fragment for
// each leaf node).
Fragment.empty = new Fragment([], 0);

function compareDeep(a, b) {
  if (a === b) return true
  if (!(a && typeof a == "object") ||
      !(b && typeof b == "object")) return false
  let array = Array.isArray(a);
  if (Array.isArray(b) != array) return false
  if (array) {
    if (a.length != b.length) return false
    for (let i = 0; i < a.length; i++) if (!compareDeep(a[i], b[i])) return false
  } else {
    for (let p in a) if (!(p in b) || !compareDeep(a[p], b[p])) return false
    for (let p in b) if (!(p in a)) return false
  }
  return true
}

// ::- A mark is a piece of information that can be attached to a node,
// such as it being emphasized, in code font, or a link. It has a type
// and optionally a set of attributes that provide further information
// (such as the target of the link). Marks are created through a
// `Schema`, which controls which types exist and which
// attributes they have.
class Mark {
  constructor(type, attrs) {
    // :: MarkType
    // The type of this mark.
    this.type = type;
    // :: Object
    // The attributes associated with this mark.
    this.attrs = attrs;
  }

  // :: ([Mark]) → [Mark]
  // Given a set of marks, create a new set which contains this one as
  // well, in the right position. If this mark is already in the set,
  // the set itself is returned. If any marks that are set to be
  // [exclusive](#model.MarkSpec.excludes) with this mark are present,
  // those are replaced by this one.
  addToSet(set) {
    let copy, placed = false;
    for (let i = 0; i < set.length; i++) {
      let other = set[i];
      if (this.eq(other)) return set
      if (this.type.excludes(other.type)) {
        if (!copy) copy = set.slice(0, i);
      } else if (other.type.excludes(this.type)) {
        return set
      } else {
        if (!placed && other.type.rank > this.type.rank) {
          if (!copy) copy = set.slice(0, i);
          copy.push(this);
          placed = true;
        }
        if (copy) copy.push(other);
      }
    }
    if (!copy) copy = set.slice();
    if (!placed) copy.push(this);
    return copy
  }

  // :: ([Mark]) → [Mark]
  // Remove this mark from the given set, returning a new set. If this
  // mark is not in the set, the set itself is returned.
  removeFromSet(set) {
    for (let i = 0; i < set.length; i++)
      if (this.eq(set[i]))
        return set.slice(0, i).concat(set.slice(i + 1))
    return set
  }

  // :: ([Mark]) → bool
  // Test whether this mark is in the given set of marks.
  isInSet(set) {
    for (let i = 0; i < set.length; i++)
      if (this.eq(set[i])) return true
    return false
  }

  // :: (Mark) → bool
  // Test whether this mark has the same type and attributes as
  // another mark.
  eq(other) {
    return this == other ||
      (this.type == other.type && compareDeep(this.attrs, other.attrs))
  }

  // :: () → Object
  // Convert this mark to a JSON-serializeable representation.
  toJSON() {
    let obj = {type: this.type.name};
    for (let _ in this.attrs) {
      obj.attrs = this.attrs;
      break
    }
    return obj
  }

  // :: (Schema, Object) → Mark
  static fromJSON(schema, json) {
    if (!json) throw new RangeError("Invalid input for Mark.fromJSON")
    let type = schema.marks[json.type];
    if (!type) throw new RangeError(`There is no mark type ${json.type} in this schema`)
    return type.create(json.attrs)
  }

  // :: ([Mark], [Mark]) → bool
  // Test whether two sets of marks are identical.
  static sameSet(a, b) {
    if (a == b) return true
    if (a.length != b.length) return false
    for (let i = 0; i < a.length; i++)
      if (!a[i].eq(b[i])) return false
    return true
  }

  // :: (?union<Mark, [Mark]>) → [Mark]
  // Create a properly sorted mark set from null, a single mark, or an
  // unsorted array of marks.
  static setFrom(marks) {
    if (!marks || marks.length == 0) return Mark.none
    if (marks instanceof Mark) return [marks]
    let copy = marks.slice();
    copy.sort((a, b) => a.type.rank - b.type.rank);
    return copy
  }
}

// :: [Mark] The empty set of marks.
Mark.none = [];

// ReplaceError:: class extends Error
// Error type raised by [`Node.replace`](#model.Node.replace) when
// given an invalid replacement.

function ReplaceError(message) {
  let err = Error.call(this, message);
  err.__proto__ = ReplaceError.prototype;
  return err
}

ReplaceError.prototype = Object.create(Error.prototype);
ReplaceError.prototype.constructor = ReplaceError;
ReplaceError.prototype.name = "ReplaceError";

// ::- A slice represents a piece cut out of a larger document. It
// stores not only a fragment, but also the depth up to which nodes on
// both side are ‘open’ (cut through).
class Slice {
  // :: (Fragment, number, number)
  // Create a slice. When specifying a non-zero open depth, you must
  // make sure that there are nodes of at least that depth at the
  // appropriate side of the fragment—i.e. if the fragment is an empty
  // paragraph node, `openStart` and `openEnd` can't be greater than 1.
  //
  // It is not necessary for the content of open nodes to conform to
  // the schema's content constraints, though it should be a valid
  // start/end/middle for such a node, depending on which sides are
  // open.
  constructor(content, openStart, openEnd) {
    // :: Fragment The slice's content.
    this.content = content;
    // :: number The open depth at the start.
    this.openStart = openStart;
    // :: number The open depth at the end.
    this.openEnd = openEnd;
  }

  // :: number
  // The size this slice would add when inserted into a document.
  get size() {
    return this.content.size - this.openStart - this.openEnd
  }

  insertAt(pos, fragment) {
    let content = insertInto(this.content, pos + this.openStart, fragment, null);
    return content && new Slice(content, this.openStart, this.openEnd)
  }

  removeBetween(from, to) {
    return new Slice(removeRange(this.content, from + this.openStart, to + this.openStart), this.openStart, this.openEnd)
  }

  // :: (Slice) → bool
  // Tests whether this slice is equal to another slice.
  eq(other) {
    return this.content.eq(other.content) && this.openStart == other.openStart && this.openEnd == other.openEnd
  }

  toString() {
    return this.content + "(" + this.openStart + "," + this.openEnd + ")"
  }

  // :: () → ?Object
  // Convert a slice to a JSON-serializable representation.
  toJSON() {
    if (!this.content.size) return null
    let json = {content: this.content.toJSON()};
    if (this.openStart > 0) json.openStart = this.openStart;
    if (this.openEnd > 0) json.openEnd = this.openEnd;
    return json
  }

  // :: (Schema, ?Object) → Slice
  // Deserialize a slice from its JSON representation.
  static fromJSON(schema, json) {
    if (!json) return Slice.empty
    let openStart = json.openStart || 0, openEnd = json.openEnd || 0;
    if (typeof openStart != "number" || typeof openEnd != "number")
      throw new RangeError("Invalid input for Slice.fromJSON")
    return new Slice(Fragment.fromJSON(schema, json.content), json.openStart || 0, json.openEnd || 0)
  }

  // :: (Fragment, ?bool) → Slice
  // Create a slice from a fragment by taking the maximum possible
  // open value on both side of the fragment.
  static maxOpen(fragment, openIsolating=true) {
    let openStart = 0, openEnd = 0;
    for (let n = fragment.firstChild; n && !n.isLeaf && (openIsolating || !n.type.spec.isolating); n = n.firstChild) openStart++;
    for (let n = fragment.lastChild; n && !n.isLeaf && (openIsolating || !n.type.spec.isolating); n = n.lastChild) openEnd++;
    return new Slice(fragment, openStart, openEnd)
  }
}

function removeRange(content, from, to) {
  let {index, offset} = content.findIndex(from), child = content.maybeChild(index);
  let {index: indexTo, offset: offsetTo} = content.findIndex(to);
  if (offset == from || child.isText) {
    if (offsetTo != to && !content.child(indexTo).isText) throw new RangeError("Removing non-flat range")
    return content.cut(0, from).append(content.cut(to))
  }
  if (index != indexTo) throw new RangeError("Removing non-flat range")
  return content.replaceChild(index, child.copy(removeRange(child.content, from - offset - 1, to - offset - 1)))
}

function insertInto(content, dist, insert, parent) {
  let {index, offset} = content.findIndex(dist), child = content.maybeChild(index);
  if (offset == dist || child.isText) {
    if (parent && !parent.canReplace(index, index, insert)) return null
    return content.cut(0, dist).append(insert).append(content.cut(dist))
  }
  let inner = insertInto(child.content, dist - offset - 1, insert);
  return inner && content.replaceChild(index, child.copy(inner))
}

// :: Slice
// The empty slice.
Slice.empty = new Slice(Fragment.empty, 0, 0);

function replace($from, $to, slice) {
  if (slice.openStart > $from.depth)
    throw new ReplaceError("Inserted content deeper than insertion position")
  if ($from.depth - slice.openStart != $to.depth - slice.openEnd)
    throw new ReplaceError("Inconsistent open depths")
  return replaceOuter($from, $to, slice, 0)
}

function replaceOuter($from, $to, slice, depth) {
  let index = $from.index(depth), node = $from.node(depth);
  if (index == $to.index(depth) && depth < $from.depth - slice.openStart) {
    let inner = replaceOuter($from, $to, slice, depth + 1);
    return node.copy(node.content.replaceChild(index, inner))
  } else if (!slice.content.size) {
    return close(node, replaceTwoWay($from, $to, depth))
  } else if (!slice.openStart && !slice.openEnd && $from.depth == depth && $to.depth == depth) { // Simple, flat case
    let parent = $from.parent, content = parent.content;
    return close(parent, content.cut(0, $from.parentOffset).append(slice.content).append(content.cut($to.parentOffset)))
  } else {
    let {start, end} = prepareSliceForReplace(slice, $from);
    return close(node, replaceThreeWay($from, start, end, $to, depth))
  }
}

function checkJoin(main, sub) {
  if (!sub.type.compatibleContent(main.type))
    throw new ReplaceError("Cannot join " + sub.type.name + " onto " + main.type.name)
}

function joinable($before, $after, depth) {
  let node = $before.node(depth);
  checkJoin(node, $after.node(depth));
  return node
}

function addNode(child, target) {
  let last = target.length - 1;
  if (last >= 0 && child.isText && child.sameMarkup(target[last]))
    target[last] = child.withText(target[last].text + child.text);
  else
    target.push(child);
}

function addRange($start, $end, depth, target) {
  let node = ($end || $start).node(depth);
  let startIndex = 0, endIndex = $end ? $end.index(depth) : node.childCount;
  if ($start) {
    startIndex = $start.index(depth);
    if ($start.depth > depth) {
      startIndex++;
    } else if ($start.textOffset) {
      addNode($start.nodeAfter, target);
      startIndex++;
    }
  }
  for (let i = startIndex; i < endIndex; i++) addNode(node.child(i), target);
  if ($end && $end.depth == depth && $end.textOffset)
    addNode($end.nodeBefore, target);
}

function close(node, content) {
  if (!node.type.validContent(content))
    throw new ReplaceError("Invalid content for node " + node.type.name)
  return node.copy(content)
}

function replaceThreeWay($from, $start, $end, $to, depth) {
  let openStart = $from.depth > depth && joinable($from, $start, depth + 1);
  let openEnd = $to.depth > depth && joinable($end, $to, depth + 1);

  let content = [];
  addRange(null, $from, depth, content);
  if (openStart && openEnd && $start.index(depth) == $end.index(depth)) {
    checkJoin(openStart, openEnd);
    addNode(close(openStart, replaceThreeWay($from, $start, $end, $to, depth + 1)), content);
  } else {
    if (openStart)
      addNode(close(openStart, replaceTwoWay($from, $start, depth + 1)), content);
    addRange($start, $end, depth, content);
    if (openEnd)
      addNode(close(openEnd, replaceTwoWay($end, $to, depth + 1)), content);
  }
  addRange($to, null, depth, content);
  return new Fragment(content)
}

function replaceTwoWay($from, $to, depth) {
  let content = [];
  addRange(null, $from, depth, content);
  if ($from.depth > depth) {
    let type = joinable($from, $to, depth + 1);
    addNode(close(type, replaceTwoWay($from, $to, depth + 1)), content);
  }
  addRange($to, null, depth, content);
  return new Fragment(content)
}

function prepareSliceForReplace(slice, $along) {
  let extra = $along.depth - slice.openStart, parent = $along.node(extra);
  let node = parent.copy(slice.content);
  for (let i = extra - 1; i >= 0; i--)
    node = $along.node(i).copy(Fragment.from(node));
  return {start: node.resolveNoCache(slice.openStart + extra),
          end: node.resolveNoCache(node.content.size - slice.openEnd - extra)}
}

// ::- You can [_resolve_](#model.Node.resolve) a position to get more
// information about it. Objects of this class represent such a
// resolved position, providing various pieces of context information,
// and some helper methods.
//
// Throughout this interface, methods that take an optional `depth`
// parameter will interpret undefined as `this.depth` and negative
// numbers as `this.depth + value`.
class ResolvedPos {
  constructor(pos, path, parentOffset) {
    // :: number The position that was resolved.
    this.pos = pos;
    this.path = path;
    // :: number
    // The number of levels the parent node is from the root. If this
    // position points directly into the root node, it is 0. If it
    // points into a top-level paragraph, 1, and so on.
    this.depth = path.length / 3 - 1;
    // :: number The offset this position has into its parent node.
    this.parentOffset = parentOffset;
  }

  resolveDepth(val) {
    if (val == null) return this.depth
    if (val < 0) return this.depth + val
    return val
  }

  // :: Node
  // The parent node that the position points into. Note that even if
  // a position points into a text node, that node is not considered
  // the parent—text nodes are ‘flat’ in this model, and have no content.
  get parent() { return this.node(this.depth) }

  // :: Node
  // The root node in which the position was resolved.
  get doc() { return this.node(0) }

  // :: (?number) → Node
  // The ancestor node at the given level. `p.node(p.depth)` is the
  // same as `p.parent`.
  node(depth) { return this.path[this.resolveDepth(depth) * 3] }

  // :: (?number) → number
  // The index into the ancestor at the given level. If this points at
  // the 3rd node in the 2nd paragraph on the top level, for example,
  // `p.index(0)` is 2 and `p.index(1)` is 3.
  index(depth) { return this.path[this.resolveDepth(depth) * 3 + 1] }

  // :: (?number) → number
  // The index pointing after this position into the ancestor at the
  // given level.
  indexAfter(depth) {
    depth = this.resolveDepth(depth);
    return this.index(depth) + (depth == this.depth && !this.textOffset ? 0 : 1)
  }

  // :: (?number) → number
  // The (absolute) position at the start of the node at the given
  // level.
  start(depth) {
    depth = this.resolveDepth(depth);
    return depth == 0 ? 0 : this.path[depth * 3 - 1] + 1
  }

  // :: (?number) → number
  // The (absolute) position at the end of the node at the given
  // level.
  end(depth) {
    depth = this.resolveDepth(depth);
    return this.start(depth) + this.node(depth).content.size
  }

  // :: (?number) → number
  // The (absolute) position directly before the wrapping node at the
  // given level, or, when `level` is `this.depth + 1`, the original
  // position.
  before(depth) {
    depth = this.resolveDepth(depth);
    if (!depth) throw new RangeError("There is no position before the top-level node")
    return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1]
  }

  // :: (?number) → number
  // The (absolute) position directly after the wrapping node at the
  // given level, or the original position when `level` is `this.depth + 1`.
  after(depth) {
    depth = this.resolveDepth(depth);
    if (!depth) throw new RangeError("There is no position after the top-level node")
    return depth == this.depth + 1 ? this.pos : this.path[depth * 3 - 1] + this.path[depth * 3].nodeSize
  }

  // :: number
  // When this position points into a text node, this returns the
  // distance between the position and the start of the text node.
  // Will be zero for positions that point between nodes.
  get textOffset() { return this.pos - this.path[this.path.length - 1] }

  // :: ?Node
  // Get the node directly after the position, if any. If the position
  // points into a text node, only the part of that node after the
  // position is returned.
  get nodeAfter() {
    let parent = this.parent, index = this.index(this.depth);
    if (index == parent.childCount) return null
    let dOff = this.pos - this.path[this.path.length - 1], child = parent.child(index);
    return dOff ? parent.child(index).cut(dOff) : child
  }

  // :: ?Node
  // Get the node directly before the position, if any. If the
  // position points into a text node, only the part of that node
  // before the position is returned.
  get nodeBefore() {
    let index = this.index(this.depth);
    let dOff = this.pos - this.path[this.path.length - 1];
    if (dOff) return this.parent.child(index).cut(0, dOff)
    return index == 0 ? null : this.parent.child(index - 1)
  }

  // :: () → [Mark]
  // Get the marks at this position, factoring in the surrounding
  // marks' [`inclusive`](#model.MarkSpec.inclusive) property. If the
  // position is at the start of a non-empty node, the marks of the
  // node after it (if any) are returned.
  marks() {
    let parent = this.parent, index = this.index();

    // In an empty parent, return the empty array
    if (parent.content.size == 0) return Mark.none

    // When inside a text node, just return the text node's marks
    if (this.textOffset) return parent.child(index).marks

    let main = parent.maybeChild(index - 1), other = parent.maybeChild(index);
    // If the `after` flag is true of there is no node before, make
    // the node after this position the main reference.
    if (!main) { let tmp = main; main = other; other = tmp; }

    // Use all marks in the main node, except those that have
    // `inclusive` set to false and are not present in the other node.
    let marks = main.marks;
    for (var i = 0; i < marks.length; i++)
      if (marks[i].type.spec.inclusive === false && (!other || !marks[i].isInSet(other.marks)))
        marks = marks[i--].removeFromSet(marks);

    return marks
  }

  // :: (ResolvedPos) → ?[Mark]
  // Get the marks after the current position, if any, except those
  // that are non-inclusive and not present at position `$end`. This
  // is mostly useful for getting the set of marks to preserve after a
  // deletion. Will return `null` if this position is at the end of
  // its parent node or its parent node isn't a textblock (in which
  // case no marks should be preserved).
  marksAcross($end) {
    let after = this.parent.maybeChild(this.index());
    if (!after || !after.isInline) return null

    let marks = after.marks, next = $end.parent.maybeChild($end.index());
    for (var i = 0; i < marks.length; i++)
      if (marks[i].type.spec.inclusive === false && (!next || !marks[i].isInSet(next.marks)))
        marks = marks[i--].removeFromSet(marks);
    return marks
  }

  // :: (number) → number
  // The depth up to which this position and the given (non-resolved)
  // position share the same parent nodes.
  sharedDepth(pos) {
    for (let depth = this.depth; depth > 0; depth--)
      if (this.start(depth) <= pos && this.end(depth) >= pos) return depth
    return 0
  }

  // :: (?ResolvedPos, ?(Node) → bool) → ?NodeRange
  // Returns a range based on the place where this position and the
  // given position diverge around block content. If both point into
  // the same textblock, for example, a range around that textblock
  // will be returned. If they point into different blocks, the range
  // around those blocks in their shared ancestor is returned. You can
  // pass in an optional predicate that will be called with a parent
  // node to see if a range into that parent is acceptable.
  blockRange(other = this, pred) {
    if (other.pos < this.pos) return other.blockRange(this)
    for (let d = this.depth - (this.parent.inlineContent || this.pos == other.pos ? 1 : 0); d >= 0; d--)
      if (other.pos <= this.end(d) && (!pred || pred(this.node(d))))
        return new NodeRange(this, other, d)
  }

  // :: (ResolvedPos) → bool
  // Query whether the given position shares the same parent node.
  sameParent(other) {
    return this.pos - this.parentOffset == other.pos - other.parentOffset
  }

  // :: (ResolvedPos) → ResolvedPos
  // Return the greater of this and the given position.
  max(other) {
    return other.pos > this.pos ? other : this
  }

  // :: (ResolvedPos) → ResolvedPos
  // Return the smaller of this and the given position.
  min(other) {
    return other.pos < this.pos ? other : this
  }

  toString() {
    let str = "";
    for (let i = 1; i <= this.depth; i++)
      str += (str ? "/" : "") + this.node(i).type.name + "_" + this.index(i - 1);
    return str + ":" + this.parentOffset
  }

  static resolve(doc, pos) {
    if (!(pos >= 0 && pos <= doc.content.size)) throw new RangeError("Position " + pos + " out of range")
    let path = [];
    let start = 0, parentOffset = pos;
    for (let node = doc;;) {
      let {index, offset} = node.content.findIndex(parentOffset);
      let rem = parentOffset - offset;
      path.push(node, index, start + offset);
      if (!rem) break
      node = node.child(index);
      if (node.isText) break
      parentOffset = rem - 1;
      start += offset + 1;
    }
    return new ResolvedPos(pos, path, parentOffset)
  }

  static resolveCached(doc, pos) {
    for (let i = 0; i < resolveCache.length; i++) {
      let cached = resolveCache[i];
      if (cached.pos == pos && cached.doc == doc) return cached
    }
    let result = resolveCache[resolveCachePos] = ResolvedPos.resolve(doc, pos);
    resolveCachePos = (resolveCachePos + 1) % resolveCacheSize;
    return result
  }
}

let resolveCache = [], resolveCachePos = 0, resolveCacheSize = 12;

// ::- Represents a flat range of content, i.e. one that starts and
// ends in the same node.
class NodeRange {
  // :: (ResolvedPos, ResolvedPos, number)
  // Construct a node range. `$from` and `$to` should point into the
  // same node until at least the given `depth`, since a node range
  // denotes an adjacent set of nodes in a single parent node.
  constructor($from, $to, depth) {
    // :: ResolvedPos A resolved position along the start of the
    // content. May have a `depth` greater than this object's `depth`
    // property, since these are the positions that were used to
    // compute the range, not re-resolved positions directly at its
    // boundaries.
    this.$from = $from;
    // :: ResolvedPos A position along the end of the content. See
    // caveat for [`$from`](#model.NodeRange.$from).
    this.$to = $to;
    // :: number The depth of the node that this range points into.
    this.depth = depth;
  }

  // :: number The position at the start of the range.
  get start() { return this.$from.before(this.depth + 1) }
  // :: number The position at the end of the range.
  get end() { return this.$to.after(this.depth + 1) }

  // :: Node The parent node that the range points into.
  get parent() { return this.$from.node(this.depth) }
  // :: number The start index of the range in the parent node.
  get startIndex() { return this.$from.index(this.depth) }
  // :: number The end index of the range in the parent node.
  get endIndex() { return this.$to.indexAfter(this.depth) }
}

const emptyAttrs = Object.create(null);

// ::- This class represents a node in the tree that makes up a
// ProseMirror document. So a document is an instance of `Node`, with
// children that are also instances of `Node`.
//
// Nodes are persistent data structures. Instead of changing them, you
// create new ones with the content you want. Old ones keep pointing
// at the old document shape. This is made cheaper by sharing
// structure between the old and new data as much as possible, which a
// tree shape like this (without back pointers) makes easy.
//
// **Do not** directly mutate the properties of a `Node` object. See
// [the guide](/docs/guide/#doc) for more information.
class Node {
  constructor(type, attrs, content, marks) {
    // :: NodeType
    // The type of node that this is.
    this.type = type;

    // :: Object
    // An object mapping attribute names to values. The kind of
    // attributes allowed and required are
    // [determined](#model.NodeSpec.attrs) by the node type.
    this.attrs = attrs;

    // :: Fragment
    // A container holding the node's children.
    this.content = content || Fragment.empty;

    // :: [Mark]
    // The marks (things like whether it is emphasized or part of a
    // link) applied to this node.
    this.marks = marks || Mark.none;
  }

  // text:: ?string
  // For text nodes, this contains the node's text content.

  // :: number
  // The size of this node, as defined by the integer-based [indexing
  // scheme](/docs/guide/#doc.indexing). For text nodes, this is the
  // amount of characters. For other leaf nodes, it is one. For
  // non-leaf nodes, it is the size of the content plus two (the start
  // and end token).
  get nodeSize() { return this.isLeaf ? 1 : 2 + this.content.size }

  // :: number
  // The number of children that the node has.
  get childCount() { return this.content.childCount }

  // :: (number) → Node
  // Get the child node at the given index. Raises an error when the
  // index is out of range.
  child(index) { return this.content.child(index) }

  // :: (number) → ?Node
  // Get the child node at the given index, if it exists.
  maybeChild(index) { return this.content.maybeChild(index) }

  // :: ((node: Node, offset: number, index: number))
  // Call `f` for every child node, passing the node, its offset
  // into this parent node, and its index.
  forEach(f) { this.content.forEach(f); }

  // :: (number, number, (node: Node, pos: number, parent: Node, index: number) → ?bool, ?number)
  // Invoke a callback for all descendant nodes recursively between
  // the given two positions that are relative to start of this node's
  // content. The callback is invoked with the node, its
  // parent-relative position, its parent node, and its child index.
  // When the callback returns false for a given node, that node's
  // children will not be recursed over. The last parameter can be
  // used to specify a starting position to count from.
  nodesBetween(from, to, f, startPos = 0) {
    this.content.nodesBetween(from, to, f, startPos, this);
  }

  // :: ((node: Node, pos: number, parent: Node) → ?bool)
  // Call the given callback for every descendant node. Doesn't
  // descend into a node when the callback returns `false`.
  descendants(f) {
    this.nodesBetween(0, this.content.size, f);
  }

  // :: string
  // Concatenates all the text nodes found in this fragment and its
  // children.
  get textContent() { return this.textBetween(0, this.content.size, "") }

  // :: (number, number, ?string, ?string) → string
  // Get all text between positions `from` and `to`. When
  // `blockSeparator` is given, it will be inserted whenever a new
  // block node is started. When `leafText` is given, it'll be
  // inserted for every non-text leaf node encountered.
  textBetween(from, to, blockSeparator, leafText) {
    return this.content.textBetween(from, to, blockSeparator, leafText)
  }

  // :: ?Node
  // Returns this node's first child, or `null` if there are no
  // children.
  get firstChild() { return this.content.firstChild }

  // :: ?Node
  // Returns this node's last child, or `null` if there are no
  // children.
  get lastChild() { return this.content.lastChild }

  // :: (Node) → bool
  // Test whether two nodes represent the same piece of document.
  eq(other) {
    return this == other || (this.sameMarkup(other) && this.content.eq(other.content))
  }

  // :: (Node) → bool
  // Compare the markup (type, attributes, and marks) of this node to
  // those of another. Returns `true` if both have the same markup.
  sameMarkup(other) {
    return this.hasMarkup(other.type, other.attrs, other.marks)
  }

  // :: (NodeType, ?Object, ?[Mark]) → bool
  // Check whether this node's markup correspond to the given type,
  // attributes, and marks.
  hasMarkup(type, attrs, marks) {
    return this.type == type &&
      compareDeep(this.attrs, attrs || type.defaultAttrs || emptyAttrs) &&
      Mark.sameSet(this.marks, marks || Mark.none)
  }

  // :: (?Fragment) → Node
  // Create a new node with the same markup as this node, containing
  // the given content (or empty, if no content is given).
  copy(content = null) {
    if (content == this.content) return this
    return new this.constructor(this.type, this.attrs, content, this.marks)
  }

  // :: ([Mark]) → Node
  // Create a copy of this node, with the given set of marks instead
  // of the node's own marks.
  mark(marks) {
    return marks == this.marks ? this : new this.constructor(this.type, this.attrs, this.content, marks)
  }

  // :: (number, ?number) → Node
  // Create a copy of this node with only the content between the
  // given positions. If `to` is not given, it defaults to the end of
  // the node.
  cut(from, to) {
    if (from == 0 && to == this.content.size) return this
    return this.copy(this.content.cut(from, to))
  }

  // :: (number, ?number) → Slice
  // Cut out the part of the document between the given positions, and
  // return it as a `Slice` object.
  slice(from, to = this.content.size, includeParents = false) {
    if (from == to) return Slice.empty

    let $from = this.resolve(from), $to = this.resolve(to);
    let depth = includeParents ? 0 : $from.sharedDepth(to);
    let start = $from.start(depth), node = $from.node(depth);
    let content = node.content.cut($from.pos - start, $to.pos - start);
    return new Slice(content, $from.depth - depth, $to.depth - depth)
  }

  // :: (number, number, Slice) → Node
  // Replace the part of the document between the given positions with
  // the given slice. The slice must 'fit', meaning its open sides
  // must be able to connect to the surrounding content, and its
  // content nodes must be valid children for the node they are placed
  // into. If any of this is violated, an error of type
  // [`ReplaceError`](#model.ReplaceError) is thrown.
  replace(from, to, slice) {
    return replace(this.resolve(from), this.resolve(to), slice)
  }

  // :: (number) → ?Node
  // Find the node directly after the given position.
  nodeAt(pos) {
    for (let node = this;;) {
      let {index, offset} = node.content.findIndex(pos);
      node = node.maybeChild(index);
      if (!node) return null
      if (offset == pos || node.isText) return node
      pos -= offset + 1;
    }
  }

  // :: (number) → {node: ?Node, index: number, offset: number}
  // Find the (direct) child node after the given offset, if any,
  // and return it along with its index and offset relative to this
  // node.
  childAfter(pos) {
    let {index, offset} = this.content.findIndex(pos);
    return {node: this.content.maybeChild(index), index, offset}
  }

  // :: (number) → {node: ?Node, index: number, offset: number}
  // Find the (direct) child node before the given offset, if any,
  // and return it along with its index and offset relative to this
  // node.
  childBefore(pos) {
    if (pos == 0) return {node: null, index: 0, offset: 0}
    let {index, offset} = this.content.findIndex(pos);
    if (offset < pos) return {node: this.content.child(index), index, offset}
    let node = this.content.child(index - 1);
    return {node, index: index - 1, offset: offset - node.nodeSize}
  }

  // :: (number) → ResolvedPos
  // Resolve the given position in the document, returning an
  // [object](#model.ResolvedPos) with information about its context.
  resolve(pos) { return ResolvedPos.resolveCached(this, pos) }

  resolveNoCache(pos) { return ResolvedPos.resolve(this, pos) }

  // :: (number, number, MarkType) → bool
  // Test whether a mark of the given type occurs in this document
  // between the two given positions.
  rangeHasMark(from, to, type) {
    let found = false;
    if (to > from) this.nodesBetween(from, to, node => {
      if (type.isInSet(node.marks)) found = true;
      return !found
    });
    return found
  }

  // :: bool
  // True when this is a block (non-inline node)
  get isBlock() { return this.type.isBlock }

  // :: bool
  // True when this is a textblock node, a block node with inline
  // content.
  get isTextblock() { return this.type.isTextblock }

  // :: bool
  // True when this node allows inline content.
  get inlineContent() { return this.type.inlineContent }

  // :: bool
  // True when this is an inline node (a text node or a node that can
  // appear among text).
  get isInline() { return this.type.isInline }

  // :: bool
  // True when this is a text node.
  get isText() { return this.type.isText }

  // :: bool
  // True when this is a leaf node.
  get isLeaf() { return this.type.isLeaf }

  // :: bool
  // True when this is an atom, i.e. when it does not have directly
  // editable content. This is usually the same as `isLeaf`, but can
  // be configured with the [`atom` property](#model.NodeSpec.atom) on
  // a node's spec (typically used when the node is displayed as an
  // uneditable [node view](#view.NodeView)).
  get isAtom() { return this.type.isAtom }

  // :: () → string
  // Return a string representation of this node for debugging
  // purposes.
  toString() {
    if (this.type.spec.toDebugString) return this.type.spec.toDebugString(this)
    let name = this.type.name;
    if (this.content.size)
      name += "(" + this.content.toStringInner() + ")";
    return wrapMarks(this.marks, name)
  }

  // :: (number) → ContentMatch
  // Get the content match in this node at the given index.
  contentMatchAt(index) {
    let match = this.type.contentMatch.matchFragment(this.content, 0, index);
    if (!match) throw new Error("Called contentMatchAt on a node with invalid content")
    return match
  }

  // :: (number, number, ?Fragment, ?number, ?number) → bool
  // Test whether replacing the range between `from` and `to` (by
  // child index) with the given replacement fragment (which defaults
  // to the empty fragment) would leave the node's content valid. You
  // can optionally pass `start` and `end` indices into the
  // replacement fragment.
  canReplace(from, to, replacement = Fragment.empty, start = 0, end = replacement.childCount) {
    let one = this.contentMatchAt(from).matchFragment(replacement, start, end);
    let two = one && one.matchFragment(this.content, to);
    if (!two || !two.validEnd) return false
    for (let i = start; i < end; i++) if (!this.type.allowsMarks(replacement.child(i).marks)) return false
    return true
  }

  // :: (number, number, NodeType, ?[Mark]) → bool
  // Test whether replacing the range `from` to `to` (by index) with a
  // node of the given type would leave the node's content valid.
  canReplaceWith(from, to, type, marks) {
    if (marks && !this.type.allowsMarks(marks)) return false
    let start = this.contentMatchAt(from).matchType(type);
    let end = start && start.matchFragment(this.content, to);
    return end ? end.validEnd : false
  }

  // :: (Node) → bool
  // Test whether the given node's content could be appended to this
  // node. If that node is empty, this will only return true if there
  // is at least one node type that can appear in both nodes (to avoid
  // merging completely incompatible nodes).
  canAppend(other) {
    if (other.content.size) return this.canReplace(this.childCount, this.childCount, other.content)
    else return this.type.compatibleContent(other.type)
  }

  // Unused. Left for backwards compatibility.
  defaultContentType(at) {
    return this.contentMatchAt(at).defaultType
  }

  // :: ()
  // Check whether this node and its descendants conform to the
  // schema, and raise error when they do not.
  check() {
    if (!this.type.validContent(this.content))
      throw new RangeError(`Invalid content for node ${this.type.name}: ${this.content.toString().slice(0, 50)}`)
    this.content.forEach(node => node.check());
  }

  // :: () → Object
  // Return a JSON-serializeable representation of this node.
  toJSON() {
    let obj = {type: this.type.name};
    for (let _ in this.attrs) {
      obj.attrs = this.attrs;
      break
    }
    if (this.content.size)
      obj.content = this.content.toJSON();
    if (this.marks.length)
      obj.marks = this.marks.map(n => n.toJSON());
    return obj
  }

  // :: (Schema, Object) → Node
  // Deserialize a node from its JSON representation.
  static fromJSON(schema, json) {
    if (!json) throw new RangeError("Invalid input for Node.fromJSON")
    let marks = null;
    if (json.marks) {
      if (!Array.isArray(json.marks)) throw new RangeError("Invalid mark data for Node.fromJSON")
      marks = json.marks.map(schema.markFromJSON);
    }
    if (json.type == "text") {
      if (typeof json.text != "string") throw new RangeError("Invalid text node in JSON")
      return schema.text(json.text, marks)
    }
    let content = Fragment.fromJSON(schema, json.content);
    return schema.nodeType(json.type).create(json.attrs, content, marks)
  }
}

class TextNode extends Node {
  constructor(type, attrs, content, marks) {
    super(type, attrs, null, marks);

    if (!content) throw new RangeError("Empty text nodes are not allowed")

    this.text = content;
  }

  toString() {
    if (this.type.spec.toDebugString) return this.type.spec.toDebugString(this)
    return wrapMarks(this.marks, JSON.stringify(this.text))
  }

  get textContent() { return this.text }

  textBetween(from, to) { return this.text.slice(from, to) }

  get nodeSize() { return this.text.length }

  mark(marks) {
    return marks == this.marks ? this : new TextNode(this.type, this.attrs, this.text, marks)
  }

  withText(text) {
    if (text == this.text) return this
    return new TextNode(this.type, this.attrs, text, this.marks)
  }

  cut(from = 0, to = this.text.length) {
    if (from == 0 && to == this.text.length) return this
    return this.withText(this.text.slice(from, to))
  }

  eq(other) {
    return this.sameMarkup(other) && this.text == other.text
  }

  toJSON() {
    let base = super.toJSON();
    base.text = this.text;
    return base
  }
}

function wrapMarks(marks, str) {
  for (let i = marks.length - 1; i >= 0; i--)
    str = marks[i].type.name + "(" + str + ")";
  return str
}

// ::- Persistent data structure representing an ordered mapping from
// strings to values, with some convenient update methods.
function OrderedMap(content) {
  this.content = content;
}

OrderedMap.prototype = {
  constructor: OrderedMap,

  find: function(key) {
    for (var i = 0; i < this.content.length; i += 2)
      if (this.content[i] === key) return i
    return -1
  },

  // :: (string) → ?any
  // Retrieve the value stored under `key`, or return undefined when
  // no such key exists.
  get: function(key) {
    var found = this.find(key);
    return found == -1 ? undefined : this.content[found + 1]
  },

  // :: (string, any, ?string) → OrderedMap
  // Create a new map by replacing the value of `key` with a new
  // value, or adding a binding to the end of the map. If `newKey` is
  // given, the key of the binding will be replaced with that key.
  update: function(key, value, newKey) {
    var self = newKey && newKey != key ? this.remove(newKey) : this;
    var found = self.find(key), content = self.content.slice();
    if (found == -1) {
      content.push(newKey || key, value);
    } else {
      content[found + 1] = value;
      if (newKey) content[found] = newKey;
    }
    return new OrderedMap(content)
  },

  // :: (string) → OrderedMap
  // Return a map with the given key removed, if it existed.
  remove: function(key) {
    var found = this.find(key);
    if (found == -1) return this
    var content = this.content.slice();
    content.splice(found, 2);
    return new OrderedMap(content)
  },

  // :: (string, any) → OrderedMap
  // Add a new key to the start of the map.
  addToStart: function(key, value) {
    return new OrderedMap([key, value].concat(this.remove(key).content))
  },

  // :: (string, any) → OrderedMap
  // Add a new key to the end of the map.
  addToEnd: function(key, value) {
    var content = this.remove(key).content.slice();
    content.push(key, value);
    return new OrderedMap(content)
  },

  // :: (string, string, any) → OrderedMap
  // Add a key after the given key. If `place` is not found, the new
  // key is added to the end.
  addBefore: function(place, key, value) {
    var without = this.remove(key), content = without.content.slice();
    var found = without.find(place);
    content.splice(found == -1 ? content.length : found, 0, key, value);
    return new OrderedMap(content)
  },

  // :: ((key: string, value: any))
  // Call the given function for each key/value pair in the map, in
  // order.
  forEach: function(f) {
    for (var i = 0; i < this.content.length; i += 2)
      f(this.content[i], this.content[i + 1]);
  },

  // :: (union<Object, OrderedMap>) → OrderedMap
  // Create a new map by prepending the keys in this map that don't
  // appear in `map` before the keys in `map`.
  prepend: function(map) {
    map = OrderedMap.from(map);
    if (!map.size) return this
    return new OrderedMap(map.content.concat(this.subtract(map).content))
  },

  // :: (union<Object, OrderedMap>) → OrderedMap
  // Create a new map by appending the keys in this map that don't
  // appear in `map` after the keys in `map`.
  append: function(map) {
    map = OrderedMap.from(map);
    if (!map.size) return this
    return new OrderedMap(this.subtract(map).content.concat(map.content))
  },

  // :: (union<Object, OrderedMap>) → OrderedMap
  // Create a map containing all the keys in this map that don't
  // appear in `map`.
  subtract: function(map) {
    var result = this;
    map = OrderedMap.from(map);
    for (var i = 0; i < map.content.length; i += 2)
      result = result.remove(map.content[i]);
    return result
  },

  // :: number
  // The amount of keys in this map.
  get size() {
    return this.content.length >> 1
  }
};

// :: (?union<Object, OrderedMap>) → OrderedMap
// Return a map with the given content. If null, create an empty
// map. If given an ordered map, return that map itself. If given an
// object, create a map from the object's properties.
OrderedMap.from = function(value) {
  if (value instanceof OrderedMap) return value
  var content = [];
  if (value) for (var prop in value) content.push(prop, value[prop]);
  return new OrderedMap(content)
};

// ::- Instances of this class represent a match state of a node
// type's [content expression](#model.NodeSpec.content), and can be
// used to find out whether further content matches here, and whether
// a given position is a valid end of the node.
class ContentMatch {
  constructor(validEnd) {
    // :: bool
    // True when this match state represents a valid end of the node.
    this.validEnd = validEnd;
    this.next = [];
    this.wrapCache = [];
  }

  static parse(string, nodeTypes) {
    let stream = new TokenStream(string, nodeTypes);
    if (stream.next == null) return ContentMatch.empty
    let expr = parseExpr(stream);
    if (stream.next) stream.err("Unexpected trailing text");
    let match = dfa(nfa(expr));
    checkForDeadEnds(match, stream);
    return match
  }

  // :: (NodeType) → ?ContentMatch
  // Match a node type, returning a match after that node if
  // successful.
  matchType(type) {
    for (let i = 0; i < this.next.length; i += 2)
      if (this.next[i] == type) return this.next[i + 1]
    return null
  }

  // :: (Fragment, ?number, ?number) → ?ContentMatch
  // Try to match a fragment. Returns the resulting match when
  // successful.
  matchFragment(frag, start = 0, end = frag.childCount) {
    let cur = this;
    for (let i = start; cur && i < end; i++)
      cur = cur.matchType(frag.child(i).type);
    return cur
  }

  get inlineContent() {
    let first = this.next[0];
    return first ? first.isInline : false
  }

  // :: ?NodeType
  // Get the first matching node type at this match position that can
  // be generated.
  get defaultType() {
    for (let i = 0; i < this.next.length; i += 2) {
      let type = this.next[i];
      if (!(type.isText || type.hasRequiredAttrs())) return type
    }
  }

  compatible(other) {
    for (let i = 0; i < this.next.length; i += 2)
      for (let j = 0; j < other.next.length; j += 2)
        if (this.next[i] == other.next[j]) return true
    return false
  }

  // :: (Fragment, bool, ?number) → ?Fragment
  // Try to match the given fragment, and if that fails, see if it can
  // be made to match by inserting nodes in front of it. When
  // successful, return a fragment of inserted nodes (which may be
  // empty if nothing had to be inserted). When `toEnd` is true, only
  // return a fragment if the resulting match goes to the end of the
  // content expression.
  fillBefore(after, toEnd = false, startIndex = 0) {
    let seen = [this];
    function search(match, types) {
      let finished = match.matchFragment(after, startIndex);
      if (finished && (!toEnd || finished.validEnd))
        return Fragment.from(types.map(tp => tp.createAndFill()))

      for (let i = 0; i < match.next.length; i += 2) {
        let type = match.next[i], next = match.next[i + 1];
        if (!(type.isText || type.hasRequiredAttrs()) && seen.indexOf(next) == -1) {
          seen.push(next);
          let found = search(next, types.concat(type));
          if (found) return found
        }
      }
    }

    return search(this, [])
  }

  // :: (NodeType) → ?[NodeType]
  // Find a set of wrapping node types that would allow a node of the
  // given type to appear at this position. The result may be empty
  // (when it fits directly) and will be null when no such wrapping
  // exists.
  findWrapping(target) {
    for (let i = 0; i < this.wrapCache.length; i += 2)
      if (this.wrapCache[i] == target) return this.wrapCache[i + 1]
    let computed = this.computeWrapping(target);
    this.wrapCache.push(target, computed);
    return computed
  }

  computeWrapping(target) {
    let seen = Object.create(null), active = [{match: this, type: null, via: null}];
    while (active.length) {
      let current = active.shift(), match = current.match;
      if (match.matchType(target)) {
        let result = [];
        for (let obj = current; obj.type; obj = obj.via)
          result.push(obj.type);
        return result.reverse()
      }
      for (let i = 0; i < match.next.length; i += 2) {
        let type = match.next[i];
        if (!type.isLeaf && !type.hasRequiredAttrs() && !(type.name in seen) && (!current.type || match.next[i + 1].validEnd)) {
          active.push({match: type.contentMatch, type, via: current});
          seen[type.name] = true;
        }
      }
    }
  }

  // :: number
  // The number of outgoing edges this node has in the finite
  // automaton that describes the content expression.
  get edgeCount() {
    return this.next.length >> 1
  }

  // :: (number) → {type: NodeType, next: ContentMatch}
  // Get the _n_th outgoing edge from this node in the finite
  // automaton that describes the content expression.
  edge(n) {
    let i = n << 1;
    if (i > this.next.length) throw new RangeError(`There's no ${n}th edge in this content match`)
    return {type: this.next[i], next: this.next[i + 1]}
  }

  toString() {
    let seen = [];
    function scan(m) {
      seen.push(m);
      for (let i = 1; i < m.next.length; i += 2)
        if (seen.indexOf(m.next[i]) == -1) scan(m.next[i]);
    }
    scan(this);
    return seen.map((m, i) => {
      let out = i + (m.validEnd ? "*" : " ") + " ";
      for (let i = 0; i < m.next.length; i += 2)
        out += (i ? ", " : "") + m.next[i].name + "->" + seen.indexOf(m.next[i + 1]);
      return out
    }).join("\n")
  }
}

ContentMatch.empty = new ContentMatch(true);

class TokenStream {
  constructor(string, nodeTypes) {
    this.string = string;
    this.nodeTypes = nodeTypes;
    this.inline = null;
    this.pos = 0;
    this.tokens = string.split(/\s*(?=\b|\W|$)/);
    if (this.tokens[this.tokens.length - 1] == "") this.tokens.pop();
    if (this.tokens[0] == "") this.tokens.unshift();
  }

  get next() { return this.tokens[this.pos] }

  eat(tok) { return this.next == tok && (this.pos++ || true) }

  err(str) { throw new SyntaxError(str + " (in content expression '" + this.string + "')") }
}

function parseExpr(stream) {
  let exprs = [];
  do { exprs.push(parseExprSeq(stream)); }
  while (stream.eat("|"))
  return exprs.length == 1 ? exprs[0] : {type: "choice", exprs}
}

function parseExprSeq(stream) {
  let exprs = [];
  do { exprs.push(parseExprSubscript(stream)); }
  while (stream.next && stream.next != ")" && stream.next != "|")
  return exprs.length == 1 ? exprs[0] : {type: "seq", exprs}
}

function parseExprSubscript(stream) {
  let expr = parseExprAtom(stream);
  for (;;) {
    if (stream.eat("+"))
      expr = {type: "plus", expr};
    else if (stream.eat("*"))
      expr = {type: "star", expr};
    else if (stream.eat("?"))
      expr = {type: "opt", expr};
    else if (stream.eat("{"))
      expr = parseExprRange(stream, expr);
    else break
  }
  return expr
}

function parseNum(stream) {
  if (/\D/.test(stream.next)) stream.err("Expected number, got '" + stream.next + "'");
  let result = Number(stream.next);
  stream.pos++;
  return result
}

function parseExprRange(stream, expr) {
  let min = parseNum(stream), max = min;
  if (stream.eat(",")) {
    if (stream.next != "}") max = parseNum(stream);
    else max = -1;
  }
  if (!stream.eat("}")) stream.err("Unclosed braced range");
  return {type: "range", min, max, expr}
}

function resolveName(stream, name) {
  let types = stream.nodeTypes, type = types[name];
  if (type) return [type]
  let result = [];
  for (let typeName in types) {
    let type = types[typeName];
    if (type.groups.indexOf(name) > -1) result.push(type);
  }
  if (result.length == 0) stream.err("No node type or group '" + name + "' found");
  return result
}

function parseExprAtom(stream) {
  if (stream.eat("(")) {
    let expr = parseExpr(stream);
    if (!stream.eat(")")) stream.err("Missing closing paren");
    return expr
  } else if (!/\W/.test(stream.next)) {
    let exprs = resolveName(stream, stream.next).map(type => {
      if (stream.inline == null) stream.inline = type.isInline;
      else if (stream.inline != type.isInline) stream.err("Mixing inline and block content");
      return {type: "name", value: type}
    });
    stream.pos++;
    return exprs.length == 1 ? exprs[0] : {type: "choice", exprs}
  } else {
    stream.err("Unexpected token '" + stream.next + "'");
  }
}

// The code below helps compile a regular-expression-like language
// into a deterministic finite automaton. For a good introduction to
// these concepts, see https://swtch.com/~rsc/regexp/regexp1.html

// : (Object) → [[{term: ?any, to: number}]]
// Construct an NFA from an expression as returned by the parser. The
// NFA is represented as an array of states, which are themselves
// arrays of edges, which are `{term, to}` objects. The first state is
// the entry state and the last node is the success state.
//
// Note that unlike typical NFAs, the edge ordering in this one is
// significant, in that it is used to contruct filler content when
// necessary.
function nfa(expr) {
  let nfa = [[]];
  connect(compile(expr, 0), node());
  return nfa

  function node() { return nfa.push([]) - 1 }
  function edge(from, to, term) {
    let edge = {term, to};
    nfa[from].push(edge);
    return edge
  }
  function connect(edges, to) { edges.forEach(edge => edge.to = to); }

  function compile(expr, from) {
    if (expr.type == "choice") {
      return expr.exprs.reduce((out, expr) => out.concat(compile(expr, from)), [])
    } else if (expr.type == "seq") {
      for (let i = 0;; i++) {
        let next = compile(expr.exprs[i], from);
        if (i == expr.exprs.length - 1) return next
        connect(next, from = node());
      }
    } else if (expr.type == "star") {
      let loop = node();
      edge(from, loop);
      connect(compile(expr.expr, loop), loop);
      return [edge(loop)]
    } else if (expr.type == "plus") {
      let loop = node();
      connect(compile(expr.expr, from), loop);
      connect(compile(expr.expr, loop), loop);
      return [edge(loop)]
    } else if (expr.type == "opt") {
      return [edge(from)].concat(compile(expr.expr, from))
    } else if (expr.type == "range") {
      let cur = from;
      for (let i = 0; i < expr.min; i++) {
        let next = node();
        connect(compile(expr.expr, cur), next);
        cur = next;
      }
      if (expr.max == -1) {
        connect(compile(expr.expr, cur), cur);
      } else {
        for (let i = expr.min; i < expr.max; i++) {
          let next = node();
          edge(cur, next);
          connect(compile(expr.expr, cur), next);
          cur = next;
        }
      }
      return [edge(cur)]
    } else if (expr.type == "name") {
      return [edge(from, null, expr.value)]
    }
  }
}

function cmp(a, b) { return a - b }

// Get the set of nodes reachable by null edges from `node`. Omit
// nodes with only a single null-out-edge, since they may lead to
// needless duplicated nodes.
function nullFrom(nfa, node) {
  let result = [];
  scan(node);
  return result.sort(cmp)

  function scan(node) {
    let edges = nfa[node];
    if (edges.length == 1 && !edges[0].term) return scan(edges[0].to)
    result.push(node);
    for (let i = 0; i < edges.length; i++) {
      let {term, to} = edges[i];
      if (!term && result.indexOf(to) == -1) scan(to);
    }
  }
}

// : ([[{term: ?any, to: number}]]) → ContentMatch
// Compiles an NFA as produced by `nfa` into a DFA, modeled as a set
// of state objects (`ContentMatch` instances) with transitions
// between them.
function dfa(nfa) {
  let labeled = Object.create(null);
  return explore(nullFrom(nfa, 0))

  function explore(states) {
    let out = [];
    states.forEach(node => {
      nfa[node].forEach(({term, to}) => {
        if (!term) return
        let known = out.indexOf(term), set = known > -1 && out[known + 1];
        nullFrom(nfa, to).forEach(node => {
          if (!set) out.push(term, set = []);
          if (set.indexOf(node) == -1) set.push(node);
        });
      });
    });
    let state = labeled[states.join(",")] = new ContentMatch(states.indexOf(nfa.length - 1) > -1);
    for (let i = 0; i < out.length; i += 2) {
      let states = out[i + 1].sort(cmp);
      state.next.push(out[i], labeled[states.join(",")] || explore(states));
    }
    return state
  }
}

function checkForDeadEnds(match, stream) {
  for (let i = 0, work = [match]; i < work.length; i++) {
    let state = work[i], dead = !state.validEnd, nodes = [];
    for (let j = 0; j < state.next.length; j += 2) {
      let node = state.next[j], next = state.next[j + 1];
      nodes.push(node.name);
      if (dead && !(node.isText || node.hasRequiredAttrs())) dead = false;
      if (work.indexOf(next) == -1) work.push(next);
    }
    if (dead) stream.err("Only non-generatable nodes (" + nodes.join(", ") + ") in a required position");
  }
}

// For node types where all attrs have a default value (or which don't
// have any attributes), build up a single reusable default attribute
// object, and use it for all nodes that don't specify specific
// attributes.
function defaultAttrs(attrs) {
  let defaults = Object.create(null);
  for (let attrName in attrs) {
    let attr = attrs[attrName];
    if (!attr.hasDefault) return null
    defaults[attrName] = attr.default;
  }
  return defaults
}

function computeAttrs(attrs, value) {
  let built = Object.create(null);
  for (let name in attrs) {
    let given = value && value[name];
    if (given === undefined) {
      let attr = attrs[name];
      if (attr.hasDefault) given = attr.default;
      else throw new RangeError("No value supplied for attribute " + name)
    }
    built[name] = given;
  }
  return built
}

function initAttrs(attrs) {
  let result = Object.create(null);
  if (attrs) for (let name in attrs) result[name] = new Attribute(attrs[name]);
  return result
}

// ::- Node types are objects allocated once per `Schema` and used to
// [tag](#model.Node.type) `Node` instances. They contain information
// about the node type, such as its name and what kind of node it
// represents.
class NodeType {
  constructor(name, schema, spec) {
    // :: string
    // The name the node type has in this schema.
    this.name = name;

    // :: Schema
    // A link back to the `Schema` the node type belongs to.
    this.schema = schema;

    // :: NodeSpec
    // The spec that this type is based on
    this.spec = spec;

    this.groups = spec.group ? spec.group.split(" ") : [];
    this.attrs = initAttrs(spec.attrs);

    this.defaultAttrs = defaultAttrs(this.attrs);

    // :: ContentMatch
    // The starting match of the node type's content expression.
    this.contentMatch = null;

    // : ?[MarkType]
    // The set of marks allowed in this node. `null` means all marks
    // are allowed.
    this.markSet = null;

    // :: bool
    // True if this node type has inline content.
    this.inlineContent = null;

    // :: bool
    // True if this is a block type
    this.isBlock = !(spec.inline || name == "text");

    // :: bool
    // True if this is the text node type.
    this.isText = name == "text";
  }

  // :: bool
  // True if this is an inline type.
  get isInline() { return !this.isBlock }

  // :: bool
  // True if this is a textblock type, a block that contains inline
  // content.
  get isTextblock() { return this.isBlock && this.inlineContent }

  // :: bool
  // True for node types that allow no content.
  get isLeaf() { return this.contentMatch == ContentMatch.empty }

  // :: bool
  // True when this node is an atom, i.e. when it does not have
  // directly editable content.
  get isAtom() { return this.isLeaf || this.spec.atom }

  hasRequiredAttrs(ignore) {
    for (let n in this.attrs)
      if (this.attrs[n].isRequired && (!ignore || !(n in ignore))) return true
    return false
  }

  compatibleContent(other) {
    return this == other || this.contentMatch.compatible(other.contentMatch)
  }

  computeAttrs(attrs) {
    if (!attrs && this.defaultAttrs) return this.defaultAttrs
    else return computeAttrs(this.attrs, attrs)
  }

  // :: (?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
  // Create a `Node` of this type. The given attributes are
  // checked and defaulted (you can pass `null` to use the type's
  // defaults entirely, if no required attributes exist). `content`
  // may be a `Fragment`, a node, an array of nodes, or
  // `null`. Similarly `marks` may be `null` to default to the empty
  // set of marks.
  create(attrs, content, marks) {
    if (this.isText) throw new Error("NodeType.create can't construct text nodes")
    return new Node(this, this.computeAttrs(attrs), Fragment.from(content), Mark.setFrom(marks))
  }

  // :: (?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
  // Like [`create`](#model.NodeType.create), but check the given content
  // against the node type's content restrictions, and throw an error
  // if it doesn't match.
  createChecked(attrs, content, marks) {
    content = Fragment.from(content);
    if (!this.validContent(content))
      throw new RangeError("Invalid content for node " + this.name)
    return new Node(this, this.computeAttrs(attrs), content, Mark.setFrom(marks))
  }

  // :: (?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → ?Node
  // Like [`create`](#model.NodeType.create), but see if it is necessary to
  // add nodes to the start or end of the given fragment to make it
  // fit the node. If no fitting wrapping can be found, return null.
  // Note that, due to the fact that required nodes can always be
  // created, this will always succeed if you pass null or
  // `Fragment.empty` as content.
  createAndFill(attrs, content, marks) {
    attrs = this.computeAttrs(attrs);
    content = Fragment.from(content);
    if (content.size) {
      let before = this.contentMatch.fillBefore(content);
      if (!before) return null
      content = before.append(content);
    }
    let after = this.contentMatch.matchFragment(content).fillBefore(Fragment.empty, true);
    if (!after) return null
    return new Node(this, attrs, content.append(after), Mark.setFrom(marks))
  }

  // :: (Fragment) → bool
  // Returns true if the given fragment is valid content for this node
  // type with the given attributes.
  validContent(content) {
    let result = this.contentMatch.matchFragment(content);
    if (!result || !result.validEnd) return false
    for (let i = 0; i < content.childCount; i++)
      if (!this.allowsMarks(content.child(i).marks)) return false
    return true
  }

  // :: (MarkType) → bool
  // Check whether the given mark type is allowed in this node.
  allowsMarkType(markType) {
    return this.markSet == null || this.markSet.indexOf(markType) > -1
  }

  // :: ([Mark]) → bool
  // Test whether the given set of marks are allowed in this node.
  allowsMarks(marks) {
    if (this.markSet == null) return true
    for (let i = 0; i < marks.length; i++) if (!this.allowsMarkType(marks[i].type)) return false
    return true
  }

  // :: ([Mark]) → [Mark]
  // Removes the marks that are not allowed in this node from the given set.
  allowedMarks(marks) {
    if (this.markSet == null) return marks
    let copy;
    for (let i = 0; i < marks.length; i++) {
      if (!this.allowsMarkType(marks[i].type)) {
        if (!copy) copy = marks.slice(0, i);
      } else if (copy) {
        copy.push(marks[i]);
      }
    }
    return !copy ? marks : copy.length ? copy : Mark.empty
  }

  static compile(nodes, schema) {
    let result = Object.create(null);
    nodes.forEach((name, spec) => result[name] = new NodeType(name, schema, spec));

    let topType = schema.spec.topNode || "doc";
    if (!result[topType]) throw new RangeError("Schema is missing its top node type ('" + topType + "')")
    if (!result.text) throw new RangeError("Every schema needs a 'text' type")
    for (let _ in result.text.attrs) throw new RangeError("The text node type should not have attributes")

    return result
  }
}

// Attribute descriptors

class Attribute {
  constructor(options) {
    this.hasDefault = Object.prototype.hasOwnProperty.call(options, "default");
    this.default = options.default;
  }

  get isRequired() {
    return !this.hasDefault
  }
}

// Marks

// ::- Like nodes, marks (which are associated with nodes to signify
// things like emphasis or being part of a link) are
// [tagged](#model.Mark.type) with type objects, which are
// instantiated once per `Schema`.
class MarkType {
  constructor(name, rank, schema, spec) {
    // :: string
    // The name of the mark type.
    this.name = name;

    // :: Schema
    // The schema that this mark type instance is part of.
    this.schema = schema;

    // :: MarkSpec
    // The spec on which the type is based.
    this.spec = spec;

    this.attrs = initAttrs(spec.attrs);

    this.rank = rank;
    this.excluded = null;
    let defaults = defaultAttrs(this.attrs);
    this.instance = defaults && new Mark(this, defaults);
  }

  // :: (?Object) → Mark
  // Create a mark of this type. `attrs` may be `null` or an object
  // containing only some of the mark's attributes. The others, if
  // they have defaults, will be added.
  create(attrs) {
    if (!attrs && this.instance) return this.instance
    return new Mark(this, computeAttrs(this.attrs, attrs))
  }

  static compile(marks, schema) {
    let result = Object.create(null), rank = 0;
    marks.forEach((name, spec) => result[name] = new MarkType(name, rank++, schema, spec));
    return result
  }

  // :: ([Mark]) → [Mark]
  // When there is a mark of this type in the given set, a new set
  // without it is returned. Otherwise, the input set is returned.
  removeFromSet(set) {
    for (var i = 0; i < set.length; i++)
      if (set[i].type == this)
        return set.slice(0, i).concat(set.slice(i + 1))
    return set
  }

  // :: ([Mark]) → ?Mark
  // Tests whether there is a mark of this type in the given set.
  isInSet(set) {
    for (let i = 0; i < set.length; i++)
      if (set[i].type == this) return set[i]
  }

  // :: (MarkType) → bool
  // Queries whether a given mark type is
  // [excluded](#model.MarkSpec.excludes) by this one.
  excludes(other) {
    return this.excluded.indexOf(other) > -1
  }
}

// SchemaSpec:: interface
// An object describing a schema, as passed to the [`Schema`](#model.Schema)
// constructor.
//
//   nodes:: union<Object<NodeSpec>, OrderedMap<NodeSpec>>
//   The node types in this schema. Maps names to
//   [`NodeSpec`](#model.NodeSpec) objects that describe the node type
//   associated with that name. Their order is significant—it
//   determines which [parse rules](#model.NodeSpec.parseDOM) take
//   precedence by default, and which nodes come first in a given
//   [group](#model.NodeSpec.group).
//
//   marks:: ?union<Object<MarkSpec>, OrderedMap<MarkSpec>>
//   The mark types that exist in this schema. The order in which they
//   are provided determines the order in which [mark
//   sets](#model.Mark.addToSet) are sorted and in which [parse
//   rules](#model.MarkSpec.parseDOM) are tried.
//
//   topNode:: ?string
//   The name of the default top-level node for the schema. Defaults
//   to `"doc"`.

// NodeSpec:: interface
//
//   content:: ?string
//   The content expression for this node, as described in the [schema
//   guide](/docs/guide/#schema.content_expressions). When not given,
//   the node does not allow any content.
//
//   marks:: ?string
//   The marks that are allowed inside of this node. May be a
//   space-separated string referring to mark names or groups, `"_"`
//   to explicitly allow all marks, or `""` to disallow marks. When
//   not given, nodes with inline content default to allowing all
//   marks, other nodes default to not allowing marks.
//
//   group:: ?string
//   The group or space-separated groups to which this node belongs,
//   which can be referred to in the content expressions for the
//   schema.
//
//   inline:: ?bool
//   Should be set to true for inline nodes. (Implied for text nodes.)
//
//   atom:: ?bool
//   Can be set to true to indicate that, though this isn't a [leaf
//   node](#model.NodeType.isLeaf), it doesn't have directly editable
//   content and should be treated as a single unit in the view.
//
//   attrs:: ?Object<AttributeSpec>
//   The attributes that nodes of this type get.
//
//   selectable:: ?bool
//   Controls whether nodes of this type can be selected as a [node
//   selection](#state.NodeSelection). Defaults to true for non-text
//   nodes.
//
//   draggable:: ?bool
//   Determines whether nodes of this type can be dragged without
//   being selected. Defaults to false.
//
//   code:: ?bool
//   Can be used to indicate that this node contains code, which
//   causes some commands to behave differently.
//
//   defining:: ?bool
//   Determines whether this node is considered an important parent
//   node during replace operations (such as paste). Non-defining (the
//   default) nodes get dropped when their entire content is replaced,
//   whereas defining nodes persist and wrap the inserted content.
//   Likewise, in _inserted_ content the defining parents of the
//   content are preserved when possible. Typically,
//   non-default-paragraph textblock types, and possibly list items,
//   are marked as defining.
//
//   isolating:: ?bool
//   When enabled (default is false), the sides of nodes of this type
//   count as boundaries that regular editing operations, like
//   backspacing or lifting, won't cross. An example of a node that
//   should probably have this enabled is a table cell.
//
//   toDOM:: ?(node: Node) → DOMOutputSpec
//   Defines the default way a node of this type should be serialized
//   to DOM/HTML (as used by
//   [`DOMSerializer.fromSchema`](#model.DOMSerializer^fromSchema)).
//   Should return a DOM node or an [array
//   structure](#model.DOMOutputSpec) that describes one, with an
//   optional number zero (“hole”) in it to indicate where the node's
//   content should be inserted.
//
//   For text nodes, the default is to create a text DOM node. Though
//   it is possible to create a serializer where text is rendered
//   differently, this is not supported inside the editor, so you
//   shouldn't override that in your text node spec.
//
//   parseDOM:: ?[ParseRule]
//   Associates DOM parser information with this node, which can be
//   used by [`DOMParser.fromSchema`](#model.DOMParser^fromSchema) to
//   automatically derive a parser. The `node` field in the rules is
//   implied (the name of this node will be filled in automatically).
//   If you supply your own parser, you do not need to also specify
//   parsing rules in your schema.
//
//   toDebugString:: ?(node: Node) -> string
//   Defines the default way a node of this type should be serialized
//   to a string representation for debugging (e.g. in error messages).

// MarkSpec:: interface
//
//   attrs:: ?Object<AttributeSpec>
//   The attributes that marks of this type get.
//
//   inclusive:: ?bool
//   Whether this mark should be active when the cursor is positioned
//   at its end (or at its start when that is also the start of the
//   parent node). Defaults to true.
//
//   excludes:: ?string
//   Determines which other marks this mark can coexist with. Should
//   be a space-separated strings naming other marks or groups of marks.
//   When a mark is [added](#model.Mark.addToSet) to a set, all marks
//   that it excludes are removed in the process. If the set contains
//   any mark that excludes the new mark but is not, itself, excluded
//   by the new mark, the mark can not be added an the set. You can
//   use the value `"_"` to indicate that the mark excludes all
//   marks in the schema.
//
//   Defaults to only being exclusive with marks of the same type. You
//   can set it to an empty string (or any string not containing the
//   mark's own name) to allow multiple marks of a given type to
//   coexist (as long as they have different attributes).
//
//   group:: ?string
//   The group or space-separated groups to which this mark belongs.
//
//   spanning:: ?bool
//   Determines whether marks of this type can span multiple adjacent
//   nodes when serialized to DOM/HTML. Defaults to true.
//
//   toDOM:: ?(mark: Mark, inline: bool) → DOMOutputSpec
//   Defines the default way marks of this type should be serialized
//   to DOM/HTML. When the resulting spec contains a hole, that is
//   where the marked content is placed. Otherwise, it is appended to
//   the top node.
//
//   parseDOM:: ?[ParseRule]
//   Associates DOM parser information with this mark (see the
//   corresponding [node spec field](#model.NodeSpec.parseDOM)). The
//   `mark` field in the rules is implied.

// AttributeSpec:: interface
//
// Used to [define](#model.NodeSpec.attrs) attributes on nodes or
// marks.
//
//   default:: ?any
//   The default value for this attribute, to use when no explicit
//   value is provided. Attributes that have no default must be
//   provided whenever a node or mark of a type that has them is
//   created.

// ::- A document schema. Holds [node](#model.NodeType) and [mark
// type](#model.MarkType) objects for the nodes and marks that may
// occur in conforming documents, and provides functionality for
// creating and deserializing such documents.
class Schema {
  // :: (SchemaSpec)
  // Construct a schema from a schema [specification](#model.SchemaSpec).
  constructor(spec) {
    // :: SchemaSpec
    // The [spec](#model.SchemaSpec) on which the schema is based,
    // with the added guarantee that its `nodes` and `marks`
    // properties are
    // [`OrderedMap`](https://github.com/marijnh/orderedmap) instances
    // (not raw objects).
    this.spec = {};
    for (let prop in spec) this.spec[prop] = spec[prop];
    this.spec.nodes = OrderedMap.from(spec.nodes);
    this.spec.marks = OrderedMap.from(spec.marks);

    // :: Object<NodeType>
    // An object mapping the schema's node names to node type objects.
    this.nodes = NodeType.compile(this.spec.nodes, this);

    // :: Object<MarkType>
    // A map from mark names to mark type objects.
    this.marks = MarkType.compile(this.spec.marks, this);

    let contentExprCache = Object.create(null);
    for (let prop in this.nodes) {
      if (prop in this.marks)
        throw new RangeError(prop + " can not be both a node and a mark")
      let type = this.nodes[prop], contentExpr = type.spec.content || "", markExpr = type.spec.marks;
      type.contentMatch = contentExprCache[contentExpr] ||
        (contentExprCache[contentExpr] = ContentMatch.parse(contentExpr, this.nodes));
      type.inlineContent = type.contentMatch.inlineContent;
      type.markSet = markExpr == "_" ? null :
        markExpr ? gatherMarks(this, markExpr.split(" ")) :
        markExpr == "" || !type.inlineContent ? [] : null;
    }
    for (let prop in this.marks) {
      let type = this.marks[prop], excl = type.spec.excludes;
      type.excluded = excl == null ? [type] : excl == "" ? [] : gatherMarks(this, excl.split(" "));
    }

    this.nodeFromJSON = this.nodeFromJSON.bind(this);
    this.markFromJSON = this.markFromJSON.bind(this);

    // :: NodeType
    // The type of the [default top node](#model.SchemaSpec.topNode)
    // for this schema.
    this.topNodeType = this.nodes[this.spec.topNode || "doc"];

    // :: Object
    // An object for storing whatever values modules may want to
    // compute and cache per schema. (If you want to store something
    // in it, try to use property names unlikely to clash.)
    this.cached = Object.create(null);
    this.cached.wrappings = Object.create(null);
  }

  // :: (union<string, NodeType>, ?Object, ?union<Fragment, Node, [Node]>, ?[Mark]) → Node
  // Create a node in this schema. The `type` may be a string or a
  // `NodeType` instance. Attributes will be extended
  // with defaults, `content` may be a `Fragment`,
  // `null`, a `Node`, or an array of nodes.
  node(type, attrs, content, marks) {
    if (typeof type == "string")
      type = this.nodeType(type);
    else if (!(type instanceof NodeType))
      throw new RangeError("Invalid node type: " + type)
    else if (type.schema != this)
      throw new RangeError("Node type from different schema used (" + type.name + ")")

    return type.createChecked(attrs, content, marks)
  }

  // :: (string, ?[Mark]) → Node
  // Create a text node in the schema. Empty text nodes are not
  // allowed.
  text(text, marks) {
    let type = this.nodes.text;
    return new TextNode(type, type.defaultAttrs, text, Mark.setFrom(marks))
  }

  // :: (union<string, MarkType>, ?Object) → Mark
  // Create a mark with the given type and attributes.
  mark(type, attrs) {
    if (typeof type == "string") type = this.marks[type];
    return type.create(attrs)
  }

  // :: (Object) → Node
  // Deserialize a node from its JSON representation. This method is
  // bound.
  nodeFromJSON(json) {
    return Node.fromJSON(this, json)
  }

  // :: (Object) → Mark
  // Deserialize a mark from its JSON representation. This method is
  // bound.
  markFromJSON(json) {
    return Mark.fromJSON(this, json)
  }

  nodeType(name) {
    let found = this.nodes[name];
    if (!found) throw new RangeError("Unknown node type: " + name)
    return found
  }
}

function gatherMarks(schema, marks) {
  let found = [];
  for (let i = 0; i < marks.length; i++) {
    let name = marks[i], mark = schema.marks[name], ok = mark;
    if (mark) {
      found.push(mark);
    } else {
      for (let prop in schema.marks) {
        let mark = schema.marks[prop];
        if (name == "_" || (mark.spec.group && mark.spec.group.split(" ").indexOf(name) > -1))
          found.push(ok = mark);
      }
    }
    if (!ok) throw new SyntaxError("Unknown mark type: '" + marks[i] + "'")
  }
  return found
}

// ParseOptions:: interface
// These are the options recognized by the
// [`parse`](#model.DOMParser.parse) and
// [`parseSlice`](#model.DOMParser.parseSlice) methods.
//
//   preserveWhitespace:: ?union<bool, "full">
//   By default, whitespace is collapsed as per HTML's rules. Pass
//   `true` to preserve whitespace, but normalize newlines to
//   spaces, and `"full"` to preserve whitespace entirely.
//
//   findPositions:: ?[{node: dom.Node, offset: number}]
//   When given, the parser will, beside parsing the content,
//   record the document positions of the given DOM positions. It
//   will do so by writing to the objects, adding a `pos` property
//   that holds the document position. DOM positions that are not
//   in the parsed content will not be written to.
//
//   from:: ?number
//   The child node index to start parsing from.
//
//   to:: ?number
//   The child node index to stop parsing at.
//
//   topNode:: ?Node
//   By default, the content is parsed into the schema's default
//   [top node type](#model.Schema.topNodeType). You can pass this
//   option to use the type and attributes from a different node
//   as the top container.
//
//   topMatch:: ?ContentMatch
//   Provide the starting content match that content parsed into the
//   top node is matched against.
//
//   context:: ?ResolvedPos
//   A set of additional nodes to count as
//   [context](#model.ParseRule.context) when parsing, above the
//   given [top node](#model.ParseOptions.topNode).

// ParseRule:: interface
// A value that describes how to parse a given DOM node or inline
// style as a ProseMirror node or mark.
//
//   tag:: ?string
//   A CSS selector describing the kind of DOM elements to match. A
//   single rule should have _either_ a `tag` or a `style` property.
//
//   namespace:: ?string
//   The namespace to match. This should be used with `tag`.
//   Nodes are only matched when the namespace matches or this property
//   is null.
//
//   style:: ?string
//   A CSS property name to match. When given, this rule matches
//   inline styles that list that property. May also have the form
//   `"property=value"`, in which case the rule only matches if the
//   propery's value exactly matches the given value. (For more
//   complicated filters, use [`getAttrs`](#model.ParseRule.getAttrs)
//   and return undefined to indicate that the match failed.)
//
//   priority:: ?number
//   Can be used to change the order in which the parse rules in a
//   schema are tried. Those with higher priority come first. Rules
//   without a priority are counted as having priority 50. This
//   property is only meaningful in a schema—when directly
//   constructing a parser, the order of the rule array is used.
//
//   context:: ?string
//   When given, restricts this rule to only match when the current
//   context—the parent nodes into which the content is being
//   parsed—matches this expression. Should contain one or more node
//   names or node group names followed by single or double slashes.
//   For example `"paragraph/"` means the rule only matches when the
//   parent node is a paragraph, `"blockquote/paragraph/"` restricts
//   it to be in a paragraph that is inside a blockquote, and
//   `"section//"` matches any position inside a section—a double
//   slash matches any sequence of ancestor nodes. To allow multiple
//   different contexts, they can be separated by a pipe (`|`)
//   character, as in `"blockquote/|list_item/"`.
//
//   node:: ?string
//   The name of the node type to create when this rule matches. Only
//   valid for rules with a `tag` property, not for style rules. Each
//   rule should have one of a `node`, `mark`, or `ignore` property
//   (except when it appears in a [node](#model.NodeSpec.parseDOM) or
//   [mark spec](#model.MarkSpec.parseDOM), in which case the `node`
//   or `mark` property will be derived from its position).
//
//   mark:: ?string
//   The name of the mark type to wrap the matched content in.
//
//   ignore:: ?bool
//   When true, ignore content that matches this rule.
//
//   skip:: ?bool
//   When true, ignore the node that matches this rule, but do parse
//   its content.
//
//   attrs:: ?Object
//   Attributes for the node or mark created by this rule. When
//   `getAttrs` is provided, it takes precedence.
//
//   getAttrs:: ?(union<dom.Node, string>) → ?union<Object, false>
//   A function used to compute the attributes for the node or mark
//   created by this rule. Can also be used to describe further
//   conditions the DOM element or style must match. When it returns
//   `false`, the rule won't match. When it returns null or undefined,
//   that is interpreted as an empty/default set of attributes.
//
//   Called with a DOM Element for `tag` rules, and with a string (the
//   style's value) for `style` rules.
//
//   contentElement:: ?union<string, (dom.Node) → dom.Node>
//   For `tag` rules that produce non-leaf nodes or marks, by default
//   the content of the DOM element is parsed as content of the mark
//   or node. If the child nodes are in a descendent node, this may be
//   a CSS selector string that the parser must use to find the actual
//   content element, or a function that returns the actual content
//   element to the parser.
//
//   getContent:: ?(dom.Node, schema: Schema) → Fragment
//   Can be used to override the content of a matched node. When
//   present, instead of parsing the node's child nodes, the result of
//   this function is used.
//
//   preserveWhitespace:: ?union<bool, "full">
//   Controls whether whitespace should be preserved when parsing the
//   content inside the matched element. `false` means whitespace may
//   be collapsed, `true` means that whitespace should be preserved
//   but newlines normalized to spaces, and `"full"` means that
//   newlines should also be preserved.

// ::- A DOM parser represents a strategy for parsing DOM content into
// a ProseMirror document conforming to a given schema. Its behavior
// is defined by an array of [rules](#model.ParseRule).
class DOMParser {
  // :: (Schema, [ParseRule])
  // Create a parser that targets the given schema, using the given
  // parsing rules.
  constructor(schema, rules) {
    // :: Schema
    // The schema into which the parser parses.
    this.schema = schema;
    // :: [ParseRule]
    // The set of [parse rules](#model.ParseRule) that the parser
    // uses, in order of precedence.
    this.rules = rules;
    this.tags = [];
    this.styles = [];

    rules.forEach(rule => {
      if (rule.tag) this.tags.push(rule);
      else if (rule.style) this.styles.push(rule);
    });
  }

  // :: (dom.Node, ?ParseOptions) → Node
  // Parse a document from the content of a DOM node.
  parse(dom, options = {}) {
    let context = new ParseContext(this, options, false);
    context.addAll(dom, null, options.from, options.to);
    return context.finish()
  }

  // :: (dom.Node, ?ParseOptions) → Slice
  // Parses the content of the given DOM node, like
  // [`parse`](#model.DOMParser.parse), and takes the same set of
  // options. But unlike that method, which produces a whole node,
  // this one returns a slice that is open at the sides, meaning that
  // the schema constraints aren't applied to the start of nodes to
  // the left of the input and the end of nodes at the end.
  parseSlice(dom, options = {}) {
    let context = new ParseContext(this, options, true);
    context.addAll(dom, null, options.from, options.to);
    return Slice.maxOpen(context.finish())
  }

  matchTag(dom, context) {
    for (let i = 0; i < this.tags.length; i++) {
      let rule = this.tags[i];
      if (matches(dom, rule.tag) &&
          (rule.namespace === undefined || dom.namespaceURI == rule.namespace) &&
          (!rule.context || context.matchesContext(rule.context))) {
        if (rule.getAttrs) {
          let result = rule.getAttrs(dom);
          if (result === false) continue
          rule.attrs = result;
        }
        return rule
      }
    }
  }

  matchStyle(prop, value, context) {
    for (let i = 0; i < this.styles.length; i++) {
      let rule = this.styles[i];
      if (rule.style.indexOf(prop) != 0 ||
          rule.context && !context.matchesContext(rule.context) ||
          // Test that the style string either precisely matches the prop,
          // or has an '=' sign after the prop, followed by the given
          // value.
          rule.style.length > prop.length &&
          (rule.style.charCodeAt(prop.length) != 61 || rule.style.slice(prop.length + 1) != value))
        continue
      if (rule.getAttrs) {
        let result = rule.getAttrs(value);
        if (result === false) continue
        rule.attrs = result;
      }
      return rule
    }
  }

  // : (Schema) → [ParseRule]
  static schemaRules(schema) {
    let result = [];
    function insert(rule) {
      let priority = rule.priority == null ? 50 : rule.priority, i = 0;
      for (; i < result.length; i++) {
        let next = result[i], nextPriority = next.priority == null ? 50 : next.priority;
        if (nextPriority < priority) break
      }
      result.splice(i, 0, rule);
    }

    for (let name in schema.marks) {
      let rules = schema.marks[name].spec.parseDOM;
      if (rules) rules.forEach(rule => {
        insert(rule = copy(rule));
        rule.mark = name;
      });
    }
    for (let name in schema.nodes) {
      let rules = schema.nodes[name].spec.parseDOM;
      if (rules) rules.forEach(rule => {
        insert(rule = copy(rule));
        rule.node = name;
      });
    }
    return result
  }

  // :: (Schema) → DOMParser
  // Construct a DOM parser using the parsing rules listed in a
  // schema's [node specs](#model.NodeSpec.parseDOM), reordered by
  // [priority](#model.ParseRule.priority).
  static fromSchema(schema) {
    return schema.cached.domParser ||
      (schema.cached.domParser = new DOMParser(schema, DOMParser.schemaRules(schema)))
  }
}

// : Object<bool> The block-level tags in HTML5
const blockTags = {
  address: true, article: true, aside: true, blockquote: true, canvas: true,
  dd: true, div: true, dl: true, fieldset: true, figcaption: true, figure: true,
  footer: true, form: true, h1: true, h2: true, h3: true, h4: true, h5: true,
  h6: true, header: true, hgroup: true, hr: true, li: true, noscript: true, ol: true,
  output: true, p: true, pre: true, section: true, table: true, tfoot: true, ul: true
};

// : Object<bool> The tags that we normally ignore.
const ignoreTags = {
  head: true, noscript: true, object: true, script: true, style: true, title: true
};

// Using a bitfield for node context options
const OPT_PRESERVE_WS = 1, OPT_PRESERVE_WS_FULL = 2, OPT_OPEN_LEFT = 4;

function wsOptionsFor(preserveWhitespace) {
  return (preserveWhitespace ? OPT_PRESERVE_WS : 0) | (preserveWhitespace === "full" ? OPT_PRESERVE_WS_FULL : 0)
}

class NodeContext {
  constructor(type, attrs, marks, solid, match, options) {
    this.type = type;
    this.attrs = attrs;
    this.solid = solid;
    this.match = match || (options & OPT_OPEN_LEFT ? null : type.contentMatch);
    this.options = options;
    this.content = [];
    this.marks = marks;
    this.activeMarks = Mark.none;
  }

  findWrapping(node) {
    if (!this.match) {
      if (!this.type) return []
      let fill = this.type.contentMatch.fillBefore(Fragment.from(node));
      if (fill) {
        this.match = this.type.contentMatch.matchFragment(fill);
      } else {
        let start = this.type.contentMatch, wrap;
        if (wrap = start.findWrapping(node.type)) {
          this.match = start;
          return wrap
        } else {
          return null
        }
      }
    }
    return this.match.findWrapping(node.type)
  }

  finish(openEnd) {
    if (!(this.options & OPT_PRESERVE_WS)) { // Strip trailing whitespace
      let last = this.content[this.content.length - 1], m;
      if (last && last.isText && (m = /\s+$/.exec(last.text))) {
        if (last.text.length == m[0].length) this.content.pop();
        else this.content[this.content.length - 1] = last.withText(last.text.slice(0, last.text.length - m[0].length));
      }
    }
    let content = Fragment.from(this.content);
    if (!openEnd && this.match)
      content = content.append(this.match.fillBefore(Fragment.empty, true));
    return this.type ? this.type.create(this.attrs, content, this.marks) : content
  }
}

class ParseContext {
  // : (DOMParser, Object)
  constructor(parser, options, open) {
    // : DOMParser The parser we are using.
    this.parser = parser;
    // : Object The options passed to this parse.
    this.options = options;
    this.isOpen = open;
    this.pendingMarks = [];
    let topNode = options.topNode, topContext;
    let topOptions = wsOptionsFor(options.preserveWhitespace) | (open ? OPT_OPEN_LEFT : 0);
    if (topNode)
      topContext = new NodeContext(topNode.type, topNode.attrs, Mark.none, true,
                                   options.topMatch || topNode.type.contentMatch, topOptions);
    else if (open)
      topContext = new NodeContext(null, null, Mark.none, true, null, topOptions);
    else
      topContext = new NodeContext(parser.schema.topNodeType, null, Mark.none, true, null, topOptions);
    this.nodes = [topContext];
    // : [Mark] The current set of marks
    this.open = 0;
    this.find = options.findPositions;
    this.needsBlock = false;
  }

  get top() {
    return this.nodes[this.open]
  }

  // : (dom.Node)
  // Add a DOM node to the content. Text is inserted as text node,
  // otherwise, the node is passed to `addElement` or, if it has a
  // `style` attribute, `addElementWithStyles`.
  addDOM(dom) {
    if (dom.nodeType == 3) {
      this.addTextNode(dom);
    } else if (dom.nodeType == 1) {
      let style = dom.getAttribute("style");
      let marks = style ? this.readStyles(parseStyles(style)) : null;
      if (marks != null) for (let i = 0; i < marks.length; i++) this.addPendingMark(marks[i]);
      this.addElement(dom);
      if (marks != null) for (let i = 0; i < marks.length; i++) this.removePendingMark(marks[i]);
    }
  }

  addTextNode(dom) {
    let value = dom.nodeValue;
    let top = this.top;
    if ((top.type ? top.type.inlineContent : top.content.length && top.content[0].isInline) || /\S/.test(value)) {
      if (!(top.options & OPT_PRESERVE_WS)) {
        value = value.replace(/\s+/g, " ");
        // If this starts with whitespace, and there is no node before it, or
        // a hard break, or a text node that ends with whitespace, strip the
        // leading space.
        if (/^\s/.test(value) && this.open == this.nodes.length - 1) {
          let nodeBefore = top.content[top.content.length - 1];
          let domNodeBefore = dom.previousSibling;
          if (!nodeBefore ||
              (domNodeBefore && domNodeBefore.nodeName == 'BR') ||
              (nodeBefore.isText && /\s$/.test(nodeBefore.text)))
            value = value.slice(1);
        }
      } else if (!(top.options & OPT_PRESERVE_WS_FULL)) {
        value = value.replace(/\r?\n|\r/g, " ");
      }
      if (value) this.insertNode(this.parser.schema.text(value));
      this.findInText(dom);
    } else {
      this.findInside(dom);
    }
  }

  // : (dom.Element)
  // Try to find a handler for the given tag and use that to parse. If
  // none is found, the element's content nodes are added directly.
  addElement(dom) {
    let name = dom.nodeName.toLowerCase();

    //==============================
    // TEMP - getting rid of this cludge (as he describes it)!!!
    //I need a different cludge
    //if (listTags.hasOwnProperty(name)) normalizeList(dom)
    //==============================

    let rule = (this.options.ruleFromNode && this.options.ruleFromNode(dom)) || this.parser.matchTag(dom, this);
    if (rule ? rule.ignore : ignoreTags.hasOwnProperty(name)) {
      this.findInside(dom);
    } else if (!rule || rule.skip) {
      if (rule && rule.skip.nodeType) dom = rule.skip;
      let sync, top = this.top, oldNeedsBlock = this.needsBlock;
      if (blockTags.hasOwnProperty(name)) {
        sync = true;
        if (!top.type) this.needsBlock = true;
      }
      this.addAll(dom);
      if (sync) this.sync(top);
      this.needsBlock = oldNeedsBlock;
    } else {
      this.addElementByRule(dom, rule);
    }
  }

  // Run any style parser associated with the node's styles. Either
  // return an array of marks, or null to indicate some of the styles
  // had a rule with `ignore` set.
  readStyles(styles) {
    let marks = Mark.none;
    for (let i = 0; i < styles.length; i += 2) {
      let rule = this.parser.matchStyle(styles[i], styles[i + 1], this);
      if (!rule) continue
      if (rule.ignore) return null
      marks = this.parser.schema.marks[rule.mark].create(rule.attrs).addToSet(marks);
    }
    return marks
  }

  // : (dom.Element, ParseRule) → bool
  // Look up a handler for the given node. If none are found, return
  // false. Otherwise, apply it, use its return value to drive the way
  // the node's content is wrapped, and return true.
  addElementByRule(dom, rule) {
    let sync, nodeType, markType, mark;
    if (rule.node) {
      nodeType = this.parser.schema.nodes[rule.node];
      if (nodeType.isLeaf) this.insertNode(nodeType.create(rule.attrs));
      else sync = this.enter(nodeType, rule.attrs, rule.preserveWhitespace);
    } else {
      markType = this.parser.schema.marks[rule.mark];
      mark = markType.create(rule.attrs);
      this.addPendingMark(mark);
    }
    let startIn = this.top;

    if (nodeType && nodeType.isLeaf) {
      this.findInside(dom);
    } else if (rule.getContent) {
      this.findInside(dom);
      rule.getContent(dom, this.parser.schema).forEach(node => this.insertNode(node));
    } else {
      let contentDOM = rule.contentElement;
      if (typeof contentDOM == "string") contentDOM = dom.querySelector(contentDOM);
      else if (typeof contentDOM == "function") contentDOM = contentDOM(dom);
      if (!contentDOM) contentDOM = dom;
      this.findAround(dom, contentDOM, true);
      this.addAll(contentDOM, sync);
    }
    if (sync) { this.sync(startIn); this.open--; }
    if (mark) this.removePendingMark(mark);
    return true
  }

  // : (dom.Node, ?NodeBuilder, ?number, ?number)
  // Add all child nodes between `startIndex` and `endIndex` (or the
  // whole node, if not given). If `sync` is passed, use it to
  // synchronize after every block element.
  addAll(parent, sync, startIndex, endIndex) {
    let index = startIndex || 0;
    for (let dom = startIndex ? parent.childNodes[startIndex] : parent.firstChild,
             end = endIndex == null ? null : parent.childNodes[endIndex];
         dom != end; dom = dom.nextSibling, ++index) {
      this.findAtPoint(parent, index);
      this.addDOM(dom);
      if (sync && blockTags.hasOwnProperty(dom.nodeName.toLowerCase()))
        this.sync(sync);
    }
    this.findAtPoint(parent, index);
  }

  // Try to find a way to fit the given node type into the current
  // context. May add intermediate wrappers and/or leave non-solid
  // nodes that we're in.
  findPlace(node) {
    let route, sync;
    for (let depth = this.open; depth >= 0; depth--) {
      let cx = this.nodes[depth];
      let found = cx.findWrapping(node);
      if (found && (!route || route.length > found.length)) {
        route = found;
        sync = cx;
        if (!found.length) break
      }
      if (cx.solid) break
    }
    if (!route) return false
    this.sync(sync);
    for (let i = 0; i < route.length; i++)
      this.enterInner(route[i], null, false);
    return true
  }

  // : (Node) → ?Node
  // Try to insert the given node, adjusting the context when needed.
  insertNode(node) {
    if (node.isInline && this.needsBlock && !this.top.type) {
      let block = this.textblockFromContext();
      if (block) this.enterInner(block);
    }
    if (this.findPlace(node)) {
      this.closeExtra();
      let top = this.top;
      this.applyPendingMarks(top);
      if (top.match) top.match = top.match.matchType(node.type);
      let marks = top.activeMarks;
      for (let i = 0; i < node.marks.length; i++)
        if (!top.type || top.type.allowsMarkType(node.marks[i].type))
          marks = node.marks[i].addToSet(marks);
      top.content.push(node.mark(marks));
    }
  }

  applyPendingMarks(top) {
    for (let i = 0; i < this.pendingMarks.length; i++) {
      let mark = this.pendingMarks[i];
      if ((!top.type || top.type.allowsMarkType(mark.type)) && !mark.isInSet(top.activeMarks)) {
        top.activeMarks = mark.addToSet(top.activeMarks);
        this.pendingMarks.splice(i--, 1);
      }
    }
  }

  // : (NodeType, ?Object) → bool
  // Try to start a node of the given type, adjusting the context when
  // necessary.
  enter(type, attrs, preserveWS) {
    let ok = this.findPlace(type.create(attrs));
    if (ok) {
      this.applyPendingMarks(this.top);
      this.enterInner(type, attrs, true, preserveWS);
    }
    return ok
  }

  // Open a node of the given type
  enterInner(type, attrs, solid, preserveWS) {
    this.closeExtra();
    let top = this.top;
    top.match = top.match && top.match.matchType(type, attrs);
    let options = preserveWS == null ? top.options & ~OPT_OPEN_LEFT : wsOptionsFor(preserveWS);
    if ((top.options & OPT_OPEN_LEFT) && top.content.length == 0) options |= OPT_OPEN_LEFT;
    this.nodes.push(new NodeContext(type, attrs, top.activeMarks, solid, null, options));
    this.open++;
  }

  // Make sure all nodes above this.open are finished and added to
  // their parents
  closeExtra(openEnd) {
    let i = this.nodes.length - 1;
    if (i > this.open) {
      for (; i > this.open; i--) this.nodes[i - 1].content.push(this.nodes[i].finish(openEnd));
      this.nodes.length = this.open + 1;
    }
  }

  finish() {
    this.open = 0;
    this.closeExtra(this.isOpen);
    return this.nodes[0].finish(this.isOpen || this.options.topOpen)
  }

  sync(to) {
    for (let i = this.open; i >= 0; i--) if (this.nodes[i] == to) {
      this.open = i;
      return
    }
  }

  addPendingMark(mark) {
    this.pendingMarks.push(mark);
  }

  removePendingMark(mark) {
    let found = this.pendingMarks.lastIndexOf(mark);
    if (found > -1) {
      this.pendingMarks.splice(found, 1);
    } else {
      let top = this.top;
      top.activeMarks = mark.removeFromSet(top.activeMarks);
    }
  }

  get currentPos() {
    this.closeExtra();
    let pos = 0;
    for (let i = this.open; i >= 0; i--) {
      let content = this.nodes[i].content;
      for (let j = content.length - 1; j >= 0; j--)
        pos += content[j].nodeSize;
      if (i) pos++;
    }
    return pos
  }

  findAtPoint(parent, offset) {
    if (this.find) for (let i = 0; i < this.find.length; i++) {
      if (this.find[i].node == parent && this.find[i].offset == offset)
        this.find[i].pos = this.currentPos;
    }
  }

  findInside(parent) {
    if (this.find) for (let i = 0; i < this.find.length; i++) {
      if (this.find[i].pos == null && parent.nodeType == 1 && parent.contains(this.find[i].node))
        this.find[i].pos = this.currentPos;
    }
  }

  findAround(parent, content, before) {
    if (parent != content && this.find) for (let i = 0; i < this.find.length; i++) {
      if (this.find[i].pos == null && parent.nodeType == 1 && parent.contains(this.find[i].node)) {
        let pos = content.compareDocumentPosition(this.find[i].node);
        if (pos & (before ? 2 : 4))
          this.find[i].pos = this.currentPos;
      }
    }
  }

  findInText(textNode) {
    if (this.find) for (let i = 0; i < this.find.length; i++) {
      if (this.find[i].node == textNode)
        this.find[i].pos = this.currentPos - (textNode.nodeValue.length - this.find[i].offset);
    }
  }

  // : (string) → bool
  // Determines whether the given [context
  // string](#ParseRule.context) matches this context.
  matchesContext(context) {
    if (context.indexOf("|") > -1)
      return context.split(/\s*\|\s*/).some(this.matchesContext, this)

    let parts = context.split("/");
    let option = this.options.context;
    let useRoot = !this.isOpen && (!option || option.parent.type == this.nodes[0].type);
    let minDepth = -(option ? option.depth + 1 : 0) + (useRoot ? 0 : 1);
    let match = (i, depth) => {
      for (; i >= 0; i--) {
        let part = parts[i];
        if (part == "") {
          if (i == parts.length - 1 || i == 0) continue
          for (; depth >= minDepth; depth--)
            if (match(i - 1, depth)) return true
          return false
        } else {
          let next = depth > 0 || (depth == 0 && useRoot) ? this.nodes[depth].type
              : option && depth >= minDepth ? option.node(depth - minDepth).type
              : null;
          if (!next || (next.name != part && next.groups.indexOf(part) == -1))
            return false
          depth--;
        }
      }
      return true
    };
    return match(parts.length - 1, this.open)
  }

  textblockFromContext() {
    let $context = this.options.context;
    if ($context) for (let d = $context.depth; d >= 0; d--) {
      let deflt = $context.node(d).contentMatchAt($context.indexAfter(d)).defaultType;
      if (deflt && deflt.isTextblock && deflt.defaultAttrs) return deflt
    }
    for (let name in this.parser.schema.nodes) {
      let type = this.parser.schema.nodes[name];
      if (type.isTextblock && type.defaultAttrs) return type
    }
  }
}

// Apply a CSS selector.
function matches(dom, selector) {
  return (dom.matches || dom.msMatchesSelector || dom.webkitMatchesSelector || dom.mozMatchesSelector).call(dom, selector)
}

// : (string) → [string]
// Tokenize a style attribute into property/value pairs.
function parseStyles(style) {
  let re = /\s*([\w-]+)\s*:\s*([^;]+)/g, m, result = [];
  while (m = re.exec(style)) result.push(m[1], m[2].trim());
  return result
}

function copy(obj) {
  let copy = {};
  for (let prop in obj) copy[prop] = obj[prop];
  return copy
}

function mustOverride() { throw new Error("Override me") }

const stepsByID = Object.create(null);

// ::- A step object represents an atomic change. It generally applies
// only to the document it was created for, since the positions
// stored in it will only make sense for that document.
//
// New steps are defined by creating classes that extend `Step`,
// overriding the `apply`, `invert`, `map`, `getMap` and `fromJSON`
// methods, and registering your class with a unique
// JSON-serialization identifier using
// [`Step.jsonID`](#transform.Step^jsonID).
class Step {
  // :: (doc: Node) → StepResult
  // Applies this step to the given document, returning a result
  // object that either indicates failure, if the step can not be
  // applied to this document, or indicates success by containing a
  // transformed document.
  apply(_doc) { return mustOverride() }

  // :: () → StepMap
  // Get the step map that represents the changes made by this step,
  // and which can be used to transform between positions in the old
  // and the new document.
  getMap() { return StepMap.empty }

  // :: (doc: Node) → Step
  // Create an inverted version of this step. Needs the document as it
  // was before the step as argument.
  invert(_doc) { return mustOverride() }

  // :: (mapping: Mappable) → ?Step
  // Map this step through a mappable thing, returning either a
  // version of that step with its positions adjusted, or `null` if
  // the step was entirely deleted by the mapping.
  map(_mapping) { return mustOverride() }

  // :: (other: Step) → ?Step
  // Try to merge this step with another one, to be applied directly
  // after it. Returns the merged step when possible, null if the
  // steps can't be merged.
  merge(_other) { return null }

  // :: () → Object
  // Create a JSON-serializeable representation of this step. When
  // defining this for a custom subclass, make sure the result object
  // includes the step type's [JSON id](#transform.Step^jsonID) under
  // the `stepType` property.
  toJSON() { return mustOverride() }

  // :: (Schema, Object) → Step
  // Deserialize a step from its JSON representation. Will call
  // through to the step class' own implementation of this method.
  static fromJSON(schema, json) {
    if (!json || !json.stepType) throw new RangeError("Invalid input for Step.fromJSON")
    let type = stepsByID[json.stepType];
    if (!type) throw new RangeError(`No step type ${json.stepType} defined`)
    return type.fromJSON(schema, json)
  }

  // :: (string, constructor<Step>)
  // To be able to serialize steps to JSON, each step needs a string
  // ID to attach to its JSON representation. Use this method to
  // register an ID for your step classes. Try to pick something
  // that's unlikely to clash with steps from other modules.
  static jsonID(id, stepClass) {
    if (id in stepsByID) throw new RangeError("Duplicate use of step JSON ID " + id)
    stepsByID[id] = stepClass;
    stepClass.prototype.jsonID = id;
    return stepClass
  }
}

// ::- The result of [applying](#transform.Step.apply) a step. Contains either a
// new document or a failure value.
class StepResult {
  // : (?Node, ?string)
  constructor(doc, failed) {
    // :: ?Node The transformed document.
    this.doc = doc;
    // :: ?string Text providing information about a failed step.
    this.failed = failed;
  }

  // :: (Node) → StepResult
  // Create a successful step result.
  static ok(doc) { return new StepResult(doc, null) }

  // :: (string) → StepResult
  // Create a failed step result.
  static fail(message) { return new StepResult(null, message) }

  // :: (Node, number, number, Slice) → StepResult
  // Call [`Node.replace`](#model.Node.replace) with the given
  // arguments. Create a successful result if it succeeds, and a
  // failed one if it throws a `ReplaceError`.
  static fromReplace(doc, from, to, slice) {
    try {
      return StepResult.ok(doc.replace(from, to, slice))
    } catch (e) {
      if (e instanceof ReplaceError) return StepResult.fail(e.message)
      throw e
    }
  }
}

// ::- Replace a part of the document with a slice of new content.
class ReplaceStep extends Step {
  // :: (number, number, Slice, ?bool)
  // The given `slice` should fit the 'gap' between `from` and
  // `to`—the depths must line up, and the surrounding nodes must be
  // able to be joined with the open sides of the slice. When
  // `structure` is true, the step will fail if the content between
  // from and to is not just a sequence of closing and then opening
  // tokens (this is to guard against rebased replace steps
  // overwriting something they weren't supposed to).
  constructor(from, to, slice, structure) {
    super();
    this.from = from;
    this.to = to;
    this.slice = slice;
    this.structure = !!structure;
  }

  apply(doc) {
    if (this.structure && contentBetween(doc, this.from, this.to))
      return StepResult.fail("Structure replace would overwrite content")
    return StepResult.fromReplace(doc, this.from, this.to, this.slice)
  }

  getMap() {
    return new StepMap([this.from, this.to - this.from, this.slice.size])
  }

  invert(doc) {
    return new ReplaceStep(this.from, this.from + this.slice.size, doc.slice(this.from, this.to))
  }

  map(mapping) {
    let from = mapping.mapResult(this.from, 1), to = mapping.mapResult(this.to, -1);
    if (from.deleted && to.deleted) return null
    return new ReplaceStep(from.pos, Math.max(from.pos, to.pos), this.slice)
  }

  merge(other) {
    if (!(other instanceof ReplaceStep) || other.structure != this.structure) return null

    if (this.from + this.slice.size == other.from && !this.slice.openEnd && !other.slice.openStart) {
      let slice = this.slice.size + other.slice.size == 0 ? Slice.empty
          : new Slice(this.slice.content.append(other.slice.content), this.slice.openStart, other.slice.openEnd);
      return new ReplaceStep(this.from, this.to + (other.to - other.from), slice, this.structure)
    } else if (other.to == this.from && !this.slice.openStart && !other.slice.openEnd) {
      let slice = this.slice.size + other.slice.size == 0 ? Slice.empty
          : new Slice(other.slice.content.append(this.slice.content), other.slice.openStart, this.slice.openEnd);
      return new ReplaceStep(other.from, this.to, slice, this.structure)
    } else {
      return null
    }
  }

  toJSON() {
    let json = {stepType: "replace", from: this.from, to: this.to};
    if (this.slice.size) json.slice = this.slice.toJSON();
    if (this.structure) json.structure = true;
    return json
  }

  static fromJSON(schema, json) {
    if (typeof json.from != "number" || typeof json.to != "number")
      throw new RangeError("Invalid input for ReplaceStep.fromJSON")
    return new ReplaceStep(json.from, json.to, Slice.fromJSON(schema, json.slice), !!json.structure)
  }
}

Step.jsonID("replace", ReplaceStep);

// ::- Replace a part of the document with a slice of content, but
// preserve a range of the replaced content by moving it into the
// slice.
class ReplaceAroundStep extends Step {
  // :: (number, number, number, number, Slice, number, ?bool)
  // Create a replace-around step with the given range and gap.
  // `insert` should be the point in the slice into which the content
  // of the gap should be moved. `structure` has the same meaning as
  // it has in the [`ReplaceStep`](#transform.ReplaceStep) class.
  constructor(from, to, gapFrom, gapTo, slice, insert, structure) {
    super();
    this.from = from;
    this.to = to;
    this.gapFrom = gapFrom;
    this.gapTo = gapTo;
    this.slice = slice;
    this.insert = insert;
    this.structure = !!structure;
  }

  apply(doc) {
    if (this.structure && (contentBetween(doc, this.from, this.gapFrom) ||
                           contentBetween(doc, this.gapTo, this.to)))
      return StepResult.fail("Structure gap-replace would overwrite content")

    let gap = doc.slice(this.gapFrom, this.gapTo);
    if (gap.openStart || gap.openEnd)
      return StepResult.fail("Gap is not a flat range")
    let inserted = this.slice.insertAt(this.insert, gap.content);
    if (!inserted) return StepResult.fail("Content does not fit in gap")
    return StepResult.fromReplace(doc, this.from, this.to, inserted)
  }

  getMap() {
    return new StepMap([this.from, this.gapFrom - this.from, this.insert,
                        this.gapTo, this.to - this.gapTo, this.slice.size - this.insert])
  }

  invert(doc) {
    let gap = this.gapTo - this.gapFrom;
    return new ReplaceAroundStep(this.from, this.from + this.slice.size + gap,
                                 this.from + this.insert, this.from + this.insert + gap,
                                 doc.slice(this.from, this.to).removeBetween(this.gapFrom - this.from, this.gapTo - this.from),
                                 this.gapFrom - this.from, this.structure)
  }

  map(mapping) {
    let from = mapping.mapResult(this.from, 1), to = mapping.mapResult(this.to, -1);
    let gapFrom = mapping.map(this.gapFrom, -1), gapTo = mapping.map(this.gapTo, 1);
    if ((from.deleted && to.deleted) || gapFrom < from.pos || gapTo > to.pos) return null
    return new ReplaceAroundStep(from.pos, to.pos, gapFrom, gapTo, this.slice, this.insert, this.structure)
  }

  toJSON() {
    let json = {stepType: "replaceAround", from: this.from, to: this.to,
                gapFrom: this.gapFrom, gapTo: this.gapTo, insert: this.insert};
    if (this.slice.size) json.slice = this.slice.toJSON();
    if (this.structure) json.structure = true;
    return json
  }

  static fromJSON(schema, json) {
    if (typeof json.from != "number" || typeof json.to != "number" ||
        typeof json.gapFrom != "number" || typeof json.gapTo != "number" || typeof json.insert != "number")
      throw new RangeError("Invalid input for ReplaceAroundStep.fromJSON")
    return new ReplaceAroundStep(json.from, json.to, json.gapFrom, json.gapTo,
                                 Slice.fromJSON(schema, json.slice), json.insert, !!json.structure)
  }
}

Step.jsonID("replaceAround", ReplaceAroundStep);

function contentBetween(doc, from, to) {
  let $from = doc.resolve(from), dist = to - from, depth = $from.depth;
  while (dist > 0 && depth > 0 && $from.indexAfter(depth) == $from.node(depth).childCount) {
    depth--;
    dist--;
  }
  if (dist > 0) {
    let next = $from.node(depth).maybeChild($from.indexAfter(depth));
    while (dist > 0) {
      if (!next || next.isLeaf) return true
      next = next.firstChild;
      dist--;
    }
  }
  return false
}

// :: (NodeRange, number) → this
// Split the content in the given range off from its parent, if there
// is sibling content before or after it, and move it up the tree to
// the depth specified by `target`. You'll probably want to use
// [`liftTarget`](#transform.liftTarget) to compute `target`, to make
// sure the lift is valid.
Transform.prototype.lift = function(range, target) {
  let {$from, $to, depth} = range;

  let gapStart = $from.before(depth + 1), gapEnd = $to.after(depth + 1);
  let start = gapStart, end = gapEnd;

  let before = Fragment.empty, openStart = 0;
  for (let d = depth, splitting = false; d > target; d--)
    if (splitting || $from.index(d) > 0) {
      splitting = true;
      before = Fragment.from($from.node(d).copy(before));
      openStart++;
    } else {
      start--;
    }
  let after = Fragment.empty, openEnd = 0;
  for (let d = depth, splitting = false; d > target; d--)
    if (splitting || $to.after(d + 1) < $to.end(d)) {
      splitting = true;
      after = Fragment.from($to.node(d).copy(after));
      openEnd++;
    } else {
      end++;
    }

  return this.step(new ReplaceAroundStep(start, end, gapStart, gapEnd,
                                         new Slice(before.append(after), openStart, openEnd),
                                         before.size - openStart, true))
};

// :: (NodeRange, [{type: NodeType, attrs: ?Object}]) → this
// Wrap the given [range](#model.NodeRange) in the given set of wrappers.
// The wrappers are assumed to be valid in this position, and should
// probably be computed with [`findWrapping`](#transform.findWrapping).
Transform.prototype.wrap = function(range, wrappers) {
  let content = Fragment.empty;
  for (let i = wrappers.length - 1; i >= 0; i--)
    content = Fragment.from(wrappers[i].type.create(wrappers[i].attrs, content));

  let start = range.start, end = range.end;
  return this.step(new ReplaceAroundStep(start, end, start, end, new Slice(content, 0, 0), wrappers.length, true))
};

// :: (number, ?number, NodeType, ?Object) → this
// Set the type of all textblocks (partly) between `from` and `to` to
// the given node type with the given attributes.
Transform.prototype.setBlockType = function(from, to = from, type, attrs) {
  if (!type.isTextblock) throw new RangeError("Type given to setBlockType should be a textblock")
  let mapFrom = this.steps.length;
  this.doc.nodesBetween(from, to, (node, pos) => {
    if (node.isTextblock && !node.hasMarkup(type, attrs) && canChangeType(this.doc, this.mapping.slice(mapFrom).map(pos), type)) {
      // Ensure all markup that isn't allowed in the new node type is cleared
      this.clearIncompatible(this.mapping.slice(mapFrom).map(pos, 1), type);
      let mapping = this.mapping.slice(mapFrom);
      let startM = mapping.map(pos, 1), endM = mapping.map(pos + node.nodeSize, 1);
      this.step(new ReplaceAroundStep(startM, endM, startM + 1, endM - 1,
                                      new Slice(Fragment.from(type.create(attrs, null, node.marks)), 0, 0), 1, true));
      return false
    }
  });
  return this
};

function canChangeType(doc, pos, type) {
  let $pos = doc.resolve(pos), index = $pos.index();
  return $pos.parent.canReplaceWith(index, index + 1, type)
}

// :: (number, ?NodeType, ?Object, ?[Mark]) → this
// Change the type, attributes, and/or marks of the node at `pos`.
// When `type` isn't given, the existing node type is preserved,
Transform.prototype.setNodeMarkup = function(pos, type, attrs, marks) {
  let node = this.doc.nodeAt(pos);
  if (!node) throw new RangeError("No node at given position")
  if (!type) type = node.type;
  let newNode = type.create(attrs, null, marks || node.marks);
  if (node.isLeaf)
    return this.replaceWith(pos, pos + node.nodeSize, newNode)

  if (!type.validContent(node.content))
    throw new RangeError("Invalid content for node type " + type.name)

  return this.step(new ReplaceAroundStep(pos, pos + node.nodeSize, pos + 1, pos + node.nodeSize - 1,
                                         new Slice(Fragment.from(newNode), 0, 0), 1, true))
};

// :: (number, ?number, ?[?{type: NodeType, attrs: ?Object}]) → this
// Split the node at the given position, and optionally, if `depth` is
// greater than one, any number of nodes above that. By default, the
// parts split off will inherit the node type of the original node.
// This can be changed by passing an array of types and attributes to
// use after the split.
Transform.prototype.split = function(pos, depth = 1, typesAfter) {
  let $pos = this.doc.resolve(pos), before = Fragment.empty, after = Fragment.empty;
  for (let d = $pos.depth, e = $pos.depth - depth, i = depth - 1; d > e; d--, i--) {
    before = Fragment.from($pos.node(d).copy(before));
    let typeAfter = typesAfter && typesAfter[i];
    after = Fragment.from(typeAfter ? typeAfter.type.create(typeAfter.attrs, after) : $pos.node(d).copy(after));
  }
  return this.step(new ReplaceStep(pos, pos, new Slice(before.append(after), depth, depth), true))
};

// :: (number, ?number) → this
// Join the blocks around the given position. If depth is 2, their
// last and first siblings are also joined, and so on.
Transform.prototype.join = function(pos, depth = 1) {
  let step = new ReplaceStep(pos - depth, pos + depth, Slice.empty, true);
  return this.step(step)
};

// :: (Node, number, NodeType) → ?number
// Try to find a point where a node of the given type can be inserted
// near `pos`, by searching up the node hierarchy when `pos` itself
// isn't a valid place but is at the start or end of a node. Return
// null if no position was found.
function insertPoint(doc, pos, nodeType) {
  let $pos = doc.resolve(pos);
  if ($pos.parent.canReplaceWith($pos.index(), $pos.index(), nodeType)) return pos

  if ($pos.parentOffset == 0)
    for (let d = $pos.depth - 1; d >= 0; d--) {
      let index = $pos.index(d);
      if ($pos.node(d).canReplaceWith(index, index, nodeType)) return $pos.before(d + 1)
      if (index > 0) return null
    }
  if ($pos.parentOffset == $pos.parent.content.size)
    for (let d = $pos.depth - 1; d >= 0; d--) {
      let index = $pos.indexAfter(d);
      if ($pos.node(d).canReplaceWith(index, index, nodeType)) return $pos.after(d + 1)
      if (index < $pos.node(d).childCount) return null
    }
}

function mapFragment(fragment, f, parent) {
  let mapped = [];
  for (let i = 0; i < fragment.childCount; i++) {
    let child = fragment.child(i);
    if (child.content.size) child = child.copy(mapFragment(child.content, f, child));
    if (child.isInline) child = f(child, parent, i);
    mapped.push(child);
  }
  return Fragment.fromArray(mapped)
}

// ::- Add a mark to all inline content between two positions.
class AddMarkStep extends Step {
  // :: (number, number, Mark)
  constructor(from, to, mark) {
    super();
    this.from = from;
    this.to = to;
    this.mark = mark;
  }

  apply(doc) {
    let oldSlice = doc.slice(this.from, this.to), $from = doc.resolve(this.from);
    let parent = $from.node($from.sharedDepth(this.to));
    let slice = new Slice(mapFragment(oldSlice.content, (node, parent) => {
      if (!parent.type.allowsMarkType(this.mark.type)) return node
      return node.mark(this.mark.addToSet(node.marks))
    }, parent), oldSlice.openStart, oldSlice.openEnd);
    return StepResult.fromReplace(doc, this.from, this.to, slice)
  }

  invert() {
    return new RemoveMarkStep(this.from, this.to, this.mark)
  }

  map(mapping) {
    let from = mapping.mapResult(this.from, 1), to = mapping.mapResult(this.to, -1);
    if (from.deleted && to.deleted || from.pos >= to.pos) return null
    return new AddMarkStep(from.pos, to.pos, this.mark)
  }

  merge(other) {
    if (other instanceof AddMarkStep &&
        other.mark.eq(this.mark) &&
        this.from <= other.to && this.to >= other.from)
      return new AddMarkStep(Math.min(this.from, other.from),
                             Math.max(this.to, other.to), this.mark)
  }

  toJSON() {
    return {stepType: "addMark", mark: this.mark.toJSON(),
            from: this.from, to: this.to}
  }

  static fromJSON(schema, json) {
    if (typeof json.from != "number" || typeof json.to != "number")
      throw new RangeError("Invalid input for AddMarkStep.fromJSON")
    return new AddMarkStep(json.from, json.to, schema.markFromJSON(json.mark))
  }
}

Step.jsonID("addMark", AddMarkStep);

// ::- Remove a mark from all inline content between two positions.
class RemoveMarkStep extends Step {
  // :: (number, number, Mark)
  constructor(from, to, mark) {
    super();
    this.from = from;
    this.to = to;
    this.mark = mark;
  }

  apply(doc) {
    let oldSlice = doc.slice(this.from, this.to);
    let slice = new Slice(mapFragment(oldSlice.content, node => {
      return node.mark(this.mark.removeFromSet(node.marks))
    }), oldSlice.openStart, oldSlice.openEnd);
    return StepResult.fromReplace(doc, this.from, this.to, slice)
  }

  invert() {
    return new AddMarkStep(this.from, this.to, this.mark)
  }

  map(mapping) {
    let from = mapping.mapResult(this.from, 1), to = mapping.mapResult(this.to, -1);
    if (from.deleted && to.deleted || from.pos >= to.pos) return null
    return new RemoveMarkStep(from.pos, to.pos, this.mark)
  }

  merge(other) {
    if (other instanceof RemoveMarkStep &&
        other.mark.eq(this.mark) &&
        this.from <= other.to && this.to >= other.from)
      return new RemoveMarkStep(Math.min(this.from, other.from),
                                Math.max(this.to, other.to), this.mark)
  }

  toJSON() {
    return {stepType: "removeMark", mark: this.mark.toJSON(),
            from: this.from, to: this.to}
  }

  static fromJSON(schema, json) {
    if (typeof json.from != "number" || typeof json.to != "number")
      throw new RangeError("Invalid input for RemoveMarkStep.fromJSON")
    return new RemoveMarkStep(json.from, json.to, schema.markFromJSON(json.mark))
  }
}

Step.jsonID("removeMark", RemoveMarkStep);

// :: (number, number, Mark) → this
// Add the given mark to the inline content between `from` and `to`.
Transform.prototype.addMark = function(from, to, mark) {
  let removed = [], added = [], removing = null, adding = null;
  this.doc.nodesBetween(from, to, (node, pos, parent) => {
    if (!node.isInline) return
    let marks = node.marks;
    if (!mark.isInSet(marks) && parent.type.allowsMarkType(mark.type)) {
      let start = Math.max(pos, from), end = Math.min(pos + node.nodeSize, to);
      let newSet = mark.addToSet(marks);

      for (let i = 0; i < marks.length; i++) {
        if (!marks[i].isInSet(newSet)) {
          if (removing && removing.to == start && removing.mark.eq(marks[i]))
            removing.to = end;
          else
            removed.push(removing = new RemoveMarkStep(start, end, marks[i]));
        }
      }

      if (adding && adding.to == start)
        adding.to = end;
      else
        added.push(adding = new AddMarkStep(start, end, mark));
    }
  });

  removed.forEach(s => this.step(s));
  added.forEach(s => this.step(s));
  return this
};

// :: (number, number, ?union<Mark, MarkType>) → this
// Remove marks from inline nodes between `from` and `to`. When `mark`
// is a single mark, remove precisely that mark. When it is a mark type,
// remove all marks of that type. When it is null, remove all marks of
// any type.
Transform.prototype.removeMark = function(from, to, mark = null) {
  let matched = [], step = 0;
  this.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isInline) return
    step++;
    let toRemove = null;
    if (mark instanceof MarkType) {
      let found = mark.isInSet(node.marks);
      if (found) toRemove = [found];
    } else if (mark) {
      if (mark.isInSet(node.marks)) toRemove = [mark];
    } else {
      toRemove = node.marks;
    }
    if (toRemove && toRemove.length) {
      let end = Math.min(pos + node.nodeSize, to);
      for (let i = 0; i < toRemove.length; i++) {
        let style = toRemove[i], found;
        for (let j = 0; j < matched.length; j++) {
          let m = matched[j];
          if (m.step == step - 1 && style.eq(matched[j].style)) found = m;
        }
        if (found) {
          found.to = end;
          found.step = step;
        } else {
          matched.push({style, from: Math.max(pos, from), to: end, step});
        }
      }
    }
  });
  matched.forEach(m => this.step(new RemoveMarkStep(m.from, m.to, m.style)));
  return this
};

// :: (number, NodeType, ?ContentMatch) → this
// Removes all marks and nodes from the content of the node at `pos`
// that don't match the given new parent node type. Accepts an
// optional starting [content match](#model.ContentMatch) as third
// argument.
Transform.prototype.clearIncompatible = function(pos, parentType, match = parentType.contentMatch) {
  let node = this.doc.nodeAt(pos);
  let delSteps = [], cur = pos + 1;
  for (let i = 0; i < node.childCount; i++) {
    let child = node.child(i), end = cur + child.nodeSize;
    let allowed = match.matchType(child.type, child.attrs);
    if (!allowed) {
      delSteps.push(new ReplaceStep(cur, end, Slice.empty));
    } else {
      match = allowed;
      for (let j = 0; j < child.marks.length; j++) if (!parentType.allowsMarkType(child.marks[j].type))
        this.step(new RemoveMarkStep(cur, end, child.marks[j]));
    }
    cur = end;
  }
  if (!match.validEnd) {
    let fill = match.fillBefore(Fragment.empty, true);
    this.replace(cur, cur, new Slice(fill, 0, 0));
  }
  for (let i = delSteps.length - 1; i >= 0; i--) this.step(delSteps[i]);
  return this
};

// :: (Node, number, ?number, ?Slice) → ?Step
// ‘Fit’ a slice into a given position in the document, producing a
// [step](#transform.Step) that inserts it. Will return null if
// there's no meaningful way to insert the slice here, or inserting it
// would be a no-op (an empty slice over an empty range).
function replaceStep(doc, from, to = from, slice = Slice.empty) {
  if (from == to && !slice.size) return null

  let $from = doc.resolve(from), $to = doc.resolve(to);
  // Optimization -- avoid work if it's obvious that it's not needed.
  if (fitsTrivially($from, $to, slice)) return new ReplaceStep(from, to, slice)
  let placed = placeSlice($from, slice);

  let fittedLeft = fitLeft($from, placed);
  let fitted = fitRight($from, $to, fittedLeft);
  if (!fitted) return null
  if (fittedLeft.size != fitted.size && canMoveText($from, $to, fittedLeft)) {
    let d = $to.depth, after = $to.after(d);
    while (d > 1 && after == $to.end(--d)) ++after;
    let fittedAfter = fitRight($from, doc.resolve(after), fittedLeft);
    if (fittedAfter)
      return new ReplaceAroundStep(from, after, to, $to.end(), fittedAfter, fittedLeft.size)
  }
  return fitted.size || from != to ? new ReplaceStep(from, to, fitted) : null
}

// :: (number, ?number, ?Slice) → this
// Replace the part of the document between `from` and `to` with the
// given `slice`.
Transform.prototype.replace = function(from, to = from, slice = Slice.empty) {
  let step = replaceStep(this.doc, from, to, slice);
  if (step) this.step(step);
  return this
};

// :: (number, number, union<Fragment, Node, [Node]>) → this
// Replace the given range with the given content, which may be a
// fragment, node, or array of nodes.
Transform.prototype.replaceWith = function(from, to, content) {
  return this.replace(from, to, new Slice(Fragment.from(content), 0, 0))
};

// :: (number, number) → this
// Delete the content between the given positions.
Transform.prototype.delete = function(from, to) {
  return this.replace(from, to, Slice.empty)
};

// :: (number, union<Fragment, Node, [Node]>) → this
// Insert the given content at the given position.
Transform.prototype.insert = function(pos, content) {
  return this.replaceWith(pos, pos, content)
};



function fitLeftInner($from, depth, placed, placedBelow) {
  let content = Fragment.empty, openEnd = 0, placedHere = placed[depth];
  if ($from.depth > depth) {
    let inner = fitLeftInner($from, depth + 1, placed, placedBelow || placedHere);
    openEnd = inner.openEnd + 1;
    content = Fragment.from($from.node(depth + 1).copy(inner.content));
  }

  if (placedHere) {
    content = content.append(placedHere.content);
    openEnd = placedHere.openEnd;
  }
  if (placedBelow) {
    content = content.append($from.node(depth).contentMatchAt($from.indexAfter(depth)).fillBefore(Fragment.empty, true));
    openEnd = 0;
  }

  return {content, openEnd}
}

function fitLeft($from, placed) {
  let {content, openEnd} = fitLeftInner($from, 0, placed, false);
  return new Slice(content, $from.depth, openEnd || 0)
}

function fitRightJoin(content, parent, $from, $to, depth, openStart, openEnd) {
  let match, count = content.childCount, matchCount = count - (openEnd > 0 ? 1 : 0);
  let parentNode = openStart < 0 ? parent : $from.node(depth);
  if (openStart < 0)
    match = parentNode.contentMatchAt(matchCount);
  else if (count == 1 && openEnd > 0)
    match = parentNode.contentMatchAt(openStart ? $from.index(depth) : $from.indexAfter(depth));
  else
    match = parentNode.contentMatchAt($from.indexAfter(depth))
      .matchFragment(content, count > 0 && openStart ? 1 : 0, matchCount);

  let toNode = $to.node(depth);
  if (openEnd > 0 && depth < $to.depth) {
    let after = toNode.content.cutByIndex($to.indexAfter(depth)).addToStart(content.lastChild);
    let joinable = match.fillBefore(after, true);
    // Can't insert content if there's a single node stretched across this gap
    if (joinable && joinable.size && openStart > 0 && count == 1) joinable = null;

    if (joinable) {
      let inner = fitRightJoin(content.lastChild.content, content.lastChild, $from, $to,
                               depth + 1, count == 1 ? openStart - 1 : -1, openEnd - 1);
      if (inner) {
        let last = content.lastChild.copy(inner);
        if (joinable.size)
          return content.cutByIndex(0, count - 1).append(joinable).addToEnd(last)
        else
          return content.replaceChild(count - 1, last)
      }
    }
  }
  if (openEnd > 0)
    match = match.matchType((count == 1 && openStart > 0 ? $from.node(depth + 1) : content.lastChild).type);

  // If we're here, the next level can't be joined, so we see what
  // happens if we leave it open.
  let toIndex = $to.index(depth);
  if (toIndex == toNode.childCount && !toNode.type.compatibleContent(parent.type)) return null
  let joinable = match.fillBefore(toNode.content, true, toIndex);
  for (let i = toIndex; joinable && i < toNode.content.childCount; i++)
    if (!parentNode.type.allowsMarks(toNode.content.child(i).marks)) joinable = null;
  if (!joinable) return null

  if (openEnd > 0) {
    let closed = fitRightClosed(content.lastChild, openEnd - 1, $from, depth + 1,
                                count == 1 ? openStart - 1 : -1);
    content = content.replaceChild(count - 1, closed);
  }
  content = content.append(joinable);
  if ($to.depth > depth)
    content = content.addToEnd(fitRightSeparate($to, depth + 1));
  return content
}

function fitRightClosed(node, openEnd, $from, depth, openStart) {
  let match, content = node.content, count = content.childCount;
  if (openStart >= 0)
    match = $from.node(depth).contentMatchAt($from.indexAfter(depth))
      .matchFragment(content, openStart > 0 ? 1 : 0, count);
  else
    match = node.contentMatchAt(count);

  if (openEnd > 0) {
    let closed = fitRightClosed(content.lastChild, openEnd - 1, $from, depth + 1,
                                count == 1 ? openStart - 1 : -1);
    content = content.replaceChild(count - 1, closed);
  }

  return node.copy(content.append(match.fillBefore(Fragment.empty, true)))
}

function fitRightSeparate($to, depth) {
  let node = $to.node(depth);
  let fill = node.contentMatchAt(0).fillBefore(node.content, true, $to.index(depth));
  if ($to.depth > depth) fill = fill.addToEnd(fitRightSeparate($to, depth + 1));
  return node.copy(fill)
}

function normalizeSlice(content, openStart, openEnd) {
  while (openStart > 0 && openEnd > 0 && content.childCount == 1) {
    content = content.firstChild.content;
    openStart--;
    openEnd--;
  }
  return new Slice(content, openStart, openEnd)
}

// : (ResolvedPos, ResolvedPos, number, Slice) → Slice
function fitRight($from, $to, slice) {
  let fitted = fitRightJoin(slice.content, $from.node(0), $from, $to, 0, slice.openStart, slice.openEnd);
  if (!fitted) return null
  return normalizeSlice(fitted, slice.openStart, $to.depth)
}

function fitsTrivially($from, $to, slice) {
  return !slice.openStart && !slice.openEnd && $from.start() == $to.start() &&
    $from.parent.canReplace($from.index(), $to.index(), slice.content)
}

function canMoveText($from, $to, slice) {
  if (!$to.parent.isTextblock) return false

  let parent = slice.openEnd ? nodeRight(slice.content, slice.openEnd)
      : $from.node($from.depth - (slice.openStart - slice.openEnd));
  if (!parent.isTextblock) return false
  for (let i = $to.index(); i < $to.parent.childCount; i++)
    if (!parent.type.allowsMarks($to.parent.child(i).marks)) return false
  let match;
  if (slice.openEnd) {
    match = parent.contentMatchAt(parent.childCount);
  } else {
    match = parent.contentMatchAt(parent.childCount);
    if (slice.size) match = match.matchFragment(slice.content, slice.openStart ? 1 : 0);
  }
  match = match.matchFragment($to.parent.content, $to.index());
  return match && match.validEnd
}

function nodeRight(content, depth) {
  for (let i = 1; i < depth; i++) content = content.lastChild.content;
  return content.lastChild
}

// Algorithm for 'placing' the elements of a slice into a gap:
//
// We consider the content of each node that is open to the left to be
// independently placeable. I.e. in <p("foo"), p("bar")>, when the
// paragraph on the left is open, "foo" can be placed (somewhere on
// the left side of the replacement gap) independently from p("bar").
//
// So placeSlice splits up a slice into a number of sub-slices,
// along with information on where they can be placed on the given
// left-side edge. It works by walking the open side of the slice,
// from the inside out, and trying to find a landing spot for each
// element, by simultaneously scanning over the gap side. When no
// place is found for an open node's content, it is left in that node.

// : (ResolvedPos, Slice) → [{content: Fragment, openEnd: number, depth: number}]
function placeSlice($from, slice) {
  let frontier = new Frontier($from);
  for (let pass = 1; slice.size && pass <= 3; pass++) {
    let value = frontier.placeSlice(slice.content, slice.openStart, slice.openEnd, pass);
    if (pass == 3 && value != slice && value.size) pass = 0; // Restart if the 3rd pass made progress but left content
    slice = value;
  }
  while (frontier.open.length) frontier.closeNode();
  return frontier.placed
}

// Helper class that models the open side of the insert position,
// keeping track of the content match and already inserted content
// at each depth.
class Frontier {
  constructor($pos) {
    // : [{parent: Node, match: ContentMatch, content: Fragment, wrapper: bool, openEnd: number, depth: number}]
    this.open = [];
    for (let d = 0; d <= $pos.depth; d++) {
      let parent = $pos.node(d), match = parent.contentMatchAt($pos.indexAfter(d));
      this.open.push({parent, match, content: Fragment.empty, wrapper: false, openEnd: 0, depth: d});
    }
    this.placed = [];
  }

  // : (Fragment, number, number, number, ?Node) → Slice
  // Tries to place the content of the given slice, and returns a
  // slice containing unplaced content.
  //
  // pass 1: try to fit directly
  // pass 2: allow wrapper nodes to be introduced
  // pass 3: allow unwrapping of nodes that aren't open
  placeSlice(fragment, openStart, openEnd, pass, parent) {
    if (openStart > 0) {
      let first = fragment.firstChild;
      let inner = this.placeSlice(first.content, Math.max(0, openStart - 1),
                                  openEnd && fragment.childCount == 1 ? openEnd - 1 : 0,
                                  pass, first);
      if (inner.content != first.content) {
        if (inner.content.size) {
          fragment = fragment.replaceChild(0, first.copy(inner.content));
          openStart = inner.openStart + 1;
        } else {
          if (fragment.childCount == 1) openEnd = 0;
          fragment = fragment.cutByIndex(1);
          openStart = 0;
        }
      }
    }
    let result = this.placeContent(fragment, openStart, openEnd, pass, parent);
    if (pass > 2 && result.size && openStart == 0) {
      let child = result.content.firstChild, single = result.content.childCount == 1;
      this.placeContent(child.content, 0, openEnd && single ? openEnd - 1 : 0, pass, child);
      result = single ? Fragment.empty : new Slice(result.content.cutByIndex(1), 0, openEnd);
    }
    return result
  }

  placeContent(fragment, openStart, openEnd, pass, parent) {
    let i = 0;
    // Go over the fragment's children
    for (; i < fragment.childCount; i++) {
      let child = fragment.child(i), placed = false, last = i == fragment.childCount - 1;
      // Try each open node in turn, starting from the innermost
      for (let d = this.open.length - 1; d >= 0; d--) {
        let open = this.open[d], wrap;

        // If pass > 1, it is allowed to wrap the node to help find a
        // fit, so if findWrapping returns something, we add open
        // nodes to the frontier for that wrapping.
        if (pass > 1 && (wrap = open.match.findWrapping(child.type)) &&
            !(parent && wrap.length && wrap[wrap.length - 1] == parent.type)) {
          while (this.open.length - 1 > d) this.closeNode();
          for (let w = 0; w < wrap.length; w++) {
            open.match = open.match.matchType(wrap[w]);
            d++;
            open = {parent: wrap[w].create(),
                    match: wrap[w].contentMatch,
                    content: Fragment.empty, wrapper: true, openEnd: 0, depth: d + w};
            this.open.push(open);
          }
        }

        // See if the child fits here
        let match = open.match.matchType(child.type);
        if (!match) {
          let fill = open.match.fillBefore(Fragment.from(child));
          if (fill) {
            for (let j = 0; j < fill.childCount; j++) {
              let ch = fill.child(j);
              this.addNode(open, ch, 0);
              match = open.match.matchFragment(ch);
            }
          } else if (parent && open.match.matchType(parent.type)) {
            // Don't continue looking further up if the parent node
            // would fit here.
            break
          } else {
            continue
          }
        }

        // Close open nodes above this one, since we're starting to
        // add to this.
        while (this.open.length - 1 > d) this.closeNode();
        // Strip marks from the child or close its start when necessary
        child = child.mark(open.parent.type.allowedMarks(child.marks));
        if (openStart) {
          child = closeNodeStart(child, openStart, last ? openEnd : 0);
          openStart = 0;
        }
        // Add the child to this open node and adjust its metadata
        this.addNode(open, child, last ? openEnd : 0);
        open.match = match;
        if (last) openEnd = 0;
        placed = true;
        break
      }
      // As soon as we've failed to place a node we stop looking at
      // later nodes
      if (!placed) break
    }
    // Close the current open node if it's not the the root and we
    // either placed up to the end of the node or the the current
    // slice depth's node type matches the open node's type
    if (this.open.length > 1 &&
        (i > 0 && i == fragment.childCount ||
         parent && this.open[this.open.length - 1].parent.type == parent.type))
      this.closeNode();

    return new Slice(fragment.cutByIndex(i), openStart, openEnd)
  }

  addNode(open, node, openEnd) {
    open.content = closeFragmentEnd(open.content, open.openEnd).addToEnd(node);
    open.openEnd = openEnd;
  }

  closeNode() {
    let open = this.open.pop();
    if (open.content.size == 0) ; else if (open.wrapper) {
      this.addNode(this.open[this.open.length - 1], open.parent.copy(open.content), open.openEnd + 1);
    } else {
      this.placed[open.depth] = {depth: open.depth, content: open.content, openEnd: open.openEnd};
    }
  }
}

function closeNodeStart(node, openStart, openEnd) {
  let content = node.content;
  if (openStart > 1) {
    let first = closeNodeStart(node.firstChild, openStart - 1, node.childCount == 1 ? openEnd - 1 : 0);
    content = node.content.replaceChild(0, first);
  }
  let fill = node.type.contentMatch.fillBefore(content, openEnd == 0);
  return node.copy(fill.append(content))
}

function closeNodeEnd(node, depth) {
  let content = node.content;
  if (depth > 1) {
    let last = closeNodeEnd(node.lastChild, depth - 1);
    content = node.content.replaceChild(node.childCount - 1, last);
  }
  let fill = node.contentMatchAt(node.childCount).fillBefore(Fragment.empty, true);
  return node.copy(content.append(fill))
}

function closeFragmentEnd(fragment, depth) {
  return depth ? fragment.replaceChild(fragment.childCount - 1, closeNodeEnd(fragment.lastChild, depth)) : fragment
}

// :: (number, number, Slice) → this
// Replace a range of the document with a given slice, using `from`,
// `to`, and the slice's [`openStart`](#model.Slice.openStart) property
// as hints, rather than fixed start and end points. This method may
// grow the replaced area or close open nodes in the slice in order to
// get a fit that is more in line with WYSIWYG expectations, by
// dropping fully covered parent nodes of the replaced region when
// they are marked [non-defining](#model.NodeSpec.defining), or
// including an open parent node from the slice that _is_ marked as
// [defining](#model.NodeSpec.defining).
//
// This is the method, for example, to handle paste. The similar
// [`replace`](#transform.Transform.replace) method is a more
// primitive tool which will _not_ move the start and end of its given
// range, and is useful in situations where you need more precise
// control over what happens.
Transform.prototype.replaceRange = function(from, to, slice) {
  if (!slice.size) return this.deleteRange(from, to)

  let $from = this.doc.resolve(from), $to = this.doc.resolve(to);
  if (fitsTrivially($from, $to, slice))
    return this.step(new ReplaceStep(from, to, slice))

  let targetDepths = coveredDepths($from, this.doc.resolve(to));
  // Can't replace the whole document, so remove 0 if it's present
  if (targetDepths[targetDepths.length - 1] == 0) targetDepths.pop();
  // Negative numbers represent not expansion over the whole node at
  // that depth, but replacing from $from.before(-D) to $to.pos.
  let preferredTarget = -($from.depth + 1);
  targetDepths.unshift(preferredTarget);
  // This loop picks a preferred target depth, if one of the covering
  // depths is not outside of a defining node, and adds negative
  // depths for any depth that has $from at its start and does not
  // cross a defining node.
  for (let d = $from.depth, pos = $from.pos - 1; d > 0; d--, pos--) {
    let spec = $from.node(d).type.spec;
    if (spec.defining || spec.isolating) break
    if (targetDepths.indexOf(d) > -1) preferredTarget = d;
    else if ($from.before(d) == pos) targetDepths.splice(1, 0, -d);
  }
  // Try to fit each possible depth of the slice into each possible
  // target depth, starting with the preferred depths.
  let preferredTargetIndex = targetDepths.indexOf(preferredTarget);

  let leftNodes = [], preferredDepth = slice.openStart;
  for (let content = slice.content, i = 0;; i++) {
    let node = content.firstChild;
    leftNodes.push(node);
    if (i == slice.openStart) break
    content = node.content;
  }
  // Back up if the node directly above openStart, or the node above
  // that separated only by a non-defining textblock node, is defining.
  if (preferredDepth > 0 && leftNodes[preferredDepth - 1].type.spec.defining &&
      $from.node(preferredTargetIndex).type != leftNodes[preferredDepth - 1].type)
    preferredDepth -= 1;
  else if (preferredDepth >= 2 && leftNodes[preferredDepth - 1].isTextblock && leftNodes[preferredDepth - 2].type.spec.defining &&
           $from.node(preferredTargetIndex).type != leftNodes[preferredDepth - 2].type)
    preferredDepth -= 2;

  for (let j = slice.openStart; j >= 0; j--) {
    let openDepth = (j + preferredDepth + 1) % (slice.openStart + 1);
    let insert = leftNodes[openDepth];
    if (!insert) continue
    for (let i = 0; i < targetDepths.length; i++) {
      // Loop over possible expansion levels, starting with the
      // preferred one
      let targetDepth = targetDepths[(i + preferredTargetIndex) % targetDepths.length], expand = true;
      if (targetDepth < 0) { expand = false; targetDepth = -targetDepth; }
      let parent = $from.node(targetDepth - 1), index = $from.index(targetDepth - 1);
      if (parent.canReplaceWith(index, index, insert.type, insert.marks))
        return this.replace($from.before(targetDepth), expand ? $to.after(targetDepth) : to,
                            new Slice(closeFragment(slice.content, 0, slice.openStart, openDepth),
                                      openDepth, slice.openEnd))
    }
  }

  let startSteps = this.steps.length;
  for (let i = targetDepths.length - 1; i >= 0; i--) {
    this.replace(from, to, slice);
    if (this.steps.length > startSteps) break
    let depth = targetDepths[i];
    if (i < 0) continue
    from = $from.before(depth); to = $to.after(depth);
  }
  return this
};

function closeFragment(fragment, depth, oldOpen, newOpen, parent) {
  if (depth < oldOpen) {
    let first = fragment.firstChild;
    fragment = fragment.replaceChild(0, first.copy(closeFragment(first.content, depth + 1, oldOpen, newOpen, first)));
  }
  if (depth > newOpen)
    fragment = parent.contentMatchAt(0).fillBefore(fragment, true).append(fragment);
  return fragment
}

// :: (number, number, Node) → this
// Replace the given range with a node, but use `from` and `to` as
// hints, rather than precise positions. When from and to are the same
// and are at the start or end of a parent node in which the given
// node doesn't fit, this method may _move_ them out towards a parent
// that does allow the given node to be placed. When the given range
// completely covers a parent node, this method may completely replace
// that parent node.
Transform.prototype.replaceRangeWith = function(from, to, node) {
  if (!node.isInline && from == to && this.doc.resolve(from).parent.content.size) {
    let point = insertPoint(this.doc, from, node.type);
    if (point != null) from = to = point;
  }
  return this.replaceRange(from, to, new Slice(Fragment.from(node), 0, 0))
};

// :: (number, number) → this
// Delete the given range, expanding it to cover fully covered
// parent nodes until a valid replace is found.
Transform.prototype.deleteRange = function(from, to) {
  let $from = this.doc.resolve(from), $to = this.doc.resolve(to);
  let covered = coveredDepths($from, $to);
  for (let i = 0; i < covered.length; i++) {
    let depth = covered[i], last = i == covered.length - 1;
    if ((last && depth == 0) || $from.node(depth).type.contentMatch.validEnd)
      return this.delete($from.start(depth), $to.end(depth))
    if (depth > 0 && (last || $from.node(depth - 1).canReplace($from.index(depth - 1), $to.indexAfter(depth - 1))))
      return this.delete($from.before(depth), $to.after(depth))
  }
  for (let d = 1; d <= $from.depth; d++) {
    if (from - $from.start(d) == $from.depth - d && to > $from.end(d))
      return this.delete($from.before(d), to)
  }
  return this.delete(from, to)
};

// : (ResolvedPos, ResolvedPos) → [number]
// Returns an array of all depths for which $from - $to spans the
// whole content of the nodes at that depth.
function coveredDepths($from, $to) {
  let result = [], minDepth = Math.min($from.depth, $to.depth);
  for (let d = minDepth; d >= 0; d--) {
    let start = $from.start(d);
    if (start < $from.pos - ($from.depth - d) ||
        $to.end(d) > $to.pos + ($to.depth - d) ||
        $from.node(d).type.spec.isolating ||
        $to.node(d).type.spec.isolating) break
    if (start == $to.start(d)) result.push(d);
  }
  return result
}

/** Update Component Command
 *
 * Command JSON format:
 * {
 *   "type":"literatePageTransaction",
 *   "memberId":(main member full name),
 *   "steps":(steps json)
 * }
 */ 
let literatepagetransaction = {};

//=====================================
// Command Object
//=====================================

literatepagetransaction.createUndoCommand = function(workspaceManager,commandData) {
    
    if(commandData.undoSteps) {
        //temporary implementation
        var undoCommandData = {};
        undoCommandData.type = literatepagetransaction.commandInfo.type;
        undoCommandData.steps = commandData.undoSteps;
        undoCommandData.startSelection = commandData.endSelection;
        undoCommandData.startMarks = commandData.endMarks;
        undoCommandData.endSelection = commandData.startSelection;
        undoCommandData.endMarks = commandData.startMarks;
        undoCommandData.memberId = commandData.memberId;
        return undoCommandData;
    }
    else {
        return null;
    }
};


literatepagetransaction.executeCommand = function(workspaceManager,commandData) {
    let modelManager = workspaceManager.getMutableModelManager();
    let componentId = modelManager.getComponentIdByMemberId(commandData.memberId);
    let component = modelManager.getMutableComponentByComponentId(componentId);

    let oldDocument = component.getDocument();
    let schema = component.getSchema();
            
    let newDocument = updateDocument(oldDocument,schema,commandData);

    if(newDocument) {
        //create the editor state info if we have it
        let editorStateInfo;
        if((commandData.endSelection)||(commandData.endMarks)) {
            editorStateInfo = {};
            editorStateInfo.selection = commandData.endSelection;
            editorStateInfo.storedMarks = commandData.endMarks;
        }

        //set the document. Also set some editor state that accompanies the document.
        //this editor state inof should only be stored temporarily, and not be maintained in the component.
        component.setDocument(newDocument,editorStateInfo);
    }
    else {
        throw new Error("Unknown error updating document");
    }
};

function updateDocument(initialDocument, schema, commandData) {

    //apply the editor transaction
    var transform = new Transform(initialDocument);

    //apply the steps
    commandData.steps.forEach(stepJson => {
      try {
        var step = Step.fromJSON(schema, stepJson);
        transform = transform.step(step);
      }
      catch (error) {
        if(error.stack) console.error(error.stack);
        console.log("Step failed: " + JSON.stringify(stepJson));
        return null;
      }
    });

    return transform.doc;
  }

literatepagetransaction.commandInfo = {
    "type": "literatePageTransaction",
    "targetType": "component",
    "event": "updated"
};

CommandManager.registerCommand(literatepagetransaction);

// :: Schema
// This the schema for the apogee page editor
function createFolderSchema(app,pageMemberId) {

  // :: Object
  // [Specs](#model.NodeSpec) for the nodes defined in this schema.
  const nodes = {
    // :: NodeSpec The top level document node.
    doc: {
      content: "(block | list | workerParent | apogeeComponent)+"
    },

    // :: NodeSpec A plain paragraph textblock. Represented in the DOM
    // as a `<p>` element.
    paragraph: {
      content: "inline*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM() { return ["p", 0] }
    },

    heading1: {
      content: "inline*",
      group: "block",
      defining: true,
      parseDOM: [{ tag: "h1" }],
      toDOM(node) { return ["h1", 0] }
    },

    heading2: {
      content: "inline*",
      group: "block",
      defining: true,
      parseDOM: [{ tag: "h2" }],
      toDOM(node) { return ["h2", 0] }
    },

    heading3: {
      content: "inline*",
      group: "block",
      defining: true,
      parseDOM: [{ tag: "h3" }],
      toDOM(node) { return ["h3", 0] }
    },

    heading4: {
      content: "inline*",
      group: "block",
      defining: true,
      parseDOM: [{ tag: "h4" }],
      toDOM(node) { return ["h4", 0] }
    },

    bulletList: {
      content: "(listItem | list)+",
      group: "list",
      defining: true,
      parseDOM: [{ tag: "ul" }],
      toDOM(node) { return ["ul", 0] }
    },

    numberedList: {
      content: "(listItem | list)+",
      group: "list",
      defining: true,
      parseDOM: [{ tag: "ol" }],
      toDOM(node) { return ["ol", 0] }
    },

    listItem: {
      content: "inline*",
      parseDOM: [{ tag: "li" }],
      toDOM() { return ["li", 0] }
    },

    //this is used only to legally transition between states.
    //there is probably a better way of doing this...
    workerParent: {
      content: "(block | listItem | list | apogeeComponent )+",
      parseDOM: [{ tag: "w-p" }],
      toDOM(node) { return ["w-p", 0] }
    },

    // :: NodeSpec The text node.
    text: {
      group: "inline"
    },

    // :: NodeSpec An inline image (`<img>`) node. Supports `src`,
    // `alt`, and `href` attributes. The latter two default to the empty
    // string.
    image: {
      inline: true,
      attrs: {
        src: {},
        alt: { default: null },
        title: { default: null }
      },
      group: "inline",
      draggable: true,
      parseDOM: [{
        tag: "img[src]", getAttrs(dom) {
          return {
            src: dom.getAttribute("src"),
            title: dom.getAttribute("title"),
            alt: dom.getAttribute("alt")
          }
        }
      }],
      toDOM(node) { let { src, alt, title } = node.attrs; return ["img", { src, alt, title }] }
    },

    apogeeComponent: {
      marks: "",
      atom: true,
      defining: true,
      isolating: true,

      //TEMP TEST////
      hasInteractiveSelection: true,
      ///////////////

      attrs: { 
        "name": { default: "" },
        "id": {default: 0}, //to be used later?
        "state": { default: "" } //this is only used for transient loading, then erased
      },
      toDOM: node => {
        let name = node.attrs.name;

        let modelManager = app.getWorkspaceManager().getModelManager();
        let model = modelManager.getModel();

        let pageMember = model.lookupMemberById(pageMemberId);
        let nodeMemberId = pageMember.lookupChildId(name);
        let nodeComponentId = modelManager.getComponentIdByMemberId(nodeMemberId);
        let nodeComponent = modelManager.getComponentByComponentId(nodeComponentId);
        let nodeMember = nodeComponent.getMember();

        let state = {};
        state.memberJson = nodeMember ? nodeMember.toJson(modelManager.getModel()) : undefined;
        state.componentJson = nodeComponent ? nodeComponent.toJson(modelManager) : undefined;

        return ["div", { "data-name":name, "data-state": JSON.stringify(state) }]
      },
      parseDOM: [{
        tag: "div[data-name]",
        getAttrs: (dom) => {
          let name = dom.getAttribute("data-name");
          let stateString = dom.getAttribute("data-state");
          let state;
          if(stateString) {
            try {
              state =  JSON.parse(stateString);
            }
            catch(error) {
              //FIGURE OUT HOW TO HANDLE THIS ERROR!!!
              console.log("Error parsing entered component: ") + name;
              if(error.stack) console.error(error.stack);
              state = undefined;
            }
          }
          return { name, state };
        }
      }]
    }
  };

  // :: Object [Specs](#model.MarkSpec) for the marks in the schema.
  const marks = {
    // :: MarkSpec A link. Has `href` and `title` attributes. `title`
    // defaults to the empty string. Rendered and parsed as an `<a>`
    // element.
    link: {
      attrs: {
        href: {},
        title: { default: null }
      },
      inclusive: false,
      parseDOM: [{
        tag: "a[href]", getAttrs(dom) {
          return { href: dom.getAttribute("href"), title: dom.getAttribute("title") }
        }
      }],
      toDOM(node) { let { href, title } = node.attrs; return ["a", { href, title }, 0] }
    },

    // :: MarkSpec An emphasis mark. Rendered as an `<em>` element.
    // Has parse rules that also match `<i>` and `font-style: italic`.
    italic: {
      parseDOM: [{ tag: "i" }, { tag: "em" }, { style: "font-style=italic" }],
      toDOM() { return ["em", 0] }
    },

    // :: MarkSpec A strong mark. Rendered as `<b>`, parse rules
    // also match `<strong>` and `font-weight: bold`.
    bold: {
      parseDOM: [{ tag: "strong" },
      // This works around a Google Docs misbehavior where
      // pasted content will be inexplicably wrapped in `<b>`
      // tags with a font-weight normal.
      { tag: "b", getAttrs: node => node.style.fontWeight != "normal" && null },
      { style: "font-weight", getAttrs: value => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null }],
      toDOM() { return ["b", 0] }
    },

    textcolor: {
      attrs: {
        color: { default: "black" }
      },
      parseDOM: [{
        tag: "clr-tag", style: "color", getAttrs(dom) {
          return { color: dom.style.color };
        }
      }],
      toDOM(node) { return ["clr-tag", { "style": "color:" + node.attrs["color"] + ";" }, 0] }
    },

    fontsize: {
      attrs: {
        fontsize: { default: "" }
      },
      parseDOM: [{
        tag: "fntsz-tag", style: "font-size", getAttrs(dom) {
          return { fontsize: dom.style["font-size"] };
        }
      }],
      toDOM(node) { return ["fntsz-tag", { "style": "font-size:" + node.attrs["fontsize"] + ";" }, 0] }
    },

    fontfamily: {
      attrs: {
        fontfamily: { default: "Sans-serif" }
      },
      parseDOM: [{
        tag: "fntfam-tag", style: "font-family", getAttrs(dom) {
          return { fontsize: dom.style["font-family"] };
        }
      }],
      toDOM(node) { return ["fntfam-tag", { "style": "font-family:" + node.attrs.fontfamily + ";" }, 0] }
    },

    highlight: {
      attrs: {
        color: { default: "white" }
      },
      parseDOM: [{
        tag: "bgd-tag", style: "background-color", getAttrs(dom) {
          return { "color": dom.style["background-color"] };
        }
      }],
      toDOM(node) { return ["bgd-tag", { "style": "background-color:" + node.attrs["color"] + ";" }, 0] }
    }

  };


  return new Schema({ nodes, marks })
}

/** This is the base class for a parent component (an object that has children),
 * It extends the component class. */
class ParentComponent extends Component {

    constructor(member,modelManager,instanceToCopy,keepUpdatedFixed) {
        //base constructor
        super(member,modelManager,instanceToCopy,keepUpdatedFixed);

        //==============
        //Fields
        //==============
        //The following fields are added by the parent component. In order to add these, the method
        //"initializeSchema" must be called. See the notes on that method.
        //"schema"
        //"document"

        //==============
        //Working variables
        //==============
        this.tempEditorStateInfo = null;
 
    }

    getSchema() {
        return this.getField("schema");
    }

    /** This method sets the document. It also allows for temporarily storing some editor info 
     * to accompany a set document */
    setDocument(document,editorStateInfo) {
        //for now set dummy data to show a change
        this.setField("document",document);

        //set the temporary editor state, to be used with the new document
        if(editorStateInfo) this.tempEditorStateInfo = editorStateInfo;
    }

    getDocument() {
        return this.getField("document");
    }

    /** This method retrieves the editor state info that acompanies the set document.
     * The argument doClearInfo, if true, will trigger the stored state info to be cleared.
     * This field is meant purely as a temporary storage and should be cleared once it is read. */
    getEditorStateInfo(doClearInfo) {
        let tempEditorStateInfo = this.tempEditorStateInfo;
        if(doClearInfo) {
            this.tempEditorStateInfo = null;
        }
        return tempEditorStateInfo;
    }

    instantiateTabDisplay() {
        let member = this.getMember();
        let folder = this.getParentFolderForChildren();
        return new LiteratePageComponentDisplay(this,member,folder); 
    }

    /** This method should be called only when a new component is created, and not when it is copied. It creates the schema
     * and an initial empty document for the page. It should be called after the parent folder for the page children is initialized.
     * Preferebly it is called from the constructor, if there is not a reason to wait longer.. */
    initializeSchema(modelManager) {
        let pageFolderMember = this.getParentFolderForChildren();
        let schema = createFolderSchema(modelManager.getApp(),pageFolderMember.getId());
        this.setField("schema",schema);
        //initialize with an empty document
        let document = this._createEmptyDocument(schema);
        this.setField("document",document);
    }

    //==============================
    // serialization
    //==============================

    /** This serializes the table component. */
    writeToJson(json,modelManager) {
        //save the editor state
        let document = this.getField("document");
        if(document) {
            json.data = {};
            json.data.doc = document.toJSON();
        }
        
        //save the children
        var folder = this.getParentFolderForChildren();
        var childrenPresent = false;
        var children = {};
        var childIdMap = folder.getChildIdMap();
        for(var key in childIdMap) {
            var childId = childIdMap[key];
            var childComponentId = modelManager.getComponentIdByMemberId(childId);
            var childComponent = modelManager.getComponentByComponentId(childComponentId);
            var name = childComponent.getName();
            children[name] = childComponent.toJson(modelManager);
            childrenPresent = true;
        }
        if(childrenPresent) {
            json.children = children;
        }

        return json;
    }

    readDataFromJson(json) {
        let document;
        let schema = this.getField("schema");

        //read the editor state
        if((json.data)&&(json.data.doc)) {
            //parse the saved document
            document = Node.fromJSON(schema,json.data.doc);
        }
        else {
            //no document stored - create an empty document
            document = this._createEmptyDocument(schema);
        }
        this.setField("document",document);
    }

    /** This method loads the children for this component */
    loadChildrenFromJson(modelManager,componentJson) {
        if(componentJson.children) {
            let parentMember = this.getParentFolderForChildren();
            
            for(let childName in componentJson.children) {
                let childMember = parentMember.lookupChild(modelManager.getModel(),childName);
                if(childMember) {
                    let childComponentJson = componentJson.children[childName];
                    modelManager.createComponentFromMember(childMember,childComponentJson);
                }
            }
        }
    }

    /** This method makes an empty document */
    _createEmptyDocument(schema) {
        return DOMParser.fromSchema(schema).parse("");
    }

}

/** This is used to flag this as an edit component. */
ParentComponent.isParentComponent = true;

/** This component represents a table object. */
class FolderComponent extends ParentComponent {

    constructor(member,modelManager,instanceToCopy,keepUpdatedFixed) {
        //extend parent component
        super(member,modelManager,instanceToCopy,keepUpdatedFixed);

        if(!instanceToCopy) {
            //initialize the schema
            this.initializeSchema(modelManager);
        }
    };

    //cludge================================================
    //I need a real solution for this
    //this is a temp solution to return the parent member for children added to this componnet
    //it is used for now when we paste into the document to create a new component.
    getParentFolderForChildren() {
        return this.getMember();
    }
    //=======================================================

    //======================================
    // Static methods
    //======================================

    //if we want to allow importing a workspace as this object, we must add this method to the generator
    static appendMemberChildren(optionsJson,childrenJson) {
        optionsJson.children = childrenJson;
    }

}

//======================================
// This is the component generator, to register the component
//======================================

FolderComponent.displayName = "Page";
FolderComponent.uniqueName = "apogeeapp.PageComponent";
FolderComponent.DEFAULT_MEMBER_JSON = {
    "type": "apogee.Folder"
};

/** This component represents a folderFunction, which is a function that is programmed using
 *apogee tables rather than writing code. */
class FolderFunctionComponent extends ParentComponent {
        
    constructor(member,modelManager,instanceToCopy,keepUpdatedFixed) {
        //extend parent component
        super(member,modelManager,instanceToCopy,keepUpdatedFixed);
        
        //==============
        //Fields
        //==============
        //Initailize these if this is a new instance
        if(!instanceToCopy) {
            //register this object as a parent container
            var internalFolder = member.getInternalFolder(modelManager.getModel());
            this.setField("member.body",internalFolder);
            modelManager.registerMember(internalFolder.getId(),this,false);

            //initialize the schema
            this.initializeSchema(modelManager);
        }
    }

    /** This overrides the get display method of componnet to return the function declaration. */
    getDisplayName(useFullPath,modelManagerForFullPathOnly) {
        let member = this.getMember();
        var name = useFullPath ? this.getFullName(modelManagerForFullPathOnly) : this.getName();
        var argList = member.getArgList();
        var argListString = argList.join(",");
        var returnValueString = member.getReturnValueString();
        
        var displayName = name + "(" + argListString + ")";
        if((returnValueString != null)&&(returnValueString.length > 0)) {
            displayName += " = " + returnValueString;
        }
        
        return displayName;
    }

    /** This method returns true if the display name field is updated. This method exists because
     * display name is potentially a compound field and this is a systematic way to see if it has changed.
     * Components modifying the getDisplayName method should also update this method.
     * Note this method only applies when useFullPath = false. We currently don't implement a method to see
     * if the full name was updated. */
    isDisplayNameUpdated() {
        return this.getMember().areAnyFieldsUpdated(["name","argList","returnValue"]);
    }

    //cludge================================================
    //I need a real solution for this
    //this is a temp solution to return the parent member for children added to this componnet
    //it is used for now when we paste into the document to create a new component.
    getParentFolderForChildren() {
        //use the internal folder
        return this.getField("member.body");
    }
    //=======================================================


    static transferMemberProperties(inputValues,propertyJson) {
        if(!propertyJson.updateData) propertyJson.updateData = {};
        if(inputValues.argListString !== undefined) {
            propertyJson.updateData.argList = apogeeutil.parseStringArray(inputValues.argListString);
        }
        if(inputValues.returnValueString !== undefined) {
            propertyJson.updateData.returnValue = inputValues.returnValueString;
        }
    }

    //if we want to allow importing a workspace as this object, we must add this method to the generator
    static appendMemberChildren(optionsJson,childrenJson) {
        var internalFolderJson = {};
        internalFolderJson.name = optionsJson.name;
        internalFolderJson.type = "apogee.Folder";
        internalFolderJson.children = childrenJson;
        
        optionsJson = {};
        optionsJson.children["body"] = internalFolderJson;
    }

    static appendMemberChildren(optionsJson,childrenJson) {
        optionsJson.children = childrenJson;
    }

}

//======================================
// This is the component generator, to register the component
//======================================

FolderFunctionComponent.displayName = "Page Function";
FolderFunctionComponent.uniqueName = "apogeeapp.PageFunctionComponent";
FolderFunctionComponent.DEFAULT_MEMBER_JSON = {
    "type": "apogee.FolderFunction",
    "children": {
        "body": {
            "name": "body",
            "type": "apogee.Folder",
        }
    }
};

/** This component represents a table object. */
class DynamicForm extends Component {
        
    constructor(member,modelManager,instanceToCopy,keepUpdatedFixed) {
        //extend edit component
        super(member,modelManager,instanceToCopy,keepUpdatedFixed);
    };

}

//======================================
// This is the component generator, to register the component
//======================================

DynamicForm.displayName = "Action Form Cell";
DynamicForm.uniqueName = "apogeeapp.ActionFormCell";
DynamicForm.DEFAULT_MEMBER_JSON = {
    "type": "apogee.FunctionMember",
    "updateData": {
        "argList": ["admin"]
    }
};

/** This ccomponent represents a data value, with input being from a configurable form.
 * This is an example of componound component. The data associated with the form
 * can be accessed from the variables (componentName).data. There are also subtables
 * "layout" which contains the form layout and "isInputValid" which is a function
 * to validate form input.
 * If you want a form to take an action on submit rather than create and edit a 
 * data value, you can use the dynmaic form. */
class FormDataComponent extends Component {

    constructor(member,modelManager,instanceToCopy,keepUpdatedFixed) {
        //extend edit component
        super(member,modelManager,instanceToCopy,keepUpdatedFixed);
        
        //this should be present in the json that builds the folder, but in case it isn't (for one, because of a previous mistake)
        member.setChildrenWriteable(false);
        
        let model = modelManager.getModel();
        //==============
        //Fields
        //==============
        //Initailize these if this is a new instance
        if(!instanceToCopy) {
            //internal tables
            let dataMember = member.lookupChild(model,"data");
            this.setField("member.data",dataMember);
            modelManager.registerMember(dataMember.getId(),this,false);

            let layoutFunctionMember = member.lookupChild(model,"layout");
            this.setField("member.layout",layoutFunctionMember);
            modelManager.registerMember(layoutFunctionMember.getId(),this,false);

            let isInputValidFunctionMember = member.lookupChild(model,"isInputValid");
            this.setField("member.isInputValid",isInputValidFunctionMember);
            modelManager.registerMember(isInputValidFunctionMember.getId(),this,false);
        }
    };

}

//======================================
// This is the component generator, to register the component
//======================================

FormDataComponent.displayName = "Data Form Cell";
FormDataComponent.uniqueName = "apogeeapp.DataFormCell";
FormDataComponent.DEFAULT_MEMBER_JSON = {
        "type": "apogee.Folder",
        "childrenNotWriteable": true,
        "children": {
            "layout": {
                "name": "layout",
                "type": "apogee.FunctionMember",
                "updateData": {
                    "argList":[],
                }
            },
            "data": {
                "name": "data",
                "type": "apogee.JsonMember",
                "updateData": {
                    "data": "",
                }
            },
            "isInputValid": {
                "name": "isInputValid",
                "type": "apogee.FunctionMember",
                "updateData": {
                    "argList":["formValue"],
                    "functionBody": "//If data valid, return true. If data is invalid, return an error message.\nreturn true;"
                }
            }
        }
    };

/** This is a custom resource component. 
 * To implement it, the resource script must have the methods "run()" which will
 * be called when the component is updated. It also must have any methods that are
 * confugred with initialization data from the model. */
class CustomComponent extends Component {

    constructor(member,modelManager,instanceToCopy,keepUpdatedFixed) {
        super(member,modelManager,instanceToCopy,keepUpdatedFixed);
        
        //==============
        //Fields
        //==============
        //Initailize these if this is a new instance
        if(!instanceToCopy) {
            this.setField("destroyOnInactive",false); //default to keep alive
            this.setField("html","");
            this.setField("css","");
            this.setField("uiCode","");
        }
    };

    //==============================
    //Resource Accessors
    //==============================

    getDestroyOnInactive() {
        return this.getField("destroyOnInactive");
    }

    setDestroyOnInactive(destroyOnInactive) {
        if(destroyOnInactive != this.destroyOnInactive) {
            this.setField("destroyOnInactive",destroyOnInactive);
        }
    }

    /** This method deseriliazes data for the custom resource component. This will
     * work is no json is passed in. */
    loadResourceFromJson(json) { 
        if((json)&&(json.resource)) {  
            for(let fieldName in json.resource) {
                this.update(fieldName,json.resource[fieldName]);
            }
        }
    }


    createResource() {
        try {
            var uiGeneratorBody = this.getField("uiCode");
            
            var resource;
            if((uiGeneratorBody)&&(uiGeneratorBody.length > 0)) {
                try {

                    //create the resource generator wrapped with its closure
                    var generatorFunctionBody = apogeeutil.formatString(
                        CustomComponent.GENERATOR_FUNCTION_FORMAT_TEXT,
                        uiGeneratorBody
                    );

                    //create the function generator, with the aliased variables in the closure
                    var generatorFunction = new Function(generatorFunctionBody);
                    var resourceFunction = generatorFunction();
                    
                    resource = resourceFunction();
                }
                catch(err) {
                    if(error.stack) console.error(error.stack);
                    console.log("bad ui generator function");
                }
            }
                
            //create a dummy
            if(!resource) {
                resource = {};
            }

            return resource;
        }
        catch(error) {
            if(error.stack) console.error(error.stack);
            
            alert("Error creating custom control: " + error.message);
        }
    }


    //=============================
    // Action
    //=============================

    doCodeFieldUpdate(app,codeFieldName,targetValue) { 
        let initialValue = this.getField(codeFieldName);

        var command = {};
        command.type = customComponentUpdateData.commandInfo.type;
        command.memberId = this.getMemberId();
        command.fieldName = codeFieldName;
        command.initialValue = initialValue;
        command.targetValue = targetValue;

        app.executeCommand(command);
        return true;  
    }

    update(fieldName,fieldValue) { 

        let oldFieldValue = this.getField(fieldName);
        if(fieldValue != oldFieldValue) {
            this.setField(fieldName,fieldValue);
        }

    }

    //==============================
    // serialization
    //==============================

    readPropsFromJson(json) {
        if(!json) return;
        
        //set destroy flag
        if(json.destroyOnInactive !== undefined) {
            var destroyOnInactive = json.destroyOnInactive;
            this.setDestroyOnInactive(destroyOnInactive);
        }
        
        //load the resource
        this.loadResourceFromJson(json);
    }

    /** This serializes the table component. */
    writeToJson(json,modelManager) {
        //store the resource info
        json.resource = {};
        json.resource["html"] = this.getField("html");
        json.resource["css"] = this.getField("css");
        json.resource["uiCode"] = this.getField("uiCode");
        json.destroyOnInactive = this.getField("destroyOnInactive");
    }

    //======================================
    // properties
    //======================================

    readExtendedProperties(values) {
        values.destroyOnInactive = this.getDestroyOnInactive();
    }

    //======================================
    // Static methods
    //======================================

    static transferComponentProperties(inputValues,propertyJson) {
        if(inputValues.destroyOnInactive !== undefined) {
            propertyJson.destroyOnInactive = inputValues.destroyOnInactive;
        }
    }
}

/** This is the format string to create the code body for updateing the member
 * Input indices:
 * 0: resouce methods code
 * 1: uiPrivate
 * @private
 */
CustomComponent.GENERATOR_FUNCTION_FORMAT_TEXT = [
    "//member functions",
    "var resourceFunction = function(component) {",
    "{0}",
    "}",
    "//end member functions",
    "return resourceFunction;",
    ""
       ].join("\n");
    


//======================================
// This is the control generator, to register the control
//======================================

CustomComponent.displayName = "Custom Cell";
CustomComponent.uniqueName = "apogeeapp.CustomCell";
CustomComponent.DEFAULT_MEMBER_JSON = {
    "type": "apogee.JsonMember"
};

//=====================================
// Update Data Command
//=====================================

/*
 *
 * Command JSON format:
 * {
 *   "type":"customComponentUpdateCommand",
 *   "memberId":(main member ID),
 *   "fieldName": (the name of the field being updated),
 *   "initialValue":(original fields value)
 *   "targetValue": (desired fields value)
 * }
 */ 
let customComponentUpdateData = {};

customComponentUpdateData.createUndoCommand = function(workspaceManager,commandData) {
    let undoCommandData = {};
    undoCommandData.memberId = commandData.memberId;
    undoCommandData.fieldName = commandData.fieldName;
    undoCommandData.initialValue = commandData.targetValue;
    undoCommandData.targetValue = commandData.initialValue;
    return undoCommandData;
};

customComponentUpdateData.executeCommand = function(workspaceManager,commandData) {
    let modelManager = workspaceManager.getMutableModelManager();
    let componentId = modelManager.getComponentIdByMemberId(commandData.memberId);
    let component = modelManager.getMutableComponentByComponentId(componentId);
    var commandResult = {};
    if(component) {
        try {
            component.update(commandData.fieldName,commandData.targetValue);

            commandResult.cmdDone = true;
            commandResult.target = component;
            commandResult.eventAction = "updated";
        }
        catch(error) {
            if(error.stack) console.error(error.stack);
            let msg = error.message ? error.message : error;
            commandResult.cmdDone = false;
            commandResult.alertMsg = "Exception on custom component update: " + msg;
        }
    }
    else {
        commandResult.cmdDone = false;
        commandResult.alertMsg = "Component not found: " + commandData.memberId;
    }
    
    return commandResult;
};

customComponentUpdateData.commandInfo = {
    "type": "customComponentUpdateCommand",
    "targetType": "component",
    "event": "updated"
};

CommandManager.registerCommand(customComponentUpdateData);

/** This attempt has a single form edit page which returns an object. */
// To add - I should make it so it does not call set data until after it is initialized. I will cache it rather 
//than making the user do that.

/** This is a custom resource component. 
 * To implement it, the resource script must have the methods "run()" which will
 * be called when the component is updated. It also must have any methods that are
 * confugred with initialization data from the model. */
class CustomDataComponent extends Component {

    constructor(member,modelManager,instanceToCopy,keepUpdatedFixed) {
        //extend edit component
        super(member,modelManager,instanceToCopy,keepUpdatedFixed);
        
        //this should be present in the json that builds the folder, but in case it isn't (for one, because of a previous mistake)
        member.setChildrenWriteable(false);

        let model = modelManager.getModel();
        //==============
        //Fields
        //==============
        //Initailize these if this is a new instance
        if(!instanceToCopy) {
            //internal tables
            let dataMember = member.lookupChild(model,"data");
            this.setField("member.data",dataMember);
            modelManager.registerMember(dataMember.getId(),this,false);

            let inputMember = member.lookupChild(model,"input");
            this.setField("member.input",inputMember);
            modelManager.registerMember(inputMember.getId(),this,false);

            this.setField("destroyOnInactive",false); //default to keep alive
            this.setField("html","");
            this.setField("css","");
            this.setField("uiCode","");
        }
    };

    //==============================
    //Resource Accessors
    //==============================

    getDestroyOnInactive() {
        return this.getField("destroyOnInactive");
    }

    setDestroyOnInactive(destroyOnInactive) {
        if(destroyOnInactive != this.getField("destroyOnInactive")) {
            this.setField("destroyOnInactive",destroyOnInactive);
        }
    }

    /** This method deseriliazes data for the custom resource component. This will
     * work is no json is passed in. */
    loadResourceFromJson(json) { 
        if((json)&&(json.resource)) {  
            for(let fieldName in json.resource) {
                this.update(fieldName,json.resource[fieldName]);
            }
        }
    }

    createResource() {
        try {
            var uiGeneratorBody = this.getField("uiCode");
            
            var resource;
            if((uiGeneratorBody)&&(uiGeneratorBody.length > 0)) {
                try {

                    //create the resource generator wrapped with its closure
                    var generatorFunctionBody = apogeeutil.formatString(
                        CustomDataComponent.GENERATOR_FUNCTION_FORMAT_TEXT,
                        uiGeneratorBody
                    );

                    //create the function generator, with the aliased variables in the closure
                    var generatorFunction = new Function(generatorFunctionBody);
                    var resourceFunction = generatorFunction();
                    
                    resource = resourceFunction();
                }
                catch(err) {
                    if(err.stack) console.error(err.stack);
                    
                    console.log("bad ui generator function");
                }
            }
                
            //create a dummy
            if(!resource) {
                resource = {};
            }

            return resource;
        }
        catch(error) {
            if(error.stack) console.error(error.stack);
            
            alert("Error creating custom control: " + error.message);
        }
    }

    //=============================
    // Action
    //=============================

    doCodeFieldUpdate(app,fieldName,targetValue) { 
        var initialValue = this.getField(fieldName);
        var command = {};
        command.type = customDataComponentUpdateData.commandInfo.type;
        command.memberId = this.getMemberId();
        command.fieldName = fieldName;
        command.initialValue = initialValue;
        command.targetValue = targetValue;

        app.executeCommand(command);
        return true; 
    }

    update(fieldName,fieldValue) { 

        let oldFieldValue = this.getField(fieldName);
        if(fieldValue != oldFieldValue) {
            this.setField(fieldName,fieldValue);
        }
    }

    //==============================
    // serialization
    //==============================

    readPropsFromJson(json) {
        if(!json) return;
        
        //set destroy flag
        if(json.destroyOnInactive !== undefined) {
            var destroyOnInactive = json.destroyOnInactive;
            this.setDestroyOnInactive(destroyOnInactive);
        }
        
        //load the resource
        this.loadResourceFromJson(json);
    }

    /** This serializes the table component. */
    writeToJson(json,modelManager) {
        //store the resource info
        json.resource = {};
        json.resource["html"] = this.getField("html");
        json.resource["css"] = this.getField("css");
        json.resource["uiCode"] = this.getField("uiCode");
        json.destroyOnInactive = this.getField("destroyOnInactive");
    }

    //======================================
    // properties
    //======================================

    readExtendedProperties(values) {
        values.destroyOnInactive = this.getDestroyOnInactive();
    }



    //======================================
    // Static methods
    //======================================

    static transferComponentProperties(inputValues,propertyJson) {
        if(inputValues.destroyOnInactive !== undefined) {
            propertyJson.destroyOnInactive = inputValues.destroyOnInactive;
        }
    }
    
}

/** This is the format string to create the code body for updateing the member
 * Input indices:
 * 0: resouce methods code
 * 1: uiPrivate
 * @private
 */
CustomDataComponent.GENERATOR_FUNCTION_FORMAT_TEXT = [
    "//member functions",
    "var resourceFunction = function(component) {",
    "{0}",
    "}",
    "//end member functions",
    "return resourceFunction;",
    ""
       ].join("\n");

//======================================
// This is the control generator, to register the control
//======================================

CustomDataComponent.displayName = "Custom Data Cell";
CustomDataComponent.uniqueName = "apogeeapp.CustomDataCell";
CustomDataComponent.DEFAULT_MEMBER_JSON = {
        "type": "apogee.Folder",
        "childrenNotWriteable": true,
        "children": {
            "input": {
                "name": "input",
                "type": "apogee.JsonMember",
                "updateData": {
                    "data":"",
                }
            },
            "data": {
                "name": "data",
                "type": "apogee.JsonMember",
                "updateData": {
                    "data": "",
                }
            }
        }
    };



//=====================================
// Update Data Command
//=====================================

/*
 *
 * Command JSON format:
 * {
 *   "type":"customComponentUpdateCommand",
 *   "memberId":(main member ID),
 *   "fieldName": (the name of the field being updated),
 *   "initialValue":(original fields value)
 *   "targetValue": (desired fields value)
 * }
 */ 

let customDataComponentUpdateData = {};

customDataComponentUpdateData.createUndoCommand = function(workspaceManager,commandData) {
    let undoCommandData = {};
    undoCommandData.memberId = commandData.memberId;
    undoCommandData.fieldName = commandData.fieldName;
    undoCommandData.initialValue = commandData.targetValue;
    undoCommandData.targetValue = commandData.initialValue;
    return undoCommandData;
};

customDataComponentUpdateData.executeCommand = function(workspaceManager,commandData) {
    let modelManager = workspaceManager.getMutableModelManager();
    let componentId = modelManager.getComponentIdByMemberId(commandData.memberId);
    let component = modelManager.getMutableComponentByComponentId(componentId);
    var commandResult = {};
    if(component) {
        try {
            component.update(commandData.fieldName,commandData.targetValue);

            commandResult.cmdDone = true;
            commandResult.target = component;
            commandResult.eventAction = "updated";
        }
        catch(error) {
            if(error.stack) console.error(error.stack);
            let msg = error.message ? error.message : error;
            commandResult.cmdDone = false;
            commandResult.alertMsg = "Exception on custom component update: " + msg;
        }
    }
    else {
        commandResult.cmdDone = false;
        commandResult.alertMsg = "Component not found: " + commandData.memberId;
    }
    
    return commandResult;
};

customDataComponentUpdateData.commandInfo = {
    "type": "customDataComponentUpdateCommand",
    "targetType": "component",
    "event": "updated"
};

CommandManager.registerCommand(customDataComponentUpdateData);

/** This component represents a json table object. */
class ErrorComponent extends Component {

    constructor(member,modelManager,instanceToCopy,keepUpdatedFixed) {
        //extend edit component
        super(member,modelManager,instanceToCopy,keepUpdatedFixed);
    };

    //==============================
    // Protected and Private Instance Methods
    //==============================

    /** This overrides the save method to return the original input. */
    toJson(modelManager) {
        return this.completeJson;
    }

    /** This overrides the open deserialize method to save the entire json. */
    loadStoredData(json) {
        this.completeJson = json;
    }

    //======================================
    // Static methods
    //======================================

}

//======================================
// This is the component generator, to register the component
//======================================

ErrorComponent.displayName = "Error Cell";
ErrorComponent.uniqueName = "apogeeapp.ErrorCell";
ErrorComponent.DEFAULT_MEMBER_JSON = {
    "type": "apogee.ErrorMember"
};

/** This module initializes the default component classes. */

let componentInfo = {};

let componentClasses = {};
let standardComponents = [];
let additionalComponents = [];
let pageComponents = [];

//==========================
// Functions
//==========================

/** This method registers a new component. It will be exposed when the user
 * requests to create a new component */
componentInfo.registerComponent = function(componentClass) {
    var name = componentClass.uniqueName;

    //we should maybe warn if another component bundle is being overwritten
    componentClasses[name] = componentClass;
    if(additionalComponents.indexOf(name) < 0) {
        additionalComponents.push(name);
    }
};

/** This method registers a component. */
componentInfo.registerStandardComponent = function(componentClass) {
    var name = componentClass.uniqueName;

    //we should maybe warn if another component bundle is being overwritten 
    componentClasses[name] = componentClass;
    if(standardComponents.indexOf(name) < 0) {
        standardComponents.push(name);
    }
};

/** This method registers a new component. It will be exposed when the user
 * requests to create a new component */
componentInfo.registerPageComponent = function(componentClass) {
    var name = componentClass.uniqueName;

    //we should maybe warn if another component bundle is being overwritten
    componentClasses[name] = componentClass;
    if(pageComponents.indexOf(name) < 0) {
        pageComponents.push(name);
    }
};

/** This method registers a new component. It will be exposed when the user
 * requests to create a new component */
componentInfo.unregisterComponent = function(componentClass) {
    //implement this
};

/** This method returns a component generator of a given name. */
componentInfo.getComponentClass = function(name) {
    return componentClasses[name];
};

componentInfo.getStandardComponentNames = function() {
    return standardComponents;
};

componentInfo.getAdditionalComponentNames = function() {
    return additionalComponents;
};

componentInfo.getPageComponentNames = function() {
    return pageComponents;
};

//===============================
//initialization
//===============================

//register standard child components
componentInfo.registerStandardComponent(JsonTableComponent);
componentInfo.registerStandardComponent(FunctionComponent);
componentInfo.registerStandardComponent(FolderFunctionComponent);
componentInfo.registerStandardComponent(DynamicForm);
componentInfo.registerStandardComponent(FormDataComponent);

//additional child components
componentInfo.registerComponent(CustomComponent);
componentInfo.registerComponent(CustomDataComponent);

componentInfo.registerPageComponent(FolderComponent);
componentInfo.registerPageComponent(FolderFunctionComponent);

//other components
componentInfo.FOLDER_COMPONENT_CLASS = FolderComponent;
componentInfo.ERROR_COMPONENT_CLASS = ErrorComponent;

/** This class manages the user interface for a model object. */
class ModelManager extends FieldObject {

    constructor(app,instanceToCopy,keepUpdatedFixed) {
        super("modelManager",instanceToCopy,keepUpdatedFixed);

        this.app = app;

        //==============
        //Fields
        //==============
        //Initailize these if this is a new instance
        if(!instanceToCopy) {
            this.setField("model",null);
            this.setField("componentMap",{});
            this.setField("memberMap",{});
        }

        //==============
        //Working variables
        //==============
        this.viewStateCallback = null;
        this.cachedViewState = null;

        this.workingChangeMap = {};

        //add a change map entry for this object
        this.workingChangeMap[this.getId()] = {action: instanceToCopy ? "modelManager_updated" : "modelManager_created", instance: this};
      
    }

    //====================================
    // Methods
    //====================================

    /** This gets the application instance. */
    getApp() {
        return this.app;
    }

    /** This method gets the model object. */
    getModel() {
        return this.getField("model");
    }

    /** This method returns a mutable instance of the model. If the active model is already mutable
     * it returns that. If not, it returns a mutble copy that also becomes the current model instance. */
    getMutableModel() {
        let oldModel = this.getModel();
        if(oldModel.getIsLocked()) {
            let newModel = oldModel.getMutableModel();
            this.setField("model",newModel);
            
            //add listeners
            //newModel.addListener("member_created", member => this.memberCreated(member));
            newModel.addListener("member_updated", member => this.memberUpdated(member));
            newModel.addListener("member_deleted", member => this.memberDeleted(member));
            newModel.addListener("model_updated", model => this.modelUpdated(model));

            return newModel;
        }
        else {
            return oldModel;
        }
    }

    
    //============================
    // Component Creation
    //============================

    /** This returns the list of parents for newly created members. The argument includeRootFolder includes
     * the root folder in the list. This should only be done for other parent objects (The root should not 
     * hold any children.). */
    getParentList(includeRootFolder) {
        let componentMap = this.getField("componentMap");
        let model = this.getModel();
        let folders = [];
        //get the model parent entry
        if(includeRootFolder) {
            folders.push([model.getId(),"Root Folder"]);
        }
        
        //get folder compontents
        for(var key in componentMap) {
            var component = componentMap[key];
            if(component.getParentFolderForChildren) {
                let folderMember = component.getParentFolderForChildren();
                if(folderMember.getChildrenWriteable()) { 
                    let folderEntry = [];
                    folderEntry.push(folderMember.getId());
                    folderEntry.push(folderMember.getFullName(model));
                    folders.push(folderEntry);
                }
            }
        }
        return folders;
    }
        
    createComponentFromMember(member,componentJson) {

        if(!member) {
            throw new Error("Unknown error: member missing!");
        }
        
        //response - get new member
        var component;
        var componentClass = componentInfo.getComponentClass(componentJson.type);
        if((componentClass)&&(member.constructor.generator.type != "apogee.ErrorMember")) {
            //create empty component
            component = new componentClass(member,this);

            //apply any serialized values
            if(componentJson) {
                component.loadStoredData(componentJson);
            }
        }

        //if we failed to create the component, or if we failed to make the member properly (and we used the error member)
        if(!component) {
            //table not found - create an empty error table
            componentClass = componentInfo.ERROR_COMPONENT_CLASS;
            component = new componentClass(member,this);
            if(componentJson) {
                component.loadStoredData(componentJson);
            }
        }

        if(!component) {
            throw new Error("Unknown error creating componet: " + member.getName());
        }

        //load the children, after the component load is completed
        if(component.loadChildrenFromJson) {
            component.loadChildrenFromJson(this,componentJson);
        }

    }

    
    //=============================
    // Model event handlers
    //=============================

    /** This method responds to a member updated. */
    memberCreated(member) {
    }


    /** This method responds to a member updated. */
    memberUpdated(member) {
        let componentId = this.getComponentIdByMemberId(member.getId());
        if(componentId) {
            let component = this.getMutableComponentByComponentId(componentId);
            component.memberUpdated(member);
        }
    }

    modelUpdated(model) {
    }

    /** This method responds to a delete menu event. */
    memberDeleted(member) {
        let memberId = member.getId();
        let componentId = this.getComponentIdByMemberId(memberId);
        if(componentId) {
            let oldComponentMap = this.getField("componentMap");
            let component = oldComponentMap[componentId];

            //take any delete actions (thes should not require a mutable member)
            component.onDelete();

            //unregister the component
            this._unregisterComponent(component);
        }
    }


    //====================================
    // Component Owner Functionality
    //====================================

    /** The change map lists the changes to the components and model. This will only be
     * valid when the ModelManager is unlocked */
    getChangeMap() {
        return this.workingChangeMap;
    }

    /** This method locks the model manager and all components. */
    lockAll() {
        this.workingChangeMap = null;

        let componentMap = this.getField("componentMap");
        for(var id in componentMap) {
            componentMap[id].lock();
        }
        this.lock();
    }

    getComponentByComponentId(componentId) {
        return this.getField("componentMap")[componentId];
    }

    /** This method gets the component associated with a member object. */
    getMutableComponentByComponentId(componentId) {
        let oldComponentMap = this.getField("componentMap");
        var oldComponent = oldComponentMap[componentId];
        if(oldComponent) {
            if(oldComponent.getIsLocked()) {
                //create an unlocked instance of the component
                let newComponent = new oldComponent.constructor(oldComponent.getMember(),this,oldComponent);

                //register this instance
                this.registerComponent(newComponent);

                return newComponent;
            }
            else {
                return oldComponent;
            }
        }
        else {
            return null;
        }
    }

    /** This method gets the component associated with a member object. */
    getComponentIdByMemberId(memberId) {
        let memberMap = this.getField("memberMap");
        var memberInfo = memberMap[memberId];
        if(memberInfo) {
            return memberInfo.componentId;
        }
        else {
            return null;
        }
    }

    /** This method stores the component instance. It must be called when a
     * new component is created and when a component instance is replaced. */
    registerComponent(component) {
        let componentId = component.getId();
        let oldComponentMap = this.getField("componentMap");

        //create the udpated map
        let newComponentMap = {};
        Object.assign(newComponentMap,oldComponentMap);
        newComponentMap[componentId] = component;
        this.setField("componentMap",newComponentMap);

        //update the change map
        let oldChangeEntry = this.workingChangeMap[componentId];  
        let newAction; 
        //this.workingChangeMap[componentId] = {action: (oldInstance ? "component_updated" : "component_created"), instance: component};
        if(oldChangeEntry) {
            //we will assume the events come in order
            //the only scenarios assuming order are:
            //created then updated => keep action as created
            //updated then updated => no change
            //we will just update the component
            newAction = oldChangeEntry.action;
        }
        else {
            //new action will depend on if we have the component in our old component map
            newAction = oldComponentMap[componentId] ? "component_updated" : "component_created"; 
        }
        this.workingChangeMap[componentId] = {action: newAction, instance: component};
    }

    /** This method takes the local actions needed when a component is deleted. It is called internally. */
    _unregisterComponent(component) {
        let componentId = component.getId();

        //update the component map
        let oldComponentMap = this.getField("componentMap");
        let newComponentMap = {};
        Object.assign(newComponentMap,oldComponentMap);
        //remove the given component
        delete newComponentMap[componentId];
        //save the updated map
        this.setField("componentMap",newComponentMap);

        //update the member map
        //this is a little cumbersome
        let oldMemberMap = this.getField("memberMap");
        let newMemberMap = {};
        Object.assign(newMemberMap,oldMemberMap);
        for(let componentMemberId in newMemberMap) {
            let componentInfo = newMemberMap[componentMemberId];
            if(componentInfo.componentId == componentId) {
                delete newMemberMap[componentMemberId];
            }
        }
        this.setField("memberMap",newMemberMap);

        //update the change map
        let oldChangeEntry = this.workingChangeMap[componentId];
        let newChangeEntry;
        if(oldChangeEntry) {
            //handle the case of an existing change entry
            if(oldChangeEntry.action == "component_created") {
                //component created and deleted during this action - flag it as transient
                newChangeEntry = {action: "transient", instance: component};
            }
            else if(oldChangeEntry.action == "component_updated") {
                newChangeEntry = {action: "component_deleted", instance: component};
            }
            else {
                //this shouldn't happen. If it does there is no change to the action
                //we will just update the component
                newChangeEntry = {action: oldChangeEntry.action, instance: component};
            }
        }
        else {
            //add a new change entry
            newChangeEntry = {action: "component_deleted", instance: component};
        }
        this.workingChangeMap[componentId] = newChangeEntry;  
    }

    /** This method registers a member data object and its associated component object.
     * If the member is not the main member assoicated with component but instead an included
     * member, the main componentMember should be passed in also. Otherwise it should be left 
     * undefined. */
    registerMember(memberId,component,isMain) {

        let oldMemberMap = this.getField("memberMap");

        if(oldMemberMap[memberId]) {
            //already registered
            return;
        }

        //copy the old map
        let newMemberMap = {};
        Object.assign(newMemberMap,oldMemberMap);

        //add the new info
        let memberInfo = {};
        memberInfo.memberId = memberId;
        memberInfo.componentId = component.getId();
        memberInfo.isMain = isMain;

        newMemberMap[memberId] = memberInfo;

        this.setField("memberMap",newMemberMap);
    }
    
    testPrint(eventInfo) {
        if(eventInfo.updated) {
            console.log(JSON.stringify(eventInfo.updated));
        }
    }

    //====================================
    // open and save methods
    //====================================
    
    setViewStateCallback(viewStateCallback) {
        this.viewStateCallback = viewStateCallback;
    }

    getCachedViewState() {
        return this.cachedViewState;
    }

     /** This method loads the model data and model components from the json. */
    load(workspaceManager,json) {

        let modelJson; 
        let componentsJson;

        if(json) {
            modelJson = json.model;
            componentsJson = json.components;

            //set the view state
            if(json.viewState !== undefined) {
                this.cachedViewState = json.viewState;
            }
        }

        //load defaults if there is not saved model data
        if(!modelJson) modelJson = Model.EMPTY_MODEL_JSON;
        if(!componentsJson) componentsJson = ModelManager.EMPTY_MODEL_COMPONENT_JSON;

        //create model
        let model = new Model(workspaceManager.getModelRunContext());
        this.setField("model",model);
        
        //add listeners
        //model.addListener("member_created", member => this.memberCreated(member));
        model.addListener("member_updated", member => this.memberUpdated(member));
        model.addListener("member_deleted", member => this.memberDeleted(member));
        model.addListener("model_updated", model => this.modelUpdated(model));

        //load the model
        let loadAction = {};
        loadAction.action = "loadModel";
        loadAction.modelJson = modelJson;
        let actionResult = doAction(model,loadAction);

        //create the return result
        let commandResult = {};

        if(actionResult.actionDone) {
            commandResult.eventAction = "updated";
            commandResult.cmdDone = true;
            commandResult.target = this;

            //create the children
            let childCommandResults = [];
            let rootChildIdMap = model.getChildIdMap();
            for(let childName in rootChildIdMap) {
                let childMemberId = rootChildIdMap[childName];
                let childMember = model.lookupMemberById(childMemberId);
                if(childMember) {
                    let childJson = componentsJson[childName];
                    let childCommandResult = this.createComponentFromMember(childMember,childJson);
                    childCommandResults.push(childCommandResult);
                }
            }
            if(childCommandResults.length > 0) {
                commandResult.childCommandResults = childCommandResults;
            }

            commandResult.actionResult = actionResult;
        }
        else {
            commandResult.cmdDone = false;
            commandResult.errorMsg = "Error opening workspace model";
        }

        return commandResult;
    }

    /** This method closes the model object. */
    close() {
        //delete all the components - to make sure the are cleaned up
        let componentMap = this.getField("componentMap");
        for(let key in componentMap) {
            let component = componentMap[key];
            component.onDelete();
        }

        let model = this.getModel();
        model.onClose(model);
    }

    /** This saves the model. It the optionalSavedRootFolder is passed in,
     * it will save a model with that as the root folder. */
    toJson(optionalSavedRootFolder) {

        let model = this.getField("model");
        let json = {};

        //get the model json
        if(optionalSavedRootFolder) {
            throw new Error("Need to correctly save the model for the optional saved root folder!");
        }
        json.model = model.toJson();

        //get the components json
        let componentsJson = {};

        //get the "root folder" - either for the model or the optional folder to save.
        let childIdMap;
        if(optionalSavedRootFolder) {
            childIdMap = optionalSavedRootFolder.getChildMap();
        }
        else {
            childIdMap = model.getChildIdMap();
        } 

        //get all the components asoicated with the root members
        for(let childName in childIdMap) {
            //member
            let memberId = childIdMap[childName];
            let componentId = this.getComponentIdByMemberId(memberId);
            let component = this.getComponentByComponentId(componentId);
            componentsJson[childName] = component.toJson(this);
        }
        json.components = componentsJson;

        //model view state
        if(this.viewStateCallback) {
            this.cachedViewState = this.viewStateCallback();
            if(this.cachedViewState) componentsJson.viewState = this.cachedViewState;
        }

        return json;
    }

    //==================================
    // DEV FUNCTION
    //==================================

    showDependencies() {
        console.log(JSON.stringify(this.createDependencies()));
    }

    createDependencies() {
        throw new Error("This needs to be rewritten, probably in Model rather than here.")
        //for one thing I removed the model instance from componentInfo in the component map
        //instead I should just read all the members from the model.

        // let model = this.getField("model");
        // var memberInfo = {};

        // let componentMap = this.getField("componentMap");

        // for(var key in componentMap) {
        //     var componentInfo = componentMap[key];
        //     if((componentInfo)&&(componentInfo.member)) {


        //         var member = componentInfo.member;

        //         var memberStruct = {};
        //         memberStruct.type = member.constructor.generator.type;
        //         var parentMember = member.getParentMember(model);
        //         memberStruct.parent = parentMember ? parentMember.getFullName(model) : null;

        //         if(member.isDependent) {
        //             let depList = [];
        //             let dependsOnMap = member.getDependsOn();
        //             for(var idString in dependsOnMap) {
        //                 dependencyType = dependsOnMap[idString];
        //                 if(dependencyType == apogeeutil.NORMAL_DEPENDENCY) {
        //                     let dependency = model.lookupMemberById(idString);
        //                     depList.push(dependency.getFullName(model));
        //                 }
        //             }
        //             if(depList.length > 0) {
        //                 memberStruct.dep = depList;
        //             }
        //         }

        //         memberInfo[member.getFullName(model)] = memberStruct;
        //     }
        // }

        // return memberInfo;
    }

}

//this is the json for an empty model
ModelManager.EMPTY_MODEL_COMPONENT_JSON = {
    "main": {
        "type":"apogeeapp.PageComponent"
    }
};

/** This class manages the workspace. */
class WorkspaceManager extends FieldObject {

    constructor(app,instanceToCopy,keepUpdatedFixed) {
        super("workspaceManager",instanceToCopy,keepUpdatedFixed);

        this.app = app;
        
        //==============
        //Fields
        //==============
        //Initailize these if this is a new instance
        if(!instanceToCopy) {
            let modelManager = new ModelManager(this.app);
            this.setField("modelManager",modelManager);

            let referenceManager = new ReferenceManager(this.app);
            this.setField("referenceManager",referenceManager);

            //this is not a field like above because when we do not require a command to change it
            this.fileMetadata = null;

            //temporary
            this.created = true;
        }
        else {
            //this is not a field like above because when we do not require a command to change it
            this.fileMetadata = instanceToCopy.fileMetadata;

            //temporary
            this.created = false;
        }

        //==============
        //Working variables
        //==============
        this.viewStateCallback = null;
        this.cachedViewState = null;

        //listen to the workspace dirty event from the app
        this.app.addListener("workspaceDirty",() => this.setIsDirty());

        this.isClosed = false;
    }

    //====================================
    // Workspace Management
    //====================================

    /** This gets the application instance. */
    getApp() {
        return this.app;
    }

    /** This method returns a mutable copy of this instance. If the instance is already mutable
     * it will be returned rather than making a new one.  */
    getMutableWorkspaceManager() {
        if(this.getIsLocked()) {
            //create a new instance that is a copy of this one
            return new WorkspaceManager(this.app,this);
        }
        else {
            //return this instance since it si already unlocked
            return this;
        }
    }

    // temporary implementation
    getChangeMap() {
        let changeMap = {};
        //workspace always changes
        let workspaceManagerEvent;
        if(this.isClosed) workspaceManagerEvent = "workspaceManager_deleted";
        else if(this.created)  workspaceManagerEvent = "workspaceManager_created";
        else workspaceManagerEvent = "workspaceManager_updated";
        changeMap[this.getId()] = {action: workspaceManagerEvent, instance: this};

        let referenceManager = this.getReferenceManager();
        let referenceChangeMap = referenceManager.getChangeMap();
        if(referenceChangeMap) Object.assign(changeMap,referenceChangeMap);

        let modelManager = this.getModelManager();
        let modelChangeMap = modelManager.getChangeMap();
        if(modelChangeMap) Object.assign(changeMap,modelChangeMap);

        return changeMap;
    }

    /** This method locks this workspace instance and all the contained object instances. */
    lockAll() {
        //we maybe shouldn't be modifying the members in place, but we will do it anyway
        this.getReferenceManager().lockAll();
        this.getModelManager().lockAll();
        this.lock();
    }

    getReferenceManager() {
        return this.getField("referenceManager");
    }

    /** This method returns an unlocked reference manager instance. If the current
     * reference manager is unlocked it will return that. Otherwise it will return
     * a new unlocked instance that will also be set as the current instance. */
    getMutableReferenceManager() {
        let oldReferenceManager = this.getReferenceManager();
        if(oldReferenceManager.getIsLocked()) {
            //create a new instance that is a copy of this one
            let newReferenceManager = new ReferenceManager(this.app,oldReferenceManager);
            this.setField("referenceManager",newReferenceManager);
            return newReferenceManager;
        }
        else {
            //return this instance since it si already unlocked
            return oldReferenceManager;
        }
    }

    getModelManager() {
        return this.getField("modelManager");
    }

    /** This method returns an unlocked model manager instance. If the current
     * model manager is unlocked it will return that. Otherwise it will return
     * a new unlocked instance that will also be set as the current instance. */
    getMutableModelManager() {
        let oldModelManager = this.getModelManager();
        if(oldModelManager.getIsLocked()) {
            //create a new instance that is a copy of this one
            let newModelManager = new ModelManager(this.app,oldModelManager);
            this.setField("modelManager",newModelManager);
            return newModelManager;
        }
        else {
            //return this instance since it si already unlocked
            return oldModelManager;
        }
    }

    getIsDirty() {
        return this.isDirty;
        
    }
    
    setIsDirty() {
        this.isDirty = true;
    }
    
    clearIsDirty() {
        this.isDirty = false;
    }

    getIsClosed() {
        return this.isClosed;
    }
    
    
    //====================================
    // asynch run context methods
    //====================================
    runFutureCommand(commandData) {
        //run command asynchronously
        setTimeout(() => this.app.executeCommand(commandData),0);
    }

    getModelRunContext() {
        let modelRunContext = {};
        modelRunContext.doAsynchActionCommand = (modelId,action) => {
            //create a command to run this action
            let modelActionCommand = {};
            modelActionCommand.type = "futureModelActionCommand";
            modelActionCommand.modelId = modelId;
            modelActionCommand.action = action;

            //execut this command as a future command
            this.runFutureCommand(modelActionCommand);
        };

        return modelRunContext;
    }

    //====================================
    // configuration
    //====================================

    /** This retrieves the file metadata used to save the file. */
    getFileMetadata() {
        return this.fileMetadata;
    }

    /** This method should be used to update the file metadata for the workspace, such as after the file is saved. */
    setFileMetadata(fileMetadata) {
        this.fileMetadata = fileMetadata;
    }

    //====================================
    // open and save methods
    //====================================

    setViewStateCallback(viewStateCallback) {
        this.viewStateCallback = viewStateCallback;
    }

    getCachedViewState() {
        return this.cachedViewState;
    }

    /** This saves the workspace. It the optionalSavedRootFolder is passed in,
     * it will save a workspace with that as the root folder. */
    toJson(optionalSavedRootFolder) {
        var json = {};
        json.fileType = "apogee app js workspace";

        json.version = WorkspaceManager.FILE_VERSION;

        json.references = this.getReferenceManager().toJson();

        json.code = this.getModelManager().toJson(optionalSavedRootFolder);

        if(this.viewStateCallback) {
            this.cachedViewState = this.viewStateCallback();
            if(this.cachedViewState) json.viewState = this.cachedViewState;
        }

        return json;
    }

    
     /** This method sets the workspace. The argument workspaceJson should be included
      * if the workspace is not empty, such as when opening a existing workspace. It
      * contains the data for the component associated with each model member. For 
      * a new empty workspace the workspaceJson should be omitted. 
      * The argument fileMetadata is the file identifier if the workspace is opened from a file.
      * This will be used for the "save" function to save to an existing file. */
     load(json,fileMetadata) {

        //check file format
        if(json) {
            if(json.version != WorkspaceManager.FILE_VERSION) {
                let msg = "Version mismatch. Expected version " + WorkspaceManager.FILE_VERSION + ", Found version " + workspaceJson.version;
                alert(msg);
                throw new Error(msg);
            }
        }
        else {
            //create aan empty json to load
            json = {};
        }

        //store the file metadata
        this.fileMetadata = fileMetadata;

        //set the view state
        if(json.viewState !== undefined) {
            this.cachedViewState = json.viewState;
        }

        //check for references. If we have references we must load these before loading the model
        if(json.references) {
            //if there are references, load these before loading the model.
            //this is asynchronous so we must load the model in a future command
            let referenceManager = this.getReferenceManager();
            let referenceLoadPromise = referenceManager.load(this,json.references);

            let onReferencesLoaded = () => {
                //load references regardless of success or failure in loading references
                let loadModelCommand = {};
                loadModelCommand.type = "loadModelManager";
                loadModelCommand.json = json.code;
                this.runFutureCommand(loadModelCommand);
            };

            referenceLoadPromise.then(onReferencesLoaded);
        }
        else {
            //if there are not references we can load the model directly.
            let modelManager = this.getModelManager();
            modelManager.load(this,json.code);
        }
    }

    /** This method closes the workspace object. */
    close() {
        //close model manager
        let modelManager = this.getModelManager();
        modelManager.close();

        //close reference manager
        let referenceManager = this.getReferenceManager();
        referenceManager.close();

        //flag the workspace as closed
        this.isClosed = true;
    }

}

WorkspaceManager.FILE_VERSION = "0.60";


//=====================================
// Command Object
//=====================================

/*** 
 * This command loads the model manager. It is a follow on command to opening a workspace,
 * if there are references present, which must be loaded first.
 * 
 * commandData.type = "loadModelManager"
 * commandData.json = (json for the model/model manager)
 */

let loadmodelmanager = {};

//There is no undo command since this is a follow on to opening a workspace
//loadmodelmanager.createUndoCommand = function(workspaceManager,commandData) {

/** This method loads an existing, unpopulated model manager. It is intended only as
 * a asynchronous follow on command to opening a workspace, once any references have
 * been loaded.
 */
loadmodelmanager.executeCommand = function(workspaceManager,commandData) {
    let modelManager = workspaceManager.getMutableModelManager();
    return modelManager.load(workspaceManager,commandData.json);
};

loadmodelmanager.commandInfo = {
    "type": "loadModelManager",
    "targetType": "modelManager",
    "event": "updated"
};

CommandManager.registerCommand(loadmodelmanager);

/** @private */
let apogeeInstance = null;

//======================================
//class definition
//======================================

/** This is the main class of the apogee application. 
 * This constuctor should not be called externally, the static creation method 
 * should be used. This is a singlet.
 * 
 * @param appConfigManager - An instance of an AppConfigManager on configure the application.
 * 
 * @private */
class Apogee {

    constructor(appConfigManager) {

        //mixin initialization
        this.eventManagerMixinInit();
        
        //make sure we define this once
        if(apogeeInstance != null) {
            throw new Error("Error: There is already an Apogee app instance - the Apogee class is a singleton.");
        }
        else {
            apogeeInstance = this;
        }
        
        this.appConfigManager = appConfigManager;
        
        //---------------------------------
        //construct the base app structures
        //---------------------------------
        
        //workspace manager
        this.workspaceManager = null;
        
        //component generators
        this.componentClasses = {};
        this.standardComponents = [];
        //these are a list of names of components that go in the "added component" list
        this.additionalComponents = [];
        
        //default settings
        this.appSettings = {};
        
        //reference manager
        this.referenceManager = new ReferenceManager(this);
        
        //command manager
        this.commandManager = new CommandManager(this);
        
        //----------------------------------
        //configure the application
        //----------------------------------
        var appConfigPromise = this.appConfigManager.getConfigPromise(this);
        
        appConfigPromise.then(() => this.initApp()).catch(errorMsg => alert("Fatal error configuring application!"));
        
    }

    //======================================
    // static singleton methods
    //======================================

    /** This retrieves an existing instance. It does not create an instance. */
    static getInstance() {
        return apogeeInstance;
    }

    // /** This function initializes the default classes for the application. */
    // static setBaseClassLists(standardComponents, additionalComponents, errorComponentClass) {
    //     Apogee.standardComponents = standardComponents;
    //     Apogee.additionalComponents = additionalComponents;
    //     Apogee.errorComponentClass = errorComponentClass;
    // }

    //==================================
    // Workspace Management
    //==================================

    /** This method returns the active WorkspaceManager object. */
    getWorkspaceManager() {
        return this.workspaceManager;
    }

    createWorkspaceManager() {
        return new WorkspaceManager(this);
    }

    /** This method returns the active model object. */
    getModel() {
        if(this.workspaceManager) {
            return this.workspaceManager.getModelManager().getModel();
        }
        else {
            return null;
        }
    }

    /** This method makes an empty workspace object. This can be used to set the initial workspace
     * manager or to give the new instance of the workspace manager. However, if the workspace manager
     * is being updated it must have the same ID as the existing workspace manager or else an exception
     * will be thrown.
     */
    setWorkspaceManager(workspaceManager) {
        //we can only have one workspace of a given id
        if((this.workspaceManager)&&(this.workspaceManager.getId() != workspaceManager.getId())) {
            throw new Error("There is already an open workspace");
        }
        this.workspaceManager = workspaceManager;
        return true;
    }

    /** This method closes the active workspace. */
    clearWorkspaceManager() {
        //remove the workspace from the app
        this.workspaceManager = null;
        
        return true;
    }

    //====================================
    // Command Management
    //====================================

    /** This method should be called to execute commands. */
    executeCommand(command) {
        this.commandManager.executeCommand(command);
    }

    /** This method is intended for the UI for the undo/redo functionality */
    getCommandManager() {
        return this.commandManager;
    }

    /** This method returns true if the workspcae contains unsaved data. */
    getWorkspaceIsDirty() {
        if(this.workspaceManager) {
            return this.workspaceManager.getIsDirty();
        }
        else {
            return false;
        }
    }

    /** This method clears the workspace dirty flag. */
    clearWorkspaceIsDirty() {
        if(this.workspaceManager) {
            return this.workspaceManager.clearIsDirty();
        }
        else {
            return false;
        }
    }

    
    //======================================
    // configuration methods methods
    //======================================

    /** This method returns the app settings json. */
    getAppSettings() {
        return this.appSettings;
    }

    /** This mehod return the application ReferenceManager. */
    getAppReferenceManager() {
        return this.referenceManager;
    }

    /** This method sets the file access object. */
    setFileAccessObject(fileAccessObject) {
        this.fileAccessObject = fileAccessObject;
    }

    /** This method retrieves the file access object for the application. */
    getFileAccessObject() {
        return this.fileAccessObject;
    }



    //==================================
    // App Initialization
    //==================================

    /** This should be called to set any settings, if there are any. If there are
     * no settings, this may be omitted.
     * 
     * configJson format:
     * {
     *   "settings": { (settings json - settings keys with associated settings value) },
     *   "references": [ (array of references - same format as refernces in workspace.) ]
     * }
     * 
     * References may include self-installing modules, for example a custom file
     * access method or custom components. See info on self installing modules.
     */ 
    getConfigurationPromise(configJson) {   
        if(!configJson) return;
        
        //set the settings JSON
        this.appSettings = configJson.settings;
        if(!this.appSettings) this.appSettings = {};
        
        //load references
        var openEntriesPromise;
        if(configJson.references) {
            openEntriesPromise = this.referenceManager.getOpenEntriesPromise(configJson.references);
        }
        else {
            //instant resolve promise (with no meaningful return)
            openEntriesPromise = Promise.resolve();
        }
        
        var onLoadReferenceError = errorMsg => alert("Error setting application level modules - some functionality may not be available: " + errorMsg);
        
        //if there is an error loading the promise, print a mesage and continue.
        return openEntriesPromise.catch(onLoadReferenceError);
    }
        
    /** This completes application initialization after any settings have been set. 
     * @private
     * */    
    initApp() {
        
        //file accessor - load the default if it wasn't loaded in cofiguration
        if(!this.fileAccessObject) {
            this.fileAccessObject = this.appConfigManager.getDefaultFileAccessObject(this);
        }
        
        //open the initial workspace
        var workspaceFilePromise = this.appConfigManager.getInitialWorkspaceFilePromise(this);
        if(workspaceFilePromise) {
            var workspaceFileMetadata = this.appConfigManager.getInitialWorkspaceFileMetadata(this);
            
            var openInitialWorkspace = workspaceText => {
                let workspaceJson = JSON.parse(workspaceText);

                //open workspace
                var commandData = {};
                commandData.type = "openWorkspace";
                commandData.workspaceJson = workspaceJson;
                commandData.fileMetadata = workspaceFileMetadata;

                this.executeCommand(commandData);
            };
            
            workspaceFilePromise.then(openInitialWorkspace).catch(errorMsg => alert("Error downloading initial workspace: " + errorMsg));
        }
        
    }
}

//add mixins to this class
apogeeutil.mixin(Apogee,EventManager);


Apogee.DEFAULT_Workspace_NAME = "workspace";

/** 
 * This is a base class for workspace opening and saveing, or whatever actions
 * are appropriate. It should be extended to provide functionality.
 */
class BaseFileAccess {
    /**
     * Constructor
     */
    constructor() {
        
    }

    /** 
     * This method should return a list of menu options for opening and closing
     * the workspace. The format should be a array with each entry being a
     * two entry array. The first item is the menu entry text and the second 
     * is the callback for the menu item action. 
     * Example: [["Open",openCallback],["Save",saveCallback]]
     * */
    getWorkspaceOpenSaveMenuOptions(app) {
        
    }
    
    /**
     * This method returns fileMetadata appropriate for a new workspace.
     */
    getNewFileMetadata() {
        
    }

    //===============================
    // The following methods must be implmented by the extending class
    //===============================

    /**
     * This method returns true if the workspace has an existing file to which 
     * is can be saved without opening a save dialog. 
     */
    directSaveOk(fileMetadata) {
        return false;
    }
    
    /**
     * This method opens a file, including dispalying a dialog
     * to select the file.
     * arguments:
     * - onOpen(err,workspaceData,fileMetadata);
     * 
     * onOpen callback arguments:
     * - err - This is a string that will be populated if there was an error
     * - fileData - This is the file contents as a string
     * - fileMetadata - This is a implementation-defined structure that is used to store the file location.
     */
    //openFile(onOpen);

    /** This  method shows a save dialog and saves the file.
     * arguments:
     * - fileMetadata - This is a implementation-defined structure that is used to store the file location.
     * - fileData - This is the file contents as a string
     * - onSave(err,fileSaved,fileMetadata);
     * 
     * onSave callback arguments:
     * - err - This is a string that will be populated if there was an error
     * - fileSaved - This is boolean telling if the file was saved.
     * - fileMetadata - This is a implementation-defined structure that gives the saved file location.
     */
    //saveFileAs(fileMetadata,data,onSave);

    /** This  method directly saves the file without letting the user select the location.
     * arguments:
     * - fileMetadata - This is a implementation-defined structure that is used to store the file location.
     * - fileData - This is the file contents as a string
     * - onSave(err,fileSaved,fileMetadata);
     * 
     * onSave callback arguments:
     * - err - This is a string that will be populated if there was an error
     * - fileSaved - This is boolean telling if the file was saved.
     * - fileMetadata - This is a implementation-defined structure that gives the saved file location.
     */
    //saveFile(fileMetadata,data,onSave);


}

/** Add Component Command
 *
 * Command JSON format:
 * {
 *   "type":"addComponent",
 *   "parentId":(parent ID),
 *   "memberJson":(member property json),
 *   "componentJson":(component property json)
 * }
 */ 

let addcomponent = {};

//=====================================
// Command Object
//=====================================

addcomponent.createUndoCommand = function(workspaceManager,commandData) {
    
    var undoCommandJson = {};
    undoCommandJson.type = "deleteComponent";
    undoCommandJson.parentId = commandData.parentId;
    undoCommandJson.memberName = commandData.memberJson.name;
    
    return undoCommandJson;
};

addcomponent.executeCommand = function(workspaceManager,commandData) { 
    
    let modelManager = workspaceManager.getMutableModelManager();
    let model = modelManager.getMutableModel();

    //create the member
    let createAction = {};
    createAction.action = "createMember";
    createAction.parentId = commandData.parentId;
    createAction.createData = commandData.memberJson;
    let actionResult = doAction(model,createAction);
    
    //create the components for the member
    //I need error handling for the create component action
    if(actionResult.actionDone) {
        //this is a bit clumsy...
        let parentMember = model.lookupMemberById(commandData.parentId);
        let name = commandData.memberJson.name;
        let componentMember = parentMember.lookupChild(model,name);
        modelManager.createComponentFromMember(componentMember,commandData.componentJson);
    }
    else {
        throw new Error("Failure creating member: " + actionResult.errorMsg);
    }
};

addcomponent.commandInfo = {
    "type": "addComponent",
    "targetType": "component",
    "event": "created"
};

CommandManager.registerCommand(addcomponent);

/** Add Link Command
 *
 * Command JSON format:
 * {
 *   "type":"addLink",
 *   "entryType":(entry type),
 *   "url":(url),
 *   "nickname":(nickname - optional)
 * }
 */ 
let addlink = {};

//=====================================
// Command Object
//=====================================

addlink.createUndoCommand = function(workspaceManager,commandData) {
    var undoCommandJson = {};
    undoCommandJson.type = "deleteLink";
    undoCommandJson.entryType = commandData.entryType;
    undoCommandJson.url = commandData.url;
    return undoCommandJson;
};

addlink.executeCommand = function(workspaceManager,commandData) {
    let referenceManager = workspaceManager.getMutableReferenceManager();
    //this creates the entry but does not load it
    let referenceEntry = referenceManager.createEntry(commandData);
    //this loads the entry - it will cause an asynchronouse command on completion
    referenceEntry.loadEntry(workspaceManager);
};

addlink.commandInfo = {
    "type": "addLink",
    "targetType": "link",
    "event": "created"
};

CommandManager.registerCommand(addlink);

let closeworkspace = {};

//=====================================
// Action
//=====================================

//NO UNDO FOR CLOSE Workspace
//closeworkspace.createUndoCommand = function(workspaceManager,commandData) {

closeworkspace.executeCommand = function(workspaceManager,commandData) {
    workspaceManager.close();
};

closeworkspace.commandInfo = {
    "type": "closeWorkspace",
    "targetType": "workspace",
    "event": "deleted"
};

CommandManager.registerCommand(closeworkspace);

let compoundcommand = {};

//=====================================
// Command Object
//=====================================

compoundcommand.createUndoCommand = function(workspaceManager,commandData) {
    let undoCommandJson = {};
    undoCommandJson.type = compoundcommand.commandInfo.type;
    undoCommandJson.childCommands = [];
    
    //add the child undo commands in the reverse order
    for(var i = commandData.childCommands.length-1; i >= 0; i--) {
        let childCommandJson = commandData.childCommands[i];
        let childCommandObject = CommandManager.getCommandObject(childCommandJson.type);
        let childUndoCommandJson = childCommandObject.createUndoCommand(workspaceManager,childCommandJson);
        undoCommandJson.childCommands.push(childUndoCommandJson);
    }
    
    return undoCommandJson;
};

/** This method is used for updating property values from the property dialog. 
 * If there are additional property lines, in the generator, this method should
 * be extended to edit the values of those properties too. */
compoundcommand.executeCommand = function(workspaceManager,commandData) {
    //execute all child commands
    for(var i = 0; i < commandData.childCommands.length; i++) {
        let childCommandJson = commandData.childCommands[i];
        let childCommandObject = CommandManager.getCommandObject(childCommandJson.type);
        childCommandObject.executeCommand(workspaceManager,childCommandJson);
    }
};

compoundcommand.commandInfo = {
    "type": "compoundCommand",
};

CommandManager.registerCommand(compoundcommand);

let deletecomponent = {};

//=====================================
// Command Object
//=====================================

/*** 
 * This command supports two formats:
 * 
 * Format 1: member ID
 * commandData.type = "deleteComponent"
 * commandData.memberId = (memberId)
 * 
 * Format 2: parent ID, memberName
 * commandData.type = "deleteComponent"
 * commandData.parentId = (parentId)
 * commandData.memberName = (memberName)
 */
deletecomponent.createUndoCommand = function(workspaceManager,commandData) {
    
    //problems
    // - is this member a component main member?
    
    let modelManager = workspaceManager.getModelManager();
    var model = modelManager.getModel();
    let member;
    let parent;

    if(commandData.memberId) {
        member = model.lookupMemberById(commandData.memberId);
        parent = member.getParent(model);
    }
    else {
        parent = model.lookupMemberById(commandData.parentId);
        member = parent.lookupChild(commandData.memberName);
    }

    let componentId = modelManager.getComponentIdByMemberId(member.getId());
    let component = modelManager.getComponentByComponentId(componentId);
    
    var commandUndoJson = {};
    commandUndoJson.type = "addComponent";
    commandUndoJson.parentId = parent.getId();
    commandUndoJson.memberJson = member.toJson(model);
    commandUndoJson.componentJson = component.toJson(modelManager);
    
    return commandUndoJson;
};

/** This method deletes the component and the underlying member. It should be passed
 *  the model and the member full name. (We delete by name and model to handle
 *  undo/redo cases where the instance of the member changes.)
 */
deletecomponent.executeCommand = function(workspaceManager,commandData) {
    
    let modelManager = workspaceManager.getMutableModelManager();
    let model = modelManager.getMutableModel();

    var actionJson = {};
    actionJson.action = "deleteMember";

    if(commandData.memberId) {
        actionJson.memberId = commandData.memberId;
    }
    else {
        let parent = model.lookupMemberById(commandData.parentId);
        let member = parent.lookupChild(model,commandData.memberName);
        actionJson.memberId = member.getId();
    }
    
    var actionResult = doAction(model,actionJson);
    if(!actionResult.actionDone) {
        throw new Error("Error deleting component: " + actionResult.errorMsg);
    }
};

deletecomponent.commandInfo = {
    "type": "deleteComponent",
    "targetType": "component",
    "event": "deleted"
};

CommandManager.registerCommand(deletecomponent);

/** Delete Link Command
 *
 * Command JSON format:
 * {
 *   "type":"deleteLink",
 *   "entryType":(entry type),
 *   "url":(url)
 * }
 */ 
let deletelink = {};

//=====================================
// Command Object
//=====================================

deletelink.createUndoCommand = function(workspaceManager,commandData) {
    
    var nickname;

    var referenceManager = workspaceManager.getReferenceManager();
    var referenceEntry = referenceManager.lookupEntry(commandData.entryType,commandData.url);
    
    if(referenceEntry) nickname = referenceEntry.getNickname();

    var undoCommandJson = {};
    undoCommandJson.type = "addLink";
    undoCommandJson.entryType = commandData.entryType;
    undoCommandJson.url = commandData.url;
    undoCommandJson.nickname = nickname;
    
    return undoCommandJson;
};

deletelink.executeCommand = function(workspaceManager,commandData) {
    var referenceManager = workspaceManager.getMutableReferenceManager();
    
    //lookup entry
    let referenceEntry = referenceManager.lookupEntry(commandData.entryType,commandData.url);
    if(!referenceEntry) throw new Error("Reference entry not found. refEntryId: " + refEntryId);

    referenceEntry.removeEntry();
    referenceManager.unregisterRefEntry(referenceEntry);
};

deletelink.commandInfo = {
    "type": "deleteLink",
    "targetType": "link",
    "event": "deleted"
};

CommandManager.registerCommand(deletelink);

/**
 * This command is intended to run asynchronous commands, for which no undo is given.
 * The intention is that these commands are byproducts of a different action that will be
 * undone by undoing that different action. (NEED TO THINK ABOUT HOW THIS IS GARUNTEED)
 */

let futuremodelactioncommand = {};

//=====================================
// Command Object
//=====================================

/** NO UNDO - DANGEROUS. THIS IS MEANT ONLY FOR FUTURE ACTIONS. IIF SOMEONE USES
 * IT FOR A REGULAR ACTION THEN IT WILL NOT PROPERLY BE REVERSIBLE!!!
 */
//futuremodelactioncommand.createUndoCommand = function(workspaceManager,commandData) {};

/** This method deletes the component and the underlying member. It should be passed
 *  the model and the member full name. (We delete by name and model to handle
 *  undo/redo cases where the instance of the member changes.)
 */
futuremodelactioncommand.executeCommand = function(workspaceManager,commandData) {
    
    let modelManager = workspaceManager.getMutableModelManager();
    let model = modelManager.getMutableModel();

    var actionResult = doAction(model,commandData.action);
    if(!actionResult.actionDone) {
        throw new Error("Error in model action command: " + actionResult.errorMsg);
    }
};

futuremodelactioncommand.commandInfo = {
    "type": "futureModelActionCommand",
    "targetType": "component",
    "event": "unknown :-)"
};

CommandManager.registerCommand(futuremodelactioncommand);

let movecomponent = {};

//=====================================
// Action
//=====================================


/** This creates the command. Both the initial and full names should be passed in 
 * even is they are the same. */
movecomponent.createUndoCommand = function(workspaceManager,commandData) {
    let modelManager = workspaceManager.getModelManager();
    var model = modelManager.getModel();
    var member = model.lookupMemberById(commandData.memberId);
    var parent = member.getParent(model);
    var oldMemberName = member.getName();
    
    var undoCommandJson = {};
    undoCommandJson.type = movecomponent.commandInfo.type;
    undoCommandJson.memberId = commandData.memberId;
    undoCommandJson.newMemberName = oldMemberName;
    undoCommandJson.newParentId = parent.getId();
    
    return undoCommandJson;
};

movecomponent.executeCommand = function(workspaceManager,commandData) {
    
    let modelManager = workspaceManager.getMutableModelManager();
    let model = modelManager.getMutableModel();

    var actionData = {};
    actionData.action = "moveMember";
    actionData.memberId = commandData.memberId;
    actionData.targetName = commandData.newMemberName;
    actionData.targetParentId = commandData.newParentId;

    let actionResult = doAction(model,actionData);
    if(!actionResult.actionDone) {
        throw new Error("Error moving member: " + actionResult.errorMsg);
    }
};

movecomponent.commandInfo = {
    "type": "moveComponent",
    "targetType": "component",
    "event": "updated"
};

CommandManager.registerCommand(movecomponent);

/** Open Workspace Command
 *
 * Command JSON format:
 * {
 *   "type":"openWorkspace",
 *   "workspaceJson":(workspace JSON),
 *   "fileMetadata":(file metadata)
 * }
 */ 
let openworkspace = {};

//=====================================
// Action
//=====================================

//NO UNDO FOR OPEN Workspace
//openworkspace.createUndoCommand = function(workspaceManager,commandData) {

openworkspace.executeCommand = function(workspaceManager,commandData) {
    workspaceManager.load(commandData.workspaceJson,commandData.fileMetadata);
};

openworkspace.commandInfo = {
    "type": "openWorkspace",
    "targetType": "workspace",
    "event": "created"
};

CommandManager.registerCommand(openworkspace);

/** This file contains some methods for creating commands to do updates for component members.
 * There are 
 */



/** This method can be called to create a undo function to return a member to the current state
 * following a code or data update. */
function getMemberStateUndoCommand(model, memberId) {
    
    var member = model.lookupMemberById(memberId);
    var command = {};
    
    if((member.isCodeable)&&(member.hasCode())) {
        //check if the current state has code set - if so, set the code for the undo function
        command.type = "saveMemberCode";
        command.argList = member.getArgList();
        command.functionBody = member.getFunctionBody();
        command.supplemental = member.getSupplementalCode();      
    }
    else {
        command.type = "saveMemberData";
        
        //here the object has data set. Check if an "alternate" data values was set - error, pending or invalid
        let state = member.getState();
        if(state == apogeeutil.STATE_ERROR) {
            //member has an error
            let errors = member.getErrors();
            //Fix this to save all the 
            command.data = errors[0];
            
        }
        else if(state == apogeeutil.STATE_INVALID) {
            //result is invalid - set value to invalid in undo
            command.data = apogeeutil.INVALID_VALUE;
        }
        else if(state == apogeeutil.STATE_PENDING) {
            //we have a pending promise. use it for the command
            commandData = member.getPendingPromise();
        }
        else {
            //normal data case
            command.data = member.getData();
        }
    }

    command.memberId = memberId;
    
    return command;
}




/** @private */
function getSaveDataAction(model,memberId,data) {

    var actionData = {};
    actionData.action = "updateData";
    actionData.memberId = memberId;
    actionData.data = data;
    return actionData;
}

function getSetCodeAction$1(model,memberId,argList,functionBody,supplementalCode,optionalClearCodeDataValue) {
     
    var actionData = {};

    if((optionalClearCodeDataValue != undefined)&&(functionBody == "")&&(supplementalCode == "")) {
        //special case - clear code
        actionData.action = "updateData";
        actionData.memberId = memberId;
        actionData.data = optionalClearCodeDataValue;
    }
    else {
        //standard case - edit code
        actionData.action = "updateCode";
        actionData.memberId = memberId;
        actionData.argList = argList;
        actionData.functionBody = functionBody;
        actionData.supplementalCode = supplementalCode;  
    }

    return actionData;
}

/** Save Member Data Command
 *
 * Command JSON format:
 * {
 *   "type":"saveMembeData",
 *   "memberId":(main member ID),
 *   "argList":(argument list json array),
 *   "functionBody":(function body)
 *   "supplementalCode":(supplementalCode code - optional)
 *   "clearCodeDataValue":(value to set data is code cleared - optional)
 * }
 */ 
let savemembercode = {};

//=====================================
// Action
//=====================================

savemembercode.createUndoCommand = function(workspaceManager,commandData) {
    let modelManager = workspaceManager.getModelManager();
    let model = modelManager.getModel();
    var undoCommandJson = getMemberStateUndoCommand(model,commandData.memberId); 
    return undoCommandJson;
};

savemembercode.executeCommand = function(workspaceManager,commandData) {
    
    let modelManager = workspaceManager.getMutableModelManager();
    let model = modelManager.getMutableModel();
    
    var actionData = getSetCodeAction$1(model,
        commandData.memberId,
        commandData.argList,
        commandData.functionBody,
        commandData.supplementalCode,
        commandData.clearCodeDataValue);
    
    var actionResult = doAction(model,actionData);
    if(!actionResult.actionDone) {
        throw new Error("Error saving member code: " + actionResult.errorMsg);
    }
};

savemembercode.commandInfo = {
    "type": "saveMemberCode",
    "targetType": "component",
    "event": "updated"
};

CommandManager.registerCommand(savemembercode);

/** Compound Update Member Command
*
* Command JSON format:
* {
*   "type":"saveMemberCompound",
*   "updateList": [
*          {    //for data update entry
*              "memberId": (member id),
*              "data": (member data value)
*          },
*          {    //for code update entry
*               "memberId": (member id),
 *              "argList":(argument list json array),
 *              "functionBody":(function body)
 *              "supplementalCode":(supplementalCode code - optional)
 *              "clearCodeDataValue":(value to set data is code cleared - optional)
*          }
*    ]
* }
*/


let savemembercompound = {};

savemembercompound.createUndoCommand = function(workspaceManager,commandData) {
    let modelManager = workspaceManager.getModelManager();
    let model = modelManager.getModel();

    let undoCommandJson = {};
    undoCommandJson.type = "saveMemberCompound";
    //each entry looks like the associated command, but with "type" removed
    undoCommandJson.updateList = commandData.updateList.forEach( updateEntry => {
        let childUndoUpdateEntry = getMemberStateUndoCommand(model,updateEntry.memberId);
        //the udpate entry is identical to he command without the type, so we will just delete it
        delete childUndoUpdateEntry.type;
        return childUndoUpdateEntry;
    }); 
    return undoCommandJson;
};

savemembercompound.executeCommand = function(workspaceManager,commandData) {
    let modelManager = workspaceManager.getMutableModelManager();
    let model = modelManager.getMutableModel();
    
    let actionData = {};
    actionData.action = "compoundAction";
    actionData.actions = commandData.updateList.map( updateEntry => {
        if(updateEntry.data != undefined) {
            return getSaveDataAction(model,
                updateEntry.memberId,
                updateEntry.data);
        }
        else if(updateEntry.functionBody != undefined) {
            return getSetCodeAction(model,
                updateEntry.memberId,
                updateEntry.argList,
                updateEntry.functionBody,
                updateEntry.supplementalCode,
                updateEntry.clearCodeDataValue);
        }
    });
    
    var actionResult = doAction(model,actionData);
    if(!actionResult.actionDone) {
        throw new Error("Error saving member data: " + actionResult.errorMsg);
    }
};

savemembercompound.commandInfo = {
    "type": "saveMemberCompound",
    "targetType": "component",
    "event": "updated"
};

CommandManager.registerCommand(savemembercompound);

/** Save Member Data Command
 *
 * Command JSON format:
 * {
 *   "type":"saveMemberData",
 *   "memberId":(main member Id),
 *   "data":(member data value)
 * }
 */ 
let savememberdata = {};

//=====================================
// Action
//=====================================

savememberdata.createUndoCommand = function(workspaceManager,commandData) {
    let modelManager = workspaceManager.getModelManager();
    let model = modelManager.getModel();
    var undoCommandJson = getMemberStateUndoCommand(model,commandData.memberId); 
    return undoCommandJson;
};

savememberdata.executeCommand = function(workspaceManager,commandData) {
    let modelManager = workspaceManager.getMutableModelManager();
    let model = modelManager.getMutableModel();
    
    var actionData = getSaveDataAction(model,commandData.memberId,commandData.data);
    
    var actionResult = doAction(model,actionData);
    if(!actionResult.actionDone) {
        throw new Error("Error saving member data: " + actionResult.errorMsg);
    }
};

savememberdata.commandInfo = {
    "type": "saveMemberData",
    "targetType": "component",
    "event": "updated"
};

CommandManager.registerCommand(savememberdata);

/** Update Component Command
 *
 * Command JSON format:
 * {
 *   "type":"updateComponent",
 *   "memberId":(main member ID),
 *   "updatedMemberProperties":(member property json),
 *   "updatedComponentProperties":(component property json)
 * }
 */ 
let updatecomponent = {};

//=====================================
// Command Object
//=====================================

updatecomponent.createUndoCommand = function(workspaceManager,commandData) {
    let modelManager = workspaceManager.getModelManager();
    let model = modelManager.getModel();
    var member = model.lookupMemberById(commandData.memberId);
    var componentId = modelManager.getComponentIdByMemberId(commandData.memberId);
    var component = modelManager.getComponentByComponentId(componentId);

    var originalMemberProperties = {};
    if(member.constructor.generator.readProperties) member.constructor.generator.readProperties(member,originalMemberProperties);
    var originalComponentProperties = {};
    if(component.readExtendedProperties) component.readExtendedProperties(originalComponentProperties);
    
    var undoMemberProperties;
    var undoComponentProperties;
    
    if(commandData.updatedMemberProperties) {
        undoMemberProperties = {};
        for(var propKey in commandData.updatedMemberProperties) {
            undoMemberProperties = originalMemberProperties[propKey];
        }
    }
    
    if(commandData.updatedComponentProperties) {
        undoComponentProperties = {};
        for(var propKey in commandData.updatedComponentProperties) {
            undoComponentProperties = originalComponentProperties[propKey];
        }
    }
    
    var undoCommandJson = {};
    undoCommandJson.type = updatecomponent.commandInfo.type;
    undoCommandJson.memberId = commandData.memberId;
    if(undoMemberProperties) undoCommandJson.updatedMemberProperties = undoMemberProperties;
    if(undoComponentProperties) undoCommandJson.updatedComponentProperties = undoComponentProperties;
    
    return undoCommandJson;
};

/** This method is used for updating property values from the property dialog. 
 * If there are additional property lines, in the generator, this method should
 * be extended to edit the values of those properties too. */
updatecomponent.executeCommand = function(workspaceManager,commandData) {
    
    let modelManager = workspaceManager.getMutableModelManager();
    //wait to get a mutable model instance only if we need it
    let model = modelManager.getModel();
    var member = model.lookupMemberById(commandData.memberId);
    var componentId = modelManager.getComponentIdByMemberId(commandData.memberId);
    var component = modelManager.getMutableComponentByComponentId(componentId);
    
    //create an action to update an member additional properties
    var memberGenerator = member.constructor.generator;
    let actionResult;
    if(memberGenerator.getPropertyUpdateAction) {
        var actionData = memberGenerator.getPropertyUpdateAction(member,commandData.updatedMemberProperties);  
        if(actionData) {
            //get a new, mutable model instance here
            model = modelManager.getMutableModel();
            actionResult = doAction(model,actionData);
            if(!actionResult.actionDone) {
                throw new Error("Error updating member properties: " + actionResult.errorMsg);
            }
        }
    }
 
    //update an component additional properties
    component.loadPropertyValues(commandData.updatedComponentProperties);
};

updatecomponent.commandInfo = {
    "type": "updateComponent",
    "targetType": "component",
    "event": "updated"
};

CommandManager.registerCommand(updatecomponent);

/** Update Link Command
 *
 * Command JSON format:
 * {
 *   "type":"updateLink",
 *   "entryType":(entry type),
 *   "oldUrl":(original url),
 *   "newUrl":(new url - optional),
 *   "newNickname":(new nickname - optional)
 * }
 */ 
let updatelink = {};


updatelink.createUndoCommand = function(workspaceManager,commandData) {
    var undoCommandJson = {};
    undoCommandJson.type = updatelink.commandInfo.type;
    
    undoCommandJson.entryType = commandData.entryType;
    undoCommandJson.oldUrl = commandData.newUrl;
    
    if(commandData.newUrl != commandData.oldUrl) undoCommandJson.newUrl = commandData.oldUrl;
    
    if(commandData.newNickname !== undefined) {
        //look up the pre-command entry (we change back gto this)
        var referenceManager = workspaceManager.getReferenceManager();
        var referenceEntry = referenceManager.lookupEntry(commandData.entryType,commandData.oldUrl);
        if((referenceEntry)&&(commandData.newNickname != referenceEntry.getNickname())) {
            undoCommandJson.newNickname = referenceEntry.getNickname();
        }
    }
    
    return undoCommandJson;
};

updatelink.executeCommand = function(workspaceManager,commandData) {
    let referenceManager = workspaceManager.getMutableReferenceManager();

    let refEntryId = referenceManager.lookupRefEntryId(commandData.entryType,commandData.oldUrl);
    if(!refEntryId) throw new Error("Reference entry not found. " + entryType + ":" + url);

    let referenceEntry = referenceManager.getMutableRefEntryById(refEntryId);
    if(!referenceEntry) throw new Error("Reference entry not found. refEntryId: " + refEntryId);

    //update entry
    let targetUrl = (commandData.newUrl !== undefined) ? commandData.newUrl : referenceEntry.getUrl();
    let targetNickname = (commandData.newNickname !== undefined) ? commandData.newNickname : referenceEntry.getNickname();
    referenceEntry.updateData(workspaceManager,targetUrl,targetNickname);

    referenceManager.registerRefEntry(referenceEntry);
};

updatelink.commandInfo = {
    "type": "updateLink",
    "targetType": "component",
    "event": "updated"
};

CommandManager.registerCommand(updatelink);

/** Update Workspace Command
 *
 * Command JSON format:
 * {
 *   "type":"updateWorkspace",
 *   "updatedCoreProperties":(member property json), //name only
 *   "updatedAppProperties":(component property json) //currently not used
 * }
 */ 
let updateworkspace = {};

//=====================================
// Action
//=====================================

updateworkspace.createUndoCommand = function(workspaceManager,commandData) {
    var undoCommandJson = {};
    undoCommandJson.type = updateworkspace.commandInfo.type;
    
    //right now we assume this is just a name update
    let modelManager = workspaceManager.getModelManager();
    let model = modelManager.getModel();
    undoCommandJson.updatedCoreProperties = {};
    undoCommandJson.updatedCoreProperties.name = model.getName();
    
    return undoCommandJson;
};

updateworkspace.executeCommand = function(workspaceManager,commandData) {
    
    let modelManager = workspaceManager.getMutableModelManager();
    let model = modelManager.getMutableModel();

    var actionResult;    
    var actionData;
    actionData = {};
    actionData.action = "updateModel";
    actionData.model = model;
    actionData.properties = commandData.updatedCoreProperties;

    actionResult = doAction(model,actionData);
    if(!actionResult.actionDone) {
        throw new Error("Error updating workspace: " + actionResult.errorMsg);
    }

    //update any workspace manager properties here - none for now
};

updateworkspace.commandInfo = {
    "type": "updateWorkspace",
    "targetType": "workspace",
    "event": "updated"
};

CommandManager.registerCommand(updateworkspace);

/** This class manages references for the web page.*/
class ReferenceEntry extends FieldObject {
    
    /** The reference data is a json entry with the referenceType, url and optionally nickname.
     * If this is a copy, the reference data wil be ignored and can be set to null. */
    constructor(referenceData,instanceToCopy,keepUpdatedFixed) {
        super("referenceEntry",instanceToCopy,keepUpdatedFixed);

        if(instanceToCopy) {
            this.referenceType = instanceToCopy.referenceType;
        }
        else {
            this.referenceType = referenceData.entryType;
        }

        //==============
        //Fields
        //==============
        //Initailize these if this is a new instance
        if(!instanceToCopy) {
            this.setField("url",referenceData.url);

            //we create in a pending state because the link is not loaded.
            this.setField("state",apogeeutil.STATE_PENDING);

            let nickname = referenceData.nickname;
            if(!nickname) nickname = NO_NICKNAME_EMPTY_STRING; 
            this.setField("nickname",nickname);
        }

        //==============
        //Working variables
        //==============
        this.viewStateCallback = null;
        this.cachedViewState = null;    
    }

    //---------------------------
    // references entry interface
    //---------------------------
    
    getEntryType() {
        return this.referenceType;
    }

    getState() {
        return this.getField("state");
    }

    getUrl() {
        return this.getField("url");
    }

    getNickname() {
        return this.getField("nickname");
    }

    getLabel() {
        let nickname = this.getNickname();
        return nickname ? nickname : this.getUrl();
    }

    getIsLabelUpdated() {
        //this will return true sometimes where there is no update to the label
        return this.areAnyFieldsUpdated(["url","nickname"]);
    }

    setViewStateCallback(viewStateCallback) {
        this.viewStateCallback = viewStateCallback;
    }

    getCachedViewState() {
        return this.cachedViewState;
    }



    ///////////////////////////////////////////////////////////////////////////

    /** This method loads the link onto the page. If passed, the onLoadComplete
     * callback will be called when load completes successfully or fails. */
    loadEntry(workspaceManager) {

        let entryLoadPromise = new Promise( (resolve,reject) => {

            //create load event handlers
            //on completion execute a command to update the link status
            let onLoad = () => {
                let commandData = {
                    type: "updateLinkLoadStatus",
                    entryType: this.referenceType,
                    url: this.getUrl(),
                    success: true
                };
                workspaceManager.runFutureCommand(commandData);
                //call resolve in any case
                resolve();
            };
            let onError = (error) => {
                //for osme on loads we get an event object with no error info
                //convert this to a string
                if(error instanceof Event) {
                    error = "Link load unsuccessful";
                }

                let commandData = {
                    type: "updateLinkLoadStatus",
                    entryType: this.referenceType,
                    url: this.getUrl(),
                    success: false,
                    error: error
                };
                workspaceManager.runFutureCommand(commandData);
                //call resolve in any case
                resolve();
            };

            this.implementationLoadEntry(onLoad,onError,workspaceManager);
        });

        return entryLoadPromise;
    }

    /** This method loads the link onto the page. It should call the 
     * appropriate callback on completion. */
    //implementationLoadEntry(onLoad,onError);
    
    /** This method removes the reference. It returns true if the link remove is successful. */
    //remove()
    
    
    ///////////////////////////////////////////////////////////////////////////

    /** This method loads the link onto the page. It returns a promise that
     * resolves when the link is loaded. */
    toJson() {
        var entryJson = {};
        entryJson.url = this.getUrl();
        if(this.nickname != NO_NICKNAME_EMPTY_STRING) entryJson.nickname = this.getNickname();
        entryJson.entryType = this.referenceType;
        return entryJson;
    }

    //-------------------------
    // Entry specific management methods
    //-------------------------

    /** This method removes and reloads the link, returning a promise. */
    updateData(workspaceManager,url,nickname) {

        //update nickname
        if(!nickname) nickname = NO_NICKNAME_EMPTY_STRING;
        if(this.nickname != nickname) {
            this.setField("nickname",nickname);
        }

        //update url
        if(this.url != url) {
            this.removeEntry();
            this.setField("url",url);
            var promise = this.loadEntry(workspaceManager);
        }

        //if we didn't do a URL update, make a promise that says update was successful
        if(!promise) promise = Promise.resolve({
            cmdDone: true,
            target: this,
            eventAction: "updated"
        });

        return promise;
    }

    //===================================
    // private methods
    //===================================

    setClearState() {
        this.setState(apogeeutil.STATE_NORMAL);
    }

    setError(errorMsg) {
        this.setState(apogeeutil.STATE_ERROR,errorMsg);
    }

    setPendingState() {
        this.setState(apogeeutil.STATE_PENDING,"loading");
    }

    setState(state,msg) {
        if(this.state != state) {
            //for now we are not tracking msg. If we do, we should check for that change too
            this.setField("state",state);
        }
    }

}

//====================================
// Static Fields
//====================================


ReferenceEntry.ELEMENT_ID_BASE = "__apogee_link_element_";

let NO_NICKNAME_EMPTY_STRING = "";

//=====================================
// Status Commands
// These are commands run to update the status of the link after loading completes
//=====================================

/*
 *
 * Command JSON format:
 * {
 *   "type":"updateLinkLoadStatus",
 *   "entryType":(entry type),
 *   "url":(url),
 *   "success":(boolean),
 *   "error":(error object or error string - optional. Only used in the success=false case)
 * }
 * 
 */ 

let updatelinkstatus = {};

//No undo command. Only the original call needs to be undone.
//updatelinkstatus.createUndoCommand = function(workspaceManager,commandData) {

updatelinkstatus.executeCommand = function(workspaceManager,commandData) {
    
    var commandResult = {};
    var referenceManager = workspaceManager.getMutableReferenceManager();
    
    //lookup entry for this reference
    let refEntryId = referenceManager.lookupRefEntryId(commandData.entryType,commandData.url);
    let referenceEntry = referenceManager.getMutableRefEntryById(refEntryId);
    if(referenceEntry) {
        //update entry status
        //add event handlers
        if(commandData.success) {
            commandResult.cmdDone = true;
            referenceEntry.setClearState();
        }
        else {
            var errorMsg = "Failed to load link '" + referenceEntry.getUrl() + "':" + commandData.error.toString();
            console.error(errorMsg);
            referenceEntry.setError(errorMsg);
        }

        //save the updated entry
        referenceManager.registerRefEntry(referenceEntry);
    }
    else {
        //reference entry not found
        throw new Error("Reference entry not found: " + commandData.url);
    }
    
    return commandResult;
};

updatelinkstatus.commandInfo = {
    "type": "updateLinkLoadStatus",
    "targetType": "referenceEntry",
    "event": "updated"
};

CommandManager.registerCommand(updatelinkstatus);

/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
class EsModuleEntry extends ReferenceEntry {
    
    constructor(referenceList,referenceData) {
        super(referenceList,referenceData,EsModuleEntry.REFERENCE_TYPE_INFO);
    }
            
    /** This method loads the actual link. */
    implementationLoadEntry(onLoad,onError,workspaceManager) {
        let localOnLoad = (module) => {
            if(module) {
                if(module.initApogeeModule) module.initApogeeModule();
            
                let commandData = {
                    type: "setEsModule",
                    entryType: this.referenceType,
                    url: this.getUrl(),
                    module: module
                };
                workspaceManager.runFutureCommand(commandData);
                onLoad();
            }
            else {
                onError("Unknown error: Module not properly loaded. " + this.getUrl());
            }

        };

        //load the module
        var moduleLoadPromise = import(this.getUrl()).then(localOnLoad).catch(onError);
    }
    
    /** This method removes the link. This returns a command result for the removed link. */
    removeEntry() {
        //allow for an optional module remove step
        let module = this.getField("module");
        if(module) {
            if(module.removeApogeeModule) module.removeApogeeModule();
            this.clearField("module");
        }
        return true;
    }
    
}

EsModuleEntry.REFERENCE_TYPE = "es module";

//=====================================
//Load Module Command
// These are commands run to update the status of the link after loading completes
//=====================================

/*
 *
 * Command JSON format:
 * {
 *   "type":"setEsModule",
 *   "entryType":(entry type),
 *   "url":(url),
 *   "module":(the module),
 * }
 * 
 */ 

let setesmodule = {};

//No undo command. Only the original call needs to be undone.
//setesmodule.createUndoCommand = function(workspaceManager,commandData) {

setesmodule.executeCommand = function(workspaceManager,commandData) {
    
    let referenceManager = workspaceManager.getMutableReferenceManager();

    let refEntryId = referenceManager.lookupRefEntryId(commandData.entryType,commandData.url);
    if(!refEntryId) throw new Error("Reference entry not found. " + commandData.entryType + ":" + commandData.url);

    let referenceEntry = referenceManager.getMutableRefEntryById(refEntryId);
    if(!referenceEntry) throw new Error("Reference entry not found. refEntryId: " + refEntryId);
    
    referenceEntry.setField("module",commandData.module);
};

setesmodule.commandInfo = {
    "type": "setEsModule",
    "targetType": "referenceEntry",
    "event": "updated"
};

CommandManager.registerCommand(setesmodule);

/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
class NpmModuleEntry extends ReferenceEntry {
    
    constructor(referenceList,referenceData) {
        super(referenceList,referenceData,NpmModuleEntry.REFERENCE_TYPE_INFO);

    }

    /** This method loads the actual link. */
    implementationLoadEntry(onLoad,onError) {

        //synchronous loading
        try {
            let module = require(this.getUrl());
            if((module)&&(module.initApogeeModule)) module.initApogeeModule();
            this.setField("module",module);
            
            onLoad();
        }
        catch(error) {
            if(error.stack) console.error(error.stack);
            
            onError(errorMsg);
        }

    }
    
    /** This method removes the link. */
    removeEntry() {
        //allow for an optional module remove step
        let module = this.getField("module");
        if(module) {
            if(module.removeApogeeModule) module.removeApogeeModule();

            this.clearField("module");
        }
        
        //we aren't really removing it...
        //require.undef(this.url);

        return true;
    }
    
}

NpmModuleEntry.REFERENCE_TYPE = "npm module";

//---------------------------------
// Link Element Management - This manages DOM elements for links
//---------------------------------
class LinkLoader {
    /** 
     * This is a singleton and the constructor should not be called.
     * @private
     */
    constructor() {          
        this.scriptElements = [];
        this.cssElements = [];
        this.nextLinkCallerId = 1;
    }
    
    /** This returns a unique caller id which should bbe used when adding or removing
     * a link. This is done to allow mulitple callers to share a link.
     */
    createLinkCallerId() {
        return this.nextLinkCallerId++;
    }

    /** 
     * This method adds a link element to a page, supporting 'css' and 'script'. 
     * The caller identifer should be a unique identifier among people
     * requesting links of this given type. It cna be requested from
     * ReferenceEntry._createId
     * @protected
     */
    addLinkElement(type,url,linkCallerId,onLoad,onError) {
        try {
            var addElementToPage = false;
            var elementType;

            var elementList;
            if(type == "css") {
                elementList = this.cssElements;
                elementType = "link";
            }
            else if(type == "script") {
                elementList = this.scriptElements;
                elementType = "script";
            }
            else throw new Error("Unknown link type: " + type);

            var elementEntry = elementList[url];
            if(!elementEntry) {
                //create script element reference
                elementEntry = {};
                elementEntry.url = url;
                elementEntry.callerInfoList = [];

                //create script element
                var element = document.createElement(elementType);

                if(type == "css") {
                    element.href = url;
                    element.rel = "stylesheet";
                    element.type = "text/css";
                }
                else if(type == "script") {
                    element.src = url;
                }

                element.onload = () => {
                    elementEntry.callerInfoList.forEach(callerInfo => {if(callerInfo.onLoad) callerInfo.onLoad();});
                };
                element.onerror = (error) => {
                    elementEntry.callerInfoList.forEach(callerInfo => {if(callerInfo.onError) callerInfo.onError(error);});
                };

                elementEntry.element = element;
                elementList[url] = elementEntry;

                addElementToPage = true;  
            }

            //add this to the caller info only if it is not there
            if(!elementEntry.callerInfoList.some(callerInfo => (callerInfo.id == linkCallerId))) {
                var callerInfo = {};
                callerInfo.id = linkCallerId;
                if(onLoad) callerInfo.onLoad = onLoad;
                if(onError) callerInfo.onError = onError;

                elementEntry.callerInfoList.push(callerInfo);
            }

            if(addElementToPage) {
                document.head.appendChild(elementEntry.element);
            }
        }
        catch(error) {
            if(error.stack) console.error(error.stack);
            
            //error loading link  
            if(onError) {
                onError(error);
            }
            else {
                console.error(error.stack);
            }
        }

    }

    /** This method removes a link element from the page.
     * @protected */
    removeLinkElement(type,url,linkCallerId) {
        var elementList;
        if(type == "css") elementList = this.cssElements;
        else if(type == "script") elementList = this.scriptElements;
        else throw new Error("Unknown link type: " + type);

        var elementEntry = elementList[url];
        if(elementEntry) {
            //remove this caller from caller list
            elementEntry.callerInfoList = elementEntry.callerInfoList.filter(callerInfo => callerInfo.id != linkCallerId);

            //remove link if there are no people left using it
            if(elementEntry.callerInfoList.length === 0) {
                if(elementEntry.element) document.head.removeChild(elementEntry.element);
                delete elementList[url];
            }
        }
    }
}

//======================================
// static singleton methods
//======================================

/** @private */
let instance = null;

/** This retrieves the link loader instance. */
function getLinkLoader() {
    if(!instance) {
        instance = new LinkLoader();
    }
    return instance;
}

/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
class JsScriptEntry extends ReferenceEntry {
    
    constructor(referenceList,referenceData) {
        super(referenceList,referenceData,JsScriptEntry.REFERENCE_TYPE_INFO);

    }

    /** This method loads the actual link. */
    implementationLoadEntry(onLoad,onError) {
        this.linkCallerId = getLinkLoader().createLinkCallerId();
        getLinkLoader().addLinkElement("script",this.getUrl(),this.getId(),onLoad,onError);
    }
    
    /** This method removes the link. */
    removeEntry() {
        getLinkLoader().removeLinkElement("script",this.getUrl(),this.getId());
        return true;
    }
    
    _getLinkCallerHandle() {
        return "JsScriptEntry-" + this.getId();
    }
}

JsScriptEntry.REFERENCE_TYPE = "js link";

/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
class CssEntry extends ReferenceEntry {
    
    constructor(referenceList,referenceData) {
        super(referenceList,referenceData,CssEntry.REFERENCE_TYPE_INFO);
    }


    /** This method loads the actual link. */
    implementationLoadEntry(onLoad,onError) {
        this.linkCallerId = getLinkLoader().createLinkCallerId();
        getLinkLoader().addLinkElement("css",this.getUrl(),this.getId(),onLoad,onError);
    }

    
    /** This method removes the link. It returns true if the link is removed. */
    removeEntry() {
        getLinkLoader().removeLinkElement("css",this.getUrl(),this.getId());
        return true;
    }
}

CssEntry.REFERENCE_TYPE = "css link";

/** This file initializes the reference class types available. */

let referenceClassArray = [];
if(__APOGEE_ENVIRONMENT__ == "WEB") {
    referenceClassArray.push(EsModuleEntry);
    referenceClassArray.push(JsScriptEntry);
    referenceClassArray.push(CssEntry);
}
else if(__APOGEE_ENVIRONMENT__ == "NODE") {
    referenceClassArray.push(NpmModuleEntry);
}
else {
    console.log("Warning - apogee environment not recognized!");
}

ReferenceManager.setReferenceClassArray(referenceClassArray);

export { Apogee, BaseFileAccess, Component, componentInfo };
