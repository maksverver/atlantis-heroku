// Atlantis game server implementation

var socket_io   = require('socket.io')
var fs          = require('fs')

var GameState     = require("../common/GameState").GameState
var MoveSelection = require("../common/MoveSelection").MoveSelection

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
            if (!game)
            {
                client.emit('error-message', "Game not found!")
            }
            else
            {
                game_id = data['game']
                client.emit('game', game)
                if (!clients[game_id]) clients[game_id] = []
                clients[game_id].push(client)
            }
        })
    })

    client.on('selection', function(obj) {

        if (!game_id) return

        // FIXME: should cache game state
        storage.retrieve(game_id, function(err, game) {
            console.log("err="+err)
            console.log("game="+game)
            if (!game)
            {
                client.emit('error-message', "Game not found!")
            }
            else
            {
                // Sanitize MoveSelection object:
                obj = MoveSelection(GameState(game), obj).objectify()

                // Send it to all other clients:
                for (var i in clients[game_id])
                {
                    var cl = clients[game_id][i]
                    if (cl != client) cl.emit('selection', obj)
                }
            }
        })
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
