"use strict"

//
// The MoveSelection class represents a (partial) set of moves to be executed
// by the next player.
//

function MoveSelection(gamestate, initial)
{
    var phase      = 1
    var subphase   = 0
    var selected   = null
    var moves      = []
    var explosions = null
    var growing    = null

    var possibleMoves = {}
    var segmentsUsed  = {}

    // Initialize list of possible moves:
    var player = gamestate.getNextPlayer()
    for (var src in gamestate.getFields())
    {
        var field = gamestate.getField(src)
        if (field.isOpen() && field.getPlayer() == player)
        {
            possibleMoves[src] = {}
            for (var dir = 0; dir < 6; ++dir)
            {
                for ( var dst = field.getCoords().getNeighbour(dir);
                      gamestate.isValidMove(src, dst);
                      dst = dst.getNeighbour(dir) )
                {
                    possibleMoves[src][dst] = true
                }
            }
        }
    }

    // Parse the state object as returned by objectify(), if possible:
    if (initial instanceof Object)
    {
        /* Note that this parsing code is intended to be robust: it will not
           crash if an invalid state object is passed in, and it will not accept
           invalid moves. */

        moves = gamestate.filterValidMoves(initial.moves, segmentsUsed)

        if (typeof initial.selected == "string" && possibleMoves[initial.selected])
        {
            selected = initial.selected
        }

        if (typeof initial.phase == "number")
        {
            while (phase < initial.phase && nextPhase()) { }
            if (typeof initial.subphase == "number")
            {
                while (phase == initial.phase && subphase < initial.subphase && nextPhase()) { }
            }
        }
    }

    function getMoves()         { return moves }
    function getExplosions()    { return explosions }
    function getGrowing()       { return growing }
    function getSelectedField() { return selected }
    function getPhase()         { return phase }

    function isSourceField(src)
    {
        return possibleMoves[src] && !segmentsUsed[gamestate.getField(src).getSegment()]
    }

    function isDestinationField(dst)
    {
        return selected && possibleMoves[selected][dst]
    }

    // Returns 0 for no change, 1 if `selection` changed only, or 2 otherwise
    function onMouseDown(id)
    {
        if (phase != 1) return 0

        if (id == null)
        {
            if (selected != null)
            {
                selected = null
                return 1
            }
            return 0
        }
        if (selected == null)
        {
            if (possibleMoves[id])
            {
                var res = 1, segment = gamestate.getField(id).getSegment()
                if (segmentsUsed[segment])
                {
                    for (var i in moves)
                    {
                        if (gamestate.getField(moves[i][0]).getSegment() == segment)
                        {
                            moves.splice(i, 1)
                            res = 2
                        }
                    }
                    delete segmentsUsed[segment]
                }
                selected = id
                return res
            }
        }
        else
        if (selected == id)
        {
            selected = null
            return 1
        }
        else
        {
            if (this.isDestinationField(id))
            {
                segmentsUsed[gamestate.getField(selected).getSegment()] = true
                moves.push([selected,id])
                selected = null
                return 2
            }
            else
            {
                selected = this.isSourceField(id) ? id : null
                return 1
            }
        }
        return 0
    }

    function onMouseUp(id)
    {
        return selected && id != selected && this.onMouseDown(id)
    }

    function nextPhase()
    {
        switch (phase)
        {
        case 1:  // end movement phase
            for (var move in moves)
            {
                move = moves[move]
                gamestate.doMove(move[0], move[1])
            }
            selected = null
            phase    = 2
            subphase = 0
            // NOTE: falls through!

        case 2:  // explosions
            for (var i in explosions)
            {
                gamestate.doExplosion(player, explosions[i])
                subphase++
            }
            explosions = gamestate.findExplosions(player)
            if (explosions.length == 0)
            {
                growing  = gamestate.findGrowing(player)
                phase    = 3
                subphase = 0
            }
            return true

        case 3:  // growth
            for (var i in growing)
            {
                gamestate.getField(growing[i]).addPlayerStones(player, 1)
            }
            phase = 4
            subphase = 0
            return true
        }
        return false
    }

    function objectify()
    {
        return { "phase":      phase,
                 "subphase":   subphase,
                 "moves":      moves }
    }

    return { getMoves:           getMoves,
             getExplosions:      getExplosions,
             getGrowing:         getGrowing,
             getSelectedField:   getSelectedField,
             getPhase:           getPhase,
             isSourceField:      isSourceField,
             isDestinationField: isDestinationField,
             onMouseDown:        onMouseDown,
             onMouseUp:          onMouseUp,
             nextPhase:          nextPhase,
             objectify:          objectify }
}

module.exports = MoveSelection
