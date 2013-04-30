"use strict"

var CustomEventSource = require("./CustomEventSource.js")
var GameState         = require("../common/GameState.js")
var MoveSelection     = require("../common/MoveSelection.js")
var Coords            = require("../common/Coords.js")

// Global variables
var gamestate            = null
var selection            = null
var board_canvas         = null
var board_canvas_context = null
var server               = null
var board_events         = CustomEventSource()
var my_turn              = false

function getGameState()                 { return gamestate }
function getBoardEvents()               { return board_events }
function setGameState(new_gamestate)    { gamestate = new_gamestate }

function fixEventOffset(event, element)
{
    // This is retarded. JavaScript in the browser fucking sucks.
    if (!event.hasOwnProperty('offsetX'))
    {
        event.offsetX = event.layerX
        event.offsetY = event.layerY
        while (element.offsetParent)
        {
            event.offsetX -= element.offsetLeft
            event.offsetY -= element.offsetTop
            element = element.offsetParent
        }
    }
}

function getMouseOverField(event)
{
    // Search for clicked field:
    for (var id in gamestate.getFields())
    {
        var coords = Coords.parse(id)
        makeFieldPath(coords.getCX(), coords.getCY())
        if (board_canvas_context.isPointInPath(event.offsetX, event.offsetY)) return id
    }
    return null
}

function makeFieldPath(cx, cy)
{
    board_canvas_context.beginPath()
    for (var i = 0; i < 6; ++i)
    {
        var x = cx + Math.cos(i*Math.PI/3)
        var y = cy + Math.sin(i*Math.PI/3)
        if (i == 0) {
            board_canvas_context.moveTo(x, y)
        } else {
            board_canvas_context.lineTo(x, y)
        }
    }
    board_canvas_context.closePath()
}

function drawFieldHighlight(id, fillStyle, context, radius)
{
    if (!radius) radius = -2/3
    context.save()
    context.globalAlpha = 0.5
    context.fillStyle = fillStyle
    var coords = Coords.parse(id)
    var cx = coords.getCX()
    var cy = coords.getCY()
    context.beginPath()
    context.arc(cx, cy, Math.abs(radius), 0, Math.PI*2, true)
    if (radius < 0)
    {
        var x1 = cx + 1, y1 = cy
        context.moveTo(x1, y1)
        for (var dir = 0; dir < 6; ++dir)
        {
            var x2 = cx + Math.cos((dir + 1)*Math.PI/3)
            var y2 = cy + Math.sin((dir + 1)*Math.PI/3)
            context.lineTo(x2, y2)
        }
    }
    context.fill()
    context.restore()
}

