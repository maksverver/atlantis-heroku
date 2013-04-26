// Atlantis game server implementation

var gamesdir    = null
var gamesuffix  = '.json'
var crypto      = require('crypto')
var fs          = require('fs')
var socket_io   = require('socket.io')

var games       = {}  // game-id => path
var clients     = {}  // game-id => list of clients connected to the game

function retrieveGame(id, callback)
{
    if (!id || !games[id])
    {
        callback(null)
    }
    else
    {
        fs.readFile(games[id], function(err, data) {
            if (err)
            {
                console.log(err)
                data = null
            } else
            {
                try
                {
                    data = JSON.parse(data)
                }
                catch (err)
                {
                    console.log(err)
                    data = null
                }
            }
            callback(data)
        })
    }
}

function storeGame(id, data, callback)
{
    if (!games[id]) throw new Error("Unknown game: '" + id + "'")

    var tempName = games[id] + '.new'
    fs.writeFile(tempName, JSON.stringify(data), function(err) {
        if (err)
        {
            callback(err)
        }
        else
        {
            fs.rename(tempName, games[id], callback)
        }
    })
}

function createGame(data, callback)
{
    crypto.randomBytes(8, function(err, buf) {
        if (err)
        {
            callback(err)
        }
        else
        {
            var id = buf.toString("hex")
            if (games[id])
            {
                // We randomly-generated a game id that is already in use!
                // This should be rare, so let's just try again:
                createGame(data, callback)
            }
            else
            {
                games[id] = gamesdir + '/' + id + gamesuffix
                storeGame(id, data, function(err) {
                    if (err)
                    {
                        delete games[id]
                        callback(err, null)
                    }
                    else
                    {
                        callback(null, id)
                    }
                })
            }
        }
    })
}

function onConnection(client)
{
    var game_id = null

    client.on('create', function(data) {

        if (game_id) return

        // TODO: validate setup / remove unneeded data

        data["turns"] = []

        createGame(data, function(err, id) {
            if (err)
            {
                console.log("Failed to create game: " + err)
                client.emit('error-message', "Could not create game!")
            }
            else
            {
                console.log('Created game "' + id + '".')
                client.emit('created', id)
            }
        })
    })

    client.on('join', function (data) {

        if (game_id) return

        retrieveGame(data['game', function(game) {
            if (game)
            {
                game_id = data['game']
                client.emit('game', game)
                if (!clients[game_id]) clients[game_id] = []
                clients[game_id].push(client)
            }
            else
            {
                client.emit('error-message', "Game not found!")
            }
        })
    })

    client.on('selection', function(data) {

        // TODO: validate selection is sane?
        for (var i in clients[game_id])
        {
            var c = clients[game_id][i]
            if (c != client) c.emit('selection', data)
        }
    })

    client.on('turn', function(data) {

        // TODO: validate turn!!!
        var turn = data

        retrieveGame(game_id, function(game) {
            if (!game) return
            game["turns"].push(turn)
            storeGame(game_id, game, function(err) {
                if (err)
                {
                    console.log(err)
                }
                else
                {
                    for (var i in clients[game_id])
                    {
                        clients[game_id][i].emit('turn', turn)
                    }
                }
            })
        })
    })

    client.on('disconnect', function() {
        if (!game_id) return

        for (var i in clients[game_id])
        {
            if (clients[game_id][i] === client)
            {
                clients[game_id].splice(i, 1)
            }
        }
    })
}

exports.listen = function(server, dir)
{
    gamesdir = dir

    fs.readdir(gamesdir, function (err, files) {

        if (err) throw err

        // Build list of known games:
        var num_games = 0
        for (var i in files)
        {
            var j = files[i].lastIndexOf(gamesuffix)
            if (j > 0 && j == files[i].length - gamesuffix.length)
            {
                games[files[i].substring(0, j)] = gamesdir + '/' + files[i]
                num_games += 1
            }
        }
        info.log(num_games + " games found.")

        // Listen for incoming connections:
        socket_io.listen(server).sockets.on('connection', onConnection)
    })
}
