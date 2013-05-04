"use strict"

// Atlantis game server implementation

var fs          = require('fs')
var url         = require('url')
var Sequelize   = require('sequelize')
var socket_io   = require('socket.io')
var GameState   = require("../common/GameState.js")

var orm         = { }       // Sequelize ORM constructors
var games       = { }       // currently loaded games

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

    orm.Game.find(game_id).error(function(err) {
        callback(err, null)
    }).success(function(game) {
        if (!game) {
            callback(new Error("Game not found"), null)
        }
        if (games[game_id])
        {
            game = games[game_id]   // handle race-condition
        }
        else
        {
            game.state   = GameState(JSON.parse(game.serializedState))
            game.clients = []
            games[game_id] = game
            console.log("Game " + game_id + " cached.")
        }
        if (new_client) game.clients.push(new_client)
        callback(null, game)
    })
}

function storeGame(game, callback)
{
    game.serializedState = JSON.stringify(game.state.objectify())
    game.save().success(function() {
        callback(null)
    }).error(function(err) {
        callback(err)
    })
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
            orm.Game.create({
                serializedState: JSON.stringify(gamestate.objectify())
            }).success(function(game) {
                console.log('Created game "' + game.id + '".')
                client.emit('created', game.id)
            }).error(function(err) {
                console.log("Failed to create game: " + err)
                client.emit('error-message', "Could not create game!")
            })
        }
    })

    client.on('join', function (new_game_id) {

        new_game_id = parseInt(new_game_id)
        if (!(new_game_id > 0)) return

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
            if (game.over)
            {
                client.emit('error-message', "Game is over!")
            }
            else
            {
                /* HACK: partially sanitize MoveSelection object.
                         Can't pass `obj` to MoveSelection constructor directly,
                         because it will modify the gamestate if phase > 1 ! */
                var clean = { moves:    game.state.filterValidMoves(obj.moves),
                              phase:    parseInt(obj.phase)    || 1,
                              subphase: parseInt(obj.subphase) || 0 }

                // Send it to all other clients:
                var clients = games[game_id].clients
                for (var i in clients)
                {
                    if (clients[i] != client) clients[i].emit('selection', clean)
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
            if (game.over)
            {
                client.emit('error-message', "Game is over!")
            }
            else
            {
                // Sanitize turn:
                var turn = game.state.filterValidMoves(moves)

                if (turn.length < moves.length)
                {
                    // Invalid turn!  Find a problematic move and notify the client:
                    var i = 0
                    while (i < turn.length && turn[i][0] == moves[i][0] && turn[i][1] == turn[i][0]) ++i
                    client.emit('error-message', "Invalid move: " + moves[i][0] + "-" + moves[i][1])
                }
                else
                {
                    // Update game state:
                    var turns = [turn]
                    game.state.addTurn(turn)

                    // Now advance to the next player that can make a move:
                    var regions = game.state.calculateRegions()
                    while (!game.state.hasPlayerMoves(game.state.getNextPlayer(), regions))
                    {
                        if (game.state.isGameOver(regions))
                        {
                            game.over = true
                            break
                        }

                        // Add a mandatory pass.
                        turns.push([])
                        game.state.addTurn([])
                        regions = game.state.calculateRegions()
                    }

                    // Store updated game state:
                    storeGame(game, function(err) {
                        if (err)
                        {
                            Console.log("Failed to store game " + game_id + ": " + err)
                            client.emit('error-message', "Failed to store turn!")
                            // ... continue anyway because we have the game cached
                        }

                        // Send turn updates to clients:
                        var clients = games[game_id].clients
                        for (var i in clients)
                        {
                            for (var j in turns) clients[i].emit('turn', turns[j])
                        }
                    })
                }
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
    // Setup database connection:
    if (!process.env.DATABASE_URL)
    {
        throw new Error("environmental variable DATABASE_URL not set")
    }
    var params = url.parse(process.env.DATABASE_URL, true)
    var dialect = params.protocol.substring(0, params.protocol.indexOf(':'))
    var database = params.pathname.substring(params.pathname.indexOf('/') + 1)
    var username = params.auth ? params.auth.substring(0, params.auth.indexOf(':'))  : ""
    var password = params.auth ? params.auth.substring(params.auth.indexOf(':') + 1) : ""
    var sequelize = new Sequelize( database, username, password, {
        host: params.hostname, port: params.port, dialect: dialect,
        native: true,      /* this is used by PostgreSQL in order to support SSL */
        storage: database, /* this is used by SQLite as the database file path */
        define: { charset: "utf8" } })

    // Create database schema:
    orm.Game = sequelize.define("Game", {
        id:              { type: Sequelize.INTEGER, allowNull: false, autoIncrement: true },
        serializedState: { type: Sequelize.TEXT,    allowNull: false                      },
        over:            { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false } })

    sequelize.sync().done(function() {

        var io = socket_io.listen(server)

        // Configure socket.io for use on Heroku:
        // https://devcenter.heroku.com/articles/using-socket-io-with-node-js-on-heroku
        io.set("transports", ["xhr-polling", "jsonp-polling"])
        io.set("polling duration", 10)
        io.set("log level", 1)

        io.sockets.on('connection', onConnection)
    })
}

exports.listGames = function(callback)
{
    // FIXME: this retrieves full rows, even the serializedState field that I don't want!
    // FIXME: do ordering + limiting on the server side
    orm.Game.findAll().error(function(err) {
        callback(err, [])
    }).success(function(rows){
        var gamelist = []
        for (var i in rows)
        {
            var row = rows[i]
            gamelist.push({
                "id":         row.id,
                "createdAt":  row.createdAt,    
                "updatedAt":  row.updatedAt,
                "over":       row.over,
                "online":     games[row.id] ? games[row.id].clients.length : 0 })
        }
        callback(null, gamelist)
    })
}
