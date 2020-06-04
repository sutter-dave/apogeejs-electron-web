// File: apogeeUiLib.es.js
// Version: 1.0.0-p1
// Copyright (c) 2016-2020 Dave Sutter
// License: MIT

import apogeeutil from './apogeeUtilLib.es.js';

/** This is the main apogeeapp ui file */
let uiutil = {};

/** This should be called to initializethe resource path. */
uiutil.initResourcePath = function(resourceDirectory) {
    uiutil.RESOURCE_DIR = resourceDirectory;
};

/** This retreives the resoruce path for a resource. */
uiutil.getResourcePath = function(relativePath) {
    return uiutil.RESOURCE_DIR + relativePath;
};

//I put some utilities in here. I shoudl figure out a better place to put this.

//=====================================
// ZIndex Constants
//=====================================
uiutil.MENU_ZINDEX = 100;
uiutil.WINDOW_FRAME_ZINIDEX = 10;
uiutil.DIALOG_ZINDEX = 200;

//======================================
// ID Generator
//======================================

uiutil.idIndex = 0;
uiutil.idBase = "_visiui_id_";

/** This method generates a generic id for dom elements. */
uiutil.createId = function() {
    return uiutil.idBase + uiutil.idIndex++;
};

//=========================================
// style methods
//=========================================

/** This method applies the style json to the dom element. */
uiutil.applyStyle = function(element,style) {
    for(var key in style) {
        element.style[key] = style[key];
    }
};

//=========================================
// resources
//=========================================

uiutil.MINIMIZE_CMD_IMAGE = "/minimize.png";
uiutil.RESTORE_CMD_IMAGE = "/restore.png";
uiutil.MAXIMIZE_CMD_IMAGE = "/maximize.png";
uiutil.CLOSE_CMD_IMAGE = "/close_gray.png";
uiutil.MENU_IMAGE = "/hamburger.png";

//=========================================
// dom methods
//=========================================


/** This method removes all the content from a DOM element. */
uiutil.removeAllChildren = function(element) {
	while(element.lastChild) {
		element.removeChild(element.lastChild);
	}
};

/** This method applies the style json to the dom element. All arguments
 * besides type are optional.
 * 
 * type is the element type
 * properties are javascript properties, 
 * styleProperties are the style properties
 * */
uiutil.createElement = function(type,properties,styleProperties) {
    var element = document.createElement(type);
    if(properties) {
        for(var key in properties) {
            element[key] = properties[key];
        }
    }
    if(styleProperties) {
        uiutil.applyStyle(element,styleProperties);
    }
    return element;
};

/** This method creates a DOM element of the given type, sets the class name
 * and, if present, adds it to the given parent. */
uiutil.createElementWithClass = function(elementType,className,parent) {
    var element = document.createElement(elementType);
    element.className = className;
    if(parent) parent.appendChild(element);
    return element;
};

//=========================================
// window and dialog methods
//=========================================

uiutil.dialogLayer = null;

uiutil.BASE_ELEMENT_STYLE = {
    "position":"absolute",
    "left":"0px",
    "right":"0px",
    "top":"0px",
    "bottom":"0px",
    "zIndex":1
};

uiutil.DIALOG_LAYER_STYLE = {
    "position":"absolute",
    "left":"0px",
    "right":"0px",
    "top":"0px",
    "bottom":"0px",
    "zIndex": 2,
    "pointerEvents": "none"
};

uiutil.DIALOG_SHIELD_STYLE = {
    "position":"absolute",
    "left":"0px",
    "right":"0px",
    "top":"0px",
    "bottom":"0px",
    "pointerEvents": "auto"
};
    
uiutil.initWindows = function(appElementId) {
    //create the ui elements from the app element
    var appContainer = document.getElementById(appElementId);
    if(!appContainer) {
        throw new Error("Container ID not found: " + appElementId);
    }
    
    var elements = {};
    elements.baseElement = uiutil.createElement("div",null,uiutil.BASE_ELEMENT_STYLE); 
    elements.dialogLayer = uiutil.createElement("div",null,uiutil.DIALOG_LAYER_STYLE);
    
    appContainer.appendChild(elements.baseElement);
    appContainer.appendChild(elements.dialogLayer);
    
    uiutil.dialogLayer = elements.dialogLayer;
    
    return elements;
};

uiutil.WINDOW_STATE_MINIMIZED = -1;
uiutil.WINDOW_STATE_NORMAL = 0;
uiutil.WINDOW_STATE_MAXIMIZED = 1;

//refers to minimized, restored or maximized
uiutil.WINDOW_STATE_CHANGED = "window state change";

uiutil.MINIMIZABLE = 0x01;
uiutil.MAXIMIZABLE = 0x02;
uiutil.CLOSEABLE = 0x04;

/** This is a handler name used to request closing the window, tab or other UI element. */
uiutil.REQUEST_CLOSE = "request_close";
uiutil.DENY_CLOSE = -1;

uiutil.CLOSE_EVENT = "closed";
uiutil.RESIZED_EVENT = "resized";
uiutil.SHOWN_EVENT = "shown";
uiutil.HIDDEN_EVENT = "hidden";

/** This function adds CSS data for a given member id. */
uiutil.setObjectCssData = function(objectId,cssText) {
    var cssElementId = "css_" + objectId;
    
    var cssElement = document.getElementById(cssElementId);
    if(cssText != "") {
        if(!cssElement) {
            cssElement = document.createElement("style");
            cssElement.id = cssElementId;
            document.head.appendChild(cssElement);
        }
        cssElement.innerHTML = cssText;
    }
    else {
        if(cssElement) {
            document.head.removeChild(cssElement);
        }
    }
};

//======================================
//window content types
//These are types of content that can be put in a window or other container. If is it 
//resizable it can be fitted to the window size. If it is fixed size it can be 
//added to a scrolling window or used to set the container size
//======================================
uiutil.RESIZABLE = 0x01;
uiutil.FIXED_SIZE = 0x02;

uiutil.SCROLL_NONE = 0x00;
uiutil.SCROLL_VERTICAL = 0x01;
uiutil.SCROLL_HORIZONTAL = 0x02;
uiutil.SCROLL_BOTH = 0x03;


//this is not an actual content type, but an option for displaying FIXED_SIZE content
uiutil.SIZE_WINDOW_TO_CONTENT = 0x03;

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

/** Thiis is a namespace with functions to control menu operation
 *
 * NOTE - the name Menu should probably be menu because this
 * is just a namespace and not a class, however when I converted this from a namespace
 * qualified by apogeeui, I didn't want to collide with local variables which are
 * often named "menu".
 *
 * @class 
 */
let Menu = {};

Menu.initialized = false;
Menu.activeMenu = null;

/** This method creates a static menu with the given text. */
Menu.createMenu = function(text) {

    //initialize menus, if needed
    if(!Menu.initialized) {
        Menu.initialize();
    }

    var element = uiutil.createElementWithClass("div", "visiui-menu-heading visiui-menu-text");
    element.innerHTML = text;
    return new MenuHeader(element);
};

/** This method creates a static menu from the given img url. */
Menu.createMenuFromImage = function(imageUrl) {

    //initialize menus, if needed
    if(!Menu.initialized) {
        Menu.initialize();
    }

    var imageElement = document.createElement("img");
    imageElement.src = imageUrl;
    var element = uiutil.createElementWithClass("div", "visiui-menu-heading visiui-menu-image");
    element.appendChild(imageElement);
    return new MenuHeader(element);
};

/** This method creates a context menu object. */
Menu.createContextMenu = function() {

    //initialize menus, if needed
    if(!Menu.initialized) {
        Menu.initialize();
    }

    return new MenuBody();
};

Menu.showContextMenu = function(menuBody,contextEvent) {
    //create menu and attach to document body
    menuBody.setPosition(contextEvent.clientX, contextEvent.clientY, document.body);
    //cacnel default popup
    contextEvent.preventDefault();
    //show
    Menu.show(menuBody);
};

Menu.menuHeaderPressed = function(menuHeader) {
	//if there is an active menu, pressing that header closes the active menu otherwise show the menu
	if(Menu.activeMenu === menuHeader) {
		//active menu - close the menu
		Menu.hideActiveMenu();
	}
	else {
		//no active menu, open this menu
		Menu.show(menuHeader.getMenuBody());
	}
};

Menu.nonMenuPressed = function() {
	//if the mouse is pressed outside the menu, close any active menu
	if(Menu.activeMenu) {
		Menu.hideActiveMenu();
	}
};

//================================
// Internal
//================================

Menu.show = function(menuBody) {
	if(Menu.activeMenu) {
		Menu.hideActiveMenu();
	}
	var parentElement = menuBody.getParentElement();
    menuBody.prepareShow();
    var menuElement = menuBody.getMenuElement();
    if((parentElement)&&(menuElement)) {
        parentElement.appendChild(menuElement);
        Menu.activeMenu = menuBody;
        //set the header to active
        var menuHeader = menuBody.getMenuHeader();
        if(menuHeader) {
            menuHeader.className = "visiui-menu-heading visiui-menu-heading-active";
        }
    }
};

Menu.hideActiveMenu = function() {
	if(Menu.activeMenu) {
        var activeMenu = Menu.activeMenu;
        //set the header to normal (not active)
        var menuHeader = activeMenu.getMenuHeader();
        if(menuHeader) {
            menuHeader.className = "visiui-menu-heading";
        }
        
        var parentElement = activeMenu.getParentElement();
        var menuElement = activeMenu.getMenuElement();
        if((parentElement)&&(menuElement)) {
            parentElement.removeChild(menuElement);
            Menu.activeMenu = null;
        }
        activeMenu.menuHidden();
	}
};

Menu.nonMenuMouseHandler = null;

Menu.initialize = function() {
	window.addEventListener("mousedown",Menu.nonMenuPressed);
	Menu.initialized = true;
};

/** This method allows you to undo the initialization actions. I am not sure you would ever need to do it. */
Menu.deinitialize = function() {
	window.removeEventListener("mousedown",Menu.nonMenuPressed);
	Menu.initialized = false;
};

//##################################################################################################


/** This is a menu component
 * This class shoudl only be constructed internally the Menu namespace. 
 * Before it is constructed, the Menu should be initialized.
 *
 * @class 
 */
class MenuBody {

    constructor() {
        
        //variables
        this.menuDiv = null;
        this.parentElement = null;
        
        this.menuItems = {};
        
        //construct the menu
        this.createMenuElement();
        
        //this will be set if it is a static menu
        this.menuHeader = null;
    }

    /** this returns the dom element for the menu object. */
    getMenuElement() {
        return this.menuDiv;
    }

    /** This returns the parent element for the menu.  */
    getParentElement() {
        return this.parentElement;
    }

    /** This returns the parent element for the menu.  */
    getMenuHeader() {
        return this.menuHeader;
    }

    /** This returns the parent element for the menu.  */
    getIsContext() {
        return (this.menuHeader == null);
    }

    /** This is called before the menu body is shown */
    prepareShow() {
        if(this.isOnTheFlyMenu) {
            this.constructItemsForShow();
        }
    }

    /** This is called after the menu body is hidden. */
    menuHidden() {
        if(this.isOnTheFlyMenu) {
            this.destroyItemsForHides();
        }
    }

    /** This method is used to attach the menu to the menu head, in a static menu. */
    attachToMenuHeader(menuHeader) {
        //attach menu to heading
        this.parentElement = menuHeader.getElement();
        this.menuDiv.style.left = "0%";
        this.menuDiv.style.top = "100%";
        this.menuHeader = menuHeader;
    }

    /** This method is used to set the position for a context menu. The x and y coordinates
     * should be the coordinates in the parent element. It is recommended to use the 
     * document body. */
    setPosition(x, y, parentElement) {
        this.parentElement = parentElement;
    
    //we need to calculate the size, so I add and remove it - there is probably another way
    parentElement.appendChild(this.menuDiv);
        var parentWidth = parentElement.offsetWidth;
        var parentHeight = parentElement.offsetHeight;
        var menuWidth = this.menuDiv.clientWidth;
        var menuHeight = this.menuDiv.clientHeight;
    parentElement.appendChild(this.menuDiv);

        //position
        if((x + menuWidth > parentWidth)&&(x > parentWidth/2)) {
            this.menuDiv.style.left = (x - menuWidth) + "px";
        }
        else {
            this.menuDiv.style.left = x + "px";
        }
        if((y + menuHeight > parentHeight)&&(y > parentHeight/2)) {
            this.menuDiv.style.top = (y - menuHeight) + "px";
        }
        else {
            this.menuDiv.style.top = y + "px";
        }
    }

    /** This sets a callback to create the menu when the menu is opened. This is
     * for static menus where we do not want to populate it ahead of time. */
    setAsOnTheFlyMenu(menuItemsCallback) {
        this.isOnTheFlyMenu = true;
        this.menuItemsCallback = menuItemsCallback;
    }

    /** this adds a menu item that dispatchs the given event when clicked. */
    addEventMenuItem(title, eventName, eventData, eventManager) {
        var itemInfo = {};
        itemInfo.title = title;
        itemInfo.eventName = eventName;
        itemInfo.eventData = eventData;
        itemInfo.eventManager = eventManager;
        this.addMenuItem(itemInfo);
    }

    /** this adds a menu item that dispatchs the given event when clicked. */
    addCallbackMenuItem(title, callback) {
        var itemInfo = {};
        itemInfo.title = title;
        itemInfo.callback = callback;
        this.addMenuItem(itemInfo);
    }
        
    /** this adds a menu item that dispatchs the given event when clicked. */
    addMenuItem(itemInfo) {
        itemInfo.element = uiutil.createElementWithClass("div","visiui-menu-item");
        itemInfo.element.innerHTML = itemInfo.title;
        
        if(itemInfo.childMenuItems) {
            //create a parent menu item
            var childMenuBody = this.createChildMenuBody(itemInfo.childMenuItems);
            var childMenuDiv = childMenuBody.getMenuElement();
            childMenuDiv.style.left = "100%";
            childMenuDiv.style.top = "0%";
            itemInfo.element.appendChild(childMenuDiv);
            
            //prevent normal action on a click
            itemInfo.element.onmousedown = (event) => {
                event.stopPropagation();
            };
            itemInfo.element.onclick = (event) => {
                event.stopPropagation();
            };
        }
        else {
            //create a norman (clickable) menu item
            itemInfo.element.onmousedown = (event) => {
                event.stopPropagation();
            };
            itemInfo.element.onclick = (event) => {
                //close menu
                Menu.hideActiveMenu();

                //do menu action
                if(itemInfo.eventName) {
                    //dispatch event
                    itemInfo.eventManager.dispatchEvent(itemInfo.eventName,itemInfo.eventData);
                }
                else if(itemInfo.callback) {
                    //use the callback
                    itemInfo.callback();
                }
                event.stopPropagation();
            };
        }
        
        this.menuDiv.appendChild(itemInfo.element);
        this.menuItems[itemInfo.title] = itemInfo;
    }

