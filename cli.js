#!/usr/bin/env node
'use strict';

const Snapshot = require('./index');

const argv = require('yargs').argv;

const snapshot = new Snapshot(argv);

snapshot.start();
