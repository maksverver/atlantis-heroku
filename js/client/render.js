"use strict"

var Coords = require("../common/Coords.js")

// Returns the bounding box [x1, y1, x2, y2]
function calculateBoundingBox(gamestate) {
    var bbox = [Infinity,Infinity,-Infinity,-Infinity]
    for (var id in gamestate.getFields())
    {
        var coords = Coords.parse(id)
        var cx = coords.getCX(), cy = coords.getCY()
        bbox[0] = Math.min(bbox[0], cx)
        bbox[1] = Math.min(bbox[1], cy)
        bbox[2] = Math.max(bbox[2], cx)
        bbox[3] = Math.max(bbox[3], cy)
    }
    bbox[0] -= 1
    bbox[1] -= 0.5*Math.sqrt(3)
    bbox[2] += 1
    bbox[3] += 0.5*Math.sqrt(3)
    return bbox;
}

function makeFieldPath(canvas_context, cx, cy)
{
    canvas_context.beginPath()
    for (var i = 0; i < 6; ++i)
    {
        var x = cx + Math.cos(i*Math.PI/3)
        var y = cy + Math.sin(i*Math.PI/3)
        if (i == 0) {
            canvas_context.moveTo(x, y)
        } else {
            canvas_context.lineTo(x, y)
        }
    }
    canvas_context.closePath()
}

function drawFieldHighlight(id, fillStyle, context, radius)
{
    if (!radius) radius = -2/3
    context.save()
    context.globalAlpha = 0.5
    context.fillStyle = fillStyle
    var coords = Coords.parse(id)
    var cx = coords.getCX()
    var cy = coords.getCY()
    context.beginPath()
    context.arc(cx, cy, Math.abs(radius), 0, Math.PI*2, true)
    if (radius < 0)
    {
        var x1 = cx + 1, y1 = cy
        context.moveTo(x1, y1)
        for (var dir = 0; dir < 6; ++dir)
        {
            var x2 = cx + Math.cos((dir + 1)*Math.PI/3)
            var y2 = cy + Math.sin((dir + 1)*Math.PI/3)
            context.lineTo(x2, y2)
        }
    }
    context.fill()
    context.restore()
}

