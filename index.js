'use strict';

require('barrkeep/pp');
const fs = require('fs');
const dree = require('dree');
const async = require('async');
const { join } = require('path');
const chokidar = require('chokidar');
const utils = require('barrkeep/utils');

function Snapshot ({
  root = process.cwd(), directory = join(process.cwd(), '.snapshot'),
  hidden = false, exclusions = [ 'node_modules', '.git$' ]
} = {}) {
  this.root = root;
  this.directory = directory;

  if (Array.isArray(exclusions) && exclusions.length) {
    this.exclude = new RegExp(exclusions.join('|').replace(/[.]/g, '\\.'));
  }

  this.options = {
    exclude: this.exclude,
    hash: true,
    hashAlgorithm: 'sha1',
    normalize: true,
    showHidden: hidden,
    size: true,
    stat: true
  };

  this.tree = {};
  this.content = {};

  this.snapshotFile = (file, callback) => {
    if (this.content[file.hash]) {
      setImmediate(callback, null);
    } else {
      fs.copyFile(file.path, join(this.directory, file.hash), (error) => {
        if (error) {
          return callback(error);
        }

        this.content[file.hash] = utils.project(file, {
          name: 1,
          extension: 1,
          type: 1,
          path: 1,
          relativePath: 1,
          'stat.mode': 'mode',
          'stat.uid': 'uid',
          'stat.gid': 'gid',
          'stat.size': 'size',
          'stat.atime': 'atime',
          'stat.mtime': 'mtime',
          'stat.ctime': 'ctime',
          hash: 1
        });

        return callback(null, file);
      });
    }
  };

  this.scan = (callback) => {
    const files = [];
    const directories = [];

    this.tree = dree.scan(this.root, this.options,
      file => { return files.push(file); },
      dir => { return directories.push(dir); });

    return async.each(files, this.snapshotFile, (error) => {
      if (error) {
        return callback(error);
      }


      console.pp(this.content);
      return callback(null);
    });
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

    fs.mkdir(this.directory, { recursive: true }, (error) => {
      if (error) {
        return callback(error);
      }

      this.scan(() => {
        this.watch();

        return callback(null);
      });
    });
  };
}

module.exports = Snapshot;
