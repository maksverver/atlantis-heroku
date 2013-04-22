DX = [ +1, +1,  0, -1, -1,  0 ]
DY = [  0, +1, +1,  0, -1, -1 ]

initial_game_state = {

    segments:
[['a3', 'a4', 'b3', 'b4', 'b5', 'c4', 'c5'], ['c2', 'c3', 'd2', 'd3', 'd4', 'e3', 'e4'], ['e1', 'e2', 'f1', 'f2', 'f3', 'g2', 'g3'], ['b6', 'b7', 'c6', 'c7', 'c8', 'd7', 'd8'], ['d5', 'd6', 'e5', 'e6', 'e7', 'f6', 'f7'], ['f4', 'f5', 'g4', 'g5', 'g6', 'h5', 'h6'], ['h3', 'h4', 'i3', 'i4', 'i5', 'j4', 'j5'], ['c9', 'c10', 'd9', 'd10', 'd11', 'e10', 'e11'], ['e8', 'e9', 'f8', 'f9', 'f10', 'g9', 'g10'], ['g7', 'g8', 'h7', 'h8', 'h9', 'i8', 'i9'], ['i6', 'i7', 'j6', 'j7', 'j8', 'k7', 'k8'], ['k5', 'k6', 'l5', 'l6', 'l7', 'm6', 'm7'], ['f11', 'f12', 'g11', 'g12', 'g13', 'h12', 'h13'], ['h10', 'h11', 'i10', 'i11', 'i12', 'j11', 'j12'], ['j9', 'j10', 'k9', 'k10', 'k11', 'l10', 'l11'], ['l8', 'l9', 'm8', 'm9', 'm10', 'n9', 'n10'], ['i13', 'i14', 'j13', 'j14', 'j15', 'k14', 'k15'], ['k12', 'k13', 'l12', 'l13', 'l14', 'm13', 'm14'], ['m11', 'm12', 'n11', 'n12', 'n13', 'o12', 'o13']],
/*
    segments: [['a1', 'a2', 'b1', 'b2', 'b3', 'c2', 'c3'], ['b4', 'b5', 'c4', 'c5', 'c6', 'd5', 'd6'], ['d3', 'd4', 'e3', 'e4', 'e5', 'f4', 'f5'], ['c7', 'c8', 'd7', 'd8', 'd9', 'e8', 'e9'], ['e6', 'e7', 'f6', 'f7', 'f8', 'g7', 'g8'], ['g5', 'g6', 'h5', 'h6', 'h7', 'i6', 'i7'], ['d10', 'd11', 'e10', 'e11', 'e12', 'f11', 'f12'], ['f9', 'f10', 'g9', 'g10', 'g11', 'h10', 'h11'], ['h8', 'h9', 'i8', 'i9', 'i10', 'j9', 'j10'], ['j7', 'j8', 'k7', 'k8', 'k9', 'l8', 'l9']],
*/
    /*
    segments: [
        ["c4","c5","d4","e5","e6"],
        ["f5","f6","g5","g6","g7","h6","h7"],
        ["a1","a2","b1","b2","b3","c2","c3"],
        ["d2","e2","d3","e3","f3","e4","f4"] ],
    */

    players: [
        {   'name': 'Foo',
            'color': 'red',
            'stacks': {
                'a3':  1,
                'a4':  1,
                'b3':  1,
                'b4':  1,
                'b5':  1,
                'c4':  1,
                'c5':  1
            }
        },
        {   'name': 'Bar',
            'color': 'blue',
            'stacks': {
                'i13': 1,
                'i14': 1,
                'j13': 1,
                'j14': 1,
                'j15': 1,
                'k14': 1,
                'k15': 1 }
        },
        {
            'name': 'Bar',
            'color': 'Green',
            'stacks': {
                'k5': 1,
                'k6': 1,
                'l5': 1,
                'l6': 1,
                'l7': 1,
                'm6': 1,
                'm7': 1
            }
        }
    ],

    turns: [ ]
}

gamestate            = null
selection            = null
board_canvas         = null
board_canvas_context = null

function deepCopy(obj)
{
    return JSON.parse(JSON.stringify(obj))
}

//
//  The Coords class represents an (immutable) pair of hexagonal grid coordinates.
//

function encodeX(x)
{
    if (x < 0) return '-' + encodeX(~x)
    if (x >= 26) return encodeX(Math.floor(x/26) - 1) + encodeX(x%26)
    return String.fromCharCode(97 + x)
}

function decodeX(s)
{
    if (s.charAt(0) == '-') return ~decodeX(s.substring(1))
    var x = 0
    for (var i = 0; i < s.length; ++i)
    {
        x = 26*x + s.charCodeAt(i) - 96
    }
    return x - 1
}

