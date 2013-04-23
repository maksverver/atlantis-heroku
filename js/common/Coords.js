DX = [ +1, +1,  0, -1, -1,  0 ]
DY = [  0, +1, +1,  0, -1, -1 ]

function deepCopy(obj)
{
    return JSON.parse(JSON.stringify(obj))
}

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

function Coords(x, y) {
    return {

        toString: function()
        {
            return encodeX(x) + (y + 1)
        },

        getNeighbour: function(dir)
        {
            return Coords(x + DX[dir], y + DY[dir])
        },

        getDirectionTo: function(dest)
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
        },

        getDistanceTo: function(dest)
        {
            return Math.max(Math.abs(dest.getX() - x), Math.abs(dest.getY() - y))
        },

        getX: function() { return x },
        getY: function() { return y },

        // Conversion to Carthesian coordinates:
        getCX: function() { return 1.5*(x - y) },
        getCY: function() { return Math.sqrt(3)/2*(x + y) },
    }
}

function parseCoords(descr)
{
    var m = descr.match(/(-?[a-z]*)(0|-?[1-9][0-9]*)/)
    if (!m) return null
    return Coords( decodeX(m[1]), parseInt(m[2], 10) - 1 )
}
