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