function redraw(canvas, context, gamestate, selection, annotations)
{
    // Clear background
    context.save()
    context.setTransform(1,0,0,1,0,0)
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.restore()

    // Render fields
    var fields = gamestate.getFields()
    for (var id in fields)
    {
        var field = fields[id]
        var coords = Coords.parse(id)
        var cx = coords.getCX()
        var cy = coords.getCY()

        makeFieldPath(context, cx, cy)
        var highlight_color = '#ffe040'
        context.fillStyle = (selection && id == selection.getSelectedField())
                                              ? highlight_color
                          : field.isDead()    ? '#6080ff'
                          : field.isGrowing() ? '#80ff80'
                                              : '#ffffa0'

        context.fill()
        context.lineWidth = 0.03
        if (field.isOpen())
        {
            context.strokeStyle = '#c0c080'
            context.stroke()
        }
        if (selection && selection.getPhase() == 1)
        {
            if (!selection.getSelectedField())
            {
                if (selection.isSourceField(id))
                {
                    drawFieldHighlight(id, highlight_color, context)
                }
            }
            else
            {
                if (selection.isDestinationField(id))
                {
                    drawFieldHighlight(id, highlight_color, context, 0.5)
                }
            }
        }
    }

    // Render segment borders
    for (var id in fields)
    {
        var field = fields[id]
        if (field.isClosed()) continue
        var coords = Coords.parse(id)
        var segment = field.getSegment()
        var cx = coords.getCX()
        var cy = coords.getCY()
        context.beginPath()
        for (var dir = 0; dir < 6; ++dir)
        {
            var field2 = gamestate.getField(coords.getNeighbour(dir))
            if (!field2 || segment > field2.getSegment() || field2.isClosed())
            {
                context.moveTo( cx + Math.cos( dir     *Math.PI/3),
                                cy + Math.sin( dir     *Math.PI/3) )
                context.lineTo( cx + Math.cos((dir + 1)*Math.PI/3),
                                cy + Math.sin((dir + 1)*Math.PI/3) )
            }
        }
        context.lineCap     = 'round'
        context.lineWidth   = 0.06
        context.strokeStyle = 'black'
        context.stroke()
    }

    switch (selection ? selection.getPhase() : 0)
    {
    case 1:  // Render moves
        var moves = selection.getMoves()
        context.save()
        context.globalAlpha = 0.5
        context.fillStyle = 'blue'
        for (var i in moves)
        {
            var src = Coords.parse(moves[i][0])
            var dst = Coords.parse(moves[i][1])
            var x1 = src.getCX(), y1 = src.getCY()
            var x2 = dst.getCX(), y2 = dst.getCY()
            var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx*dx + dy*dy)
            dx *= 0.4/len
            dy *= 0.4/len
            x1 += 1.5*dx
            y1 += 1.5*dy
            x2 -= 2*dx
            y2 -= 2*dy
            context.beginPath()
            context.moveTo(x1 + dx, y1 + dy)
            context.lineTo(x1 + dy, y1 - dx)
            context.lineTo(x2 + dy, y2 - dx)
            context.lineTo(x2 + dx, y2 + dy)
            context.lineTo(x2 - dy, y2 + dx)
            context.lineTo(x1 - dy, y1 + dx)
            context.closePath()
            context.fill()
        }
        context.restore()
        break

    case 2:  // Render explosions
        var explosions = selection.getExplosions()
        context.save()
        context.globalAlpha = 0.5
        context.fillStyle = 'red'
        for (var i in explosions)
        {
            var coords = Coords.parse(explosions[i])
            var cx = coords.getCX()
            var cy = coords.getCY()
            context.beginPath()
            context.arc(cx, cy, 2/3, 0, Math.PI*2, true)
            var x1 = cx + 1, y1 = cy
            context.moveTo(x1, y1)
            for (var dir = 0; dir < 6; ++dir)
            {
                var x2 = cx + Math.cos((dir + 1)*Math.PI/3)
                var y2 = cy + Math.sin((dir + 1)*Math.PI/3)
                var neighbour = gamestate.getField(coords.getNeighbour(dir))
                if (neighbour && neighbour.isOpen())
                {
                    context.lineTo( 0.75*x1 + 0.25*x2,
                                    0.75*y1 + 0.25*y2 )
                    context.lineTo( cx + 1.2*Math.cos((dir + 0.5)*Math.PI/3),
                                    cy + 1.2*Math.sin((dir + 0.5)*Math.PI/3) )
                    context.lineTo( 0.25*x1 + 0.75*x2,
                                    0.25*y1 + 0.75*y2 )
                }
                context.lineTo(x2, y2)
                x1 = x2
                y1 = y2
            }
            context.fill()
        }
        context.restore()
        break

    case 3:  // Render growing fields
        var growing = selection.getGrowing()
        for (var i in growing)
        {
            drawFieldHighlight(growing[i], 'green', context)
        }
        break
    }

    // Render stones
    for (var id in fields)
    {
        var field = fields[id]
        var coords = Coords.parse(id)
        var n = field.getStones()
        for (var i = 0; i < n; ++i)
        {
            var x = coords.getCX(), y = coords.getCY()
            if (n > 1)
            {
                x += (0.4 + 0.01*n)*Math.cos(Math.PI*2*i/n)
                y += (0.4 + 0.01*n)*Math.sin(Math.PI*2*i/n)
            }
            context.beginPath()
            context.arc(x, y, 0.22 + (6 - n)*0.02, 0, Math.PI*2)
            context.fillStyle = gamestate.getPlayer(field.getPlayer()).color
            context.fill()
        }
    }

    // Render annotations (used in rules.html)
    if (annotations) {
        context.save();
        context.scale(1, -1);
        context.font = '0.75px Arial';
        context.strokeStyle = '#ffffff';
        context.fillStyle = '#4080ff';
        function drawLabel(id, text) {
            var coords = Coords.parse(id)
            var x = coords.getCX() - context.measureText(text).width * 0.5, y = coords.getCY() - 0.77;
            context.strokeText(text, x, -y);
            context.fillText(text, x, -y);
        }
        var count = 0;
        for (var id in annotations) {
            var ann = annotations[id];
            if (typeof(ann) === 'string') {
                drawLabel(id, ann)
            }
            count++;
        }
        if (count === 0) {
            // For debugging: draw grid coordinates.
            for (var id in fields) drawLabel(id, id);
        }
        context.restore();
    }
}

exports.calculateBoundingBox = calculateBoundingBox
exports.makeFieldPath = makeFieldPath
exports.redraw = redraw
