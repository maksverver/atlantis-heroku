if (typeof exports == 'object')
{
    Field = require("./Field.js").Field
    parseCoords = require("./Coords.js").parseCoords
}

function deepCopy(obj)
{
    return obj ? JSON.parse(JSON.stringify(obj)) : null
}

//
// The GameState class represents the state of the game between turns.
//

function GameState(initial)
{
    var segments = null
    var players  = null
    var turns    = null
    var fields   = null

    // TODO: sanitize `initial`!
    initialize(initial.segments, initial.players, initial.turns)

    function executeTurn(player, moves)
    {
        // Phase 1: movement
        for (var i in moves)
        {
            var move = moves[i]
            doMove(move[0], move[1])
        }

        // Phase 2: explosions
        var explosions
        while ((explosions = findExplosions(player)).length > 0)
        {
            for (var i in explosions)
            {
                doExplosion(player, explosions[i])
            }
        }

        // Phase 3: growth
        var growing = findGrowing(player)
        for (var i in growing)
        {
            fields[growing[i]].addPlayerStones(player, 1)
        }
    }

    function initialize(s, p, t)
    {
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
        if (players)
        {
            for (var player in players)
            {
                for (var id in players[player].stacks)
                {
                    fields[id].setPlayerValue(player, players[player].stacks[id])
                }
            }
        }

        // Process player's turns:
        if (turns)
        {
            for (var turn = 0; turn < turns.length; ++turn)
            {
                executeTurn(turn % players.length, turns[turn])
            }
        }
    }

    function getSegments()      { return segments }
    function getPlayer(i)       { return players[i] }
    function getPlayers()       { return players }
    function getTurns()         { return turns }
    function getFields()        { return fields }
    function getField(id)       { return fields[id] || null }
    function getNextPlayer()    { return turns ? turns.length % players.length : -1 }

    function reset()
    {
        initialize(segments, players, turns)
    }

    function isValidMove(src, dst)
    {
        var src = parseCoords(src)
        var dst = parseCoords(dst)
        if (!src || !dst) return false

        var field = fields[src]
        if (!field) return false

        // Check that the source field is open and occupied by the next player:
        if (field.isClosed() || field.getPlayer() != getNextPlayer()) return false

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
    }

    function countNeighbours(id)
    {
        var coords = parseCoords(id)
        var result = 0
        for (var dir = 0; dir < 6; ++dir)
        {
            var neighbour = fields[coords.getNeighbour(dir)]
            if (neighbour && neighbour.isOpen()) ++result
        }
        return result
    }

    function findExplosions(player)
    {
        var result = []
        for (var id in fields) {
            var field = fields[id]
            if ( !field.isDead() && field.getPlayer() == player &&
                 field.getStones() >= countNeighbours(id) )
            {
                result.push(id)
            }
        }
        return result
    }

    function findGrowing(player)
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
    }

    // NOTE: blindly assumes the given move is valid!
    function doMove(src, dst)
    {
        var src     = parseCoords(src)
        var dst     = parseCoords(dst)
        var dir     = src.getDirectionTo(dst)
        var dist    = src.getDistanceTo(dst)
        var field   = fields[src]
        var player  = field.getPlayer()
        var stones  = field.removeStones(dist)
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
    }

    // NOTE: blindly assumes the given field is ready to burst!
    function doExplosion(player, id)
    {
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
    }

    // NOTE: assumes the given moves are valid for the next player!
    function addTurn(moves)
    {
        executeTurn(getNextPlayer(), moves)
        turns.push(moves)
    }

    function storeInitialState()
    {
        for (var i in players)
        {
            players[i]["stacks"] = {}
        }

        for (var id in fields)
        {
            var field = fields[id]
            if (field.getPlayer() >= 0)
            {
                players[field.getPlayer()].stacks[id] =
                    field.isGrowing() ? -field.getStones() : field.getStones()
            }
        }

        // TODO: clear turns list?
    }

    function objectify()
    {
        return { "format":   "Atlantis trancript",
                 "version":  "1.0",
                 "segments":  deepCopy(segments),
                 "players":   deepCopy(players) }
        // TODO: turns/events
    }

    return { getSegments:       getSegments,
             getPlayer:         getPlayer,
             getPlayers:        getPlayers,
             getTurns:          getTurns,
             getFields:         getFields,
             getField:          getField,
             getNextPlayer:     getNextPlayer,
             reset:             reset,
             isValidMove:       isValidMove,
             countNeighbours:   countNeighbours,
             findExplosions:    findExplosions,
             findGrowing:       findGrowing,
             doMove:            doMove,
             doExplosion:       doExplosion,
             addTurn:           addTurn,
             storeInitialState: storeInitialState,
             objectify:         objectify }
}

if (typeof exports == 'object')
{
    exports.GameState = GameState
}
