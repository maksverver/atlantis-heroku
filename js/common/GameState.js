"use strict"

var Field  = require("./Field.js")
var Coords = require("./Coords.js")
var MoveSelection = require("./MoveSelection.js")

function deepCopy(obj)
{
    return obj ? JSON.parse(JSON.stringify(obj)) : null
}

//
// The GameState class represents the state of the game between turns.
//

function GameState(initial)
{
    var obj = { getSegments:       getSegments,
                getPlayer:         getPlayer,
                getPlayers:        getPlayers,
                getFields:         getFields,
                getField:          getField,
                getNextPlayer:     getNextPlayer,
                isValidMove:       isValidMove,
                countNeighbours:   countNeighbours,
                findExplosions:    findExplosions,
                findGrowing:       findGrowing,
                doMove:            doMove,
                doExplosion:       doExplosion,
                addTurn:           addTurn,
                storeInitialState: storeInitialState,
                objectify:         objectify,
                calculateRegions:  calculateRegions,
                calculateScores:   calculateScores,
                isGameOver:        isGameOver,
                hasPlayerMoves:    hasPlayerMoves }

    // TODO: freeze these after initialization?
    var segments = []
    var players  = []
    var turns    = []
    var fields   = {}

    if (typeof initial == "object")
    {
        // Robustly parse segment list:
        if (initial.segments instanceof Array)
        {
            for (var i = 0; i < initial.segments.length; ++i)
            {
                var s = initial.segments[i]
                if (s instanceof Array)
                {
                    var segment = []
                    for (var j = 0; j < s.length; ++j)
                    {
                        var coords = Coords.parse(s[j])
                        if (coords)
                        {
                            var id = coords.toString()
                            if (!fields[id])
                            {
                                segment.push(id)
                                fields[id] = Field(id, segments.length)
                            }
                        }
                    }
                    if (segment.length > 0)
                    {
                        // Keep only non-empty segments:
                        segments.push(segment)
                    }
                }
            }

            // Robustly parse player list:
            if (initial.players instanceof Array)
            {
                for (var i = 0; i < initial.players.length; ++i)
                {
                    var p = initial.players[i]
                    if (typeof p == "object" && typeof p.color == "string")
                    {
                        var player = { color: p.color, stacks: {} }
                        if (typeof p.name == "string") player.name = p.name
                        if (p.stacks instanceof Object)
                        {
                            for (var id in p.stacks)
                            {
                                var value = parseInt(p.stacks[id])
                                if (value == value && fields[id] && fields[id].getPlayer() < 0)
                                {
                                    player.stacks[id] = value
                                    fields[id].setPlayerValue(players.length, value)
                                }
                            }
                        }
                        if (Object.keys(player.stacks).length > 0)
                        {
                            // Keep only players initially controlling some stones:
                            players.push(player)
                        }
                    }
                }

                // Note: turns list only makes sense if all initial players were preserved
                if (players.length == initial.players.length && initial.turns instanceof Array)
                {
                    // Robustly parse turn list:
                    for (var i = 0; i < initial.turns.length; ++i)
                    {
                        /* FIXME: going through MoveSelection is rather ugly/relatively slow!
                           Maybe I should add a mothed to validate a turn here (or a robust
                           version of addTurn that rejects invalid moves) */
                        addTurn(MoveSelection(obj, { moves: initial.turns[i] }).getMoves())
                    }
                }
            }
        }
    }

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

    function getSegments()      { return segments }
    function getPlayer(i)       { return players[i] }
    function getPlayers()       { return players }
    function getFields()        { return fields }
    function getField(id)       { return fields[id] || null }
    function getNextPlayer()    { return turns ? turns.length % players.length : -1 }

    function isValidMove(src, dst)
    {
        var src = Coords.parse(src)
        var dst = Coords.parse(dst)
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
        var coords = Coords.parse(id)
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
        var src     = Coords.parse(src)
        var dst     = Coords.parse(dst)
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
                 "players":   deepCopy(players),
                 "turns":     deepCopy(turns) }
    }

    /* Returns a list of connected regions of open fields.

       Each region is an object with the following keys:
        fields: list of ids of open fields in the region
        stones: an object describing the stones players have in this region:
                each key is a player index, and the corresponding value is the
                (positive) number of this player's stones.
        stable: a Boolean value indicating whether this region is stable (i.e.
                contains at most one player's stones and has no adjacent growing
                points)
        winner: the winner of the region, or -1 if there is no winner (yet).
                (The winner of a region is the only player to control stones in
                 a stable region; if a region is empty there is no winner.)
    */
    function calculateRegions()
    {
        var visited = {}
        var regions = []
        for (var id in fields)
        {
            if (fields[id].isOpen() && !visited[id])
            {
                var region = { fields: [], stones: {}, stable: true, winner: -1 }
                var queue = [id]
                visited[id] = true
                for (var pos = 0; pos < queue.length; ++pos)
                {
                    var id = queue[pos]
                    region.fields.push(id)

                    // Count stones on this field:
                    var field  = fields[id]
                    var stones = field.getStones()
                    if (stones > 0)
                    {
                        var player = field.getPlayer()
                        if (!region.stones[player]) region.stones[player] = 0
                        region.stones[player] += stones
                    }

                    // Check adjacent fields:
                    var coords = Coords.parse(id)
                    for (var dir = 0; dir < 6; ++dir)
                    {
                        var next_id = coords.getNeighbour(dir).toString()
                        if (!visited[next_id])
                        {
                            var field = fields[next_id]
                            if (field)
                            {
                                if (field.isOpen())
                                {
                                    visited[next_id] = true
                                    queue.push(next_id)
                                }
                                else
                                if (field.isGrowing())
                                {
                                    region.stable = false
                                }
                            }
                        }
                    }
                }

                var players = Object.keys(region.stones)
                if (players.length == 1) region.winner = parseInt(players[0])
                if (players.length > 1) region.stable = false
                regions.push(region)
            }
        }
        return regions
    }

    /* Returns the total score per player.
       Note that these scores are not final until all regions are stable! */
    function calculateScores(regions)
    {
        var scores = []
        if (typeof regions == 'undefined')
        {
            regions = calculateRegions()
        }
        for (var i in players)
        {
            scores.push(0)
        }
        for (var i in regions)
        {
            if (regions[i].winner >= 0)
            {
                scores[regions[i].winner] += regions[i].fields.length
            }
        }
        return scores
    }

    /* Returns whether the game is over (i.e. all board regions are stable) */
    function isGameOver(regions)
    {
        if (typeof regions == 'undefined')
        {
            regions = calculateRegions()
        }
        for (var i in regions)
        {
            if (!regions[i].stable) return false
        }
        return true
    }

    function hasPlayerMoves(player, regions)
    {
        if (typeof regions == 'undefined')
        {
            regions = calculateRegions()
        }
        for (var i in regions)
        {
            if (!regions[i].stable && regions[i].stones[player] > 0) return true
        }
        return false
    }

    return obj
}

module.exports = GameState
