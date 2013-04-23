var atlantis    = require('./js/server/server.js')
var express     = require('express')
var http        = require('http')

var app = express()
app.use('/',          express.static(__dirname + '/html'))
app.use('/js/common', express.static(__dirname + '/js/common'))
app.use('/js/client', express.static(__dirname + '/js/client'))

var server = http.createServer(app)
server.listen('8888')
atlantis.listen(server, __dirname + '/games')