function Coords(x, y) {
    return {

        toString: function()
        {
            return encodeX(x) + (y + 1)
        },

        getNeighbour: function(dir)
        {
            return Coords(x + DX[dir], y + DY[dir])
        },

        getDirectionTo: function(dest)
        {
            var dx = dest.getX() - x
            var dy = dest.getY() - y
            if (dx >  0 && dy ==  0) return 0
            if (dx >  0 && dy == dx) return 1
            if (dx == 0 && dy >   0) return 2
            if (dx <  0 && dy ==  0) return 3
            if (dx <  0 && dy == dx) return 4
            if (dx == 0 && dy <   0) return 5
            return -1
        },

        getDistanceTo: function(dest)
        {
            return Math.max(Math.abs(dest.getX() - x), Math.abs(dest.getY() - y))
        },

        getX: function() { return x },
        getY: function() { return y },

        // Conversion to Carthesian coordinates:
        getCX: function() { return 1.5*(x - y) },
        getCY: function() { return Math.sqrt(3)/2*(x + y) },
    }
}

function parseCoords(descr)
{
    var m = descr.match(/(-?[a-z]*)(0|-?[1-9][0-9]*)/)
    if (!m) return null
    return Coords( decodeX(m[1]), parseInt(m[2], 10) - 1 )
}

//
//  The Fields class represents a mutable game field.  Each field is part
//  of some board segment, may contain some stones of a single player, and
//  can be "open" or "closed".  If a field is open it may be moved onto or over,
//  and if it is closed the field is either growing or dead.
//
//  A field is expected to have an associated player (represented as an integer)
//  if it contains any stones, or if it is growing.
//

function Field(id, segment) {
    var state   =  0  // 0: open, 1: growing, 2: dead
    var player  = -1
    var stones  =  0

    return {
        getId:      function() { return id },
        getPlayer:  function() { return player },
        getStones:  function() { return stones },
        getSegment: function() { return segment },
        getCoords:  function() { return parseCoords(id) },
        isOpen:     function() { return state == 0 },
        isClosed:   function() { return state != 0 },
        isGrowing:  function() { return state == 1 },
        isDead:     function() { return state == 2 },

        setPlayerValue: function(new_player, value)
        {
            player = new_player
            if (value > 0)  // stack of stones on open field
            {
                state  = 0
                stones = value
            }
            else
            if (value < 0)  // stones on growing field
            {
                state  = 1
                stones = -value
            }
            else  /* value == 0 */  // dead field
            {
                state  = 2
                stones = 0
            }
        },

        removeStones: function(n)
        {
            if (n < 0) return 0
            if (n < stones)
            {
                stones -= n
            }
            else  /* n >= stones */
            {
                n = stones
                stones =  0
                player = -1
            }
            return n
        },

        addPlayerStones: function(p, n) {
            if (n <= 0) return
            if (stones == 0)
            {
                player = p
                stones = n
            }
            else
            if (player == p)
            {
                stones += n
            }
            else
            if (stones > n)
            {
                stones -= n
            }
            else
            if (stones < n)
            {
                stones = n - stones
                player = p
            }
            else  /* player != p && stones == n */
            {
                stones =  0
                player = -1
            }
        },

        explode: function(p) {
            stones = 0
            player = p
            if (state < 2) ++state
        }

    }
}

//
// The GameState class represents the state of the game between turns.
//

