//
// The MoveSelection class represents a partial set of moves to be executed
// by the next player.
//

function MoveSelection(state)
{
    var phase      = 1
    var subphase   = 0
    var selected   = null
    var moves      = [ ]
    var explosions = null
    var growing    = null

    var possibleMoves = {}
    var segmentsUsed  = {}

    var obj = {

        objectify: function() {
            return { "phase":      phase,
                     "selected":   selected,
                     "subphase":   subphase,
                     "moves":      moves }
        },

        getMoves:           function() { return moves },
        getExplosions:      function() { return explosions },
        getGrowing:         function() { return growing },
        getSelectedField:   function() { return selected },
        getPhase:           function() { return phase },

        isSourceField: function(src) {
            return possibleMoves[src] && !segmentsUsed[gamestate.getField(src).getSegment()]
        },

        isDestinationField: function(dst) {
            return selected && possibleMoves[selected][dst]
        },

        onMouseDown: function(id)
        {
            if (phase != 1) return false

            if (id == null)
            {
                if (selected != null)
                {
                    selected = null
                    return true
                }
                return false
            }
            if (selected == null)
            {
                for (var i in moves)
                {
                    if (moves[i][0] == id)
                    {
                        delete segmentsUsed[gamestate.getField(id).getSegment()]
                        moves.splice(i, 1)
                        break
                    }
                }
                if (this.isSourceField(id))
                {
                    selected = id
                    return true
                }
            }
            else
            if (selected == id)
            {
                selected = null
                return true
            }
            else
            {
                if (this.isDestinationField(id))
                {
                    segmentsUsed[gamestate.getField(selected).getSegment()] = true
                    moves.push([selected,id])
                    selected = null
                }
                else
                {
                    selected = this.isSourceField(id) ? id : null
                }
                return true
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
                for (var move in moves)
                {
                    move = moves[move]
                    gamestate.doMove(move[0], move[1])
                }
                selected      = null
                phase         = 2
                subphase      = 0
                // NOTE: falls through!

            case 2:  // execute explosions!
                for (var i in explosions)
                {
                    gamestate.doExplosion(player, explosions[i])
                    subphase++
                }
                explosions = gamestate.findExplosions(player)
                if (explosions.length == 0)
                {
                    growing = gamestate.findGrowing(player)
                    phase = 3
                    subphase = 0
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
        }
    }

    var player = gamestate.getNextPlayer()
    for (var src in gamestate.getFields())
    {
        var field = gamestate.getField(src)
        if (field.isOpen() && field.getPlayer() == player)
        {
            possibleMoves[src] = {}
            for (var dst in gamestate.getFields())  // FIXME? this is slow
            {
                if (gamestate.isValidMove(src, dst)) {
                    possibleMoves[src][dst] = true
                }
            }
        }
    }

    // Parse the state object as returned by objectify(), if possible:
    if (state instanceof Object)
    {
        /* Note that this parsing code is intended to be robust: it will not
           crash if an invalid state object is passed in, and it will not accept
           invalid moves. */
        if (state.moves instanceof Array)
        {
            for (var i = 0; i < state.moves.length; ++i)
            {
                if (state.moves[i].length == 2)
                {
                    var src = state.moves[i][0]
                    var dst = state.moves[i][1]
                    if ( typeof src == "string" && possibleMoves[src] &&
                         !segmentsUsed[gamestate.getField(src).getSegment()] &&
                         typeof dst == "string" && possibleMoves[src][dst] )
                    {
                        segmentsUsed[gamestate.getField(src).getSegment()] = true
                        moves.push([src,dst])
                    }
                }
            }
        }

        if (typeof state.selected == "string" && possibleMoves[state.selected])
        {
            selected = state.selected
        }

        if (typeof state.phase == "number" && typeof state.subphase == "number")
        {
            while (phase < state.phase || (phase == state.phase && subphase < state.subphase))
            {
                var old_phase = phase, old_subphase = subphase
                obj.nextPhase()
                if (old_phase == phase || old_subphase == subphase) break
            }
        }
    }

    return obj
}
