let connection = require('./node-polling').create();
let fs = require('fs');

let commandLineArgs = require('command-line-args')
let commandLineUsage = require('command-line-usage')

const optionDefinitions = [
    {
        name: 'port',
        alias: 'p',
        type: Number,
        typeLabel: '{underline port}',
        description: 'Port number. Default is 10191.'
    },
    {
        name: 'root',
        alias: 'r',
        type: String,
        typeLabel: '{underline path/to/watch/directory}',
        description: '(Required) The directory to monitor.',
    },
]

const args = commandLineArgs(optionDefinitions)

if (!args.root) {
    console.log(commandLineUsage(
        {
            header: 'Options',
            optionList: optionDefinitions
        }
    ))
    process.exit(1)
}

let path = args.root

try {

    fs.watch(path, {recursive: true}, (eventType, filename) => {
        console.log("event: ", eventType, JSON.stringify(filename));
        for (let uid in listenerUids) {
            let match = (listenerUids[uid]);
            if (!filename.match(match)) {
                continue;
            }
            connection.SendByUid(uid, JSON.stringify({
                responseType: "change",
                eventType: eventType,
                filename: filename
            }), {
                statusCode: 205 // reset content
            });
        }
    })
} catch(e) {
    console.log("Failed to monitor directory '" + path + "'")
    process.exit(1)
}

console.log("Monitoring directory '" + path + "'")

let listenerUids = {};
args.port = args.port || 10191

connection.start(args.port, '127.0.0.1');
console.log("Server started on localhost:" + args.port);

let options = "'list', 'get(=filename)', 'watch(=glob)', 'goodbye'";

connection.on('conn', function(uid, query, data) {
    console.log("Connection established by uid ", uid, " with query ", JSON.stringify(query));
    if (query['list'] !== undefined) {
        sendList(uid);
    } else if (query['get']) {
        sendFile(uid, query['get']);
    } else if (query['watch'] !== undefined) {
        watch(uid, query['watch']);
    } else if (query['goodbye'] !== undefined) {
        goodbye(uid);
    } else {
        let errorMessage = "Error: expected query parameter " + options;
        console.log(errorMessage);
        connection.SendByUid(uid, JSON.stringify({
            eventType: "error",
            message: errorMessage
        }));
    }
});

connection.on('close', function(uid) {
    console.log("Connection closed by uid ", uid);
    delete listenerUids[uid];
});

function watch(uid, match) {
    console.log("Adding uid ", uid, " to watchers for match ", match);
    listenerUids[uid] = match ? match : '';
}

function is_directory(path) {
    return fs.lstatSync(path).isDirectory();
}

function ls(path, friendlyPath) {
    let files = [];
    let items = fs.readdirSync(path)
    for (let i in items) {
        let item = items[i];
        let itemPath = path + "/" + item;
        let friendlyItemPath = friendlyPath + item;
        if (is_directory(itemPath)) {
            files = [...files, ls(itemPath, friendlyItemPath + "/")];
        } else {
            files.push(friendlyItemPath);
        }
    }
    return files;
}

function sendList(uid) {
    console.log("Send list to uid ", uid);
    let files = ls(path, "");
    connection.SendByUid(uid, JSON.stringify({
        responseType: "list",
        files: files
    }));
}

function base64_decode(string) {
    return Buffer.from(string, 'base64').toString('utf8');
}

function base64_encode(filepath) {
    var file = fs.readFileSync(filepath);
    return new Buffer(file).toString('base64');
}

function sendFile(uid, filepath_base64) {
    let filepath = base64_decode(filepath_base64);
    console.log("Send file ", filepath, " to uid ", uid);
    let target_path = path + "/" + filepath;
    if (fs.existsSync(target_path) && !is_directory(target_path))
    {
        console.log("File found: sending as base64_encoded string");
        connection.SendByUid(uid, JSON.stringify({
            responseType: "file",
            filename: filepath,
            base64: base64_encode(target_path)
        }));
    } else {
        console.log("File not found or is a directory");
        connection.SendByUid(uid, JSON.stringify({
            responseType: "error",
            message: "File not found: '%s'" + target_path
        }), {
            statusCode: 404
        });
    }
}

function goodbye(uid) {
    console.log("Goodbye: disconnecting all active connections");
    for (let conn in listenerUids) {
        connection.SendByUid(conn, JSON.stringify({
            responseType: "goodbye"
        }));
    }
    listenerUids = {};
    connection.SendByUid(uid, JSON.stringify({
        responseType: "goodbye"
    }));
}
