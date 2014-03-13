'use strict';

var through = require('through');
var path = require('path');
var gutil = require('gulp-util');
var _ = require('lodash');

function makeAMD(moduleContents, opts) {
  // define(['dependency'], function(Dependency) { return moduleObject; });
  var includes = [];
  var defines = [];
  _.each(opts.require, function(include, define) {
    includes.push(JSON.stringify(include));
    defines.push(define);
  });
  return 'define([' + includes.join(',') + '], ' +
    'function(' + defines.join(',') + ') { return ' + moduleContents + '; });';
}

function makeCommonJS(moduleContents, opts) {
  // module.exports = moduleObject;
  return 'module.exports = ' + moduleContents + ';';
}

function makeNode(moduleContents, opts) {
  // var Dependency = global.Dependency || require('dependency');module.exports = moduleObject;
  var requires = _.map(opts.require, function(key, value) {
    return 'var ' + value + ' = global.' + value + ' || require(' + JSON.stringify(key) + ');';
  });
  return requires + 'module.exports = ' + moduleContents + ';';
}

function makePlain(moduleContents, opts) {
  // moduleObject;
  return moduleContents + ';';
}

module.exports = function(type, options) {
  return through(function(file) {
    if (file.isNull()) { return this.queue(file); } // pass along
    if (file.isStream()) { return this.emit('error', new gutil.PluginError('gulp-define-module', 'Streaming not supported')); }

    var opts = _.defaults({}, options, file.defineModuleOptions, {
      require: {}
    });

    var contents = file.contents.toString();
    var name = path.basename(file.path, path.extname(file.path));
    if (opts.wrapper) {
      var context = {
        name: name,
        file: file,
        contents: contents
      };
      if (opts.context) {
        var extensions = opts.context;
        if (typeof extensions === 'function') {
          extensions = extensions(context);
        }
        _.defaults(context, _(extensions).map(function(value, key) {
          return [key, _.template(value, context)];
        }).object().value());
      }
      contents = _.template(opts.wrapper, context);
    }

    if (type === 'amd') { contents = makeAMD(contents, opts); }
    else if (type === 'commonjs') { contents = makeCommonJS(contents, opts); }
    else if (type === 'node') { contents = makeNode(contents, opts); }
    else if (type === 'plain') { contents = makePlain(contents, opts); }
    else {
      throw new Error('Unsupported module type for gulp-define-module: ' + type);
    }

    file.path = gutil.replaceExtension(file.path, '.js');
    file.contents = new Buffer(contents);
    this.queue(file);
  });
};
