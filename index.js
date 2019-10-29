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
  this.head = null;
  this.index = {};

  this.snapshotFile = (file, callback) => {
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
      hash: 'content'
    });

    projection.atime = new Date(projection.atime).getTime();
    projection.mtime = new Date(projection.mtime).getTime();
    projection.ctime = new Date(projection.ctime).getTime();

    const hash = utils.sha1(projection);

    if (this.index[hash]) {
      return setImmediate(callback, null, hash);
    }

    return fs.copyFile(file.path, join(this.directory, file.hash), (error) => {
      if (error) {
        return callback(error);
      }

      this.index[hash] = projection;

      return callback(null, hash);
    });
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
      'stat.ctime': 'ctime',
      children: 1
    });

    projection.atime = new Date(projection.atime).getTime();
    projection.mtime = new Date(projection.mtime).getTime();
    projection.ctime = new Date(projection.ctime).getTime();

    projection.children = projection.children || null;

    const hash = utils.sha1(projection);

    this.index[hash] = projection;

    return setImmediate(callback, null, hash);
  };

  this.reduce = (object, callback) => {
    return async.map(object.children, this.reduce, (error, children) => {
      if (error) {
        return callback(error);
      }

      if (object.type === 'file') {
        return this.snapshotFile(object, callback);
      } else if (object.type === 'directory') {
        object.children = children.sort();

        return this.snapshotDirectory(object, callback);
      }
      return callback(new Error(`Unknown object type ${ object.type }`));
    });
  };

  this.scan = (callback) => {
    const scan = dree.scan(this.root, this.options);

    console.pp(scan);

    return this.reduce(scan, (error, head) => {
      if (error) {
        return callback(error);
      }

      this.head = head;

      console.pp(this.index);
      console.pp(this.head);
      return callback(null, this.head);
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
