"use strict"

var Coords = require("./Coords.js")

//
//  The Fields class represents a mutable game field.  Each field is part
//  of some board segment, may contain some stones of a single player, and
//  can be "open" or "closed".  If a field is open it may be moved onto or over,
//  and if it is closed the field is either growing or dead.
//
//  A field is expected to have an associated player (represented as an integer)
//  if it contains any stones, or if it is growing.
//

function Field(id, segment)
{
    var state   =  0  // 0: open, 1: growing, 2: dead
    var player  = -1
    var stones  =  0

    function getId()        { return id }
    function getPlayer()    { return player }
    function getStones()    { return stones }
    function getSegment()   { return segment }
    function getCoords()    { return Coords.parse(id) }
    function isOpen()       { return state == 0 }
    function isClosed()     { return state != 0 }
    function isGrowing()    { return state == 1 }
    function isDead()       { return state == 2 }

    function setPlayer(new_player)
    {
        if (stones > 0 || state > 0) player = new_player
    }

    function setPlayerValue(new_player, value)
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
    }

    function removeStones(n)
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
    }

    function addPlayerStones(p, n)
    {
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
    }

    function explode(p)
    {
        stones = 0
        player = p
        if (state < 2) ++state
    }

    function toggleLiving(p) 
    {
        if (stones > 0)
        {
            state = (state == 1) ? 0 : 1
        }
        else
        {
            state = (state == 2) ? 0 : 2
        }
    }

    return { getId:             getId,
             getPlayer:         getPlayer,
             getStones:         getStones,
             getSegment:        getSegment,
             getCoords:         getCoords,
             isOpen:            isOpen,
             isClosed:          isClosed,
             isGrowing:         isGrowing,
             isDead:            isDead,
             setPlayer:         setPlayer,
             setPlayerValue:    setPlayerValue,
             removeStones:      removeStones,
             addPlayerStones:   addPlayerStones,
             explode:           explode,
             toggleLiving:      toggleLiving }
}

module.exports = Field