    /** this adds a menu item that dispatchs the given event when clicked. */
    setMenuItems(itemInfos) {
        for(var i = 0; i < itemInfos.length; i++) {
            this.addMenuItem(itemInfos[i]);
        }
    }

    /** this adds a menu item that dispatchs the given event when clicked. */
    removeMenuItem(title) {
        var itemInfo = this.menuItems[title];
        if(itemInfo) {
            this.menuDiv.removeChild(itemInfo.element);
            delete this.menuItems[title];
        }
    }

    /** this adds a menu item that dispatchs the given event when clicked. */
    removeAllMenuItems() {
        for(var title in this.menuItems) {
            this.removeMenuItem(title);
        }
    }

    //================================
    // Internal
    //================================

    /** This method creates the menu body that is shown below the header. */
    createMenuElement() {
        this.menuDiv = uiutil.createElementWithClass("div","visiui-menu-body");
    }

    constructItemsForShow () {
        if(this.menuItemsCallback) {
            var menuItems = this.menuItemsCallback();
            this.setMenuItems(menuItems);
        }
    }

    /** This is called after the menu body is hidden. */
    destroyItemsForHides() {
        if(this.menuDiv) {
            uiutil.removeAllChildren(this.menuDiv);
        }
        this.menuItems = {};
    }

    createChildMenuBody(menuItems) {
        var childMenuBody = new MenuBody();
        childMenuBody.setMenuItems(menuItems);
        return childMenuBody;
    }

}

//###########################################################################################################

/** This is a menu component, attached to the given dom element
 * This class shoudl only be constructed internally the Menu namespace. 
 * Before it is constructed, the Menu should be initialized.
 *
 * @class 
 */
class MenuHeader {

    constructor(domElement) {
        
        //variables
        this.domElement = domElement;
        this.menuBody = new MenuBody();
        
        //construct the menu
        this.initHeadingElement();
        
        //attach menu to heading
        this.menuBody.attachToMenuHeader(this);
    }

    /** this returns the dom element for the menu heading. */
    getElement() {
        return this.domElement;
    }

    /** this returns the dom element for the menu heading. */
    setChildLocation(childLocation) {
        this.childLocation = childLocation;
    }

    /** this returns the dom element for the menu heading. */
    getChildLocation() {
        return this.childLocation;
    }

    /** this returns the dom element for the menu object. */
    getMenuBody() {
        return this.menuBody;
    }

    /** this adds a menu item that dispatchs the given event when clicked. */
    addEventMenuItem(title, eventName, eventData, eventManager) {
        this.menuBody.addEventMenuItem(title,eventName, eventData, eventManager);
    }

    /** this adds a menu item that dispatchs the given event when clicked. */
    addCallbackMenuItem(title, callback) {
        this.menuBody.addCallbackMenuItem(title,callback);
    }

    /** this adds a menu item that dispatchs the given event when clicked. */
    addMenuItem(itemInfo) {
        this.menuBody.addMenuItem(itemInfo);
    }

    /** this adds a menu item that dispatchs the given event when clicked. */
    setMenuItems(itemInfos) {
        this.menuBody.setMenuItems(itemInfos);
    }

    /** this adds a menu item that dispatchs the given event when clicked. */
    removeMenuItem(title) {
        this.menuBody.removeMenuItem(title);
    }

    /** this adds a menu item that dispatchs the given event when clicked. */
    removeAllMenuItems() {
        this.menuBody.removeAllMenuItems();
    }

    /** This sets a callback to create the menu when the menu is opened. This is
     * for static menus where we do not want to populate it ahead of time. */
    setAsOnTheFlyMenu(getMenuItemsCallback) {
        this.menuBody.setAsOnTheFlyMenu(getMenuItemsCallback);
    }
    //================================
    // Init
    //================================

    /** this adds a menu item that dispatchs the given event when clicked. */
    initHeadingElement() {	
        this.domElement.onmousedown = (e) => {
            Menu.menuHeaderPressed(this);
            e.stopPropagation();
        };	
    }

}

/** This is a window frame component. IT is used the table window and the dialog.
 *
 * It can be minimized an maximized and dragged and resized with the mouse.  
 * 
 * options:
 * minimizable - allow content to be minimized. defaylt value: false
 * maximizable - allow content to be maximized. default value: false
 * closable - display a close button. defalt value: false
 * resizable- allow resizing window with mouse. default vlue: false
 * movable - allow moving window with mouse. default value : false
 *
 * @class 
 */
class WindowFrame {

    constructor(options) {
        //mixin initialization
        this.eventManagerMixinInit();
        
        //set the options
        if(!options) {
            options = {};
        }
        
        //variables
        this.windowParent = null;
        this.parentElement = null;
        this.options = options;

        this.windowState = (options.initialState !== undefined) ? options.initialState : uiutil.WINDOW_STATE_NORMAL; //minimize, normal, maximize
        
        //set default size values
        this.posInfo = {};
        this.posInfo.x = 0;
        this.posInfo.y = 0;
        this.sizeInfo = {};
        this.sizeInfo.width = WindowFrame.DEFAULT_WINDOW_WIDTH;
        this.sizeInfo.height = WindowFrame.DEFAULT_WINDOW_HEIGHT;
        
        this.frame = null;
        this.titleCell = null;
        this.headerCell = null;
        this.bodyCell = null;
        
        this.content = null;
        
        this.windowDragActive = false;
        this.moveOffsetX = null;
        this.moveOffsetX = null;
        //handlers we place on the parent during a move
        this.moveOnMouseMove = null;
        this.moveOnMouseLeave = null;
        this.moveOnMouseUp = null;
        
        this.resizeEastActive = false;
        this.resizeWestActive = false;
        this.resizeNorthActive = false;
        this.resizeSouthActive = false;
        this.resizeOffsetWidth = null;
        this.resizeOffsetHeight = null;
        //hanlders we place on the parent during a resize
        this.resizeOnMouseUp = null;
        this.resizeOnMouseMove = null;
        this.resizeOnMouseLeave = null;
        
        //these should be set to soemthing more meeaningful, like the minimum sensible width of the title bar
        this.minWidth = 0;
        this.minHeight = 0;
        
        //initialize
        this.initUI();
        
        //add the handler to move the active window to the front
        var frontHandler = () => {
            this.windowParent.bringToFront(this);
        };
        var element = this.getElement();
        element.addEventListener("mousedown",frontHandler);
    }


    //====================================
    // Public Methods
    //====================================

    //---------------------------
    // WINDOW CONTAINER
    //---------------------------

    /** This method shows the window. */
    getTitle() {
        return this.title;
    }

    /** This method shows the window. */
    setTitle(title) {
        this.title = title;
        this.titleBarTitleElement.innerHTML = title;
    }

    /** This method shows the window. */
    createMenu(iconUrl) {
        if(!iconUrl) iconUrl = uiutil.getResourcePath(uiutil.MENU_IMAGE);
        this.menu = Menu.createMenuFromImage(iconUrl);
        this.titleBarMenuElement.appendChild(this.menu.getElement());
        //create the icon (menu) overlay
        this.iconOverlayElement = uiutil.createElementWithClass("div","visiui_win_icon_overlay_style",this.titleBarMenuElement);
        
        return this.menu;
    }

    /** This method shows the window. */
    getMenu() {
        return this.menu;
    }

    /** This sets the given element as the icon overlay. If null or other [false} is passed
     * this will just clear the icon overlay. */
    setIconOverlay(element) {
        if(this.iconOverlayElement) {
            this.clearIconOverlay();
            if(element) {
                this.iconOverlayElement.appendChild(element);
            }
        }
    }

    clearIconOverlay() {
        if(this.iconOverlayElement) {
            uiutil.removeAllChildren(this.iconOverlayElement);
        }
    }

    /** This sets the content for the window. If null (or otherwise false) is passed
     * the content will be set to empty.*/
    setHeaderContent(contentElement) {
        uiutil.removeAllChildren(this.headerCell);
        if(contentElement) {
            this.headerCell.appendChild(contentElement);
        }
    }

    /** This sets the content for the window. The content type
     *  can be:
     *  uiutil.RESIZABLE - content can be resized to fit window - scrolling, if necessary is managed within the content element.
     *  uiutil.FIXED_SIZE - the content is fixed size. The window will decide how to display the complete object.
     *  uiutil.SIZE_WINDOW_TO_CONTENT - this is not a content type but a input option for content FIXED_SIZE that shrinks the window to fit the content. */
    setContent(contentElement,elementType) {
        
        if(!this.contentContainer) {
            this.contentContainer = uiutil.createElement("div");
            uiutil.removeAllChildren(this.bodyCell);
            this.bodyCell.appendChild(this.contentContainer);
        }
        if(elementType == uiutil.RESIZABLE) {
            this.contentContainer.className = "visiui_win_container_fixed";
        }
        else if(elementType == uiutil.FIXED_SIZE) {
            this.contentContainer.className = "visiui_win_container_scrolling";
        }
        else if(elementType == uiutil.SIZE_WINDOW_TO_CONTENT) {
            this.contentContainer.className = "visiui_win_container_fit_content";
        }
        else {
            throw new Error("Unknown content type: " + elementType);
        }
        
        uiutil.removeAllChildren(this.contentContainer);
        this.contentContainer.appendChild(contentElement);
        
        this.content = contentElement;
    }

    /** This method removes the given element from the content display. If the element
     * is not in the content display, no action is taken. */
    safeRemoveContent(contentElement) {
        for(var i = 0; i < this.bodyCell.childNodes.length; i++) {
            var node = this.bodyCell.childNodes[i];
            if(node === contentElement) {
                this.bodyCell.removeChild(contentElement);
                this.content = null;
            }
        }
    }

    addTitleToolElement(element) {
        this.titleBarToolElement.appendChild(element);
    }

    removeTitleToolElement(element) {
        this.titleBarToolElement.removeChild(element);
    }




    //---------------------------
    // WINDOW CHILD
    //---------------------------

    /** This method returns the parent container for the window.*/
    getParent() {
        return this.windowParent;
    }

    /** This method returns true if the window is showing. */
    getIsShowing() {
        if(this.windowParent) {
            return this.windowParent.getIsShowing();
        }
        else {
            return false;
        }
    }

    /** This method closes the window. If the argument forceClose is not
     * set to true the "request_close" handler is called to check if
     * it is ok to close the window. */
    close(forceClose) {
        if(!this.windowParent) return;
        
        if(!forceClose) {
            //make a close request
            var requestResponse = this.callHandler(uiutil.REQUEST_CLOSE,this);
            if(requestResponse == uiutil.DENY_CLOSE) {
                //do not close the window
                return;
            }
        }

        this.windowParent.removeListener(uiutil.SHOWN_EVENT, this.windowShownListener);
        this.windowParent.removeListener(uiutil.HIDDEN_EVENT, this.windowHiddenListener);
        this.windowParent.removeWindow(this);
        this.windowParent = null;

        this.dispatchEvent(uiutil.CLOSE_EVENT,this);
    }

    /** This method sets the position of the window frame in the parent. */
    setPosition(x,y) {
        //don't let window be placed at a negative coord. We can lose it.
        if(x < 0) x = 0;
        if(y < 0) y = 0;
        this.posInfo.x = x;
        this.posInfo.y = y;
        
        this.updateCoordinates();
    }

    /** This method sets the size of the window frame, including the title bar. */
    setSize(width,height) {
        this.sizeInfo.width = width;
        this.sizeInfo.height = height;
        
        this.updateCoordinates();
    }

    /** This method gets the location and size info for the window. */
    getPosInfo() {
        return this.posInfo;
    }

    /** This method gets the location and size info for the window. */
    setPosInfo(posInfo) {
        this.posInfo = posInfo;
        this.updateCoordinates();
    }

    /** This method gets the location and size info for the window. */
    getSizeInfo() {
        return this.sizeInfo;
    }

    /** This method gets the location and size info for the window. */
    setSizeInfo(sizeInfo) {
        this.sizeInfo = sizeInfo;
        this.updateCoordinates();
    }

    /** This method sets the location and size info for the window at the same time. */
    setCoordinateInfo(posInfo,sizeInfo) {
        this.posInfo = posInfo;
        this.sizeInfo = sizeInfo;
        this.updateCoordinates();
    }


    /** This method sets the size of the window, including the title bar and other decorations. */
    setZIndex(zIndex) {
        this.frame.style.zIndex = String(zIndex);
    }


    //---------------------------
    // GUI ELEMENT
    //---------------------------

    /** This method returns the main dom element for the window frame. */
    getElement() {
        return this.frame;
    }



    //----------------------------------------------------------------
    //object specific

    /** This method sets the size of the window to fit the content. */
    fitToContent() {
        this.sizeInfo.width = undefined;
        this.sizeInfo.height = undefined;
    }

    /** This method centers the window in its parent. it should only be called
     *after the window is shown. */
    centerInParent() {
        var coords = this.windowParent.getCenterOnPagePosition(this);
        this.setPosition(coords[0],coords[1]);
    }


    /** This method gets the location and size info for the window. */
    getWindowState() {
        return this.windowState;
    }

    /** This method sets the location and size info for the window. */
    setWindowState(windowState) {
        switch(windowState) {
            case uiutil.WINDOW_STATE_NORMAL:
                this.restoreContent();
                break;
                
            case uiutil.WINDOW_STATE_MINIMIZED:
                this.minimizeContent();
                break;
                
            case uiutil.WINDOW_STATE_MAXIMIZED:
                this.maximizeContent();
                break;
                
            default:
                alert("Unknown window state: " + windowState);
                break;
        }
    }

    //================================
    // Internal
    //================================

    /** This method shows the window. This automatically called internally when the window is
     * added to the parent. */
    onAddedToParent(newWindowParent) {
        this.windowParent = newWindowParent;
        this.parentElement = newWindowParent.getOuterElement();
        
        //attach to listeners to forward show and hide events
        this.windowShownListener = (windowParent) => {
            this.dispatchEvent(uiutil.SHOWN_EVENT,this);
        };
        this.windowParent.addListener(uiutil.SHOWN_EVENT, this.windowShownListener);
        this.windowHiddenListener = (windowParent) => {
            this.dispatchEvent(uiutil.HIDDEN_EVENT,this);
        };
        this.windowParent.addListener(uiutil.HIDDEN_EVENT, this.windowHiddenListener);
        
        //do the show event if the parent is currently wshowing
        if(this.windowParent.getIsShowing()) {
            this.dispatchEvent(uiutil.SHOWN_EVENT,this);
        }
        
        //we will redo this since the size of elements used in calculation may have been wrong
        if(this.sizeInfo.height !== undefined) {
            this.updateCoordinates();
        }
    }

