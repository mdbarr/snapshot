'use strict';

require('barrkeep/pp');
const dree = require('dree');
const chokidar = require('chokidar');
const utils = require('barrkeep/utils');

function Snapshot ({
  root = process.cwd(), hidden = false, exclusions = [ 'node_modules' ]
} = {}) {
  this.root = root;

  if (Array.isArray(exclusions) && exclusions.length) {
    this.exclude = new RegExp(exclusions.join('|').replace(/[.]/g, '\\.'));
  }

  this.options = {
    exclude: this.exclude,
    hash: true,
    normalize: true,
    showHidden: hidden,
    size: true,
    stat: true
  };

  this.tree = {};

  this.scan = () => {
    this.tree = dree.scan(this.root, this.options);
    console.pp(this.tree);
  };

  this.watch = () => {
    if (this.watcher && this.watcher.close) {
      this.watcher.close();
    }

    this.watcher = chokidar.watch(this.root, {
      persistent: true,
      ignoreInitial: true,
      ignored: this.exclude
    });

    this.watcher.on('all', (type, filename) => {
      console.log('=watch', type, filename);
    });
  };

  this.start = (callback) => {
    callback = utils.callback(callback);

    this.scan();
    this.watch();

    callback(null);
  };
}

module.exports = Snapshot;
