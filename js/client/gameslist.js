"use strict"

var auth = require('./authentication.js')
var rpc = require('./rpc.js').rpc

function onAuthChange(username)
{
    document.getElementById("LoggedIn").style.display = username ? "block" : "none"
    document.getElementById("NotLoggedIn").style.display = username ? "none" : "block"
    if (username)
    {
        updateMyGamesList()
    }
}

function initialize()
{
    updateGamesList()
    onAuthChange(auth.getUsername())
    auth.onChange(onAuthChange)
}

function updateGamesList()
{
    rpc({ method: 'listGames' }, function(response) {
        if (response.error)
        {
            alert(response.error)
            return
        }
        onGamesList(document.getElementById("GamesList"), response.games)
    })
}

function updateMyGamesList()
{
    rpc({ method: 'listMyGames' }, function(response) {
        if (response.error)
        {
            alert(response.error)
            return
        }
        onGamesList(document.getElementById("MyGamesList"), response.games)
    })
}

function onGamesList(table, games)
{
    var tbody = table.firstChild
    while (tbody.tagName != "TBODY") tbody = tbody.nextSibling
    while (tbody.firstChild) tbody.removeChild(tbody.firstChild)

    for (var i in games)
    {
        games[i].mtime = new Date(games[i].mtime)
    }

    games.sort(function(a,b) {
        if (a.online > b.online) return -1
        if (a.online < b.online) return +1
        if (a.mtime.valueOf() > b.mtime.valueOf()) return -1
        if (a.mtime.valueOf() < b.mtime.valueOf()) return +1
        return 0
    })

    for (var i in games)
    {
        var game = games[i]

        var tr = document.createElement("tr")
        tbody.appendChild(tr)

        // Game ID
        var td = document.createElement("td")
        td.appendChild(document.createTextNode(game.gameId))
        td.appendChild(document.createTextNode(" ("))
        var a = document.createElement("a")
        a.href = "game.html#game=" + encodeURIComponent(game.gameId)
        a.target = "game-" + game.gameId
        a.appendChild(document.createTextNode('view'))
        td.style.textAlign = "center"
        td.appendChild(a)
        td.appendChild(document.createTextNode(")"))
        tr.appendChild(td)

        // Online client count:
        tr.appendChild(td)
        var td = document.createElement("td")
        td.style.textAlign = "center"
        td.appendChild(document.createTextNode(game.online))
        tr.appendChild(td)

        // Modification time
        var td = document.createElement("td")
        td.appendChild(document.createTextNode(game.updatedAt))
        tr.appendChild(td)

        // Next player
        var td = document.createElement("td")
        td.style.textAlign = "center";
        td.appendChild(document.createTextNode(game.nextPlayer < 0 ? "game over" : game.nextPlayer + 1))
        tr.appendChild(td)

        // My player
        if (typeof game.myPlayer != 'undefined')
        {
            var owner = (game.myPlayer < 0)
            var td = document.createElement("td")
            td.appendChild(document.createTextNode(owner ? "owner" : "player " + (game.myPlayer + 1)))
            td.appendChild(document.createTextNode(" ("))
            var a = document.createElement("a")
            a.href = "game.html#game=" + encodeURIComponent(game.gameId) + "&" + (owner ? "player" : "owner") + "=" + encodeURIComponent(game.myKey)
            a.target = "game-" + game.gameId + (owner ? "" : "player-" + (game.myPlayer + 1))
            a.appendChild(document.createTextNode(owner ? 'keys' : 'play'))
            td.style.textAlign = "center"
            td.appendChild(a)
            td.appendChild(document.createTextNode(")"))
            tr.appendChild(td)
        }
    }
}

exports.updateGamesList   = updateGamesList
exports.updateMyGamesList = updateMyGamesList
exports.initialize        = initialize
