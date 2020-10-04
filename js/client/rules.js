"use strict";

var Coords = require('../common/Coords.js');
var render = require('./render.js');

function drawBoardFigure(canvas, gamestate, selection, annotations) {
    var context = canvas.getContext("2d")

    var bbox = render.calculateBoundingBox(gamestate)

    // Margin is fixed at 10 pixels (max). Would percentage of width/height make more sense?
    var margin = Math.min(10, canvas.width/2, canvas.height/2)

    var drawWidth = canvas.width - 2*margin
    var drawHeight = canvas.height - 2*margin

    var bbWidth = bbox[2] - bbox[0]
    var bbHeight = bbox[3] - bbox[1]

    var scale = Math.min(drawWidth / bbWidth, drawHeight / bbHeight);

    context.resetTransform();
    context.translate(margin + Math.floor(drawWidth - bbWidth*scale)/2,
        canvas.height - margin - Math.floor(drawHeight - bbHeight*scale)/2)
    context.scale(scale, -scale)
    context.translate(-bbox[0], -bbox[1])

    render.redraw(canvas, context, gamestate, selection, annotations);
}

exports.drawBoardFigure = drawBoardFigure