function redraw()
{
    var canvas  = board_canvas
    var context = board_canvas_context

    // Clear background
    context.save()
    context.setTransform(1,0,0,1,0,0)
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.restore()

    // Render fields
    var fields = gamestate.getFields()
    for (var id in fields)
    {
        var field = fields[id]
        var coords = Coords.parse(id)
        var cx = coords.getCX()
        var cy = coords.getCY()

        makeFieldPath(cx, cy)
        var highlight_color = '#ffe040'
        context.fillStyle = (selection && id == selection.getSelectedField())
                                              ? highlight_color
                          : field.isDead()    ? '#6080ff'
                          : field.isGrowing() ? '#80ff80'
                                              : '#ffffa0'
        context.fill()
        context.lineWidth = 0.03
        if (field.isOpen())
        {
            context.strokeStyle = '#c0c080'
            context.stroke()
        }
        if (selection && selection.getPhase() == 1)
        {
            if (!selection.getSelectedField())
            {
                if (selection.isSourceField(id))
                {
                    drawFieldHighlight(id, highlight_color, context)
                }
            }
            else
            {
                if (selection.isDestinationField(id))
                {
                    drawFieldHighlight(id, highlight_color, context, 0.5)
                }
            }
        }
    }

    // Render segment borders
    for (var id in fields)
    {
        var field = fields[id]
        if (field.isClosed()) continue
        var coords = Coords.parse(id)
        var segment = field.getSegment()
        var cx = coords.getCX()
        var cy = coords.getCY()
        context.beginPath()
        for (var dir = 0; dir < 6; ++dir)
        {
            var field2 = gamestate.getField(coords.getNeighbour(dir))
            if (!field2 || segment > field2.getSegment() || field2.isClosed())
            {
                context.moveTo( cx + Math.cos( dir     *Math.PI/3),
                                cy + Math.sin( dir     *Math.PI/3) )
                context.lineTo( cx + Math.cos((dir + 1)*Math.PI/3),
                                cy + Math.sin((dir + 1)*Math.PI/3) )
            }
        }
        context.lineCap     = 'round'
        context.lineWidth   = 0.06
        context.strokeStyle = 'black'
        context.stroke()
    }

    switch (selection ? selection.getPhase() : 0)
    {
    case 1:  // Render moves
        var moves = selection.getMoves()
        context.save()
        context.globalAlpha = 0.5
        context.fillStyle = 'blue'
        for (var i in moves) 
        {
            var src = Coords.parse(moves[i][0])
            var dst = Coords.parse(moves[i][1])
            var x1 = src.getCX(), y1 = src.getCY()
            var x2 = dst.getCX(), y2 = dst.getCY()
            var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx*dx + dy*dy)
            dx *= 0.4/len
            dy *= 0.4/len
            x1 += 1.5*dx
            y1 += 1.5*dy
            x2 -= 2*dx
            y2 -= 2*dy
            context.beginPath()
            context.moveTo(x1 + dx, y1 + dy)
            context.lineTo(x1 + dy, y1 - dx)
            context.lineTo(x2 + dy, y2 - dx)
            context.lineTo(x2 + dx, y2 + dy)
            context.lineTo(x2 - dy, y2 + dx)
            context.lineTo(x1 - dy, y1 + dx)
            context.closePath()
            context.fill()
        }
        context.restore()
        break

    case 2:  // Render explosions
        var explosions = selection.getExplosions()
        context.save()
        context.globalAlpha = 0.5
        context.fillStyle = 'red'
        for (var i in explosions)
        {
            var coords = Coords.parse(explosions[i])
            var cx = coords.getCX()
            var cy = coords.getCY()
            context.beginPath()
            context.arc(cx, cy, 2/3, 0, Math.PI*2, true)
            var x1 = cx + 1, y1 = cy
            context.moveTo(x1, y1)
            for (var dir = 0; dir < 6; ++dir)
            {
                var x2 = cx + Math.cos((dir + 1)*Math.PI/3)
                var y2 = cy + Math.sin((dir + 1)*Math.PI/3)
                var neighbour = gamestate.getField(coords.getNeighbour(dir))
                if (neighbour && neighbour.isOpen())
                {
                    context.lineTo( 0.75*x1 + 0.25*x2,
                                    0.75*y1 + 0.25*y2 )
                    context.lineTo( cx + 1.2*Math.cos((dir + 0.5)*Math.PI/3),
                                    cy + 1.2*Math.sin((dir + 0.5)*Math.PI/3) )
                    context.lineTo( 0.25*x1 + 0.75*x2,
                                    0.25*y1 + 0.75*y2 )
                }
                context.lineTo(x2, y2)
                x1 = x2
                y1 = y2
            }
            context.fill()
        }
        context.restore()
        break

    case 3:  // Render growing fields
        var growing = selection.getGrowing()
        for (var i in growing)
        {
            drawFieldHighlight(growing[i], 'green', context)
        }
        break
    }

    // Render stones
    for (var id in fields)
    {
        var field = fields[id]
        var coords = Coords.parse(id)
        var n = field.getStones()
        for (var i = 0; i < n; ++i)
        {
            var x = coords.getCX(), y = coords.getCY()
            if (n > 1)
            {
                x += (0.4 + 0.01*n)*Math.cos(Math.PI*2*i/n)
                y += (0.4 + 0.01*n)*Math.sin(Math.PI*2*i/n)
            }
            context.beginPath()
            context.arc(x, y, 0.22 + (6 - n)*0.02, 0, Math.PI*2)
            context.fillStyle = gamestate.getPlayer(field.getPlayer()).color
            context.fill()
        }
    }
}

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
        redraw()
    }
    updateMoveButtons()
}

