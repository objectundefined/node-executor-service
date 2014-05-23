var node_console = console;
var util = require('util');
var format = util.format;
var colors = require('colors');

module.exports = new Logger();

function Logger (names) {
  var logger = this;
  Object.defineProperty(this,"names",{value:names||[]});
};

Logger.prototype.log = function () {
  var logger = this;
  var args = Array.prototype.slice.call(arguments);
  var logging_args = getLoggingArgs(logger, args, "LOG");
  return console.log.apply(node_console,args);
}

Logger.prototype.info = function () {
  var logger = this;
  var args = Array.prototype.slice.call(arguments);
  var logging_args = getLoggingArgs(logger, args, "INFO", "green");
  return console.log.apply(node_console,args);
}

Logger.prototype.debug = function () {
  var logger = this;
  var args = Array.prototype.slice.call(arguments);
  var logging_args = getLoggingArgs(logger, args, "DEBUG", "grey");
  return console.log.apply(node_console,args);
}

Logger.prototype.warn = function () {
  var logger = this;
  var args = Array.prototype.slice.call(arguments);
  var logging_args = getLoggingArgs(logger, args, "WARN", "yellow");
  return console.error.apply(node_console,args);
}

Logger.prototype.error = function () {
  var logger = this;
  var args = Array.prototype.slice.call(arguments);
  var logging_args = getLoggingArgs(logger, args, "ERROR", "red");
  return console.error.apply(node_console,args);
}

Logger.prototype.trace = function () {
  var logger = this;
  var has_race = false;
  var args = Array.prototype.slice.call(arguments).map(function(arg){
    if (typeof arg.stack == "string") {
      has_trace = true
      return format("%s\n%s\n",arg.message,arg.stack);
    } else {
      return arg;
    }
  });
  if (!has_trace) {
    var fake_trace = (new Error("TRACE")).stack;
    args.push(format("\n%s\n",fake_trace))
  }
  var logging_args = getLoggingArgs(logger, args, "TRACE", "red");
  return console.error.apply(node_console,args);
}


Logger.prototype.getLogger = function (name) {
  return Object.create(this,{
    names : {
      value : this.names.concat([name])
    }
  })
}

function getLoggingArgs (logger, args, log_type, color) {
  var format_arg = typeof args[0] == "string" ? " " + args.shift() : " ";
  var d = (new Date()).toISOString();
  var name = logger.names.join(".") ;
  var initial_arg = format("%s [%s]", d, log_type).bold;
  initial_arg  = format("%s %s:", initial_arg, name);
  if (color) initial_arg = initial_arg[color];
  initial_arg = initial_arg + format_arg ;
  args.unshift(initial_arg);
  return args
}