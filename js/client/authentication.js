"use strict"

var rmd = require("../common/RIPEMD-160.js")
var rpc = require("./rpc.js").rpc

function setAuthenticated(username)
{
    document.getElementById("Authentication").style.display  = "none"
    document.getElementById("Authenticated").style.display = "block"
    var elem = document.getElementById("Username")
    while (elem.firstChild) elem.removeChild(elem.firstChild)
    elem.appendChild(document.createTextNode(username))
}

function setUnauthenticated()
{
    document.getElementById("Authentication").style.display  = "block"
    document.getElementById("Authenticated").style.display = "none"
}

function initialize()
{
    rpc({"method": "getUsername"}, function(response) {
        if (response.username)
        {
            setAuthenticated(response.username)
        }
        else
        {
            setUnauthenticated()
        }
    })
}

function clearPasswordFields()
{
    document.getElementById("CreatePassword").value = ""
    document.getElementById("CreatePassword2").value = ""
    document.getElementById("AuthPassword").value = ""
}

function createAccount()
{
    var username  = document.getElementById("CreateUsername")
    var password  = document.getElementById("CreatePassword")
    var password2 = document.getElementById("CreatePassword2")
    if (!username.value)
    {
        alert("Please choose a username.")
        username.focus()
    }
    else
    if (!password.value)
    {
        alert("Please choose a password.")
        password.focus()
    }
    else
    if (password2.value != password.value)
    {
        alert("Password does not match confirmation!")
        password2.focus()
    }
    else
    {
        // Generate client key from random salt + user's password.
        var salt = []
        for (var i = 0; i < 5; ++i) salt.push(parseInt(Math.random()*0x100000000))
        var passkey = rmd.digest(encodeURI(password.value), salt)

        // Request user account creation.
        rpc( { method: "createAccount",
               username: username.value,
               salt: rmd.str(salt),
               passkey: rmd.str(passkey) }, function(response) {
            if (response.error)
            {
                alert("Account creation failed: " + response.error + "!")
            }
            else
            if (response.username)
            {
                setAuthenticated(response.username)
                clearPasswordFields()
            }
        })
    }
}

function logIn(username, password)
{
    var username = document.getElementById("AuthUsername")
    var password = document.getElementById("AuthPassword")
    if (!username.value)
    {
        alert("Please enter your username.")
        username.focus()
    }
    else
    if (!password.value)
    {
        alert("Please enter your password.")
        password.focus()
    }
    else
    {
        rpc( { method: "getAuthChallenge",
               username: username.value }, function(response) {
            if (response.error)
            {
                alert("Authentication failed: " + response.error + "!")
            }
            else
            if (response.salt && response.nonce)
            {
                var passkey = rmd.digest(encodeURI(password.value), rmd.vec(response.salt))
                var proof = rmd.digest(response.nonce, passkey)
                rpc( { method: "authenticate",
                       username: response.username,
                       nonce: response.nonce,
                       proof: rmd.str(proof) }, function(response) {
                    if (response.error)
                    {
                        alert("Authentication failed: " + response.error + "!")
                    }
                    else
                    if (response.username)
                    {
                        setAuthenticated(response.username)
                        clearPasswordFields()
                    }
                })
            }
        })
    }
}

function logOut()
{
    rpc({"method": "logOut"}, setUnauthenticated)
}

exports.initialize    = initialize
exports.createAccount = createAccount
exports.logIn         = logIn
exports.logOut        = logOut
