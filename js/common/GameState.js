
//
// The GameState class represents the state of the game between turns.
//

function GameState(descr)
{
    var segments = null
    var players  = null
    var events   = null
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

if (typeof exports === 'object') exports.GameState = GameState
