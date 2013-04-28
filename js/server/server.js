"use strict"

// Atlantis game server implementation

var socket_io   = require('socket.io')
var fs          = require('fs')

var GameState     = require("../common/GameState.js")
var MoveSelection = require("../common/MoveSelection.js")

var storage     = null  // game storage
var clients     = {}    // game-id => list of clients connected to each game
var games       = {}    // game-id => game object

function removeClient(game_id, client)
{
    var clnts = clients[game_id]
    for (var i = 0; i < clnts.length; ++i)
    {
        if (clnts[i] === client)
        {
            clnts.splice(i--, 1)
        }
    }
    if (clnts.length == 0)
    {
        delete games[game_id]
        delete clients[game_id]
        console.log("Game " + game_id + " released.")
    }
}

function retrieveGame(game_id, new_client, callback)
{
    if (games[game_id])
    {
        if (new_client) clients[game_id].push(new_client)
        callback(null, games[game_id])
        return
    }

    /* FIXME: there is sort of a race condition here. Multiple clients
              might call retrieveGame() at the same time! */

    storage.retrieve(game_id, function(err, game) {

        if (games[game_id])  // handle race-condition
        {
            if (new_client) clients[game_id].push(new_client)
            callback(null, games[game_id])
        } 
        else
        {
            if (game)
            {
                console.log("Game " + game_id + " cached.")
                games[game_id] = game
                clients[game_id] = []
                if (new_client) clients[game_id].push(new_client)
            }
            callback(err, game)
        }
    })

}

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

    client.on('join', function (new_game_id) {
        if (typeof new_game_id != "string") return

        retrieveGame(new_game_id, client, function(err, game) {
            if (!game)
            {
                client.emit('error-message', "Game not found!")
            }
            else
            if (game_id)
            {
                client.emit('error-message', "Already connected!")
                removeClient(new_game_id, client)
            }
            else
            {
                game_id = new_game_id
                client.emit('game', game)
            }
        })
    })

    client.on('selection', function(obj) {

        if (!game_id) return

        retrieveGame(game_id, null, function(err, game) {
            if (!game)
            {
                client.emit('error-message', "Game not found!")
            }
            else
            {
                // Sanitize MoveSelection object:
                obj = MoveSelection(GameState(game), obj).objectify()

                // Send it to all other clients:
                var clnts = clients[game_id]
                for (var i = 0; i < clnts.length; ++i)
                {
                    if (clnts[i]) clnts[i].emit('selection', obj)
                }
            }
        })
    })

    client.on('turn', function(moves) {

        if (!game_id) return

        retrieveGame(game_id, null, function(err, game) {
            if (!game)
            {
                client.emit('error-message', "Game not found!")
            }
            else
            {
                // Sanitize turn:
                turn = MoveSelection(GameState(game), {
                    phase:      1,
                    subphase:   0,
                    selected:   null,
                    moves:      moves }).getMoves()

                // Store turn:
                game["turns"].push(moves)

                storage.store(game_id, game, function(err) {
                    if (err)
                    {
                        client.emit('error-message', "Failed to store turn!")
                    }
                    else
                    {
                        for (var i = 0; i < clients[game_id].length; ++i)
                        {
                            clients[game_id][i].emit('turn', moves)
                        }
                    }
                })
            }
        })
    })

    client.on('disconnect', function() {
        if (!game_id) return
        removeClient(game_id, client)
    })
}

exports.listen = function(server, store)
{
    storage = store
    socket_io.listen(server).sockets.on('connection', onConnection)
}