function GameState(descr)
{
    var segments = null
    var players  = null
    var turns    = null
    var fields   = null

    var initialize = function(s, p, t) {
        segments = deepCopy(s)
        players  = deepCopy(p)
        turns    = deepCopy(t)
        fields   = {}

        // Initialize fields:
        for (var i = 0; i < segments.length; ++i)
        {
            for (var j = 0; j < segments[i].length; ++j)
            {
                var id = segments[i][j]
                fields[id] = Field(id, i)
            }
        }

        // Put player's stones on fields:
        for (var player in players)
        {
            for (var id in players[player].stacks)
            {
                fields[id].setPlayerValue(player, players[player].stacks[id])
            }
        }

        // Process player's turns:
        for (var turn = 0; turn < turns.length; ++turn)
        {
            var player = turn % players.length

            // Phase 1: movement
            for (var i in turns[turn]) {
                var move = turns[turn][i]
                this.doMove(move[0], move[1])
            }

            // Phase 2: explosions
            var explosions
            while ((explosions = this.findExplosions(player)).length > 0)
            {
                for (var i in explosions)
                {
                    this.doExplosion(player, explosions[i])
                }
            }

            // Phase 3: growth
            var growing = this.findGrowing(player)
            for (var i in growing)
            {
                fields[growing[i]].addPlayerStones(player, 1)
            }
        }
    }

    var obj = {
        getSegments:    function()   { return segments },
        getPlayer:      function(i)  { return players[i] },
        getPlayers:     function()   { return players },
        getTurns:       function()   { return turns },
        getFields:      function()   { return fields },
        getField:       function(id) { return fields[id] || null },
        getNextPlayer:  function()   { return turns.length % players.length },

        isValidMove: function(src, dst)
        {
            var src = parseCoords(src)
            var dst = parseCoords(dst)
            if (!src || !dst) return false

            var field = fields[src]
            if (!field) return false

            // Check that the source field is open and occupied by the next player:
            if (field.isClosed() || field.getPlayer() != this.getNextPlayer()) return false

            // Check that stones are moved in one of six possible directions:
            var dir = src.getDirectionTo(dst)
            if (dir < 0) return false

            // Check that the distance moved is between 1 and the height of the stack:
            var dist = src.getDistanceTo(dst)
            if (dist < 1 || dist > field.getStones()) return false

            // Check that all fields visited are open:
            for (var step = 0; step < dist; ++step)
            {
                src = src.getNeighbour(dir)
                field = fields[src]
                if (!field || !field.isOpen()) return false
            }

            return true
        },

        countNeighbours: function(id) {
            var coords = parseCoords(id)
            var result = 0
            for (var dir = 0; dir < 6; ++dir)
            {
                var neighbour = fields[coords.getNeighbour(dir)]
                if (neighbour && neighbour.isOpen()) ++result
            }
            return result
        },

        findExplosions: function(player)
        {
            var result = []
            for (var id in fields) {
                var field = fields[id]
                if ( !field.isDead() && field.getPlayer() == player &&
                     field.getStones() >= this.countNeighbours(id) )
                {
                    result.push(id)
                }
            }
            return result
        },

        findGrowing: function(player)
        {
            var result = []
            for (var id in fields)
            {
                var field = fields[id]
                if (field.isGrowing() && field.getPlayer() == player)
                {
                    result.push(id)
                }
            }
            return result
        },

        // NOTE: assumes the given move is valid!
        doMove: function(src, dst)
        {
            var src = parseCoords(src)
            var dst = parseCoords(dst)
            var dir = src.getDirectionTo(dst)
            var dist = src.getDistanceTo(dst)
            var field = fields[src]
            var player = field.getPlayer()
            var stones = field.removeStones(dist)
            for (var step = 0; step < dist; ++step)
            {
                src = src.getNeighbour(dir)
                field = fields[src]
                if (field.getPlayer() != player) stones -= field.removeStones(stones)
            }
            if (stones > 0)
            {
                field.addPlayerStones(player, stones)
            }
            return true
        },

        // NOTE: assumes the given field is ready to burst!
        doExplosion: function(player, id) {
            var field = fields[id]
            var coords = field.getCoords()
            for (var dir = 0; dir < 6; ++dir)
            {
                var neighbour = fields[coords.getNeighbour(dir)]
                if (neighbour && neighbour.isOpen())
                {
                    neighbour.addPlayerStones(player, 1)
                }
            }
            field.explode(player)
        },

        reset: function() {
            initialize.call(this, segments, players, turns)
        },

        addTurn: function(moves) {
            turns.push(moves)
        },
    }
    initialize.call(obj, descr.segments, descr.players, descr.turns)
    return obj
}

//
// The MoveSelection class represents a partial set of moves to be executed
// by the next player.
//

function MoveSelection()
{
    var phase      = 1
    var selected   = null
    var moves      = [ ]
    var explosions = null
    var growing    = null

    return {
        getMoves:           function() { return moves },
        getExplosions:      function() { return explosions },
        getGrowing:         function() { return growing },
        getSelectedField:   function() { return selected },
        getPhase:           function() { return phase },

        onMouseDown: function(id)
        {
            if (phase > 1) return false

            if (id == null)
            {
                if (selected != null)
                {
                    selected = null
                    return true
                }
                return false
            }

            // Pre-calculate fields/segments involved in moves
            var movedToField  = { }, movedFromField = { }, movedFromSegment = { }
            for (var i in moves)
            {
                movedFromField[moves[i][0]] = true
                movedToField[moves[i][1]] = true
                movedFromSegment[gamestate.getField(moves[i][0]).getSegment()] = true
            }

            if (selected == null && movedFromField[id])
            {
                // Cancel previous move:
                for (var i in moves)
                {
                    if (moves[i][0] == id)
                    {
                        moves.splice(i, 1)
                        break
                    }
                }
                selected = id
                return true
            }
            if (selected != null)
            {
                if (selected != id && gamestate.isValidMove(selected, id))
                {
                    moves.push([selected,id])
                }
                selected = null
                return true
            }
            else
            {
                var field = gamestate.getField(id)
                if ( field.isOpen() && !movedFromSegment[field.getSegment()] &&
                     field.getPlayer() == gamestate.getNextPlayer() )
                {
                    selected = id
                    return true
                }
            }
            return false
        },

        onMouseUp: function(id)
        {
            return selected && id != selected && this.onMouseDown(id)
        },

        nextPhase: function()
        {
            var player = gamestate.getNextPlayer()

            switch (phase)
            {
            case 1:  // end movement phase
                if (selected != null)
                {
                    selected = null
                }
                for (var move in moves)
                {
                    move = moves[move]
                    gamestate.doMove(move[0], move[1])
                }
                phase = 2  // NOTE: falls through!

            case 2:  // execute explosions!
                for (var i in explosions)
                {
                    gamestate.doExplosion(player, explosions[i])
                }
                explosions = gamestate.findExplosions(player)
                if (explosions.length == 0)
                {
                    growing = gamestate.findGrowing(player)
                    phase = (growing.length > 0) ? 3 : 4
                }
                break

            case 3:  // growth
                for (var i in growing)
                {
                    gamestate.getField(growing[i]).addPlayerStones(player, 1)
                }
                phase = 4
                break
            }
        },
    }
}