    //====================================
    // Motion/Reseize Event Handlers and functions
    //====================================

    /** Mouse down handler for moving the window. */
    moveMouseDown(e) {
        //do not do move in maximized state
        if(this.windowState === uiutil.WINDOW_STATE_MAXIMIZED) return;
        
        if(this.parentElement) {
            this.windowDragActive = true;
            this.moveOffsetX = e.clientX - this.frame.offsetLeft;
            this.moveOffsetY = e.clientY - this.frame.offsetTop;
            
            //add move events to the parent, since the mouse can leave this element during a move
            this.parentElement.addEventListener("mousemove",this.moveOnMouseMove);
            this.parentElement.addEventListener("mouseleave",this.moveOnMouseLeave);
            this.parentElement.addEventListener("mouseup",this.moveOnMouseUp);
            
            //move start event would go here
        }
    }

    /** Mouse m,ove handler for moving the window. */
    moveMouseMoveImpl(e) {
        if(!this.windowDragActive) return;
        var newX = e.clientX - this.moveOffsetX;
        if(newX < 0) newX = 0;
        var newY = e.clientY - this.moveOffsetY;
        if(newY < 0) newY = 0;
        this.posInfo.x = newX;
        this.posInfo.y = newY;
        this.updateCoordinates();
    }

    /** Mouse up handler for moving the window. */
    moveMouseUpImpl(e) {
        this.endMove();
    }

    /** Mouse leave handler for moving the window. */
    moveMouseLeaveImpl(e) {
        this.endMove();
    }

    /** Mouse down handler for resizing the window. */
    resizeMouseDownImpl(e,resizeFlags) {
        //do not do resize in maximized state
        if(this.windowState === uiutil.WINDOW_STATE_MAXIMIZED) return;

        if(resizeFlags) {
            if(resizeFlags & WindowFrame.RESIZE_EAST) {
                this.resizeEastActive = true;
                this.resizeOffsetWidth = e.clientX - this.bodyCell.clientWidth;
            }
            else if(resizeFlags & WindowFrame.RESIZE_WEST) {
                this.resizeWestActive = true;
                this.resizeOffsetWidth = e.clientX + this.bodyCell.clientWidth;
                this.moveOffsetX = e.clientX - this.frame.offsetLeft;
            }
            if(resizeFlags & WindowFrame.RESIZE_SOUTH) {
                this.resizeSouthActive = true;
                this.resizeOffsetHeight = e.clientY - this.bodyCell.clientHeight;
            }
            else if(resizeFlags & WindowFrame.RESIZE_NORTH) {
                this.resizeNorthActive = true;
                this.resizeOffsetHeight = e.clientY + this.bodyCell.clientHeight;
                this.moveOffsetY = e.clientY - this.frame.offsetTop;
            }

            //add resize events to the parent, since the mouse can leave this element during a move
            this.parentElement.addEventListener("mouseup",this.resizeOnMouseUp);
            this.parentElement.addEventListener("mousemove",this.resizeOnMouseMove);
            this.parentElement.addEventListener("mouseleave",this.resizeOnMouseLeave);
        }
    }

    /** Mouse move handler for resizing the window. */
    resizeMouseMoveImpl(e) {
        var newHeight;
        var newWidth;
        var newX;
        var newY;
        var changeMade = false;
        
        if(this.resizeEastActive) {
            newWidth = e.clientX - this.resizeOffsetWidth;
            //if(newWidth < this.minWidth) return;
            this.sizeInfo.width = newWidth;
            changeMade = true;
        }
        else if(this.resizeWestActive) {
            newWidth = this.resizeOffsetWidth - e.clientX;
            //if(newWidth < this.minWidth) return;
            newX = e.clientX - this.moveOffsetX;
            if(newX < 0) newX = 0;
            this.sizeInfo.width = newWidth;
            this.posInfo.x = newX;
            changeMade = true;
        }
        if(this.resizeSouthActive) {
            newHeight = e.clientY - this.resizeOffsetHeight;
            //if(newHeight < this.minHeight) return;
            this.sizeInfo.height = newHeight;
            changeMade = true;
        }
        else if(this.resizeNorthActive) {
            newHeight = this.resizeOffsetHeight - e.clientY;
            //if(newHeight < this.minHeight) return;
            newY = e.clientY - this.moveOffsetY;
            if(newY < 0) newY = 0;
            this.sizeInfo.height = newHeight;
            this.posInfo.y = newY;
            changeMade = true;
        }
            
        if(changeMade) {
            //update coordinates
            this.updateCoordinates();
        }
    }

    /** Mouse up handler for resizing the window. */
    resizeMouseUpImpl(e) {
        this.endResize();
    }

    /** Mouse up handler for resizing the window. */
    resizeMouseLeaveImpl(e) {
        this.endResize();
    }


    /** This method ends a move action. 
     * @private */
    endMove(e) {
        this.windowDragActive = false;
        this.parentElement.removeEventListener("mousemove",this.moveOnMouseMove);
        this.parentElement.removeEventListener("mouseup",this.moveOnMouseUp);
        this.parentElement.removeEventListener("mouseleave",this.moveOnMouseLeave);
    }

    /** this method ends a resize action.
     * @private */
    endResize() {
        this.resizeEastActive = false;
        this.resizeWestActive = false;
        this.resizeSouthActive = false;
        this.resizeNorthActive = false;
        this.parentElement.removeEventListener("mouseup",this.resizeOnMouseUp);
        this.parentElement.removeEventListener("mousemove",this.resizeOnMouseMove);
        this.parentElement.removeEventListener("mouseleave",this.resizeOnMouseLeave);
    }

    //====================================
    //  Min/max Methods
    //====================================

    /** This is the minimize function for the window.*/
    minimizeContent() {
        
        //set body as hidden
        this.headerCell.style.display = "none";
        this.bodyCell.style.display = "none";
        
        var wasMinimized = (this.windowState === uiutil.WINDOW_STATE_MINIMIZED);
    
        //set the window state
        this.windowState = uiutil.WINDOW_STATE_MINIMIZED;
        this.updateCoordinates();
        this.setMinMaxButtons();
        
        //dispatch resize event
        if(!wasMinimized) { 
            this.dispatchEvent(uiutil.WINDOW_STATE_CHANGED,this);
        }
    }

    /** This is the restore function for the window.*/
    restoreContent() {
        
        //set body as not hidden
        this.headerCell.style.display = "";
        this.bodyCell.style.display = "";
        
        var wasMinimized = (this.windowState === uiutil.WINDOW_STATE_MINIMIZED);
        var wasMaximized = (this.windowState === uiutil.WINDOW_STATE_MAXIMIZED);
        
        //set the window state
        this.windowState = uiutil.WINDOW_STATE_NORMAL;
        this.updateCoordinates();
        this.setMinMaxButtons();
        
        if((wasMinimized)||(wasMaximized)) {
            this.dispatchEvent(uiutil.WINDOW_STATE_CHANGED,this);
        }
    }

    /** This is the minimize function for the window.*/
    maximizeContent() {
        
        //set body as not hidden
        this.headerCell.style.display = "";
        this.bodyCell.style.display = "";
        
        var wasMaximized = (this.windowState === uiutil.WINDOW_STATE_MAXIMIZED);
        
        //set the window state
        this.windowState = uiutil.WINDOW_STATE_MAXIMIZED;
        this.updateCoordinates();
        this.setMinMaxButtons();
        
        if(!wasMaximized) {
            this.dispatchEvent(uiutil.WINDOW_STATE_CHANGED,this);
        }
    }

    /** @private */
    updateCoordinates() {
        
        var initialBodyHeight = this.bodyCell.style.height;
        var initialBodyWidth = this.bodyCell.style.width;
        
        if(this.windowState === uiutil.WINDOW_STATE_MAXIMIZED) {
            //apply the maximized coordinates size
            this.frame.style.left = "0px";
            this.frame.style.top = "0px";
            this.frame.style.height = "100%";
            this.frame.style.width = "100%";
            
            this.bodyCell.style.height = "100%";
            this.bodyCell.style.width = "100%";
        }
        else if(this.windowState === uiutil.WINDOW_STATE_NORMAL) {
            //apply the normal size to the window
            this.frame.style.left = this.posInfo.x + "px";
            this.frame.style.top = this.posInfo.y + "px";
            this.frame.style.height = "";
            this.frame.style.width = "";
            
            if(this.sizeInfo.height !== undefined) {
                this.bodyCell.style.height = this.sizeInfo.height + "px";
            }
            else {
                this.bodyCell.style.height = "";
            }
            if(this.sizeInfo.width !== undefined) {
                this.bodyCell.style.width = this.sizeInfo.width + "px";
            }
            else {
                this.bodyCell.style.width = "";
            }
        }
        else if(this.windowState === uiutil.WINDOW_STATE_MINIMIZED) {
            //apply the minimized size to the window
            this.frame.style.left = this.posInfo.x + "px";
            this.frame.style.top = this.posInfo.y + "px";
            this.frame.style.height = "";
            this.frame.style.width = "";
            
            this.bodyCell.style.height = "0px";
            this.bodyCell.style.width = "0px";
        }
        
        if((initialBodyHeight != this.bodyCell.style.height)||(initialBodyWidth != this.bodyCell.style.width)) {
            this.dispatchEvent(uiutil.RESIZED_EVENT,this);
        }
    }

    //====================================
    // Initialization Methods
    //====================================

    /** @private */
    initUI() {
        
        var table;
        var row;
        var cell;
        
        table = document.createElement("table");
        table.className = "visiui_win_main";
        this.frame = table; 
        
        //top border
        row = document.createElement("tr");
        table.appendChild(row);
        cell = document.createElement("td");
        cell.className = "visiui_win_windowColorClass visiui_win_topLeft";
        this.addResizeHandlers(cell,WindowFrame.RESIZE_WEST | WindowFrame.RESIZE_NORTH);
        row.appendChild(cell);
        cell = document.createElement("td");
        cell.className = "visiui_win_windowColorClass visiui_win_top";
        this.addResizeHandlers(cell,WindowFrame.RESIZE_NORTH);  
        row.appendChild(cell);
        cell = document.createElement("td");
        cell.className = "visiui_win_windowColorClass visiui_win_topRight";
        this.addResizeHandlers(cell,WindowFrame.RESIZE_EAST | WindowFrame.RESIZE_NORTH);  
        row.appendChild(cell);
        
        //title bar
        row = document.createElement("tr");
        table.appendChild(row);
        cell = document.createElement("td");
        cell.className = "visiui_win_windowColorClass visiui_win_left";
        this.addResizeHandlers(cell,WindowFrame.RESIZE_WEST); 
        cell.rowSpan = 3;
        row.appendChild(cell);
        cell = document.createElement("td");
        cell.className = "visiui_win_windowColorClass";
        this.titleBarCell = cell;
        row.appendChild(cell);
        cell = document.createElement("td");
        cell.className = "visiui_win_windowColorClass visiui_win_right";
        this.addResizeHandlers(cell,WindowFrame.RESIZE_EAST); 
        cell.rowSpan = 3;
        row.appendChild(cell);
        
        //header
        row = document.createElement("tr");
        row.className = "visiui_win_headerRow";
        table.appendChild(row);
        cell = document.createElement("td");
        cell.className = "visiui_win_headerCell";
        this.headerCell = cell;
        row.appendChild(cell);
        
        //body
        row = document.createElement("tr");
        row.className = "visiui_win_bodyRow";
        table.appendChild(row);
        cell = document.createElement("td");
        cell.className = "visiui_win_bodyCell";
        this.bodyCell = cell;
        row.appendChild(cell);
        
        //bottom border
        row = document.createElement("tr");
        table.appendChild(row);
        cell = document.createElement("td");
        cell.className = "visiui_win_windowColorClass visiui_win_bottomLeft";
        this.addResizeHandlers(cell,WindowFrame.RESIZE_WEST | WindowFrame.RESIZE_SOUTH); 
        row.appendChild(cell);
        cell = document.createElement("td");
        cell.className = "visiui_win_windowColorClass visiui_win_bottom";
        this.addResizeHandlers(cell,WindowFrame.RESIZE_SOUTH);  
        row.appendChild(cell);
        cell = document.createElement("td");
        cell.className = "visiui_win_windowColorClass visiui_win_bottomRight";
        this.addResizeHandlers(cell,WindowFrame.RESIZE_EAST | WindowFrame.RESIZE_SOUTH);
        row.appendChild(cell);
    
        //create the title bar
        this.createTitleBar();
    }

    /** @private */
    addResizeHandlers(cell,flags) {
        //add handlers if the window is resizable
        if(this.options.resizable) {
            cell.onmousedown = (event) => {
                this.resizeMouseDownImpl(event,flags);
            };
            
            //these are not cel specific. they are used on all cells and on the parent container
            //during a move.
            if(!this.resizeOnMouseMove) {
                this.resizeOnMouseMove = (event) => {
                    this.resizeMouseMoveImpl(event);
                };
                this.resizeOnMouseUp = (event) => {
                    this.resizeMouseUpImpl(event);
                };
                this.resizeOnMouseLeave = (event) => {
                    this.resizeMouseLeaveImpl(event);
                };
            }
        }
    }

