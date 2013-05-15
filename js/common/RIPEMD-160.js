/* Javascript implementation of the RIPEMD-160 hash function

Copyright (c) 2006 Maks Verver (maksverver@geocities.com)

Modification and redistribution is permitted free of charge provided that
the copyright notice and this condition is retained in the source code.

-----------------------------------------------------------------------------

Based on pseudo-code in "RIPEMD-160: A Strengthened Version of RIPEMD"
by Hans Dobbertin, Antoon Bosselaers & Bart Preneel, available online at:
    http://homes.esat.kuleuven.be/~cosicart/pdf/AB-9601/AB-9601.pdf

-----------------------------------------------------------------------------

Within the context of this algorithm, a word is a 32-bit integer.
A state vector is an array of 5 words. Input data is presented in 16 word
blocks; conversion from byte to word data uses a little-endian encoding
(ie. the first byte in the input goes into the lowest 8 bits of the first
words, the second byte into bits 15-8 of that word, etcetera.)

Generally, the rmd160_digest function can be used to create a message
digest from an (ASCII) string. Convenience functions are provided to convert
a state vector to and from a hexadecimal string (rmd160_str and rmd160_vec,
respectively).

Note that this implementation is VERY SLOW, and should not be used to hash
strings longer than ~1000 characters.
*/

"use strict"

var rmd160_start_vec = rmd160_vec("0123456789abcdeffedcba9876543210f0e1d2c3")

/* Converts a RIPEMD-160 state vector to a hexidecimal string representation.
   Input is an array of 5 integers, output is a string of 40 characters. */
function rmd160_str(h)
{
    var s = "", digits = "0123456789abcdef";
    for(var n = 0; n < 20; ++n)
    {
        s += digits.charAt((h[n >> 2] >>> (4 + ((n&7)<<3)))&15);
        s += digits.charAt((h[n >> 2] >>> ((n&7)<<3))&15);
    }
    return s;
}

/* Converts hexidecimal string representation to a RIPEMD-160 state vector.
   Input a string of 40 characters, all hexadecimal digits, output is an
   array of 5 integers. */
function rmd160_vec(s, h)
{
    if (!h) h = [0,0,0,0,0];
    var digits = "0123456789abcdef0123456789ABCDEF";
    for(var n = 0; n < 20; ++n)
    {
        h[n >> 2] |= ((digits.indexOf(s.charAt(2*n + 0))) << (4 + ((n&7)<<3)));
        h[n >> 2] |= ((digits.indexOf(s.charAt(2*n + 1))) << ((n&7)<<3));
    }
    return h;
}

/* Creates the message digest for a string (of length less than 2^32),
   starting with the optional state vector 'h_in' or the default start state. */
function rmd160_digest(str, h_in)
{
    var h = [0,0,0,0,0];
    if (!h_in) h_in = rmd160_start_vec;
    for(var n = 0; n < 5; ++n)
        h[n] = h_in[n] & 0xffffffff;
    var len = str.length, pos = 0, X = [];
    while(pos + 64 <= len)
    {
        for(var n = 0; n < 64; ++n)
            X[n] = 0;
        for(var n = 0; n < 64; ++n)
            X[n >> 2] |= ((str.charCodeAt(pos + n)&255) << ((n&3)<<3));
        rmd160_compress(h, X);
        pos += 64;
    }
    for(var n = 0; n < 64; ++n)
        X[n] = 0;
    for(var n = 0; n < (len&63); ++n)
        X[n >> 2] |= ((str.charCodeAt(pos + n)&255) << ((n&3)<<3));
    return rmd160_finish(h, X, len, 0);
}

/* Finishes a message digest. X contains the remaining data to be compressed
   (unused bytes must be set to 0), and lswlen and mswlen denote the least- and
   most significant word of the total message length, respectively. */
function rmd160_finish(h, X, lswlen, mswlen)
{
    X[(lswlen>>2)&15] ^= 1 << (((lswlen&3)<<3) + 7);

    if((lswlen&63) > 55)
    {
        rmd160_compress(h, X);
        for(var n = 0; n < 16; ++n)
            X[n] = 0;
    }

    X[14] = lswlen << 3;
    X[15] = (lswlen >> 29) | (mswlen << 3);

    return rmd160_compress(h, X);
}

/* Transforms the given state vector 'h' using the message data of 'X',
   which must be an array containing 16 data words. */
