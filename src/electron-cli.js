#!/usr/bin/env node

var electron = require('electron')
var path = require('path')
var proc = require('child_process')

let installDir = path.dirname(process.argv[1]);
let args = [installDir].concat(process.argv.slice(2));

var child = proc.spawn(electron, args, {stdio: 'inherit'})
child.on('close', function (code) {
  process.exit(code)
})