#!/bin/bash
clear
export NOSTR_ROOT_PUBLIC_KEY="npub15kpvwpk66wns84kqyywuyhntkt9ujzqua47z4katjy2shyzkgknsejdaas"
rm -rf deno-kv
mkdir deno-kv
deno run -A --allow-env --unstable-kv --unstable-broadcast-channel ./index.js