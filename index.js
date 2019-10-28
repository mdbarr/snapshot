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
  this.objects = {};

  this.snapshotFile = (file, callback) => {
    if (this.objects[file.hash]) {
      setImmediate(callback, null);
    } else {
      fs.copyFile(file.path, join(this.directory, file.hash), (error) => {
        if (error) {
          return callback(error);
        }

        const projection = utils.project(file, {
          name: 1,
          extension: 1,
          type: 1,
          path: 1,
          relativePath: 'relative',
          'stat.mode': 'mode',
          'stat.uid': 'uid',
          'stat.gid': 'gid',
          'stat.size': 'size',
          'stat.atime': 'atime',
          'stat.mtime': 'mtime',
          'stat.ctime': 'ctime',
          hash: 1
        });

        projection.atime = new Date(projection.atime).getTime();
        projection.mtime = new Date(projection.mtime).getTime();
        projection.ctime = new Date(projection.ctime).getTime();

        this.objects[file.hash] = projection;

        return callback(null, projection);
      });
    }
  };

  this.snapshotDirectory = (dir, callback) => {
    const projection = utils.project(dir, {
      name: 1,
      type: 1,
      path: 1,
      relativePath: 'relative',
      'stat.mode': 'mode',
      'stat.uid': 'uid',
      'stat.gid': 'gid',
      'stat.atime': 'atime',
      'stat.mtime': 'mtime',
      'stat.ctime': 'ctime'
    });

    projection.atime = new Date(projection.atime).getTime();
    projection.mtime = new Date(projection.mtime).getTime();
    projection.ctime = new Date(projection.ctime).getTime();

    projection.hash = utils.sha1(projection);

    this.objects[projection.hash] = projection;

    return setImmediate(() => { callback(null, projection); });
  };

  this.scan = (callback) => {
    const files = [];
    const directories = [];

    this.tree = dree.scan(this.root, this.options,
      file => { return files.push(file); },
      dir => { return directories.push(dir); });

    console.pp(this.tree);

    return async.each(files, this.snapshotFile, (error) => {
      if (error) {
        return callback(error);
      }

      return async.each(directories, this.snapshotDirectory, (error) => {
        if (error) {
          return callback(error);
        }

        console.pp(this.objects);
        return callback(null);
      });
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

    return fs.mkdir(this.directory, { recursive: true }, (error) => {
      if (error) {
        return callback(error);
      }

      return this.scan(() => {
        this.watch();

        return callback(null);
      });
    });
  };
}

module.exports = Snapshot;
