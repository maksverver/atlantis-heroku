"use strict"

// Atlantis game server implementation

var socket_io   = require('socket.io')
var fs          = require('fs')

var GameState     = require("../common/GameState.js")
var MoveSelection = require("../common/MoveSelection.js")

var storage     = null
var games       = {} 

function removeClient(game_id, client)
{
    var clients = games[game_id].clients
    for (var i = 0; i < clients.length; ++i)
    {
        if (clients[i] === client)
        {
            clients.splice(i--, 1)
        }
    }
    if (clients.length == 0)
    {
        delete games[game_id]
        console.log("Game " + game_id + " released.")
    }
}

function retrieveGame(game_id, new_client, callback)
{
    if (games[game_id])
    {
        if (new_client) games[game_id].clients.push(new_client)
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
                var game = { id:      game_id,
                             state:   GameState(game),
                             clients: [] }
                if (new_client) game.clients.push(new_client)
                games[game_id] = game
            }
            callback(err, game)
        }
    })
}

function storeGame(game, callback)
{
    storage.store(game.id, game.state.objectify(), callback)
}

function onConnection(client)
{
    var game_id = null

    client.on('create', function(game) {

        if (game_id) return

        var gamestate = GameState(game)
        if (gamestate.getPlayers().length < 2)
        {
            client.emit('error-message', "Invalid game state received!")
        }
        else
        {
            game = gamestate.objectify()
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
        }
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
                client.emit('game', game.state.objectify())
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
                obj = MoveSelection(game.state, obj).objectify()

                // Send it to all other clients:
                var clients = games[game_id].clients
                for (var i in clients)
                {
                    if (clients[i] != client) clients[i].emit('selection', obj)
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
                // FIXME: add dedicated method to GameState for this!
                var turn = MoveSelection(game.state, { moves: moves }).getMoves()

                // Store turn:
                game.state.addTurn(moves)

                storeGame(game, function(err) {
                    if (err)
                    {
                        client.emit('error-message', "Failed to store turn!")
                    }
                    else
                    {
                        var clients = games[game_id].clients
                        for (var i in clients)
                        {
                            clients[i].emit('turn', moves)
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

exports.listGames = function(callback)
{
    storage.list(function(err, gamelist) {
        if (err)
        {
            callback(err, [])
        }
        else
        {
            // Augment game list with count of connected clients:
            for (var i in gamelist)
            {
                var game = games[gamelist[i].id]
                gamelist[i].online = game ? game.clients.length : 0
            }
            callback(null, gamelist)
        }
    })
}