function rmd160_compress(h, X)
{
    function rol(x, n) { return ((x << n) & 0xffffffff) | (x >>> (32 - n)); }

    function add2(a, b)
    {
        return (a + b) & 0xffffffff;
    }

    function add4(a, b, c, d)
    {
        return (a + b + c + d) & 0xffffffff;
    }

    function add3(a, b, c)
    {
        return (a + b + c) & 0xffffffff;
    }

    function f(j, x, y, z)
    {
        switch(j >> 4)
        {
        case 0: return x ^ y ^ z;
        case 1: return (x & y) | (~x & z);
        case 2: return (x | ~y) ^ z;
        case 3: return (x & z) | (y & ~z);
        case 4: return x ^ (y | ~z);
        }
        alert("Invalid arguments: f("+j+","+x+","+y+","+z+")!");
    }

    function K(j)
    {
        switch(j >> 4)
        {
        case 0: return 0x00000000;
        case 1: return 0x5A827999;
        case 2: return 0x6ED9EBA1;
        case 3: return 0x8F1BBCDC;
        case 4: return 0xA953FD4E;
        }
        alert("Invalid arguments: K("+j+")!");
    }

    function KK(j)
    {
        switch(j >> 4)
        {
        case 0: return 0x50A28BE6;
        case 1: return 0x5C4DD124;
        case 2: return 0x6D703EF3;
        case 3: return 0x7A6D76E9;
        case 4: return 0x00000000;
        }
        alert("Invalid arguments: KK("+j+")!");
    }

    var r = new Array(
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
        7, 4, 13, 1, 10, 6, 15, 3, 12, 0, 9, 5, 2, 14, 11, 8,
        3, 10, 14, 4, 9, 15, 8, 1, 2, 7, 0, 6, 13, 11, 5, 12,
        1, 9, 11, 10, 0, 8, 12, 4, 13, 3, 7, 15, 14, 5, 6, 2,
        4, 0, 5, 9, 7, 12, 2, 10, 14, 1, 3, 8, 11, 6, 15, 13 );
    var rr = new Array(
        5, 14, 7, 0, 9, 2, 11, 4, 13, 6, 15, 8, 1, 10, 3, 12,
        6, 11, 3, 7, 0, 13, 5, 10, 14, 15, 8, 12, 4, 9, 1, 2,
        15, 5, 1, 3, 7, 14, 6, 9, 11, 8, 12, 2, 10, 0, 4, 13,
        8, 6, 4, 1, 3, 11, 15, 0, 5, 12, 2, 13, 9, 7, 10, 14,
        12, 15, 10, 4, 1, 5, 8, 7, 6, 2, 13, 14, 0, 3, 9, 11 );

    var s = new Array(
        11, 14, 15, 12, 5, 8, 7, 9, 11, 13, 14, 15, 6, 7, 9, 8,
        7, 6, 8, 13, 11, 9, 7, 15, 7, 12, 15, 9, 11, 7, 13, 12,
        11, 13, 6, 7, 14, 9, 13, 15, 14, 8, 13, 6, 5, 12, 7, 5,
        11, 12, 14, 15, 14, 15, 9, 8, 9, 14, 5, 6, 8, 6, 5, 12,
        9, 15, 5, 11, 6, 8, 13, 12, 5, 12, 13, 14, 11, 8, 5, 6 );
    var ss = new Array(
        8, 9, 9, 11, 13, 15, 15, 5, 7, 7, 8, 11, 14, 14, 12, 6,
        9, 13, 15, 7, 12, 8, 9, 11, 7, 7, 12, 7, 6, 15, 13, 11,
        9, 7, 15, 11, 8, 6, 6, 14, 12, 13, 5, 14, 13, 13, 7, 5,
        15, 5, 8, 11, 14, 14, 6, 14, 6, 9, 12, 9, 12, 5, 15, 8,
        8, 5, 12, 9, 12, 5, 14, 6, 8, 13, 6, 5, 15, 13, 11, 11 );

    var A  = h[0], B  = h[1], C  = h[2], D  = h[3], E  = h[4],
        AA = h[0], BB = h[1], CC = h[2], DD = h[3], EE = h[4],
        T;

    for(var j = 0; j < 80; ++j)
    {
        T = add2(rol(add4(A, f(j, B, C, D), X[r[j]], K(j)), s[j]), E);
        A = E; E = D; D = rol(C, 10); C = B; B = T;
        T = add2(rol(add4(AA, f(79 - j, BB, CC, DD), X[rr[j]], KK(j)), ss[j]), EE);
        AA = EE; EE = DD; DD = rol(CC, 10); CC = BB; BB = T;
    }

    T    = add3(h[1], C, DD);
    h[1] = add3(h[2], D, EE);
    h[2] = add3(h[3], E, AA);
    h[3] = add3(h[4], A, BB);
    h[4] = add3(h[0], B, CC);
    h[0] = T;

    return h;
}

module.exports = {  str:        rmd160_str,
                    vec:        rmd160_vec,
                    digest:     rmd160_digest,
                    start_vec:  rmd160_start_vec,
                    finish:     rmd160_finish,
                    compress:   rmd160_compress }
