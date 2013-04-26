//
//  Implements game setup functionality.
//

function setup()
{
    document.getElementById('SelectBoard').style.display = 'block'
    onBoardShapeChanged()
}

function onBoardShapeChanged()
{
    var shape = document.getElementById('BoardShape').value
    var size  = parseInt(document.getElementById('BoardSize').value)

    var segments = []
    for (var i = 0; i < (shape == 'hexagon' ? 2*size - 1 : size); ++i)
    {
        var begin = shape == 'hexagon'  ? Math.max(i + 1 - size, 0) : 0
        var end   = shape == 'hexagon'  ? Math.min(2*size - 1, i + size) :
                    shape == 'triangle' ? i + 1 : size
        for (var j = begin; j < end; ++j)
        {
            var center = Coords(1 + i + 2*j, 1 + 3*i - j)
            var segment = [ center.toString() ]
            for (var dir = 0; dir < 6; ++dir)
            {
                segment.push(center.getNeighbour(dir).toString())
            }
            segments.push(segment)
        }
    }
    gamestate = GameState({"segments":segments})
    createBoardCanvas()
    redraw()
}

function toggleSegment(field)
{
    if (field)
    {
        var segment = gamestate.getField(field).getSegment()
        var fields = gamestate.getFields()
        for (var id in fields)
        {
            if (fields[id].getSegment() == segment)
            {
                fields[id].toggleLiving()
            }
        }
        redraw()
    }
}

function onBoardSelected()
{
    document.getElementById('SelectBoard').style.display = 'none'
    document.getElementById('CustomizeBoard').style.display = 'block'
    board_events.addHandler('mousedown', toggleSegment)
}

function addPlayerStone(field_id)
{
    if (!field_id) return
    field = gamestate.getField(field_id)
    if (!field.isOpen()) return
    
    var color = null
    for (var i = 0; ; ++i)
    {
        var elem = document.getElementById('Color' + i)
        if (!elem) break
        if (elem.checked) color = elem.value
    }
    var player = -1
    var players = gamestate.getPlayers()
    if (color != null && color != "white")
    {
        while (++player < players.length && players[player].color != color) { }
        if (player == players.length) players.push({"color":color})
    }
    if (player == -1 || field.getPlayer() != player)
    {
        field.removeStones(field.getStones())
    }
    if (player != -1)
    {
        if (field.getStones() < gamestate.countNeighbours(field_id))
        {
            field.addPlayerStones(player, 1)
        }
        else
        {
            field.removeStones(field.getStones())
        }
    }

    // Remove unused players:
    var used = {}, fields = gamestate.getFields()
    for (var id in fields)
    {
        var field = gamestate.getField(id)
        if (field.getStones() > 0)
        {
            var color = players[field.getPlayer()].color
            if (!used[color]) used[color] = []
            used[color].push(field)
        }
    }
    for (var i = 0; i < players.length; ++i)
    {
        if (!used[players[i].color])
        {
            players.splice(i--, 1)
        }
        else
        {
            for (var j in used[players[i].color])
            {
                used[players[i].color][j].setPlayer(i)
            }
        }
    }
    redraw()

    // Assign player indices to labels
    for (var i = 0; ; ++i)
    {
        var elem = document.getElementById('Color' + i)
        if (!elem) break
        var color = elem.value
        elem = elem.nextSibling
        while (elem.firstChild) elem.removeChild(elem.firstChild)
        for (var j = 0; j < players.length; ++j)
        {
            if (players[j].color == color)
            {
                var span = document.createElement("span")
                span.appendChild(document.createTextNode(j + 1))
                elem.appendChild(span)
                break
            }
        }
    }
}

function onBoardCustomized()
{
    // Remove dead fields/segments:
    var old_segments = gamestate.getSegments()
    var new_segments = []
    for (var i = 0; i < old_segments.length; ++i)
    {
        var new_segment = []
        for (var j = 0; j < old_segments[i].length; ++j)
        {
            if (!gamestate.getField(old_segments[i][j]).isDead())
            {
                new_segment.push(old_segments[i][j])
            }
        }
        if (new_segment.length > 0) new_segments.push(new_segment)
    }
    if (new_segments.length == 0)
    {
        alert("Leave some segments open!")
        return
    }
    document.getElementById('CustomizeBoard').style.display = 'none'
    document.getElementById('CustomizePlayer').style.display = 'block'
    board_events.removeHandler('mousedown', toggleSegment)
    board_events.addHandler('mousedown', addPlayerStone)
    gamestate = GameState({'segments':new_segments, "players":[]})
    createBoardCanvas()
    redraw()
}

function onStonesPlaced()
{
    if (gamestate.getPlayers().length < 2)
    {
        alert("Place some stones first! (Minimum of two players required.)")
        return
    }
    board_events.removeHandler('mousedown', addPlayerStone)
    document.getElementById('CustomizePlayer').style.display = 'none'
    gamestate.storeInitialState()
    server.emit('create', gamestate.objectify())
}
