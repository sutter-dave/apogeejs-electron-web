# ApogeeWebElectron
This is an Apogee application running on electron. This operates the same way as the web page application and works with the same workspaces but it lets yau save to the local file system. There is no access to Node.js features exposed renderer thread except for bridge access for saving files. For safety, before any file is saved, the user is notified with a dialog box.
