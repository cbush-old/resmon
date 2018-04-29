# Resource monitor server

A simple HTTP server that watches a directory for file changes, which you can then use for hot reloading of assets, etc.

## Installation

    cd resmon
    yarn install

## Starting the server

    yarn start -r /path/to/watched/directory -p <PORT>

When the server is running, access the server at `localhost:<PORT>` and use HTTP commands, e.g.

    curl http://localhost:<PORT>/?list
    curl http://localhost:<PORT>/?get=ZXhhbXBsZS5qcGcK # example.jpg

Default port is 10191 if unspecified with -p.

## Credit

node-polling server code, released under MIT license, provided by James Loo http://github.com/xylvxy/node-polling

Modified for my purposes, see node-polling.js

## HTTP command reference

### ?list

List the files available from the watched directory.

#### Arguments

None.

#### Return value

    {
        "responseType": "list",
        "files": [<relative paths to files>]
    }

### ?get

Get a file from the server as base64-encoded data.

#### Arguments

The base64-encoded relative path of the desired file.

#### Return value

HTTP 200:

    {
        "responseType": "file",
        "filename": "<filepath>",
        "base64": "<base64-encoded file data>"
    }

HTTP 404:

    {
        "responseType": "error",
        "message": "<error message>"
    }

### ?watch

Watches the target directory for changes to files. An optional regex filter may be provided.

Used with long-polling strategy. Will delay response until timeout or files changed on the server. As a client, when the request times out, start a new request to keep watching. When a file change is detected, use `?get` to reload the file.

NOTE: Be sure to use `?goodbye` to close the connection when you are done watching.

#### Arguments

(Optional) A regex on which file change notifications will be filtered, e.g. `\.jpg$` to watch for changes to jpgs only.

#### Return value

HTTP 205: Reset content

    {
        "responseType": "change",
        "eventType": "<eventType>",
        "filename": "<filename>"
    }

where `eventType` is the node fs change event type: see https://nodejs.org/docs/latest/api/fs.html#fs_event_change

### ?goodbye

Clears up any long poll connections initiated with `?watch`. Should be used when no longer interested in the response to `?watch`, including client shutdown.

#### Arguments

None.

#### Return value

    {
        "responseType": "goodbye"
    }

