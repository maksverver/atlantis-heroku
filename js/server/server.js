"use strict"

// Atlantis game server implementation

var crypto      = require('crypto')
var fs          = require('fs')
var url         = require('url')
var pg          = require('pg').native
var socket_io   = require('socket.io')

var GameState   = require("../common/GameState.js")
var rmd         = require("../common/RIPEMD-160.js")

var database   = null       // PostgreSQL database handle
var games       = { }       // currently loaded games

function propagateError(callback, onSuccess)
{
    return function(err, result) {
        if (err)
        {
            callback(err)
        }
        else
        {
            onSuccess(result)
        }
    }
}

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
    database.query( 'SELECT "game_id", "serialized_state", "over" FROM "Games" WHERE game_id = $1',
                    [game_id], propagateError(callback, function(result) {
        if (result.rows.length < 1)
        {
            callback(new Error("Game not found"), null)
            return
        }
        var row = result.rows[0]
        var obj = JSON.parse(row.serialized_state)
        var game = games[game_id]  // handle race-condition
        if (!game)
        {
            game = { gameId:     row.game_id,
                     state:      GameState(obj),
                     over:       row.over,
                     playerKeys: obj.playerKeys,
                     clients:    [ ] }
            games[game_id] = game
            console.log("Game " + game_id + " cached.")
        }
        if (new_client) game.clients.push(new_client)
        callback(null, game)
    }))
}

function storeGame(game, callback)
{
    var obj = game.state.objectify()
    obj.playerKeys = game.playerKeys
    database.query( 'UPDATE "Games" SET "serialized_state"=$2, "over"=$3, "updated_at"=NOW() WHERE game_id = $1',
                    [game.gameId, JSON.stringify(obj), game.over], propagateError(callback, function(result) { callback(null) }))
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

    database.query( 'INSERT INTO "Games" ("serialized_state") VALUES ($1) RETURNING("game_id")', [JSON.stringify(game)],
                    propagateError(callback, function(result) {
        var game_id = result.rows[0].game_id
        console.log('Created game "' + game_id + '".')
        callback(null, game_id, keys)
    }))
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
                            console.log("Failed to store game " + game_id + ": " + err)
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
    database = new pg.Client(process.env.DATABASE_URL)
    database.connect()
    socket_io.listen(server).sockets.on('connection', onConnection)
}

exports.listGames = function(callback)
{
    // FIXME: this retrieves full rows, even the serializedState field that I don't want!
    // FIXME: do ordering + limiting on the server side
    database.query( 'SELECT * FROM "Games"', function(err,result) {
        if (err)
        {
            callback(err, null)
            return
        }
        var gamelist = []
        for (var i in result.rows)
        {
            var row = result.rows[i]
            var game_id = row.game_id
            gamelist.push({
                "id":         game_id,
                "createdAt":  new Date(row.created_at),
                "updatedAt":  new Date(row.updated_at),
                "over":       row.over,
                "online":     games[game_id] ? games[game_id].clients.length : 0 })
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

    // Check if user exists:
    database.query('SELECT 1 FROM "Users" WHERE "username" = $1', [username], function(err,result) {
        if (err) { callback(err); return }
        if (result.rows.length > 0)
        {
            callback(new Error("username already taken"))
            return
        }
        // Create new user row.
        database.query('INSERT INTO "Users" ("username", "salt", "passkey") VALUES ($1,$2,$3)', [username,salt,passkey], function(err,result) {
            if (err) { callback(err); return }
            callback(null, username)
        })
    })
}

exports.getAuthChallenge = function(username, callback)
{
    username = username.toLowerCase()
    database.query('SELECT "salt" FROM "Users" WHERE "username" = $1', [username], function(err,result) {
        if (err) { callback(err); return }
        if (result.rows.length == 0) { callback(new Error("user not found")); return }
        // FIXME: nonce is just a random number for now.  This doesn't protect against replay attacks!
        var nonce = crypto.randomBytes(20).toString("hex")
        callback(null, username, result.rows[0].salt, nonce)
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
    username = username.toLowerCase()
    database.query('SELECT "passkey" FROM "Users" WHERE "username" = $1', [username], function(err,result) {
        if (err) { callback(err);  return }
        if (result.rows.length == 0) { callback(new Error("user not found")); return }
        // FIXME: should verify nonce was generated by the server (see above)
        if (rmd.str(rmd.digest(nonce, rmd.vec(result.rows[0].passkey))) != proof)
        {
            callback(new Error("invalid password"))
            return
        }
        callback(null, username)
    })
}

exports.storePlayerKey = function(username, game_id, player_key, store, callback)
{
    if (!username)
    {
        callback(new Error("not logged in"))
        return
    }
/*
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
*/
    callback(null, false)   // TEMP
}

exports.createGame = createGame
