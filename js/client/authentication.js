"use strict"

var rmd = require("../common/RIPEMD-160.js")
var rpc = require("./rpc.js").rpc

var username = null   // authenticated username
var change_callbacks = []

function initialize()
{
    var html = '\
<div id="AuthBar">\
  <div id="Authentication" style="display:none"> \
    <div id="LogInTabHandle" class="tabHandle">Log in</div> \
    <div id="RegisterTabHandle" class="tabHandle">Register</div> \
  </div> \
  <div id="Authenticated" style="display:none"> \
    <div id="AccountTabHandle" class="tabHandle">Account</div> \
  </div> \
  <div id="AuthMessage"></div> \
  <div id="LogInTabBody" class="tabBody" style="display:none"> \
    <form id="LogInForm"> \
    <table> \
    <tr><th><label for="AuthUsername">Username:&nbsp;</label></th><td><input id="AuthUsername" type="text"></td></tr> \
    <tr><th><label for="AuthPassword">Password:&nbsp;</label></th><td><input id="AuthPassword" type="password"></td></tr> \
    <tr><th></th><td><input class="button" type="submit" id="LogInButton" value="Log in"> \
                     <input class="button" type="button" id="LogInCloseButton" value="Close"><td></tr> \
    </table> \
    </form> \
  </div> \
  <div id="RegisterTabBody" class="tabBody" style="display:none"> \
    <form id="RegisterForm"> \
    <table> \
    <tr><th align="right"><label for="CreateUsername">Username:&nbsp;<label></th><td><input id="CreateUsername" type="text"></td></tr> \
    <tr><th align="right"><label for="CreatePassword">Password:&nbsp;</label></th><td><input id="CreatePassword" type="password"></td></tr> \
    <tr><th align="right"><label for="CreatePassword2">Confirmation:&nbsp;</label></th><td><input id="CreatePassword2" type="password"></td></tr> \
    <tr><th></th><td><input class="button" type="submit" id="RegisterButton" value="Create account"> \
                     <input class="button" type="button" id="RegisterCloseButton" value="Close"><td></tr> \
    </table> \
    </form> \
  </div> \
  <div id="AccountTabBody" class="tabBody" style="display:none"> \
    <p>Logged in as <span id="Username">nobody</span>.</p> \
    <table><tr><td><input class="button" type="button" id="LogOutButton" value="Log out"> \
                   <input class="button" type="button" id="AccountCloseButton" value="Close"></td></tr></table> \
  </div> \
</div>'
    document.body.innerHTML = html + document.body.innerHTML

    document.getElementById("LogInTabHandle").onclick = function() {
        setActiveTab("LogIn")
        document.getElementById("AuthUsername").focus()
    }
    document.getElementById("RegisterTabHandle").onclick = function() {
        setActiveTab("Register")
        document.getElementById("CreateUsername").focus()
    }
    document.getElementById("AccountTabHandle").onclick = function() {
        setActiveTab("Account")
    }
    document.getElementById("LogInCloseButton").onclick = 
    document.getElementById("RegisterCloseButton").onclick =
    document.getElementById("AccountCloseButton").onclick = function() {
        setActiveTab()
    }
    document.getElementById("LogInForm").onsubmit = function() {
        logIn()
        return false
    }
    document.getElementById("RegisterForm").onsubmit = function() {
        createAccount()
        return false
    }
    document.getElementById("LogOutButton").onclick= function() {
        logOut()
        return false
    }
    rpc({"method": "getUsername"}, function(response) {
        setActiveTab()
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

function setAuthenticated(new_username)
{
    username = new_username
    document.getElementById("Authentication").style.display = "none"
    document.getElementById("Authenticated").style.display = "inline-block"

    var elem = document.getElementById("Username")
    while (elem.firstChild) elem.removeChild(elem.firstChild)
    elem.appendChild(document.createTextNode(username))

    for (var i in change_callbacks)
    {
        change_callbacks[i](username)
    }
}

function setUnauthenticated()
{
    document.getElementById("Authentication").style.display  = "inline-block"
    document.getElementById("Authenticated").style.display = "none"
    for (var i in change_callbacks)
    {
        change_callbacks[i](null)
    }
}

function setActiveTab(which)
{
    var tabs = [ "LogIn", "Register", "Account" ]
    for (var i = 0; i < tabs.length; ++i)
    {
        var value = tabs[i] == which
        document.getElementById(tabs[i] + "TabHandle").className
            = value ? "tabHandle active" : "tabHandle"
        document.getElementById(tabs[i] + "TabBody").style.display
            = value ? "block" : "none"
    }
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
                setActiveTab()
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
                        setActiveTab()
                    }
                })
            }
        })
    }
}

function logOut()
{
    rpc({"method": "logOut"}, function(response) {
        setUnauthenticated()
    })
    setActiveTab()
}

function setContent(child_elem)
{
    var elem = document.getElementById("AuthMessage")
    while (elem.firstChild) elem.removeChild(elem.firstChild)
    elem.appendChild(child_elem)
}

function onChange(callback)
{
    change_callbacks.push(callback)
}

exports.initialize    = initialize
exports.getUsername   = function() { return username }
exports.setContent    = setContent
exports.onChange      = onChange
