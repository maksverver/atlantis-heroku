"use strict"

function onGamesList(games)
{
    var table = document.getElementById("GamesList")

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
        table.appendChild(tr)

        // Game ID
        var td = document.createElement("td")
        td.style.fontFamily = "mono";
        var a = document.createElement("a")
        a.href = "game.html#game=" + encodeURIComponent(game.id)
        a.target = "game-" + game.id
        a.appendChild(document.createTextNode(game.id))
        td.style.textAlign = "center"
        td.appendChild(a)
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

        // Finished time
        var td = document.createElement("td")
        td.appendChild(document.createTextNode(game.over ? "game over" : "in progress"))
        tr.appendChild(td)
    }
}

exports.onGamesList = onGamesList
