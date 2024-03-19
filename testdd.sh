#!/bin/bash
clear
rm -rf deno-kv
mkdir deno-kv
deno run -A --unstable-kv --unstable-broadcast-channel ./dd-schema/index.js