    /** @private */
    createTitleBar() {
        
        this.titleBarElement = uiutil.createElementWithClass("div","visiui_win_titleBarClass",this.titleBarCell);

        //add elements
        this.titleBarLeftElements = uiutil.createElementWithClass("div","visiui_win_left_style",this.titleBarElement);
        this.titleBarMenuElement = uiutil.createElementWithClass("div","visiui_win_menu_style",this.titleBarLeftElements);
        this.titleBarTitleElement = uiutil.createElementWithClass("div","visiui_win_title",this.titleBarLeftElements);
        
        this.titleBarRightElements = uiutil.createElementWithClass("div","visiui_win_right_style",this.titleBarElement);
        this.titleBarToolElement = uiutil.createElementWithClass("div","visiui_win_tool_style",this.titleBarRightElements);
        
        //add window commands ( we will hide the bottons that are not needed)
        //minimize button
        if(this.options.minimizable) {
            this.minimizeButton = uiutil.createElementWithClass("img","visiui_win_cmd_button",this.titleBarRightElements);
            this.minimizeButton.src = uiutil.getResourcePath(uiutil.MINIMIZE_CMD_IMAGE);
            this.minimizeButton.onclick = () => {
                this.minimizeContent();
            };
        }
        
        //restore button - only if we cn minimize or maximize
        if(this.options.minimizable || this.options.maximizable) {	
            this.restoreButton = uiutil.createElementWithClass("img","visiui_win_cmd_button",this.titleBarRightElements);
            this.restoreButton.src = uiutil.getResourcePath(uiutil.RESTORE_CMD_IMAGE);
            this.restoreButton.onclick = () => {
                this.restoreContent();
            };
        }
        
        //maximize button and logic
    //DISABLE MAXIMIZE - just don't show button for now
    //    if(this.options.maximizable) {
    //        this.maximizeButton = uiutil.createElementWithClass("img","visiui_win_cmd_button",this.titleBarRightElements);
    //        this.maximizeButton.src = uiutil.getResourcePath(uiutil.MAXIMIZE_CMD_IMAGE);
    //        this.maximizeButton.onclick = () => {
    //            this.maximizeContent();
    //        }
    //    }
        
        //layout the window buttons
        this.windowState = uiutil.WINDOW_STATE_NORMAL;
        this.setMinMaxButtons();
        
        //close button
        if(this.options.closable) {
            this.closeButton = uiutil.createElementWithClass("img","visiui_win_cmd_button",this.titleBarRightElements);
            this.closeButton.src = uiutil.getResourcePath(uiutil.CLOSE_CMD_IMAGE);
            this.closeButton.onclick = () => {
                this.close();
            };
        }
        
        //add am empty title
        this.setTitle("");
        
        //mouse move and resize
        if(this.options.movable) {
            //add mouse handlers for moving the window 
            this.titleBarElement.onmousedown = (event) => {
                this.moveMouseDown(event);
            };

            //mouse window drag events we will place on the parent container - since the mouse drag 
            //may leave the window frame during the move
            this.moveOnMouseMove = (event) => {
                this.moveMouseMoveImpl(event);
            };
            this.moveOnMouseUp = (event) => {
                this.moveMouseUpImpl(event);
            };
            this.moveOnMouseLeave = (event) => {
                this.moveMouseLeaveImpl(event);
            };
        }
    }


    /** This method shows the min/max/restore buttons properly 
     * @private */
    setMinMaxButtons() {
        if(this.minimizeButton) {
            if(this.windowState == uiutil.WINDOW_STATE_MINIMIZED) {
                this.minimizeButton.style.display = "none";
            }
            else {
                this.minimizeButton.style.display = "";
            }
        }
        if(this.restoreButton) {
            if(this.windowState == uiutil.WINDOW_STATE_NORMAL) {
                this.restoreButton.style.display = "none";
            }
            else {
                this.restoreButton.style.display = "";
            }
        }
        if(this.maximizeButton) {
            if(this.windowState == uiutil.WINDOW_STATE_MAXIMIZED) {
                this.maximizeButton.style.display = "none";
            }
            else {
                this.maximizeButton.style.display = "";
            }
        }
    }

}

//add mixins to this class
apogeeutil.mixin(WindowFrame,EventManager);

WindowFrame.RESIZE_LOCATION_SIZE = 10;

//constants for resizing
WindowFrame.RESIZE_TOLERANCE = 5;
WindowFrame.RESIZE_EAST = 1;
WindowFrame.RESIZE_WEST = 2;
WindowFrame.RESIZE_SOUTH = 4;
WindowFrame.RESIZE_NORTH = 8;
WindowFrame.RESIZE_NE = WindowFrame.RESIZE_NORTH + WindowFrame.RESIZE_EAST;
WindowFrame.RESIZE_NW = WindowFrame.RESIZE_NORTH + WindowFrame.RESIZE_WEST;
WindowFrame.RESIZE_SE = WindowFrame.RESIZE_SOUTH + WindowFrame.RESIZE_EAST;
WindowFrame.RESIZE_SW = WindowFrame.RESIZE_SOUTH + WindowFrame.RESIZE_WEST;

/** size must be speicifed for the window. If not these values are used. */
WindowFrame.DEFAULT_WINDOW_HEIGHT = 300;
WindowFrame.DEFAULT_WINDOW_WIDTH = 300;

/** This object is a container for window frames. The argument of the constructor should
 * be an element that will hold the window frames.  */
class WindowParent {

    constructor(containerElement) {
        //mixin initialization
        this.eventManagerMixinInit();
        
        this.containerElement = containerElement;
        
        this.windowFrameStack = [];
        
        this.showing = false;
        
        //child auto positioning variables
        this.prevNewChildX = 0;
        this.prevNewChildY = 0;
        this.wrapCount = 0;
    }

    //==============================
    // Public Instance Methods
    //==============================

    /** This should be called when the window parent element is shown, if the
     * "shown" event is to be supported.  */
    elementIsShown() {
        this.showing = true;
        this.dispatchEvent(uiutil.SHOWN_EVENT,this);
    }

    /** This should be called when the window parent element is shown, if the
     * "shown" event is to be supported.  */
    elementIsHidden() {
        this.showing = false;
        this.dispatchEvent(uiutil.HIDDEN_EVENT,this);
    }

    /** This method returns true if this window parent is showing. */
    getIsShowing() {
        return this.showing;
    }

    getOuterElement() {
        return this.containerElement;
    }

    /** This method adds a windows to the parent. It does not show the window. Show must be done. */
    addWindow(windowFrame) {
        this.containerElement.appendChild(windowFrame.getElement());
        this.windowFrameStack.push(windowFrame);
        this.updateOrder();
        
        windowFrame.onAddedToParent(this);
    }

    /** This method removes the window from the parent container. */
    removeWindow(windowFrame) {
        this.containerElement.removeChild(windowFrame.getElement());
        var index = this.windowFrameStack.indexOf(windowFrame);
        this.windowFrameStack.splice(index,1);
        this.updateOrder();
    }

    /** This brings the given window to the front inside this container. */
    bringToFront(windowFrame) {
        //remove from array
        var index = this.windowFrameStack.indexOf(windowFrame);
        this.windowFrameStack.splice(index,1);
        //readd at the end
        this.windowFrameStack.push(windowFrame);
        this.updateOrder();
    }

    /** This method centers the dialog on the page. It must be called after the conten
     * is set, and possibly after it is rendered, so the size of it is calculated. */
    getCenterOnPagePosition(child) {
        var element = child.getElement();
        var x = (this.containerElement.offsetWidth - element.clientWidth)/2;
        var y = (this.containerElement.offsetHeight - element.clientHeight)/2;
        return [x,y];
    }


    /** This method returns the position of the next window for auto/cascade positioning. */
    getNextWindowPosition() {
        var x = this.prevNewChildX + WindowParent.DELTA_CHILD_X;
        var y = this.prevNewChildY + WindowParent.DELTA_CHILD_Y;
        
        if( ((x > WindowParent.MAX_WRAP_WIDTH) || 
            (y > WindowParent.MAX_WRAP_HEIGHT)) ) {
            this.wrapCount++;
            x = WindowParent.DELTA_CHILD_X * (this.wrapCount + 1);
            y = WindowParent.DELTA_CHILD_Y;
        }
        
        this.prevNewChildX = x;
        this.prevNewChildY = y;
        
        var pos = {};
        pos.x = x;
        pos.y = y;
        return pos;
    }

    //=========================
    // Private Methods
    //=========================

    /** This updates the order for the windows.
     * @private */
    updateOrder() {
        var zIndex = WindowParent.BASE_ZINDEX;
        for(var i = 0; i < this.windowFrameStack.length; i++) {
            var windowFrame = this.windowFrameStack[i];
            windowFrame.setZIndex(zIndex++);
        }
    }

}

//add mixins to this class
apogeeutil.mixin(WindowParent,EventManager);

WindowParent.BASE_ZINDEX = 0;

//constants for window placement
WindowParent.DELTA_CHILD_X = 25;
WindowParent.DELTA_CHILD_Y = 25;
WindowParent.MAX_WRAP_WIDTH = 400; 
WindowParent.MAX_WRAP_HEIGHT = 400;

let dialogMgr = {};

/** This method creates a normal window which is situated above a shiled layer blocking
 *out events to the app, making the dialog like a modal dialog. If this function is used
 *to create a dialog, it must be closed with the dialogMgr.closeDialog function to
 *remove the modal layer, whether or not the dialog was shown. The options passed are the 
 *normal options for a window frame. (Note - if there are other events with whihc to act with
 *the app they may need to be shileded too.) */
dialogMgr.createDialog = function(options) {
    var dialog = new WindowFrame(options);
    return dialog;
};

dialogMgr.showDialog = function(dialog) {
    var shieldElement = uiutil.createElement("div",null,uiutil.DIALOG_SHIELD_STYLE);
    var dialogParent = new WindowParent(shieldElement);
    uiutil.dialogLayer.appendChild(shieldElement);

    dialogParent.addWindow(dialog);
};

/** This method closes a dialog created with createDialog. It
 *hides the window and removes the modal shiled. */
dialogMgr.closeDialog = function(dialog) {
    var parent = dialog.getParent();
    dialog.close();
    uiutil.dialogLayer.removeChild(parent.getOuterElement());
};

/** This namespacve provides methods to create a status banner and icon overlay. */

//constants for the window banner bar
let bannerConstants = {};

bannerConstants.BANNER_TYPE_ERROR = apogeeutil.STATE_ERROR;
bannerConstants.BANNER_BGCOLOR_ERROR = "red";
bannerConstants.BANNER_FGCOLOR_ERROR = "white";
bannerConstants.ERROR_ICON_IMAGE = "/error.png";

bannerConstants.BANNER_TYPE_PENDING = apogeeutil.STATE_PENDING;
bannerConstants.BANNER_BGCOLOR_PENDING = "yellow";
bannerConstants.BANNER_FGCOLOR_PENDING = "black";
bannerConstants.PENDING_ICON_IMAGE = "/pending.png";

bannerConstants.BANNER_TYPE_INVALID = apogeeutil.STATE_INVALID;
bannerConstants.BANNER_BGCOLOR_INVALID = "gray";
bannerConstants.BANNER_FGCOLOR_INVALID = "white";
bannerConstants.INVALID_ICON_IMAGE = "/invalid.png";

bannerConstants.BANNER_BGCOLOR_UNKNOWN = "yellow";
bannerConstants.BANNER_FGCOLOR_UNKNOWN = "black";

bannerConstants.BANNER_TYPE_NONE = apogeeutil.STATE_NORMAL;

bannerConstants.PENDING_MESSAGE = "Calculation pending...";bannerConstants.INVALID_MESSAGE = "Result not valid!";

/** This method returns a banner for the given state and message. This should 
 * not be called for banner state bannerConstants.BANNER_TYPE_NONE */
function getBanner(text,bannerState) {
    
    //get banner colors and icon overlay resource
    var bgColor;
    var fgColor;
    if(bannerState == bannerConstants.BANNER_TYPE_INVALID) {
        bgColor = bannerConstants.BANNER_BGCOLOR_INVALID;
        fgColor = bannerConstants.BANNER_FGCOLOR_INVALID;
    }
    else if(bannerState == bannerConstants.BANNER_TYPE_ERROR) {
        bgColor = bannerConstants.BANNER_BGCOLOR_ERROR;
        fgColor = bannerConstants.BANNER_FGCOLOR_ERROR;
    }
    else if(bannerState == bannerConstants.BANNER_TYPE_PENDING) {
        bgColor = bannerConstants.BANNER_BGCOLOR_PENDING;
        fgColor = bannerConstants.BANNER_FGCOLOR_PENDING;
    }
    else {
        bgColor = bannerConstants.BANNER_BGCOLOR_UNKNOWN;
        fgColor = bannerConstants.BANNER_FGCOLOR_UNKNOWN;
    }
   
    //banner showing
    var bannerDiv = uiutil.createElement("div",null,
        {
            //"display":"block",
            //"position":"relative",
            //"top":"0px",
            "backgroundColor":bgColor,
            "color":fgColor
        });
    bannerDiv.innerHTML = text;
    
    return bannerDiv;
}

/** This method creates an icon overlay for a given banner state. This should 
 * not be called for banner state bannerConstants.BANNER_TYPE_NONE */
function getIconOverlay(bannerState) {
    var resource;
    if(bannerState == bannerConstants.BANNER_TYPE_INVALID) {
        resource = bannerConstants.INVALID_ICON_IMAGE;
    }
    else if(bannerState == bannerConstants.BANNER_TYPE_ERROR) {
        resource = bannerConstants.ERROR_ICON_IMAGE;
    }
    else if(bannerState == bannerConstants.BANNER_TYPE_PENDING) {
        resource = bannerConstants.PENDING_ICON_IMAGE;
    }
    else {
        //unknown
        resource = null;
    }
    
    var iconOverlayElement = document.createElement("img");
    if(resource) {
        var url = uiutil.getResourcePath(resource);
        iconOverlayElement.src = url;
    }
    return iconOverlayElement;
}

/** This is is a layout element to fill a parent element with a header element and
 * a display element which takes all the remaning vertical space.
 * 
 * The header and display types may be the following:
 * DisplayAndHeader.SCROLLING_PANE
 * DisplayAndHeader.FIXED_PANE
 * 
 * Additionally a CSS class may be specified for each fo give information such as
 * coloring and, for the sake of the header, height.
 */ 
class DisplayAndHeader {

    constructor(headerType,headerStyleClass,bodyType,bodyStyleClass) {
    //    this.container = uiutil.createElementWithClass("div","visiui-dnh-container");
    //    
    //    this.headerOuter = uiutil.createElementWithClass("div","visiui-dnh-header",this.container);
    //    this.header = uiutil.createElementWithClass("div","visiui-dnh-header-inner",this.headerOuter);
    //    this.bodyOuter = uiutil.createElementWithClass("div","visiui-dnh-body",this.container);
    //    this.body = uiutil.createElementWithClass("div","visiui-dnh-body-inner",this.bodyOuter);
    //    
    //    this.headerStyleClass = headerStyleClass;
    //    this.bodyStyleClass = bodyStyleClass;
    //    
    //    this.headerContent = document.createElement("div");
    //    this.header.appendChild(this.headerContent);
    //    this.bodyContent = document.createElement("div");
    //    this.body.appendChild(this.bodyContent);
        
        this.container = uiutil.createElementWithClass("table","visiui-dnh-container");
        
        this.headerOuter = uiutil.createElementWithClass("tr","visiui-dnh-header",this.container);
        this.header = uiutil.createElementWithClass("td","visiui-dnh-header-inner",this.headerOuter);
        this.bodyOuter = uiutil.createElementWithClass("tr","visiui-dnh-body",this.container);
        this.body = uiutil.createElementWithClass("td","visiui-dnh-body-inner",this.bodyOuter);
        
        this.headerStyleClass = headerStyleClass;
        this.bodyStyleClass = bodyStyleClass;
        
        this.headerContent = document.createElement("div");
        this.header.appendChild(this.headerContent);
        this.bodyContent = document.createElement("div");
        this.body.appendChild(this.bodyContent);
        
        //this.setHeaderType(headerType);
        this.setHeaderType("visiui-dnh-shrink-to-fit");
        this.setBodyType(bodyType);
    }

