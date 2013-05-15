"use strict"

var GameState         = require("../common/GameState.js")
var MoveSelection     = require("../common/MoveSelection.js")
var Coords            = require("../common/Coords.js")
var board             = require("./board.js")

// Global variables
var gamestate            = null
var my_player            = -1
var selection            = null
var server               = null
var my_turn              = false

function updateMoveButtons()
{
    document.getElementById('MoveButton' + 0).disabled = !my_turn || !selection
    for (var i = 1; i < 4; ++i)
    {
        document.getElementById('MoveButton' + i).disabled
            = !my_turn || !selection || selection.getPhase() != i
    }
}

function onMoveButton(i)
{
    // If no MoveSelection is active, these buttons should be disabled!
    if (!selection) return

    if (i == 0)
    {
        // Reset game state and move selection:
        gamestate = GameState(gamestate.objectify())
        selection = MoveSelection(gamestate)
    }
    else
    if (i == selection.getPhase())
    {
        selection.nextPhase()
    }
    if (selection.getPhase() == 4)
    {
        server.emit('turn', selection.getMoves())
        setMyTurn(false)
    }
    else
    {
        server.emit('selection', selection.objectify())
        board.redraw(gamestate, selection)
    }
    updateMoveButtons()
}

function moveSelectionMouseDownHandler(field)
{
    switch (selection.onMouseDown(field))
    {
    case 2: server.emit('selection', selection.objectify())
    case 1: board.redraw(gamestate, selection)
    }
}

function moveSelectionMouseUpHandler(field)
{
    switch (selection.onMouseUp(field))
    {
    case 2: server.emit('selection', selection.objectify())
    case 1: board.redraw(gamestate, selection)
    }
}

function setMyTurn(new_value)
{
    if (my_turn == new_value) return

    var board_events = board.getEventSource()
    if (new_value)
    {
        my_turn = true
        board_events.addHandler('mousedown', moveSelectionMouseDownHandler)
        board_events.addHandler('mouseup',   moveSelectionMouseUpHandler)
        updateMoveButtons()
    }
    else
    {
        my_turn = false
        board_events.removeHandler('mousedown', moveSelectionMouseDownHandler)
        board_events.removeHandler('mouseup',   moveSelectionMouseUpHandler)
        updateMoveButtons()
    }
}

function parseHash(hash)
{
    hash = hash.substr(hash.indexOf('#') + 1)
    var params = {}, i = 0
    while (i < hash.length)
    {
        var j = hash.indexOf('&', i)
        if (j < 0) j = hash.length
        var k = hash.indexOf('=', i)
        if (k >= i && k < j)
        {
            try
            {
                params[decodeURIComponent(hash.substring(i, k))] = 
                    decodeURIComponent(hash.substring(k + 1, j))
            }
            catch (e)
            {
                // silently ignored!
            }
        }
        i = j + 1
    }
    return params
}

function formatHash(obj)
{
    var hash = "#"
    for (var key in obj)
    {
        if (hash != "#") hash += "&"
        hash += encodeURIComponent(key) + '=' + encodeURIComponent(obj[key])
    }
    return hash
}

function updateScoreBoard()
{
    var elem = document.getElementById("ScoreBoard").firstChild
    var scores = gamestate.calculateScores()
    var players = gamestate.getPlayers()
    var nextIndex = gamestate.isGameOver() ? -1 :  gamestate.getNextPlayer()
    for (var i = 0; i < players.length; ++i)
    {
        while (!elem.tagName || elem.tagName.toLowerCase() != "div") elem = elem.nextSibling
        elem.className = elem.className.replace(" Next", "")
        if (i == nextIndex) elem.className += " Next"
        elem.lastChild.firstChild.data = scores[i].toString()
        elem = elem.nextSibling
    }
}

function createScoreBoard()
{
    var root = document.getElementById("ScoreBoard")
    root.style.display = "block"
    var players = gamestate.getPlayers()
    for (var i in players)
    {
        var div = document.createElement("div")
        div.className = "PlayerScore"
        div.style.background = players[i].color
        root.appendChild(div)

        var nameDiv = document.createElement("div")
        nameDiv.className = "Name"
        nameDiv.appendChild(document.createTextNode(players[i].name || players[i].color))
        div.appendChild(nameDiv)

        var scoreDiv = document.createElement("score")
        scoreDiv.className = "Score"
        scoreDiv.appendChild(document.createTextNode("0"))
        div.appendChild(scoreDiv)
    }
    updateScoreBoard()
}

function initialize()
{
    // Parse parameters passed in URL hash:
    var params = parseHash(document.location.hash)

    // Connect to server
    server = io.connect(document.location.origin)
    server.on('connection-failed', function () { alert('Connection failed!') })
    server.on('disconnected', function () { alert('Connection lost!') })
    server.on('game', function(state, player_index) {
        document.getElementById("Buttons").style.display = "block"
        gamestate = GameState(state)
        my_player = player_index
        createScoreBoard()
        board.recreate(gamestate)
        if (!gamestate.isGameOver())
        {
            selection = new MoveSelection(gamestate)
            setMyTurn(my_player >= 0 && gamestate.getNextPlayer() == my_player)
        }
        else
        {
            selection = null
            setMyTurn(false)
        }
        board.redraw(gamestate, selection)
    })
    server.on('error-message', function(msg) {
        alert("The server said: " + msg)
    })
    server.on('selection', function(obj) {
        gamestate = GameState(gamestate.objectify())
        selection = MoveSelection(gamestate, obj)
        updateMoveButtons()
        board.redraw(gamestate, selection)
    })
    server.on('turn', function(moves) {
        gamestate = GameState(gamestate.objectify())  // reset to turn start
        gamestate.addTurn(moves)
        updateScoreBoard()
        if (!gamestate.isGameOver())
        {
            selection = MoveSelection(gamestate)
            setMyTurn(my_player >= 0 && gamestate.getNextPlayer() == my_player)
        }
        else
        {
            selection = null
            setMyTurn(false)
        }
        updateMoveButtons()
        board.redraw(gamestate, selection)
    })
    var connected = 0
    server.on('connect', function() {
        // NOTE: this fires on automatic reconnects too!
        if (connected++ == 0) server.emit('join', params['game'], params['player'])
    })
}

exports.onMoveButton      = onMoveButton
exports.initialize        = initialize
