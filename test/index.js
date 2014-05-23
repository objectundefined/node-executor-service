var ExecutorService = require("../lib/ExecutorService");
var format = require('util').format;
/*var log = console.log.bind(console, 'LOG:')
var logErr = function(e) {
  console.error('ERROR', e.stack || e)
};*/
var async = require('async');
var assert = require('assert');
var uuid = require('node-uuid');
var path = require('path');
var executor_module_path = path.join(__dirname,'./runner.js');
var executorLocalFn = function(){
  return {
    ping : function (ct, cb) { cb(null, "pong " + ct ); }
  }
};
var executorLocalFnWithUncaughtException = function(){
  setTimeout(function(){throw new Error("EXPECTED THREAD EXCEPTION")},25);
  return {
    ping : function (ct, cb) { cb(null, "pong " + ct ); }
  }
};
var executorLocalFnWithArg = function(arg){
  return {
    ping : function (cb) { cb(null, arg); }
  }
};

var executorLocal = ExecutorService.createExecutor(executorLocalFn);


describe('executorLocal', function() {
  it('should reply with pong ten times', function (done){
    var executorLocal = ExecutorService.createExecutor(executorLocalFn);
    async.times(10, function(n, cb){
      executorLocal.invoke('ping', n, cb)
    }, done);    
  });
  it('should reply with pong ten times even though the thread respawns due to error', function (done){
    var executorLocalWithUncaughtException = ExecutorService.createExecutor(executorLocalFnWithUncaughtException);
    async.times(10, function(n, cb){
      // allow time for the exception to fire a few times
      setTimeout(function(){
        executorLocalWithUncaughtException.invoke('ping', n, cb);
      },50);
    }, done);    
  });
  describe('executorLocalWithConstructorArgs', function() {
    it('should reply with passed in constructor arg', function (done){
      var arg = uuid();
      var executorLocalWithArgs = ExecutorService.createExecutor(executorLocalFnWithArg, arg);
      executorLocalWithArgs.invoke('ping', function(err, result){
        assert(result==arg);
        done();
      })
    });
  });
  
});

describe('executorModule', function() {
  it('should reply with pong ten times', function (done){
    var executorModule = ExecutorService.createExecutor(executor_module_path);
    async.times(10, function(n, cb){
      executorModule.invoke('ping', n, cb)
    }, done);    
  });
});

describe('executorModulePool', function() {
  it('should reply with pong ten times', function (done){
    var executorModulePool = ExecutorService.createExecutorPool(5, executor_module_path);
    async.times(10, function(n, cb){
      executorModulePool.invoke('ping', n, cb)
    }, done);    
  });
});


/*


describe('rpc', function() {
  var rpc = connection.rpc();
  describe('#expose-str/resolve', function() {
    it('should create a queue, resolve messages', function(done) {
      rpc.expose('rpc.foobar', function(data) {
        return when('foo')
      }).then(function(consumer) {
        rpc.call('rpc.foobar', null).then(function(res) {
          assert(res == 'foo', 'RPC result is not \'foo\'')
          done();
        }).then(null, done)
      }).then(null, done);
    })
  })
  describe('#expose-str/resolve/awaitReply=false', function() {
    it('should create a queue, resolve messages', function(done) {
      rpc.expose('rpc.foobar', function(data) {
        return when('foo')
      }).then(function(consumer) {
        rpc.call('rpc.foobar', null, {
          awaitReply: false
        }).then(function(res) { 
          assert(res !== 'foo' && res == true, 'RPC result should be \'true\' because awaitReply is false')
          done();
        }).then(null, done)
      }).then(null, done);
    })
  })
  describe('#expose-q/reject', function() {
    var queueName = 'rpcCheck-' + uuid();
    var q = connection.queue(queueName, {
      autoDelete: true
    });
    it('should create a queue, resolve messages', function(done) {
      rpc.expose(q, function(data) {
        return when.promise(function(resolve, reject) {
          reject('bar')
        })
      }).then(function(consumer) {
        rpc.call(q.name, null).then(function(res) {
          done(new Error('Should Not Resolve'));
        }).then(null, function(err) {
          assert(err == 'bar', 'Error was not \'bar\'')
          done();
        })
      }).then(null, done);
    })
  })
  describe('#expose-q/notify', function() {
    var queueName = 'rpcCheck-' + uuid();
    var q = connection.queue(queueName, {
      autoDelete: true
    });
    it('should create a queue, notify twice, then resolve', function(done) {
      rpc.expose(q, function(data) {
        return when.promise(function(resolve, reject, notify) {
          setTimeout(function() {
            notify(1);
          }, 5);
          setTimeout(function() {
            notify(2);
          }, 10);
          setTimeout(function() {
            resolve(3);
          }, 15);
        })
      }).then(function(consumer) {
        var notifyResults = [];
        rpc.call(q.name, null).then(function(res) {
          assert(notifyResults.indexOf(1) == 0, 'Was not notified in order')
          assert(notifyResults.indexOf(2) == 1, 'Was not notified in order')
          assert(res == 3, 'Was not resolved in order')
          done()
        }).then(null, null, function onNotify(note) {
          notifyResults.push(note)
        }).then(null, done)
      }).then(null, done);
    })
  })

})*/