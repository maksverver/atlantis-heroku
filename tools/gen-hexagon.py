#!/usr/bin/env python2

import sys

size = int(sys.argv[1])

def encX(x):
    return chr(ord('a') + x) if x < 26 else encX(x//26 - 1) + encX(x%26)

def enc(x,y):
    return encX(x) + str(y + 1)

data = []
for i in range(2*size - 1):
    for j in range(max(i + 1 - size, 0), min(2*size - 1, i + size)):
        x,y = 1 + i + 2*j, 3*i - j + size
        data.append([ enc(x - 1, y - 1), enc(x - 1, y    ),
                      enc(x    , y - 1), enc(x    , y    ), enc(x    , y + 1),
                                         enc(x + 1, y    ), enc(x + 1, y + 1) ])
print(repr(data))
