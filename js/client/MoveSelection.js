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
                subphase = 0

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

    if (state) {
        moves = state.moves
        selected = state.selected
        while (phase < state.phase || (phase == state.phase && subphase < state.subphase)) obj.nextPhase()
    }

    return obj
}