    /** this method sets the header type. */
    setHeaderType(headerType) {
        var headerClass = headerType;
        if(this.headerStyleClass) headerClass += " " + this.headerStyleClass;
        this.headerContent.className = headerClass;
    }

    /** this method sets the body type. */
    setBodyType(bodyType) {
        var bodyClass = bodyType;
        if(this.bodyStyleClass) bodyClass += " " + this.bodyStyleClass;
        this.bodyContent.className = bodyClass;
    }

    /** this method returns the DOM element for ths combined layout. */
    getOuterElement() {
        return this.container;
    }

    /** this method returns the content element for the header. */
    getHeaderContainer() {
        return this.header;
    }

    /** this method returns the content element for the display pane. */
    getBodyContainer() {
        return this.body;
    }

    /** this method returns the content element for the header. */
    getHeader() {
        return this.headerContent;
    }

    /** this method returns the content element for the display pane. */
    getBody() {
        return this.bodyContent;
    }

}

/** This is the pane type for a pane that scrolls in both X and Y, iv needed. */
DisplayAndHeader.FIXED_PANE = "visiui-dnh-fixed";

/** This is the pane type for a pane that does not scrolling, hiding any overflow. */
DisplayAndHeader.SCROLLING_PANE = "visiui-dnh-scrolling";

class Tab {

    constructor(id) {
        //mixin initialization
        this.eventManagerMixinInit();
        
        this.tabFrame = null;
        this.id = id;
        this.tabLabelElement = uiutil.createElementWithClass("div","visiui-tf-tab-base visiui-tf-tab-inactive");
        
        this.menuContainer = uiutil.createElementWithClass("div","visiui-tf_tab-menuDiv",this.tabLabelElement);
        this.titleElement = uiutil.createElementWithClass("div","visiui_tf_tab_title",this.tabLabelElement);
        
        this.closeButton = uiutil.createElementWithClass("img","visiui_tf_tab_cmd_button",this.tabLabelElement);
        this.closeButton.src = uiutil.getResourcePath(uiutil.CLOSE_CMD_IMAGE);
        
        this.closeButton.onclick = () => {
            this.close();
        };
        
        //create the tab element
        this.displayFrame = uiutil.createElementWithClass("div","visiui-tf-tab-window");
        this.tabInsideContainer = new DisplayAndHeader(DisplayAndHeader.FIXED_PANE,
                null,
                DisplayAndHeader.FIXED_PANE,
                null
            );
        this.displayFrame.appendChild(this.tabInsideContainer.getOuterElement());
        
        this.headerContainer = this.tabInsideContainer.getHeaderContainer();
        this.bodyContainer = this.tabInsideContainer.getBodyContainer();
        
        this.isShowing = false;
    }

    //---------------------------
    // WINDOW CONTAINER
    //---------------------------

    /** This is called by the tab frame. */
    setTabFrame(tabFrame) {
        this.tabFrame = tabFrame;
        var instance = this;
        //attach to listeners to forward show and hide events
        this.tabShownListener = (tab) => {
            if(tab == instance) {
                this.isShowing = true;
                instance.dispatchEvent(uiutil.SHOWN_EVENT,instance);
            }
        };
        this.tabFrame.addListener(uiutil.SHOWN_EVENT, this.tabShownListener);
        this.tabHiddenListener = (tab) => {
            if(tab == instance) {
                this.isShowing = false;
                instance.dispatchEvent(uiutil.HIDDEN_EVENT,instance);
            }
        };
        this.tabFrame.addListener(uiutil.HIDDEN_EVENT, this.tabHiddenListener);
    }

    /** This sets the tab as the active tab. It returns true if it can do this. In the case
     * it does not have an active frame, it returns false. */
    makeActive() {
        if(this.tabFrame) {
            this.tabFrame.setActiveTab(this.id);
            return true;
        }
        else {
            return false;
        }
    }

    /** This method must be implemented in inheriting objects. */
    getId() {
        return this.id;
    }

    /** This returns true if the tab is showing in the display. */
    getIsShowing() {
        return this.isShowing;
    }

    /** This method must be implemented in inheriting objects. */
    setTitle(title) {
        this.titleElement.innerHTML = title;
        this.title = title;
    }

    /** This sets the content for the window. If null (or otherwise false) is passed
     * the content will be set to empty.*/
    setHeaderContent(contentElement) {
        uiutil.removeAllChildren(this.headerContainer);
        if(contentElement) {
            this.headerContainer.appendChild(contentElement);
        }
    }

    /** This sets the content for the window. */
    setContent(contentElement) {
        if(!this.contentContainer) {
            this.contentContainer = uiutil.createElement("div");
            uiutil.removeAllChildren(this.bodyContainer);
            this.bodyContainer.appendChild(this.contentContainer);
        }
        this.contentContainer.className = "visiui_tf_tab_container";
        
        uiutil.removeAllChildren(this.contentContainer);
        this.contentContainer.appendChild(contentElement);
        
        this.content = contentElement;
    }

    /** This method must be implemented in inheriting objects. */
    getTitle() {
        return this.title;
    }

    /** This method shows the window. */
    createMenu(iconUrl) {
        if(!iconUrl) iconUrl = uiutil.getResourcePath(uiutil.MENU_IMAGE);
        this.menu = Menu.createMenuFromImage(iconUrl);
        this.menuContainer.appendChild(this.menu.domElement);
        //add the icon overlay element
        this.iconOverlayElement = uiutil.createElementWithClass("div","visiui_tf_icon_overlay",this.menuContainer);
        return this.menu;
    }

    /** This method shows the window. */
    getMenu() {
        return this.menu;
    }

    /** This sets the given element as the icon overlay. If null or other [false} is passed
     * this will just clear the icon overlay. */
    setIconOverlay(element) {
        if(this.iconOverlayElement) {
            this.clearIconOverlay();
            if(element) {
                this.iconOverlayElement.appendChild(element);
            }
        }
    }

    clearIconOverlay() {
        if(this.iconOverlayElement) {
            uiutil.removeAllChildren(this.iconOverlayElement);
        }
    }

    /** This method closes the window. */
    close(forceClose) {
        if(!this.tabFrame) return;
        
        if(!forceClose) {
            //make a close request
            var requestResponse = this.callHandler(uiutil.REQUEST_CLOSE,this);
            if(requestResponse == uiutil.DENY_CLOSE) {
                //do not close the window
                return;
            }
        }
        
        this.tabFrame.closeTab(this.id);
        this.tabFrame.removeListener(uiutil.SHOWN_EVENT, this.tabShownListener);
        this.tabFrame.removeListener(uiutil.HIDDEN_EVENT, this.tabHiddenListener);
        this.tabFrame = null;
        
        this.dispatchEvent(uiutil.CLOSE_EVENT,this);
        
        
    }

    //---------------------------
    // GUI ELEMENT
    //---------------------------

    /** This method must be implemented in inheriting objects. */
    getMainElement() {
        return this.displayFrame;
    }

    /** This method must be implemented in inheriting objects. */
    getLabelElement() {
        return this.tabLabelElement;
    }

}

//add mixins to this class
apogeeutil.mixin(Tab,EventManager);

/** This is a tab frame.
 * 
 * @class 
 */
class TabFrame {

    constructor() {
        //mixin initialization
        this.eventManagerMixinInit();
        
        //variables
        this.tabTable = {};
        this.activeTab = null;
        
        this.tabFrameControl = uiutil.createElementWithClass("div","visiui-tf-frame");
        this.tabBar = uiutil.createElementWithClass("div","visiui-tf-tab-bar",this.tabFrameControl);
        this.tabFrame = uiutil.createElementWithClass("div","visiui-tf-tab-container",this.tabFrameControl);   	
    }

    /** This method returns the dom element for the control. */
    getElement() {
        return this.tabFrameControl;
    }

    /** This method returns the main dom element for the window frame. */
    getTab(id) {
        return this.tabTable[id];
    }

    /** This method adds a tab to the tab frame. */
    addTab(tab,makeActive) {
        var id = tab.getId();
        
        //make sure there is no tab with this name
        if(this.tabTable[id]) {
            alert("There is already a tab with this id!");
            return null;
        }
        
        tab.setTabFrame(this);
        this.tabFrame.appendChild(tab.getMainElement());
        
        var tabLabelElement = tab.getLabelElement();
        this.tabBar.appendChild(tabLabelElement);
        
        //add the click handler
        tabLabelElement.onclick = () => {
            this.setActiveTab(id);
        };
        tabLabelElement.onmousedown = (e) => {
            //this prevents text selection
            e.preventDefault();
        };
        
        //add to tabs
        this.tabTable[id] = tab;
        
        if((makeActive)||(this.activeTab == null)) {
            this.setActiveTab(id);
        }
        else {
            this.updateTabDisplay();
        }
    }

    /** This method adds a tab to the tab frame. */
    closeTab(id) {
        var tab = this.tabTable[id];
        if(tab) {
            this.tabFrame.removeChild(tab.getMainElement());
            
            var tabLabelElement = tab.getLabelElement();
            this.tabBar.removeChild(tabLabelElement);
            delete tabLabelElement.onclick;
            delete tabLabelElement.onmousedown;
            
            delete this.tabTable[id];
            
            if(this.activeTab == id) {
                this.dispatchEvent(uiutil.HIDDEN_EVENT,tab);
                this.activeTab = null;
                //choose a random tab
                for(var newId in this.tabTable) {
                    this.setActiveTab(newId);
                    break;
                }
            }
            
            this.updateTabDisplay();
        }
    }

    /** This gets the active tab, by tab id. */
    getActiveTab() {
        return this.activeTab;
    }

    /** This sets the active tab, by tab id. */
    setActiveTab(id) {
        var tab = this.tabTable[id];
        if(tab) {
            var oldTab;
            if(this.activeTab) {
                oldTab = this.tabTable[this.activeTab];
            }
            this.activeTab = id;
            this.tabFrame.appendChild(tab.getMainElement());
            this.updateTabDisplay();
            if(oldTab) {
                this.dispatchEvent(uiutil.HIDDEN_EVENT,oldTab);
            }
            this.dispatchEvent(uiutil.SHOWN_EVENT,tab);
            
        }
    }

    /** This gets the active tab, by tab id. */
    getOpenTabs() {
        var openTabs = [];
        for(var idString in this.tabTable) {
            var id = parseInt(idString);
            openTabs.push(id);
        }
        return openTabs;
    }

    /** This updates the tabs. */
    updateTabDisplay() {
        var id;
        for(id in this.tabTable) {
            var tab = this.tabTable[id];
            if(id == this.activeTab) {
                tab.getMainElement().style.display = "";
                tab.getLabelElement().className = "visiui-tf-tab-base visiui-tf-tab-active";
            }
            else {
                tab.getMainElement().style.display = "none";
                tab.getLabelElement().className = "visiui-tf-tab-base visiui-tf-tab-inactive";
            }
        }
    }

}

//add mixins to this class
apogeeutil.mixin(TabFrame,EventManager);

/** This is a split pane, with a right and left pane. The types of pane are 
 * given by the constants defined below:
 * SplitPane.SCROLLING_PANE
 * SplitPane.FIXED_PANE
 */ 
class SplitPane {

    constructor(leftPaneType,rightPaneType) {
        //mixin initialization
        this.eventManagerMixinInit();

        //-----------------
        // Create the DOM elements
        //-----------------
        
        this.container1 = uiutil.createElementWithClass("div","visiui-sp-parent");
        var container2 = uiutil.createElementWithClass("div","visiui-sp-parent2",this.container1);
        var table = uiutil.createElementWithClass("table","visiui-sp-table",container2);
        
        var row = uiutil.createElementWithClass("tr","visiui-sp-row",table);
        
        var leftCell = uiutil.createElementWithClass("td","visiui-sp-left",row);
        var divider = uiutil.createElementWithClass("td","visiui-sp-divider",row);
        var rightCell = uiutil.createElementWithClass("td","visiui-sp-right",row);

        var leftInnerPane = uiutil.createElementWithClass("div","visiui-sp-inner",leftCell);
        this.leftOuterPane = uiutil.createElementWithClass("div",leftPaneType,leftInnerPane);
        
        var rightInnerPane = uiutil.createElementWithClass("div","visiui-sp-inner",rightCell);
        this.rightOuterPane = uiutil.createElementWithClass("div",rightPaneType,rightInnerPane);

        //-----------------
        // Create the mouse handler logic for resizing
        //-----------------
        var resizeActive = false;
        var resizeBasePixels = 0;
        var resizeBasePosition = 0;
        
        //mouse down handler
        var mouseDown = function(e) {

                resizeActive = true;
                resizeBasePixels = e.clientX;
                resizeBasePosition = leftCell.offsetWidth;

                //add resize events to the parent, since the mouse can leave this element during a move
                table.addEventListener("mouseup",mouseUp);
                table.addEventListener("mousemove",mouseMove);
                table.addEventListener("mouseleave",mouseLeave);
        };

        //mouse move handler
        var mouseMove = (e) => {
            if(resizeActive) {
                var delta = e.clientX - resizeBasePixels;
                leftCell.style.width = (resizeBasePosition + delta) + "px";
                this.dispatchEvent("move",this);
            }
        };

        //mouse up handler
        var mouseUp = function(e) {
            endResize();
        };

        //mouse leave handler
        var mouseLeave = function(e) {
            endResize();
        };
        
        //end resize function
        var endResize = function() {
            resizeActive = false;
            table.removeEventListener("mouseup",mouseUp);
            table.removeEventListener("mousemove",mouseMove);
            table.removeEventListener("mouseleave",mouseLeave);
        };
        
        divider.addEventListener("mousedown",mouseDown);

    }

    /** this method returns the DOM element for ths split pane. */
    getOuterElement() {
        return this.container1;
    }

    /** this method returns the content element for the left pane. */
    getLeftPaneContainer() {
        return this.leftOuterPane;
    }

