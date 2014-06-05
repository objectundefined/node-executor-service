var format = require('util').format;
var axon = require('axon');
var arpc = require('axon-rpc');
var child_process = require('child_process');
var logger = require('./logger').getLogger('Executor');
var carrier = require('carrier');
var uuid = require('node-uuid');
var path = require('path');
var os = require('os');
var fs = require('fs');
var procs = {};

exports.createExecutor = createExecutor;
exports.createExecutorPool = createExecutorPool;

// exit fires before uncaught exceptions, which can 
// leave detached zombie child-processes unless handled
process.on('exit', function(){
  Object.keys(procs).forEach(function(id){
    try { procs[id].kill(); } catch (e) {}
  })
});

function createExecutor (module_or_fn, varargs) {
  var WrappedExecutorPool = wrapConstructor(ExecutorPool);
  var caller = getCaller();
  var args = ([1, caller]).concat(Array.prototype.slice.call(arguments));
  return new WrappedExecutorPool( args );
}

function createExecutorPool (pool_size, module_or_fn, varargs) {
  var WrappedExecutorPool = wrapConstructor(ExecutorPool);
  var caller = getCaller();
  var args = ([pool_size, caller]).concat(Array.prototype.slice.call(arguments, 1));
  return new WrappedExecutorPool( args );
}

function ExecutorPool ( pool_size, caller, module_or_fn, varargs ) {
  var self = this;
  var WrappedExecutor = wrapConstructor(Executor);
  var executors = [];
  var args = Array.prototype.slice.call(arguments, 1);
  for ( var i = 0; i < pool_size; i++ ) {
    executors.push( new WrappedExecutor(args) )
  }
  self._pool = new RoundRobinSet(executors);
}

ExecutorPool.prototype.invoke = function () {
  var self = this;
  var executor = self._pool.obtain();
  executor.invoke.apply(executor, arguments);
}

function Executor (caller, module_or_fn, varargs) {
  
  var self = this;
  if ( "function" == typeof module_or_fn ) {
    self._logger = logger.getLogger('[function]')
    self._fn = format("(%s)", module_or_fn.toString() );
  } else if ( "string" == typeof module_or_fn ) {
    self._logger = logger.getLogger(path.basename(module_or_fn,'.js'));
    self._fn = format("require('%s')", module_or_fn );
  } else {
    throw new Error("InvalidArgument - Must be function or path to module")
  }
  if (caller && caller.filename) {
    self._caller_path = path.dirname(caller.filename);    
  } else if (module && module.parent && module.parent.filename){
    self._caller_path = path.dirname(module.parent.filename)
  } else {
    self._caller_path = process.cwd();
  }
  self._args = Array.prototype.slice.call(arguments,2).map(JSON.stringify.bind(JSON));
  self._client_sock = axon.socket('req');
  self._client = new arpc.Client(self._client_sock);
  self._running = false;
  
}

Executor.prototype.invoke = function( method_name, varargs ) {
  var self = this;
  self._client.call.apply(self._client, arguments);
  self.run();
}

Executor.prototype.run = function() {
  if ( this._running || this._starting ) return;
  else this._starting = true;
  var self = this;
  var args = self._args;
  var sock_path = path.join(os.tmpDir(), uuid() + ".sock" );
  var arpc_addr = "unix://" + sock_path;
  var executable = ([
    format("var axon= require('%s');", require.resolve('axon')),
    format("var arpc= require('%s');", require.resolve('axon-rpc')),
    "var sock= axon.socket('rep');",
    "var server= new arpc.Server(sock);",
    format("sock.bind('%s');", arpc_addr),
    format("console.log('%s');", arpc_addr),
    format("server.expose(%s(%s));", self._fn, args)
  ]).join("\n");
  var child = child_process.spawn(process.execPath,[
    "-e", executable
  ],{
    cwd: self._caller_path,
    env: process.env
  });
  var child_logger = self._logger.getLogger(child.pid);
  var stdout = carrier.carry(child.stdout);
  var stderr = carrier.carry(child.stderr);
  var startup = function (line){
    if (line.indexOf(arpc_addr)==0) {
      stdout.on('line', child_logger.log.bind(child_logger));
      stdout.removeListener('line',startup);
      self._client_sock.connect(arpc_addr);
      self._running = true;
      self._starting = false;
    }
  };
  procs[sock_path] = child;
  stdout.on('line', startup );
  stderr.on('line', child_logger.warn.bind(child_logger));
  self._client_sock.on('error',function(){})
  child.on('exit', function(){
    procs[sock_path] = undefined;
    self._running = false;
    self._client_sock.close();
    fs.unlinkSync(sock_path);
    if (Object.keys(self._client_sock.callbacks).length) self.run();
  });
}

function RoundRobinSet ( arr ) {
  Object.defineProperty(this,"items",{ value: arr.slice(0) });
}

RoundRobinSet.prototype.obtain = function (){
  var item = this.items.shift();
  this.items.push(item);
  return item;
}

function getCaller() {
  return getStack()[3].receiver;
}

function getStack() {
  var origPrepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = function (_, stack) {
    return stack;
  };
  var err = new Error();
  var stack = err.stack;
  Error.prepareStackTrace = origPrepareStackTrace;
  stack.shift();
  return stack;
}

/**
 *  Utility: Apply an array of arguments to a constructor
 */

function wrapConstructor (c) {
  var ctor = function(args) {
    c.apply(this, args);
  };
  ctor.prototype = c.prototype;
  return ctor;
};
