// Atlantis game server implementation

var fs          = require('fs')
var socket_io   = require('socket.io')

var storage     = null  // game storage
var clients     = {}  // game-id => list of clients connected to the game

function onConnection(client)
{
    var game_id = null

    client.on('create', function(game) {

        if (game_id) return

        // TODO: validate setup / remove unneeded data

        game["turns"] = []

        storage.create(game, function(err, id) {
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

        storage.retrieve(data['game'], function(err, game) {
            if (err)
            {
                client.emit('error-message', "Game not found!")
            }
            else
            if (game)
            {
                game_id = data['game']
                client.emit('game', game)
                if (!clients[game_id]) clients[game_id] = []
                clients[game_id].push(client)
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

    client.on('turn', function(turn) {

        // TODO: validate turn!!!

        storage.retrieve(game_id, function(err, game) {
            if (err)
            {
                client.emit('error-message', "Game not found!")
            }
            else
            {
                game["turns"].push(turn)
                storage.store(game_id, game, function(err) {
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
            }
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

exports.listen = function(server, store)
{
    storage = store
    socket_io.listen(server).sockets.on('connection', onConnection)
}
