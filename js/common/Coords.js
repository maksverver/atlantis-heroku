var DX = [ +1, +1,  0, -1, -1,  0 ]
var DY = [  0, +1, +1,  0, -1, -1 ]

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

function Coords(x, y)
{
    function toString()
    {
        return encodeX(x) + (y + 1)
    }

    function toCoords()
    {
        return this
    }

    function getNeighbour(dir)
    {
        return Coords(x + DX[dir], y + DY[dir])
    }

    function getDirectionTo(dest)
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
    }

    function getDistanceTo(dest)
    {
        return Math.max(Math.abs(dest.getX() - x), Math.abs(dest.getY() - y))
    }

    function getX() { return x }
    function getY() { return y }

    // Conversion to Carthesian coordinates:
    function getCX() { return 1.5*(x - y) }
    function getCY() { return Math.sqrt(3)/2*(x + y) }

    return {
        toString:       toString,
        toCoords:       toCoords,
        getNeighbour:   getNeighbour,
        getDirectionTo: getDirectionTo,
        getDistanceTo:  getDistanceTo,
        getX:           getX,
        getY:           getY,
        getCX:          getCX,
        getCY:          getCY }
}

function parseCoords(descr)
{
    switch (typeof descr)
    {
    case "object":
        if (descr.toCoords) return descr.toCoords()
        // NOTE: falls through, since element may have a toString() method
    case "string":
        var m = descr.match(/^(-?[a-z]*)(0|-?[1-9][0-9]*)$/)
        if (m) return Coords(decodeX(m[1]), parseInt(m[2], 10) - 1)
        // NOTE: falls through
    default:
        return NULL
    }
}

if (typeof exports == 'object')
{
    exports.parseCoords = parseCoords
    exports.Coords      = Coords
}