    /** this method returns the content element for the left pane. */
    getRightPaneContainer() {
        return this.rightOuterPane;
    }

}

//add mixins to this class
apogeeutil.mixin(SplitPane,EventManager);

/** This is the pane type for a pane that scrolls in both X and Y, iv needed. */
SplitPane.SCROLLING_PANE = "visiui-sp-scrolling";

/** This is the pane type for a pane that does not scrolling, hiding any overflow. */
SplitPane.FIXED_PANE = "visiui-sp-fixed";

class TreeControl {

    constructor() {
        this.list = uiutil.createElementWithClass("ul","visiui-tc-child-list",this.element); 
    }

    /** The outer DOM element */
    getElement() {
        return this.list;
    }

    setRootEntry(treeEntry) {
        this.clearRootEntry();
        this.list.appendChild(treeEntry.getElement());
    }

    clearRootEntry() {
        uiutil.removeAllChildren(this.list);
    }

}

class TreeEntry {

    constructor(labelText,iconSrc,dblClickCallback,menuItemCallback,isRoot) {
        
        this.contractUrl = uiutil.getResourcePath("/opened_bluish.png");
        this.expandUrl = uiutil.getResourcePath("/closed_bluish.png");
        this.noControlUrl = uiutil.getResourcePath("/circle_bluish.png");
        this.emptyControlUrl = uiutil.getResourcePath("/circle_bluish.png");
        
        this.isRoot = isRoot;
        
        var baseCssClass;
        if(isRoot) {
            baseCssClass = "visiui-tc-root";
        }
        else {
            baseCssClass = "visiui-tc-child";
        }
        
        this.element = uiutil.createElementWithClass("li", baseCssClass);
        this.control = uiutil.createElementWithClass("img", "visiui-tc-control",this.element);
        

        //icon/menu
        if(iconSrc) {
            this.iconContainerElement = uiutil.createElementWithClass("div", "visiui-tc-icon-container",this.element);
            if(menuItemCallback) {
                //icon as menu
                this.menu = Menu.createMenuFromImage(iconSrc);
                this.menu.setAsOnTheFlyMenu(menuItemCallback);
                this.iconContainerElement.appendChild(this.menu.getElement());
            }
            else {
                //plain icon
                this.icon = uiutil.createElementWithClass("img", "visiui-tc-icon",this.iconContainerElement);
                this.icon.src = iconSrc; 
            }
            this.iconOverlayElement = uiutil.createElementWithClass("div","visiui_tc_icon_overlay",this.iconContainerElement);
        }
        
        
        
        //label
        this.label = uiutil.createElementWithClass("div", "visiui-tc-label",this.element);
        if(labelText) {
            this.setLabel(labelText);
        }
        
        this.childContainer = null;
        this.childEntries = [];
        this.parent = null;
        this.sortFunction = null;
        this.extraSortParam = null;
        
        //set the non-empty state for in case we get children
        //but for now it will be empty
        this.nonEmptyState = TreeEntry.DEFAULT_STATE;
        this.setState(TreeEntry.NO_CONTROL);
        
        //context menu and double click
        var contextMenuCallback = (event) => {
            var contextMenu = Menu.createContextMenu();
            var menuItems = menuItemCallback();
            contextMenu.setMenuItems(menuItems);
            Menu.showContextMenu(contextMenu,event);
        };
        this.label.oncontextmenu = contextMenuCallback;
        
        //double click action
        if(dblClickCallback) {
            this.label.ondblclick = dblClickCallback;
        }
    }

    /** The outer DOM element */
    getElement() {
        return this.element;
    }

    /** This sets a sort function for the children of the node. If none is set the
     * children will be sorted by the order they are added. */
    setSortFunction(sortFunction) {
        this.sortFunction = sortFunction;
    }

    /** The label for the entry. */
    setLabel(labelText) {
        this.labelText = labelText;
        this.label.innerHTML = labelText;
        if(this.parent) {
            this.parent._notifyNameChange(this);
        }
    }

    /** The label for the entry. */
    getLabel() {
        return this.labelText;
    }

    /** This allows for specified ordering of the chidlren. */
    setExtraSortParam(value) {
        this.extraSortParam = value;
    }

    /** This allows for specified ordering of the chidlren. */
    getExtraSortParam() {
        return this.extraSortParam;
    }

    addChild(childTreeEntry) {
        this.childEntries.push(childTreeEntry);
        this._insertChildIntoList(childTreeEntry);
        childTreeEntry._setParent(this);
    }

    removeChild(childTreeEntry) {
        if(this.childContainer) {
            var index = this.childEntries.indexOf(childTreeEntry);
            if(index >= 0) {
                this.childEntries.splice(index,1);
                this._removeChildFromList(childTreeEntry);
                childTreeEntry._setParent(null);
            }
        }
    }

    getState() {
        return this.state;
    }

    setState(state) {
        //if we have no children, always make the state no control
        //but we will store the state below for latert
        if((!this.childContainer)||(this.childContainer.length == 0)) {
            this.state = TreeEntry.NO_CONTROL;
        }
        else {
            this.state = state;
        }
        
        //save this as the non-empty state if it is not no control
        if(state != TreeEntry.NO_CONTROL) {
            this.nonEmptyState = state;
        }
        
        //configure the state
        if(this.state == TreeEntry.NO_CONTROL) {
            if(this.isRoot) {
                this.control.src = this.emptyControlUrl;
            }
            else {
                this.control.src = this.noControlUrl;
            }
        }
        else if(this.state == TreeEntry.EXPANDED) {
            this.control.src = this.contractUrl;
            
            if(!this.collapse) {
                this.collapse = () => {
                    this.setState(TreeEntry.COLLAPSED);
                };
            }
            
            this.control.onclick = this.collapse;
            this.childContainer.style.display = "";
        }
        else if(this.state == TreeEntry.COLLAPSED) {
            this.control.src = this.expandUrl;
            
            if(!this.expand) {
                this.expand = () => {
                    this.setState(TreeEntry.EXPANDED);
                };
            }
            
            this.control.onclick = this.expand;
            this.childContainer.style.display = "none";
        }
    }

    /** This sets the given element as the icon overlay. If null or other [false} is passed
     * this will just clear the icon overlay. */
    setIconOverlay(element) {
        this.clearIconOverlay();
        if(element) {
            this.iconOverlayElement.appendChild(element);
        }
    }

    clearIconOverlay() {
        uiutil.removeAllChildren(this.iconOverlayElement);
    }

    setBannerState(bannerState) {
        var iconOverlay = getIconOverlay(bannerState);
        if(iconOverlay) {
            this.setIconOverlay(iconOverlay);
        }
        else {
            this.clearIconOverlay();
        }
    }

    //=====================================
    // Private
    //=====================================

    /** I want to make sure people don't do this themselves. It is done in add/remove child. 
     * @private */
    _setParent(parent) {
        this.parent = parent;
    }

    /** I want to make sure people don't do this themselves. It is done in add/remove child. 
     * @private */
    _insertChildIntoList(childEntry) {
        if(!this.childContainer) {
            //add the child list if it does not exist
            this.childContainer = uiutil.createElementWithClass("ul","visiui-tc-child-list",this.element); 
            this.setState(this.nonEmptyState);
        }
        
        if(this.sortFunction) {
            this._updateChildElements();
        }
        else {
            this.childContainer.appendChild(childEntry.getElement());
        }
    }

    /** I want to make sure people don't do this themselves. It is done in add/remove child. 
     * @private */
    _removeChildFromList(childEntry) {
        this.childContainer.removeChild(childEntry.getElement());
        
        //remove the child list if there are no children
        if(this.childContainer.childElementCount === 0) {
            this.element.removeChild(this.childContainer);
            this.childContainer = null;
            //set state to empty, but save our old setting
            this.nonEmtpyState = this.state;
            this.setState(TreeEntry.NO_CONTROL); 
        }
    }

    /** I want to make sure people don't do this themselves. It is done in add/remove child. 
     * @private */
    _notifyNameChange(childEntry) {
        if(this.sortFunction) {
            this._updateChildElements();
        }
    }

    /** This sets the children elements in the sorted order 
     * @private */
    _updateChildElements() {
    var temp = this.childEntries.map( element => element);
    temp.sort(this.sortFunction);
    uiutil.removeAllChildren(this.childContainer);
    temp.forEach(child => this.childContainer.appendChild(child.getElement()));

    }    

}


TreeEntry.NO_CONTROL = 0;
TreeEntry.EXPANDED = 1;
TreeEntry.COLLAPSED = -1;

TreeEntry.DEFAULT_STATE = TreeEntry.EXPANDED;

let ConfigurablePanelConstants = {};

ConfigurablePanelConstants.STATE_NORMAL = "normal";
ConfigurablePanelConstants.STATE_DISABLED = "disabled";
ConfigurablePanelConstants.STATE_HIDDEN = "hidden";
ConfigurablePanelConstants.STATE_INACTIVE = "inactive";

ConfigurablePanelConstants.DEFAULT_SUBMIT_LABEL = "OK";
ConfigurablePanelConstants.DEFAULT_CANCEL_LABEL = "Cancel";

/** This is a panel with forma elements that can be configured using a javascript object.
 * 
 * @class 
 */
class ConfigurablePanel {
    
    constructor(optionalContainerClassName = ConfigurablePanel.CONTAINER_CLASS_SELF_SIZED) {
        this.elementObjects = [];
        this.panelElement = this.createPanelElement(optionalContainerClassName); 
    }
    
    configureForm(formInitData) {
        
        //TEMPORARY - legacy check correction----------------------
        if((formInitData)&&(formInitData.constructor == Array)) {
            formInitData = {layout:formInitData};
        }
        //---------------------------------------------------------
        
        //check for an invalid input
        if((!formInitData)||(!formInitData.layout)||(formInitData.layout.constructor != Array)) {
            formInitData = ConfigurablePanel.INVALID_INIT_DATA;
        }
        
        //clear data
        uiutil.removeAllChildren(this.panelElement);
        this.elementObjects = [];
        
        try {
            //create elements     
            formInitData.layout.forEach(elementInitData => this.addToPanel(elementInitData));

            //additional init
            if(formInitData.onChange) {
                this.addOnChange(formInitData.onChange);
            }

            if(formInitData.onSubmitInfo) {
                this.addSubmit(formInitData.onSubmitInfo.onSubmit,
                    formInitData.onSubmitInfo.onCancel,
                    formInitData.onSubmitInfo.submitLabel,
                    formInitData.onSubmitInfo.cancelLabel);
            }

            if(formInitData.disabled) {
                this.setDisabled(true);
            }
        }
        catch(error) {
            var errorMsg = "Error in panel: " + error.message;
            
            //display an error layout
            //but only try this once. If the error layout throws an error jsut continue
            if(!formInitData.isErrorLayout) {
                var errorLayoutInfo = ConfigurablePanel.getErrorMessageLayoutInfo(errorMsg);
                this.configureForm(errorLayoutInfo);
            }
        }
    }
    
    /** This method returns the ConfigurableElement for the given key. */
    getEntry(key) {
        return this.elementObjects.find(elementObject => elementObject.getKey() == key);
    }

    /** This method returns the data value object for this given panel. */
    getValue() {
        var formValue = {};
        var addValue = elementObject => {
            if(elementObject.getState() != ConfigurablePanelConstants.STATE_INACTIVE) {
                var elementValue = elementObject.getValue();
                if(elementValue !== undefined) {
                    var key = elementObject.getKey();
                    formValue[key] = elementValue;
                }
            }
        };
        this.elementObjects.forEach(addValue);
        return formValue;
    }
    
    /** This method returns the data value object for this given panel. */
    setValue(formValue) {
        for(var key in formValue) {
            var entry = this.getEntry(key);
            if(entry) {
                entry.setValue(formValue[key]);
            }
        }
    }
    
    getElement() {
        return this.panelElement;
    }
    
    getChildEntries() {
        return this.elementObjects;
    }
    
    /** This is an alternate way to add a submit entry to the form. This is useful
     * if the layout has no other handlers in it and is a pure JSON object. This 
     * will then separate out any handlers from the layout. */
    addSubmit(onSubmit,
            onCancel,
            optionalSubmitLabel = ConfigurablePanelConstants.DEFAULT_SUBMIT_LABEL,
            optionalCancelLabel = ConfigurablePanelConstants.DEFAULT_CANCEL_LABEL) {
                
        var data = {};
        data.type = "submit";
        if(onSubmit) {
            data.onSubmit = onSubmit;
            data.submitLabel = optionalSubmitLabel;
        }
        if(onCancel) {
            data.onCancel = onCancel;
            data.cancelLabel = optionalCancelLabel;
        }
        
        this.addToPanel(data);
    }
    
    //takes a handler onChange(formValue,form)
    addOnChange(onChange) {
        var childOnChange = (childValue,form) => {
            var formValue = this.getValue();
            onChange(formValue,form);
        };
        this.elementObjects.forEach( elementObject => {if(elementObject.addOnChange) elementObject.addOnChange(childOnChange);} );
    }
    
    setDisabled(isDisabled) {
        this.elementObjects.forEach( elementObject => {
            if(elementObject._setDisabled) {
                elementObject._setDisabled(isDisabled);
            }
        });
    }
    
    /** This method is used to register configurable elements with the panel */
    static addConfigurableElement(constructorFunction) {
        var type = constructorFunction.TYPE_NAME;
        ConfigurablePanel.elementMap[type] = constructorFunction;
    }
    
    /** This method can be used to generate an error message layout. */
    static getErrorMessageLayoutInfo(errorMsg) {
        var layout = [];
        var entry = {};
        entry.type = "htmlDisplay";
        entry.html = "<em style='color:red'>" + errorMsg + "</em>";
        layout.push(entry);
        return {"layout":layout, "isErrorLayout": true};
    }
    
    //=================================
    // Private methods
    //=================================
    
    /** This creates the container element for the panel. */
    createPanelElement(containerClassName) {
        var panelElement = document.createElement("div");
        panelElement.className = containerClassName;
        return panelElement;
    }
    
    /** this is called internally to add an element to the panel. */
    addToPanel(elementInitData) {
        var type = elementInitData.type;
        if(!type) {
            throw new Error("Type not found for configurable form entry!");
        }
        
        var constructor = ConfigurablePanel.getTypeConstructor(type);
        if(!constructor) {
            throw new Error("Type not found for configurable element: " + type);
        }

        var elementObject = new constructor(this,elementInitData);

        
        this.elementObjects.push(elementObject);
        var domElement = elementObject.getElement();
        if(domElement) {
            this.panelElement.appendChild(domElement);
        }
    }
    
