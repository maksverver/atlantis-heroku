// Atlantis game server implementation

var fs          = require('fs')
var socket_io   = require('socket.io')

var games       = {}  // game-id => path
var clients     = {}  // game-id => list of clients

function retrieveGame(id, callback)
{
    if (!id || !games[id]) return null
    fs.readFile(games[id], function(err, data) {
        if (err) {
            console.log(err)
            data = null
        } else {
            try {
                data = JSON.parse(data)
            } catch (err) {
                console.log(err)
                data = null
            }
        }
        callback(data)
    })
}

function storeGame(id, data, callback)
{
    if (!id || !games[id]) return null
    var tempName = games[id] + '.new'
    fs.writeFile(tempName, JSON.stringify(data), function(err) {
        if (err) {
            callback(err)
        } else {
            fs.rename(tempName, games[id], callback)
        }
    })
}

// TODO: cache games in memory (while cliens are connected)

function connection(client)
{
    var game_id = null

    client.on('join', function (data) {

        if (game_id) return
        var id = data['game']
        if (!id) return
        retrieveGame(id, function(game) {
            game_id = id
            client.emit('game', game)
            if (!clients[game_id]) clients[game_id] = []
            clients[game_id].push(client)
        })
    })

    client.on('selection', function(data) {
        // TODO: validate selection is sane?
        for (var i in clients[game_id]) {
            var c = clients[game_id][i]
            if (c != client) c.emit('selection', data)
        }
    })

    client.on('turn', function(data) {

        // TODO: validate turn!!! (if invalid, issue reset. (how?))
        var turn = data

        retrieveGame(game_id, function(game) {
            if (!game) return
            if (!game["turns"]) game["turns"] = []
            game["turns"].push(turn)
            storeGame(game_id, game, function(err) {
                if (err) {
                    console.log(err)
                } else {
                    for (var i in clients[game_id]) {
                        console.log('sending ' + turn + ' to ' + clients[game_id][i].id)
                        clients[game_id][i].emit('turn', turn)
                    }
                }
            })
        })
    })

    client.on('disconnect', function() {
        if (!game_id) return

        for (var i in clients[game_id]) {
            if (clients[game_id][i] === client) {
                clients[game_id].splice(i, 1)
            }
        }
    })
}

exports.listen = function(server, gamesdir) {

    fs.readdir(gamesdir, function (err, files) {

        if (err) throw err

        // Build list of known games:
        var suffix = '.json'
        for (var i in files) {
            var j = files[i].lastIndexOf(suffix)
            if (j > 0 && j == files[i].length - suffix.length) {
                games[files[i].substring(0, j)] = gamesdir + '/' + files[i]
            }
        }

        // Listen for incoming connections:
        socket_io.listen(server).sockets.on('connection', connection)
    })
}
