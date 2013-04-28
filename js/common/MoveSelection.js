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
        if (initial.moves instanceof Array)
        {
            for (var i = 0; i < initial.moves.length; ++i)
            {
                if (initial.moves[i].length == 2)
                {
                    var src = initial.moves[i][0]
                    var dst = initial.moves[i][1]
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

        if (typeof initial.selected == "string" && possibleMoves[initial.selected])
        {
            selected = initial.selected
        }

        if (typeof initial.phase == "number" && typeof initial.subphase == "number")
        {
            while ( (phase < initial.phase || (phase == initial.phase && subphase < initial.subphase) ) &&
                    nextPhase() ) { }
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

    function onMouseDown(id)
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
                 "selected":   selected,
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
