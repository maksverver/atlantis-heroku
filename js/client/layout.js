"use strict"

var CustomEventSource = require("./CustomEventSource.js")

var mouse_events = CustomEventSource()

function installDragHandler()
{
    var x, y, t
    var onMouseMoved = function(event) {
        var dx = event.clientX - x
        var dy = event.clientY - y
        x += dx
        y += dy
        mouse_events.emit('drag', t, dx, dy)
    }
    var dragging = true
    document.addEventListener("mousedown", function(event) {
        if (!dragging)
        {
            t = event.target
            if (t && t.className.indexOf("Draggable") >= 0)
            {
                x = event.clientX
                y = event.clientY
                event.preventDefault()
                document.addEventListener("mousemove", onMouseMoved)
                dragging = true
            }
        }
    })
    document.addEventListener("mouseup", function(event) {
        document.removeEventListener("mousemove", onMouseMoved)
        dragging = false
    })
}

function initialize()
{
    installDragHandler()
    mouse_events.addHandler('drag', function(target, dx, dy) {
        if (target == document.getElementById('ColumnSplitter'))
        {
            var l = document.getElementById("LeftColumn")
            var r = document.getElementById("RightColumn")
            var rwidth = parseInt(r.style.width)
            var rleft  = parseInt(r.style.left)
            dx = Math.min(dx, rwidth - Math.max(rwidth - dx, 4))
            dx = Math.max(dx, -rleft)
            l.style.width = parseInt(l.style.width) + dx + 'px'
            r.style.left  = rleft + dx + 'px'
            r.style.width = rwidth - dx + 'px'
        }
    })
    resize(0.7)
}

function resize(ratio)
{
    var h = innerHeight
    var w = innerWidth
    var l = document.getElementById("LeftColumn")
    var r = document.getElementById("RightColumn")
    if (typeof ratio == "undefined")
    {
        var a = parseInt(l.style.width)
        var b = parseInt(r.style.width)
        ratio = a/(a + b)
    }
    l.style.width  = parseInt(ratio*w) + 'px'
    l.style.height = h + 'px'
    r.style.width  = w - parseInt(ratio*w) + 'px'
    r.style.height = h + 'px'
    r.style.left   = l.style.width
}

exports.resize     = resize
exports.initialize = initialize