function getMouseOverField(event)
{
    var x = event.pageX - board_canvas.offsetLeft
    var y = event.pageY - board_canvas.offsetTop

    // Search for clicked field:
    for (var id in gamestate.getFields())
    {
        var coords = parseCoords(id)
        makeFieldPath(coords.getCX(), coords.getCY())
        if (board_canvas_context.isPointInPath(x,y)) return id
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
        var coords = parseCoords(id)
        var cx = coords.getCX()
        var cy = coords.getCY()

        makeFieldPath(cx, cy)
        context.fillStyle = (id == selection.getSelectedField()) ? '#ffe000' :
                             field.isDead() ? '#6080ff' :
                             field.isGrowing() ?'#80ff80' : '#ffffa0'
        context.fill()
        context.lineWidth = 0.03
        if (field.isOpen())
        {
            context.strokeStyle = '#c0c080'
            context.stroke()
        }
    }

    // Render segment borders
    for (var id in fields)
    {
        var field = fields[id]
        if (field.isClosed()) continue
        var coords = parseCoords(id)
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

    switch (selection.getPhase())
    {
    case 1:  // Render moves
        var moves = selection.getMoves()
        context.save()
        context.globalAlpha = 0.5
        context.fillStyle = 'blue'
        for (var i in moves) 
        {
            var src = parseCoords(moves[i][0])
            var dst = parseCoords(moves[i][1])
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
            var coords = parseCoords(explosions[i])
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
        context.save()
        context.globalAlpha = 0.5
        context.fillStyle = 'green'
        for (var i in growing)
        {
            var coords = parseCoords(growing[i])
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
                context.lineTo(x2, y2)
            }
            context.fill()
        }
        context.restore()
        break
    }

    // Render stones
    for (var id in fields)
    {
        var field = fields[id]
        var coords = parseCoords(id)
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
    document.getElementById('MoveButton' + 0).disabled = !selection
    for (var i = 1; i < 5; ++i)
    {
        document.getElementById('MoveButton' + i).disabled
            = !selection || selection.getPhase() != i
    }
}

function onMoveButton(i)
{
    if (i == 0)
    {
        // Reset game state and move selection:
        gamestate.reset()
        selection = MoveSelection()
    }
    else
    if (i == 4)
    {
        gamestate.addTurn(selection.getMoves())
        selection = MoveSelection()
    }
    else
    {
        selection.nextPhase()
    }
    updateMoveButtons()
    redraw()
}

function initialize()
{
    gamestate = GameState(initial_game_state)
    selection = MoveSelection()

    var bbox = [0,0,0,0]    // bounding box (x1,y1,x2,y2)
    for (var id in gamestate.getFields())
    {
        var coords = parseCoords(id)
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
    document.getElementById("BoardContainer").appendChild(board_canvas)

    board_canvas_context = board_canvas.getContext('2d')
    board_canvas_context.translate(margin, board_canvas.height - margin)
    board_canvas_context.scale(scale, -scale)
    board_canvas_context.translate(-bbox[0], -bbox[1])
    board_canvas.addEventListener("mousedown", function(event) {
        if (selection.onMouseDown(getMouseOverField(event))) redraw()
        event.preventDefault()  // prevent text-selection while dragging
    }, false)
    board_canvas.addEventListener("mouseup", function(event) {
        if (selection.onMouseUp(getMouseOverField(event))) redraw()
    }, false)

    updateMoveButtons()
    redraw()
}