function moveSelectionMouseDownHandler(field)
{
    switch (selection.onMouseDown(field))
    {
    case 2: server.emit('selection', selection.objectify())
    case 1: redraw()
    }
}

function moveSelectionMouseUpHandler(field)
{
    switch (selection.onMouseUp(field))
    {
    case 2: server.emit('selection', selection.objectify())
    case 1: redraw()
    }
}

function setMyTurn(new_value)
{
    if (my_turn == new_value) return

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
        var k = hash.indexOf('=', k)
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
    var nextIndex = gamestate.getNextPlayer()
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
    server.on('game', function(state) {
        gamestate = GameState(state)
        selection = new MoveSelection(gamestate)
        document.getElementById("Buttons").style.display = "block"
        createScoreBoard()
        createBoardCanvas()
        setMyTurn(true)
        redraw()
    })
    server.on('error-message', function(msg) {
        alert("The server said: " + msg)
    })
    server.on('selection', function(obj) {
        gamestate = GameState(gamestate.objectify())
        selection = MoveSelection(gamestate, obj)
        updateMoveButtons()
        redraw()
    })
    server.on('turn', function(moves) {
        gamestate = GameState(gamestate.objectify())
        gamestate.addTurn(moves)
        updateScoreBoard()
        selection = MoveSelection(gamestate)
        setMyTurn(true)
        updateMoveButtons()
        redraw()
    })
    server.on('created', function(game_id) {
        params['game'] = game_id
        document.location.hash = formatHash(params)
        server.emit('join', game_id)
    })

    var connected = 0
    server.on('connect', function() {
        // NOTE: this fires on automatic reconnects too!
        if (connected++) return
        if (!params['game'])
        {
            require('./setup.js').setup(function(){
                server.emit('create', gamestate.objectify())
            })
        }
        else
        {
            server.emit('join', params['game'])
        }
    })
}

// (Re)creates the board canvas (assuming gamestate has been initialized!)
function createBoardCanvas()
{
    var board_container = document.getElementById("BoardContainer")

    if (board_canvas)
    {
        // Get rid of old canvas
        board_container.removeChild(board_canvas)
        board_canvas = board_canvas_context = null
    }

    // Calculate bounding box:
    var bbox = [Infinity,Infinity,-Infinity,-Infinity]  // bounding box (x1,y1,x2,y2)
    for (var id in gamestate.getFields())
    {
        var coords = Coords.parse(id)
        var cx = coords.getCX(), cy = coords.getCY()
        bbox[0] = Math.min(bbox[0], cx)
        bbox[1] = Math.min(bbox[1], cy)
        bbox[2] = Math.max(bbox[2], cx)
        bbox[3] = Math.max(bbox[3], cy)
    }
    bbox[0] -= 1
    bbox[1] -= 0.5*Math.sqrt(3)
    bbox[2] += 1
    bbox[3] += 0.5*Math.sqrt(3)

    var scale  = 30
    var margin = 10

    board_canvas = document.createElement('canvas')
    board_canvas.id = "Board"
    board_canvas.width  = Math.ceil((bbox[2] - bbox[0])*scale + 2*margin)
    board_canvas.height = Math.ceil((bbox[3] - bbox[1])*scale + 2*margin)
    board_container.appendChild(board_canvas)

    board_canvas.addEventListener("mousedown", function(event) {
        fixEventOffset(event, board_canvas)
        board_events.emit('mousedown', getMouseOverField(event))
        event.preventDefault()  // prevent text-selection while dragging
    }, false)
    board_canvas.addEventListener("mouseup", function(event) {
        fixEventOffset(event, board_canvas)
        board_events.emit('mouseup', getMouseOverField(event))
    }, false)

    board_canvas_context = board_canvas.getContext('2d')
    board_canvas_context.translate(margin, board_canvas.height - margin)
    board_canvas_context.scale(scale, -scale)
    board_canvas_context.translate(-bbox[0], -bbox[1])
}

exports.getGameState      = getGameState
exports.getBoardEvents    = getBoardEvents
exports.setGameState      = setGameState
exports.onMoveButton      = onMoveButton
exports.redraw            = redraw
exports.initialize        = initialize
exports.createBoardCanvas = createBoardCanvas
