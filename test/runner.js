module.exports = function ( config ) {
  return  {
    ping: function (ct, cb) {
      cb(null, "pong " + ct ) 
    }
  }
}