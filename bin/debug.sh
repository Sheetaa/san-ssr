#!/usr/bin/env bash
set -e

if [ "$1" == "" ]; then
    echo specify a test case name
    exit 1
fi

node ./dist/bin/debug.js $1