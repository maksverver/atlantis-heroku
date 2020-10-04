"use strict"

var Coords            = require("../common/Coords.js")
var CustomEventSource = require("./CustomEventSource.js")
var render            = require("./render.js")

var fields               = null
var board_canvas         = null
var board_canvas_context = null
var board_events         = CustomEventSource()

// (Re)creates the board canvas for the given gamestate
function recreate(gamestate)
{
    fields = gamestate.getFields()

    var board_container = document.getElementById("BoardContainer")
    if (board_canvas)
    {
        // Get rid of old canvas
        board_container.removeChild(board_canvas)
        board_canvas = board_canvas_context = null
    }

    // Calculate bounding box:
    var bbox = render.calculateBoundingBox(gamestate)

    var scale  = 30
    var margin = 10

    board_canvas = document.createElement('canvas')
    board_canvas.id = "Board"
    board_canvas.width  = Math.ceil((bbox[2] - bbox[0])*scale + 2*margin)
    board_canvas.height = Math.ceil((bbox[3] - bbox[1])*scale + 2*margin)
    board_container.appendChild(board_canvas)

    board_canvas.addEventListener("mousedown", function(event) {
        fixEventOffset(event, board_canvas)
        board_events.emit('mousedown', getMouseOverField(event))
        event.preventDefault()  // prevent text-selection while dragging
    }, false)
    board_canvas.addEventListener("mouseup", function(event) {
        fixEventOffset(event, board_canvas)
        board_events.emit('mouseup', getMouseOverField(event))
    }, false)

    board_canvas_context = board_canvas.getContext('2d')
    board_canvas_context.translate(margin, board_canvas.height - margin)
    board_canvas_context.scale(scale, -scale)
    board_canvas_context.translate(-bbox[0], -bbox[1])
}

function fixEventOffset(event, element)
{
    // This is retarded. JavaScript in the browser fucking sucks.
    if (event.hasOwnProperty('offsetX')) {
	return {
            offsetX: event.offsetX,
            offsetY: event.offsetY,
        }
    } else {
	return {
            offsetX: event.layerX - element.offsetLeft,
            offsetY: event.layerY - element.offsetTop,
        }
        /* `element` has an attribute `offsetParent` too,
           but apparently adding offsets recusively doesn't work! */
    }
}

function getMouseOverField(event)
{
    // Search for clicked field:
    for (var id in fields)
    {
        var coords = Coords.parse(id)
        render.makeFieldPath(board_canvas_context, coords.getCX(), coords.getCY())
        if (board_canvas_context.isPointInPath(event.offsetX, event.offsetY)) return id
    }
    return null
}

function redraw(gamestate, selection)
{
    render.redraw(board_canvas, board_canvas_context, gamestate, selection)
}

exports.recreate          = recreate
exports.redraw            = redraw
exports.getEventSource    = function() { return board_events }