    static getTypeConstructor(type) {
        return ConfigurablePanel.elementMap[type];
    }
}

//static fields
ConfigurablePanel.elementMap = {};

ConfigurablePanel.CONTAINER_CLASS_FILL_PARENT = "apogee_configurablePanelBody_fillParent";
ConfigurablePanel.CONTAINER_CLASS_SELF_SIZED = "apogee_configurablePanelBody_selfSized";

//This is displayed if there is an invalid layout passed in
ConfigurablePanel.INVALID_INIT_DATA = {
    layout: [
        {
            type: "heading",
            text: "INVALID FORM LAYOUT!",
            level: 4
        }
    ]
};

/** This is an element that composes the content of a configurable panel.
 * 
 * @class 
 */
class ConfigurableElement {
    constructor(form,elementInitData,optionalContainerClassName = ConfigurableElement.CONTAINER_CLASS_STANDARD) {
        this.form = form;
        this.key = elementInitData.key;
        this.domElement = uiutil.createElement("div",{"className":optionalContainerClassName});
    }
    
    /** This method returns the key for this ConfigurableElement within this panel. */
    getKey() {
        return this.key;
    }

    /** This method returns value for this given element, if applicable. If not applicable
     * this method returns undefined. */
    getValue() {
        return undefined;
    }  
    
    getState() {
        return this.state;
    }

    /** This hides or shows the given element within the panel. */
    setState(state) {
        this.state = state;

console.log("Settings state: " + state + "; element key: " + this.key);
         
        switch(state) {
            case ConfigurablePanelConstants.STATE_NORMAL:
                this._setVisible(true);
                this._setDisabled(false);
                break;
                
            case ConfigurablePanelConstants.STATE_DISABLED:
                this._setVisible(true);
                this._setDisabled(true);
                break;
                
            case ConfigurablePanelConstants.STATE_HIDDEN:
                this._setVisible(false);
                break;
                
            case ConfigurablePanelConstants.STATE_INACTIVE:
                this._setVisible(false);
                break;
        }
        
    }

    /** This method updates the value for a given element. See the specific element
     * to see if this method is applicable. */
    setValue(value) {
    }

    /** This method returns the DOM element for this configurable element. */
    getElement() {
        return this.domElement;
    }
    
    /** This method returns the parent form for this configurable element. */
    getForm() {
        return this.form;
    }
    
    /** This allows this element to control visibility of the given child.
     * When the value of the element is set, the child will be made visible depending
     * if its childs target valud matches the current element value. */
    addSelectionChild(childElement,value,keepActiveOnHide) {
        if(!this.childSelectionElements) {
            this._initAsParent();
        }
        var childData = {};
        childData.element = childElement;
        childData.value = value;
        childData.keepActiveOnHide = keepActiveOnHide;
        this.childSelectionElements.push(childData);
        
        this.setChildState(childData,this.getValue());
    }
    
    checkChildSelection(value) {
        if((this.childSelectionElements)&&(this.setChildState)) {
            this.childSelectionElements.forEach( childData => this.setChildState(childData,value));
        } 
    }
    
//    /* Implement this if the element can selector children */
//    setChildState(childData,value) {
//        
//    }

    //---------------------------------
    //set child state implementations
    //---------------------------------
    
    /** This is a function that can be used to set values when the parent element has a single value. */
    static setChildStateSingleValue(childData,value) {
console.log("Setting child state single. Child Data Value: " + childData.value + ". Parent value: " + value);
        if(childData.value == value) {
            childData.element.setState(ConfigurablePanelConstants.STATE_NORMAL);
        }
        else {
            var state = childData.keepActiveOnHide ? ConfigurablePanelConstants.STATE_HIDDEN : ConfigurablePanelConstants.STATE_INACTIVE;
            childData.element.setState(state);
        }
    }
    
    /** This is a function that can be used to set values when the parent element has an array value. */
    static setChildStateArrayValue(childData,value) {
console.log("Setting child state array.");
        if(value.indexOf(childData.value) >= 0) {
            childData.element.setState(ConfigurablePanelConstants.STATE_NORMAL);
        }
        else {
            var state = childData.keepActiveOnHide ? ConfigurablePanelConstants.STATE_HIDDEN : ConfigurablePanelConstants.STATE_INACTIVE;
            childData.element.setState(state);
        }
    }
    
    
    //===================================
    // internal Methods
    //==================================
    
    /** This method does standard initialization which requires the element be created. 
     * Any extending method should call this at the end of the constructor. */
    _postInstantiateInit(elementInitData) {
        
        //standard fields
        if(elementInitData.value !== undefined) {
            this.setValue(elementInitData.value);
        }
        
        var state = (elementInitData.state != undefined) ? elementInitData.state : ConfigurablePanelConstants.STATE_NORMAL;
        this.setState(state);
        
        //standard events
        if(elementInitData.onChange) {
            this.addOnChange(elementInitData.onChange);
        }
        
        //accont for parent elements
        if(elementInitData.selector) {
            if(!elementInitData.selector.parentKey) throw new Error("Parent key is required for a selectable child element:" + elementInitData.key);
            if(elementInitData.selector.parentValue === undefined) throw new Error("A child selectable element must contain a value: " + elementInitData.key)
            var parentElement = this.form.getEntry(elementInitData.selector.parentKey);
            if(!parentElement) throw new Error("Parent element " + elementInitData.selector.parentKey + " not found for selectable child element " + elementInitData.key);
            if(!parentElement.setChildState) throw new Error("Parent element " + elementInitData.selector.parentKey + " does not support selection of a child element - in element = " + elementInitData.key);
            
            parentElement.addSelectionChild(this,elementInitData.selector.parentValue,elementInitData.selector.keepActiveOnHide);
        }
    }
    
    _setDisabled(isDisabled) {};
    
    _setVisible(isVisible) {
        if(isVisible) {
            this.domElement.style.display = "";
        }
        else {
            this.domElement.style.display = "none";
        }
    }
    
    _initAsParent() {
        this.childSelectionElements = [];
        this.parentOnChangeHandler = (value,form) => this.childSelectionElements.forEach( childElement => this.setChildState(childElement,value));
        this.addOnChange(this.parentOnChangeHandler);
    }
}

ConfigurableElement.CONTAINER_CLASS_STANDARD = "apogee_configurablePanelLine_standard";
ConfigurableElement.CONTAINER_CLASS_NO_MARGIN = "apogee_configurablePanelPanelLine_noMargin";
ConfigurableElement.CONTAINER_CLASS_INVISIBLE = "apogee_configurablePanelPanelLine_hidden";

/** This is an text field element configurable element.
 * 
 * @class 
 */
class CheckboxElement extends ConfigurableElement {
    constructor(form,elementInitData) {
        super(form,elementInitData);
        
        var containerElement = this.getElement();
        
        //label
        if(elementInitData.label) {
            this.labelElement = document.createElement("span");
            this.labelElement.className = "apogee_configurablePanelLabel";
            this.labelElement.innerHTML = elementInitData.label;
            containerElement.appendChild(this.labelElement);
        }
        else {
            this.labelElement = null;
        }
        
        //checkbox field
        this.checkbox = uiutil.createElement("input",{"type":"checkbox"});
        containerElement.appendChild(this.checkbox);  
        
        this._postInstantiateInit(elementInitData);
        
        //add suport for selection children
        this.setChildState = ConfigurableElement.setChildStateSingleValue;
    }
    
    /** This method returns value for this given element, if applicable. If not applicable
     * this method returns undefined. */
    getValue() {
        return this.checkbox.checked;
    }   

    /** This method updates the value for a given element. See the specific element
     * to see if this method is applicable. */
    setValue(value) {
        this.checkbox.checked = (value === true);
        
        //needed for selection children
        this.checkChildSelection(value);
    }
    
    /** This should be extended in elements to handle on change listeners. */
    addOnChange(onChange) {
        var onChangeImpl = () => {
            onChange(this.getValue(),this.getForm());
        };
        this.checkbox.addEventListener("change",onChangeImpl);
    }
    
    //===================================
    // internal Methods
    //==================================
    
    _setDisabled(isDisabled) { 
        this.checkbox.disabled = isDisabled;
    }
}

CheckboxElement.TYPE_NAME = "checkbox";

/** This is an text field element configurable element.
 * 
 * @class 
 */
class CheckboxGroupElement extends ConfigurableElement {
    constructor(form,elementInitData) {
        super(form,elementInitData);
        
        var containerElement = this.getElement();
        
        //label
        if(elementInitData.label) {
            this.labelElement = document.createElement("span");
            this.labelElement.className = "apogee_configurablePanelLabel";
            this.labelElement.innerHTML = elementInitData.label;
            containerElement.appendChild(this.labelElement);
            
            if(!elementInitData.horizontal) containerElement.appendChild(document.createElement("br"));
        }
        else {
            this.labelElement = null;
        }
        
        //check boxes
        this.checkboxList = [];
        var addCheckbox = checkboxInfo => {
            var buttonContainer = uiutil.createElement("div");
            buttonContainer.style.display = elementInitData.horizontal ? "inline-block" : "block";
            containerElement.appendChild(buttonContainer);

            var checkbox = uiutil.createElement("input");
            checkbox.type = "checkbox";
            
            var label;
            var value;
            if(apogeeutil.getObjectType(checkboxInfo) == "Array") {
                label = checkboxInfo[0];
                value = checkboxInfo[1];     
            }
            else {
                label = checkboxInfo;
                value = checkboxInfo; 
            }
            checkbox.value = value;
            this.checkboxList.push(checkbox);
            buttonContainer.appendChild(checkbox);
            buttonContainer.appendChild(document.createTextNode(label));

            if(elementInitData.horizontal) buttonContainer.appendChild(document.createTextNode("\u00A0\u00A0\u00A0\u00A0"));

            
            if(elementInitData.disabled) checkbox.disabled = true;
        };
        elementInitData.entries.forEach(addCheckbox);   
        
        this._postInstantiateInit(elementInitData);
        
        //add suport for selection children
        this.setChildState = ConfigurableElement.setChildStateArrayValue;
    }
    
    /** This method returns value for this given element, if applicable. If not applicable
     * this method returns undefined. */
    getValue() {
        return this.checkboxList.filter(checkbox => checkbox.checked).map(checkbox => checkbox.value);
    }   

    /** This method updates the list of checked entries. */
    setValue(valueList) {
        this.checkboxList.forEach(checkbox => checkbox.checked = (valueList.indexOf(checkbox.value) >= 0));
        
        //needed for selection children
        this.checkChildSelection(valueList);
    }
    
    /** This should be extended in elements to handle on change listeners. */
    addOnChange(onChange) {
        var onChangeImpl = () => {
            onChange(this.getValue(),this.getForm());
        };
        this.checkboxList.forEach(checkbox => checkbox.addEventListener("change",onChangeImpl));
    }
    
    //===================================
    // internal Methods
    //==================================
    
    _setDisabled(isDisabled) { 
        this.checkboxList.forEach(checkbox => checkbox.disabled = isDisabled);
    }
}

CheckboxGroupElement.TYPE_NAME = "checkboxGroup";

/** This is a custom configurable element.
 * It elementInfoData should contain the entries:
 * - type - this should be the value "custom"
 * - key - this is the standard element key
 * - builderFunction - this is a function that takes the instance as an argument. it should be used to add
 * or override any functions to the instance.
 * 
 * @class 
 */
class CustomElement extends ConfigurableElement {

    constructor(form,elementInitData) {
        super(form,elementInitData);
        
        elementInitData.builderFunction(this);
    }

}

CustomElement.TYPE_NAME = "custom";

/** This is an text field element configurable element.
 * 
 * @class 
 */
class DropdownElement extends ConfigurableElement {
    constructor(form,elementInitData) {
        super(form,elementInitData);
        
        var containerElement = this.getElement();
        
        //label
        if(elementInitData.label) {
            this.labelElement = document.createElement("span");
            this.labelElement.className = "apogee_configurablePanelLabel";
            this.labelElement.innerHTML = elementInitData.label;
            containerElement.appendChild(this.labelElement);
        }
        else {
            this.labelElement = null;
        }
        
        this.select = uiutil.createElement("select");
        var addEntry = entryInfo => {
            var label;
            var value;
            if(apogeeutil.getObjectType(entryInfo) == "Array") {
                label = entryInfo[0];
                value = entryInfo[1];
            }
            else {
                label = entryInfo;
                value = entryInfo;   
            }
            var entry = document.createElement("option");
            entry.text = label;
            entry.value = value;
            this.select.appendChild(entry);
        };
        if(elementInitData.entries) {
            elementInitData.entries.forEach(addEntry);
        }
        containerElement.appendChild(this.select); 
        
        this._postInstantiateInit(elementInitData);
        
        //add suport for selection children
        this.setChildState = ConfigurableElement.setChildStateSingleValue;
    }
    
    /** This method returns value for this given element, if applicable. If not applicable
     * this method returns undefined. */
    getValue() {
        return this.select.value;
    }   

    /** This method updates the value for a given element. See the specific element
     * to see if this method is applicable. */
    setValue(value) {
        this.select.value = value;
        
        //needed for selection children
        this.checkChildSelection(value);
    }
    
    /** This should be extended in elements to handle on change listeners. */
    addOnChange(onChange) {
        var onChangeImpl = () => {
            onChange(this.getValue(),this.getForm());
        };
        this.select.addEventListener("change",onChangeImpl);
    }
    
    
  
    
    //===================================
    // internal Methods
    //==================================
    
    _setDisabled(isDisabled) { 
        this.select.disabled = isDisabled;
    }
}

DropdownElement.TYPE_NAME = "dropdown";

/** This is a heading element configurable element.
 * 
 * @class 
 */
class HeadingElement extends ConfigurableElement {

    constructor(form,elementInitData) {
        super(form,elementInitData);
        
        var containerElement = this.getElement();
        
        var headingLevel;
        if(elementInitData.level) { 
            headingLevel = elementInitData.level;
        }
        else {
            headingLevel = HeadingElement.DEFAULT_HEADING_LEVEL;
        }
        var headingType = "h" + headingLevel;
        
        this.headingElement = uiutil.createElement(headingType,{"className":"apogee_configurablePanelHeading","innerHTML":elementInitData.text});
        containerElement.appendChild(this.headingElement);
    }

    /** This method updates the data for the given element. See the specific element
     * type for fields that can be updated. */
    updateData(elementInitData) {
        //no action;
    }
}


HeadingElement.DEFAULT_HEADING_LEVEL = 2;

HeadingElement.TYPE_NAME = "heading";

/** This is a heading element configurable element.
 * 
 * @class 
 */
