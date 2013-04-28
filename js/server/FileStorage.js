"use strict"

// Implements a key/object data store backed by a filesystem.

var fs        = require("fs")
var crypto    = require("crypto")

var directory = "./"
var suffix    = ".json"

var filename = function(id)
{
    return directory + '/' + encodeURIComponent(id) + suffix
}

var retrieve = function(id, callback)  /* callback(err, obj) */
{
    fs.readFile(filename(id), function(err, data) {
        if (err)
        {
            callback(err, null)
        }
        else
        {
            var err = null, res = null
            try
            {
                res = JSON.parse(data)
            }
            catch (e)
            {
                err = e
            }
            callback(err, res)
        }
    })
}

var store = function(id, obj, callback)  /* callback(err) */
{
    var name = filename(id) 
    var temp = name + '.new'
    fs.writeFile(temp, JSON.stringify(obj), function(err) {
        if (err)
        {
            callback(err)
        }
        else
        {
            fs.rename(temp, name, function(err) {
                if (err)
                {
                    fs.unlink(temp, function(err_ignored) {
                        callback(err)
                    })
                }
                else
                {
                    callback(null)
                }
            })
        }
    })
}

var create = function(obj, callback)  /* callback(err, id) */
{
    crypto.randomBytes(8, function(err, buf) {
        if (err)
        {
            callback(err, null)
        }
        else
        {
            var id = buf.toString("hex")
            fs.exists(filename(id), function(exists) {
                if (exists)
                {
                    // We randomly-generated a game id that is already in use!
                    // This should be rare, so let's just try again:
                    create(obj, callback)
                }
                else
                {
                    store(id, obj, function(err) {
                        callback(err, err ? null : id)
                    })
                }
            })
        }
    })
}

exports.setDirectory = function(dir) { directory = dir }
exports.setSuffix    = function(suf) { suffix = suf}
exports.create       = create
exports.store        = store
exports.retrieve     = retrieve
