var atlantis    = require('./js/server/server.js')
var crypto      = require('crypto')
var express     = require('express')
var http        = require('http')
var url         = require('url')

var port         = process.env.PORT || 8027
var app          = express()
app.enable("jsonp callback")
app.use('/',          express.static(__dirname + '/html'))
app.use('/js/common', express.static(__dirname + '/js/common'))
app.use('/js/client', express.static(__dirname + '/js/client'))

app.use('/rpc', express.bodyParser())
app.use('/rpc', express.cookieParser(crypto.randomBytes(20).toString("hex")))

app.use('/rpc', function(request, response, next) {

    if (url.parse(request.url).pathname != "/" || request.method != "POST")
    {
        return next()
    }

    try
    {
        switch (request.body.method)
        {
        case 'createAccount':
            atlantis.createAccount(request.body.username, request.body.salt, request.body.passkey, function(err, username) {
                if (username) response.cookie('username', username, { signed: true, httpOnly: true })
                response.json({error: err ? err.message : undefined, username: username })
            })
            break

        case 'getUsername':
            response.json({username: request.signedCookies.username})
            break

        case 'getAuthChallenge':
            atlantis.getAuthChallenge(request.body.username, function(err, username, salt, nonce) {
                response.json({error: err ? err.message : undefined, username: username, salt: salt, nonce: nonce })
            })
            break

        case 'authenticate':
            atlantis.authenticate(request.body.username, request.body.nonce, request.body.proof, function(err, username) {
                if (username) response.cookie('username', username, { signed: true, httpOnly: true })
                response.json({ error: err ? err.message : undefined, username: username || undefined })
            })
            break

        case 'logOut':
            response.cookie('username')
            response.json({})
            break

        case 'createGame':
            atlantis.createGame(request.body.game, function(err, gameId, ownerKey) {
                response.json({ error:      err ? err.message : undefined,
                                gameId:     gameId || undefined,
                                ownerKey:   ownerKey || undefined })
            })
            break

        case 'storePlayerKey':
            atlantis.storePlayerKey( request.signedCookies.username, request.body.gameId,
                                     request.body.playerKey || request.body.ownerKey,
                                     request.body.store, function(err, result) {
                response.json({ error: err ? err.message : undefined, result: result })
            })
            break

        case 'listGames':
            atlantis.listGames(function(err, games) {
                response.json({error: err ? err.message : undefined, games: games})
            })
            break

        case 'listMyGames':
            atlantis.listMyGames(request.signedCookies.username, function(err, games) {
                response.json({error: err ? err.message : undefined, games: games})
            })
            break

        default:
            response.send(403)
        }
    }
    catch (err)
    {
        console.log("Error caught in RPC request handler: " + err)
        response.send(500)
    }
})

var server = http.createServer(app)
server.listen(port)
atlantis.listen(server)
console.log("Atlantis server listening on port " + port + ".")
