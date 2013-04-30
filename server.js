var atlantis    = require('./js/server/server.js')
var express     = require('express')
var http        = require('http')
var url         = require('url')

var port = 8027
var app = express()
app.enable("jsonp callback");
app.use('/',          express.static(__dirname + '/html'))
app.use('/js/common', express.static(__dirname + '/js/common'))
app.use('/js/client', express.static(__dirname + '/js/client'))
app.use('/games', function(request, response, next) {
    if (url.parse(request.url).pathname != "/")
    {
        return next()
    }
    atlantis.listGames(function(err, games) {
        if (err)
        {
            console.log("listGames failed: " + err)
            response.jsonp({error: err})
        }
        else
        {
            response.jsonp(games)
        }
    })
})

var storage = require('./js/server/FileStorage.js')
storage.setDirectory(__dirname + '/games')

var server = http.createServer(app)
server.listen(port)
atlantis.listen(server, storage)
console.log("Atlantis server listening on port " + port + ".")