class HTMLDisplayElement extends ConfigurableElement {

    constructor(form,elementInitData) {
        super(form,elementInitData);
        
        var containerElement = this.getElement();
        
        containerElement.innerHTML = elementInitData.html;
    }

    /** This method updates the data for the given element. See the specific element
     * type for fields that can be updated. */
    updateData(elementInitData) {
        //no action;
    }
}

HTMLDisplayElement.TYPE_NAME = "htmlDisplay";

/** This is an text field element configurable element.
 * 
 * @class 
 */
class InvisibleElement extends ConfigurableElement {
    constructor(form,elementInitData) {
        //we will hide this element by setting display none. Someone can go ahead 
        //and show it, in which case they will get an empty element with margins.
        //maybe we should have a way to not create the element in the first place.
        super(form,elementInitData,ConfigurableElement.CONTAINER_CLASS_INVISIBLE);
        
        this._postInstantiateInit(elementInitData);
    }
    
    /** This method returns value for this given element, if applicable. If not applicable
     * this method returns undefined. */
    getValue() {
        return this.value;
    }   

    /** This method updates the value for a given element. See the specific element
     * to see if this method is applicable. */
    setValue(value) {
        this.value = value;
    }
}

InvisibleElement.TYPE_NAME = "invisible";

/** This is an text field element configurable element.
 * 
 * @class 
 */
class PanelElement extends ConfigurableElement {
    constructor(form,elementInitData) {
        super(form,elementInitData,ConfigurableElement.CONTAINER_CLASS_NO_MARGIN);
        
        var containerElement = this.getElement();
        //update the container class
        containerElement.className = "apogee_configurablePanelPanelLine";
        
        var formInitData = elementInitData.formData;
        this.panel = new ConfigurablePanel();
        this.panel.configureForm(formInitData);
        var panelElement = this.panel.getElement();
        panelElement.className = "apogee_configurablePanelPanelLine";
        containerElement.appendChild(panelElement);  
        
        this._postInstantiateInit(elementInitData);
    }
    
    /** This method returns value for this given element, if applicable. If not applicable
     * this method returns undefined. */
    getValue() {
        return this.panel.getValue();
    }   

    /** This method updates the value for a given element. See the specific element
     * to see if this method is applicable. */
    setValue(value) {
        this.panel.setValue(value);
    }
    
    /** This will call the handler is this panel changes value. */
    addOnChange(onChange) {
        //add this to each element in the panel
        this.panel.getChildEntries().forEach( elementObject => {if(elementObject.addOnChange) elementObject.addOnChange(onChange);} );
    }
    
    //===================================
    // internal Methods
    //==================================
    
    _setDisabled(isDisabled) { 
        this.panel.setDisabled(isDisabled);
    }
}

PanelElement.TYPE_NAME = "panel";

/** This is an text field element configurable element.
 * 
 * @class 
 */
class RadioGroupElement extends ConfigurableElement {
    constructor(form,elementInitData) {
        super(form,elementInitData);
        
        var containerElement = this.getElement();
        
        //label
        if(elementInitData.label) {
            this.labelElement = document.createElement("span");
            this.labelElement.className = "apogee_configurablePanelLabel";
            this.labelElement.innerHTML = elementInitData.label;
            containerElement.appendChild(this.labelElement);
            
            if(!elementInitData.horizontal) containerElement.appendChild(document.createElement("br"));
        }
        else {
            this.labelElement = null;
        }
        
        //radio buttons
        this.buttonList = [];
        var groupName = elementInitData.groupName;
        var addButton = buttonInfo => {
            var buttonContainer = uiutil.createElement("div");
            buttonContainer.style.display = elementInitData.horizontal ? "inline-block" : "block";
            containerElement.appendChild(buttonContainer);

            var radio = uiutil.createElement("input");
            radio.type = "radio";
            radio.name = groupName;
            
            var label;
            var value;
            if(apogeeutil.getObjectType(buttonInfo) == "Array") {
                label = buttonInfo[0];
                value = buttonInfo[1];     
            }
            else {
                label = buttonInfo;
                value = buttonInfo; 
            }
            radio.value = value;
            this.buttonList.push(radio);
            buttonContainer.appendChild(radio);
            buttonContainer.appendChild(document.createTextNode(label));
            
            if(elementInitData.horizontal) buttonContainer.appendChild(document.createTextNode("\u00A0\u00A0\u00A0\u00A0"));
        };
        elementInitData.entries.forEach(addButton);
        
        this._postInstantiateInit(elementInitData);
        
        //add suport for selection children
        this.setChildState = ConfigurableElement.setChildStateSingleValue;
    }
    
    /** This method returns value for this given element, if applicable. If not applicable
     * this method returns undefined. */
    getValue() {
        var checkedRadio = this.buttonList.find(radio => radio.checked);
        if(checkedRadio) {
            return checkedRadio.value;
        }
        else {
            return undefined;
        }
    }   

    /** This method updates the list of checked entries. */
    setValue(value) {
        var checkedButton = this.buttonList.find(radioButton => (radioButton.value == value));
        if(checkedButton) {
            checkedButton.checked = true;
        }
        
        //needed for selection children
        this.checkChildSelection(value);
    }
    
    /** This should be extended in elements to handle on change listeners. */
    addOnChange(onChange) {
        var onChangeImpl = () => {
            onChange(this.getValue(),this.getForm());
        };
        this.buttonList.forEach(radioButton => radioButton.addEventListener("change",onChangeImpl));
    }
    
    //===================================
    // internal Methods
    //==================================
    
    _setDisabled(isDisabled) { 
        this.buttonList.forEach(radioButton => radioButton.disabled = isDisabled);
    }
}

RadioGroupElement.TYPE_NAME = "radioButtonGroup";

/** This is an text field element configurable element.
 * 
 * @class 
 */
class SpacerElement extends ConfigurableElement {
    constructor(form,elementInitData) {
        //we will hide this element by setting display none. Someone can go ahead 
        //and show it, in which case they will get an empty element with margins.
        //maybe we should have a way to not create the element in the first place.
        super(form,elementInitData,ConfigurableElement.CONTAINER_CLASS_NO_MARGIN);
        
        var containerElement = this.getElement();
        
        this.spacerElement = document.createElement("div");
        var spacerHeight;
        if(elementInitData.height !== undefined) {
            spacerHeight = elementInitData.height;
        }
        else {
            spacerHeight = SpacerElement.DEFAULT_HEIGHT;
        }
        //this.spacerElement.style.display = "table";
        this.spacerElement.style.height = spacerHeight + "px";
        
        containerElement.appendChild(this.spacerElement);
        
        this._postInstantiateInit(elementInitData);
    }
}

//adding this includes the extra space of two margins rather than one,
//so just one pixel has a large effect
SpacerElement.DEFAULT_HEIGHT = 15;

SpacerElement.TYPE_NAME = "spacer";

/** This is an submit element configurable element.
 * 
 * @class 
 */
class SubmitElement extends ConfigurableElement {
    
    constructor(form,elementInitData) {
        super(form,elementInitData);
        
        var containerElement = this.getElement();

        this.submitDisabled = elementInitData.submitDisabled;
        this.cancelDisabled = elementInitData.cancelDisabled;
        
        //create the submit button
        if(elementInitData.onSubmit) {
            
            var onSubmit = () => {
                var formValue = form.getValue();
                elementInitData.onSubmit(formValue,form);
            };
            
            var submitLabel;
            if(elementInitData.submitLabel) { 
                submitLabel = elementInitData.submitLabel;
            }
            else {
                submitLabel = ConfigurablePanelConstants.DEFAULT_SUBMIT_LABEL;
            }
            
            this.submitButton = uiutil.createElement("button",{"className":"apogee_configurablePanelButton","innerHTML":submitLabel,"onclick":onSubmit});
            containerElement.appendChild(this.submitButton);
        }
        else {
            this.submitButton = null;
        }
        
        //create the cancel button
        if(elementInitData.onCancel) {
            
            var onCancel = () => {
                elementInitData.onCancel(form);
            };
            
            var cancelLabel;
            if(elementInitData.cancelLabel) { 
                cancelLabel = elementInitData.cancelLabel;
            }
            else {
                cancelLabel = ConfigurablePanelConstants.DEFAULT_CANCEL_LABEL;
            }
            
            this.cancelButton = uiutil.createElement("button",{"className":"apogee_configurablePanelButton","innerHTML":cancelLabel,"onclick":onCancel});
            containerElement.appendChild(this.cancelButton);
        }
        else {
            this.cancelButton = null;
        }  

        this._setButtonState();    
        
        this._postInstantiateInit(elementInitData);
    }
    
    submitDisable(isDisabled) {
        this.submitDisabled = isDisabled;
        this._setButtonState();
    }
    
    cancelDisable(isDisabled) {
        this.cancelDisabled = isDisabled;
        this._setButtonState();
    }

    //===================================
    // internal Methods
    //==================================
    
    _setDisabled(isDisabled) { 
        this.overallDisabled = isDisabled;
        this._setButtonState();
    }

    _setButtonState() {
        if(this.submitButton) this.submitButton.disabled = this.overallDisabled || this.submitDisabled;
        if(this.cancelButton) this.cancelButton.disabled = this.overallDisabled || this.cancelDisabled;
    }
}

SubmitElement.TYPE_NAME = "submit";

/** This is an text field element configurable element.
 * 
 * @class 
 */
class TextareaElement extends ConfigurableElement {
    constructor(form,elementInitData) {
        super(form,elementInitData);
        
        var containerElement = this.getElement();
        
        //label
        if(elementInitData.label) {
            this.labelElement = document.createElement("span");
            this.labelElement.className = "apogee_configurablePanelLabel";
            this.labelElement.innerHTML = elementInitData.label;
            containerElement.appendChild(this.labelElement);
        }
        else {
            this.labelElement = null;
        }
        
        //text field
        this.inputElement = uiutil.createElement("textarea");
        if(elementInitData.rows) {
            this.inputElement.rows = elementInitData.rows;
        }
        if(elementInitData.cols) {
            this.inputElement.cols = elementInitData.cols;
        }
        containerElement.appendChild(this.inputElement); 
        
        //non standard events
        if(elementInitData.onChangeCompleted) {
            this.addOnChangeCompleted(elementInitData.onChangeCompleted);
        }
        
        this._postInstantiateInit(elementInitData);
    }
    
    /** This method returns value for this given element, if applicable. If not applicable
     * this method returns undefined. */
    getValue() {
        return this.inputElement.value.trim();
    }   

    /** This method updates the value for a given element. See the specific element
     * to see if this method is applicable. */
    setValue(value) {
        this.inputElement.value = value;
    }
    
    /** This should be extended in elements to handle on change listeners. */
    addOnChange(onChange) {
        var onChangeImpl = () => {
            onChange(this.getValue(),this.getForm());
        };
        this.inputElement.addEventListener("input",onChangeImpl);
    }
    
    /** This should be extended in elements to handle on change listeners. */
    addOnChangeCompleted(onChangeCompleted) {
        var onChangeCompletedImpl = () => {
            onChangeCompleted(this.getValue(),this.getForm());
        };
        this.inputElement.addEventListener("change",onChangeCompletedImpl);
    }
    
    //===================================
    // internal Methods
    //==================================
    
    _setDisabled(isDisabled) { 
        this.inputElement.disabled = isDisabled;
    }
}

TextareaElement.TYPE_NAME = "textarea";

/** This is an text field element configurable element.
 * 
 * @class 
 */
class TextFieldElement extends ConfigurableElement {
    constructor(form,elementInitData) {
        super(form,elementInitData);
        
        var containerElement = this.getElement();
        
        //label
        if(elementInitData.label) {
            this.labelElement = document.createElement("span");
            this.labelElement.className = "apogee_configurablePanelLabel";
            this.labelElement.innerHTML = elementInitData.label;
            containerElement.appendChild(this.labelElement);
        }
        else {
            this.labelElement = null;
        }
        
        //text field (maight had password flag)
        var type = (elementInitData.password === true) ? "password" : "text";
        this.inputElement = uiutil.createElement("input",{"type":type});
        containerElement.appendChild(this.inputElement); 
        
        if(elementInitData.size !== undefined) {
            this.inputElement.size = elementInitData.size;
        }
        
        //non-standard events
        if(elementInitData.onChangeCompleted) {
            this.addOnChangeCompleted(elementInitData.onChangeCompleted);
        }
        
        this._postInstantiateInit(elementInitData);
    }
    
    /** This method returns value for this given element, if applicable. If not applicable
     * this method returns undefined. */
    getValue() {
        return this.inputElement.value.trim();
    }   

    /** This method updates the value for a given element. See the specific element
     * to see if this method is applicable. */
    setValue(value) {
        this.inputElement.value = value;
    }
    
    /** This should be extended in elements to handle on change listeners. */
    addOnChange(onChange) {
        var onChangeImpl = () => {
            onChange(this.getValue(),this.getForm());
        };
        this.inputElement.addEventListener("input",onChangeImpl);
    }
    
    /** This should be extended in elements to handle on change listeners. */
    addOnChangeCompleted(onChangeCompleted) {
        var onChangeCompletedImpl = () => {
            onChangeCompleted(this.getValue(),this.getForm());
        };
        this.inputElement.addEventListener("change",onChangeCompletedImpl);
    }
    
    //===================================
    // internal Methods
    //==================================
    
    _setDisabled(isDisabled) { 
        this.inputElement.disabled = isDisabled;
    }
}

TextFieldElement.TYPE_NAME = "textField";

ConfigurablePanel.addConfigurableElement(CheckboxElement);
ConfigurablePanel.addConfigurableElement(CheckboxGroupElement);
ConfigurablePanel.addConfigurableElement(CustomElement);
ConfigurablePanel.addConfigurableElement(DropdownElement);
ConfigurablePanel.addConfigurableElement(HeadingElement);
ConfigurablePanel.addConfigurableElement(HTMLDisplayElement);
ConfigurablePanel.addConfigurableElement(InvisibleElement);
ConfigurablePanel.addConfigurableElement(PanelElement);
ConfigurablePanel.addConfigurableElement(RadioGroupElement);
ConfigurablePanel.addConfigurableElement(SpacerElement);
ConfigurablePanel.addConfigurableElement(SubmitElement);
ConfigurablePanel.addConfigurableElement(TextareaElement);
ConfigurablePanel.addConfigurableElement(TextFieldElement);

export { ConfigurablePanel, DisplayAndHeader, Menu, SplitPane, Tab, TabFrame, TreeControl, TreeEntry, bannerConstants, dialogMgr, getBanner, getIconOverlay, uiutil };
