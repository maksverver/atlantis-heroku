"use strict"

// Atlantis game server implementation

var crypto      = require('crypto')
var fs          = require('fs')
var url         = require('url')
var Sequelize   = require('sequelize')
var socket_io   = require('socket.io')

var GameState   = require("../common/GameState.js")
var rmd         = require("../common/RIPEMD-160.js")

var orm         = { }       // Sequelize ORM constructors
var games       = { }       // currently loaded games

function removeClient(game_id, client)
{
    var clients = games[game_id].clients
    if (client)
    {
        for (var i = 0; i < clients.length; ++i)
        {
            if (clients[i] === client)
            {
                clients.splice(i--, 1)
            }
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
            return
        }
        if (games[game_id])
        {
            game = games[game_id]   // handle race-condition
        }
        else
        {
            var obj = JSON.parse(game.serializedState)
            game.playerKeys  = obj.playerKeys
            game.state       = GameState(obj)
            game.clients     = []
            games[game_id] = game
            console.log("Game " + game_id + " cached.")
        }
        if (new_client) game.clients.push(new_client)
        callback(null, game)
    })
}

function storeGame(game, callback)
{
    var obj = game.state.objectify()
    obj.playerKeys = game.playerKeys
    game.serializedState = JSON.stringify(obj)
    game.save().success(function() {
        callback(null)
    }).error(function(err) {
        callback(err)
    })
}

function createGame(game, callback)
{
    var gamestate = GameState(game)
    if (gamestate.getPlayers().length < 2)
    {
        callback(new Error("Invalid game state received!"))
        return
    }
    var keys = []
    for (var i = 0; i < gamestate.getPlayers().length; ++i)
    {
        keys.push(crypto.randomBytes(20).toString("hex"))
    }
    game = gamestate.objectify()
    game.playerKeys = keys
    orm.Game.create({
        serializedState: JSON.stringify(game)
    }).success(function(game) {
        console.log('Created game "' + game.id + '".')
        callback(null, game.id, keys)
    }).error(function(err) {
        console.log("Failed to store game: " + err)
        callback(new Error("Failed to store game!"))
    })
}

function onConnection(client)
{
    var game_id = null
    var player_index = -1

    client.on('join', function (new_game_id, player_key) {

        new_game_id = parseInt(new_game_id)
        if (!(new_game_id > 0))
        {
            client.emit('error-message', "Invalid/missing game id!")
            return
        }

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
                for (var i = 0; i < game.playerKeys.length; ++i)
                {
                    if (game.playerKeys[i] == player_key)
                    {
                        player_index = i
                        break
                    }
                }
                client.emit('game', game.state.objectify(), player_index)
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
            if (player_index < 0 || game.state.getNextPlayer() != player_index)
            {
                client.emit('error-message', "It's not your turn!")
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
            if (player_index < 0 || game.state.getNextPlayer() != player_index)
            {
                client.emit('error-message', "It's not your turn!")
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
    var params = url.parse(process.env.DATABASE_URL || "sqlite://localhost/atlantis.db", true)
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
        id:              { type: Sequelize.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true },
        serializedState: { type: Sequelize.TEXT,    allowNull: false                      },
        over:            { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false } })

    orm.User = sequelize.define("User", {
        username: { type: Sequelize.TEXT, allowNull: false, primaryKey: true },
        salt:     { type: Sequelize.TEXT },
        passkey:  { type: Sequelize.TEXT } })

    sequelize.sync().done(function() {
        socket_io.listen(server).sockets.on('connection', onConnection)
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

exports.createAccount = function(username, salt, passkey, callback)
{
    if ( typeof username != "string" ||
         typeof salt     != "string" ||
         typeof passkey  != "string" || !passkey.match(/^[0-9a-f]{40}$/) )
    {
        callback(new Error("invalid arguments"))
        return
    }

    username = username.toLowerCase()
    if (!username.match(/^[a-z][a-z0-9]*$/))
    {
        callback(new Error("username must start with a letter, and may contain only ASCII letters and digits"))
        return
    }

    orm.User.find(username).success(function(user){
        if (user)
        {
            callback(new Error("username is already in use"))
        }
        else
        {
            orm.User.create({ username: username, salt: salt, passkey: passkey }).success(function(user) {
                callback(null, user.username)
            })
        }
    })
}

exports.getAuthChallenge = function(username, callback)
{
    orm.User.find(username.toLowerCase()).success(function(user){
        if (!user)
        {
            callback(new Error("user not found"))
        }
        else
        {
            // FIXME: nonce is just a random number for now.  This doesn't protect against replay attacks!
            var nonce = crypto.randomBytes(20).toString("hex")
            callback(null, user.username, user.salt, nonce)
        }
    })
}

exports.authenticate = function(username, nonce, proof, callback)
{
    if ( typeof username != "string" ||
         typeof nonce    != "string" ||
         typeof proof    != "string" )
    {
        callback(new Error("invalid arguments"))
        return
    }
    orm.User.find(username.toLowerCase()).success(function(user){
        if (!user)
        {
            callback(new Error("user not found"))
        }
        else
        {
            // FIXME: should verify nonce was generated by the server (see above)
            if (rmd.str(rmd.digest(nonce, rmd.vec(user.passkey))) != proof)
            {
                callback(new Error("invalid password"))
            }
            else
            {
                callback(null, user.username)
            }
        }
    })
}

exports.storePlayerKey = function(username, game_id, player_key, store, callback)
{
    if (!username)
    {
        callback(new Error("not logged in"))
        return
    }
    orm.User.find(username.toLowerCase()).success(function(user){
        if (!user)
        {
            callback(new Error("user not found"))
            return
        }

        retrieveGame(game_id, null, function(err, game) {
            if (err)
            {
                callback(err)
                return
            }
            var numKeys = game.playerKeys.length
            for (var player = 0; player < numKeys ; ++player)
            {
                if (game.playerKeys[player] === player_key) break
            }
            removeClient(game_id)  // frees game if no other clients are connected
            if (player == game.playerKeys.length)
            {
                callback(new Error("invalid player key"))
                return
            }
            callback(null, false)
            // TODO: look up association in database
            // TODO: check if typeof(store) == 'boolean' and if so, change state
        })
    })
}

exports.createGame = createGame
