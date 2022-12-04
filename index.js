const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const fs = require('fs');


function LoadThreadsFromJSON() {
    return JSON.parse(fs.readFileSync("./DiscussionBoard.json", 'utf8'));
}

class DiscussionBoard {
    constructor() {
        this.PostList = LoadThreadsFromJSON();
    }
    refresh() {
        this.PostList = LoadThreadsFromJSON();
    }
    print() {
        console.log(this.PostList);
    }
    PushToJSON() {
        fs.writeFileSync("./DiscussionBoard.json", JSON.stringify(this.PostList));
    }
}

class Thread {
    constructor(Author, Title, Body, Tag) {
        this.Author = Author;
        this.Title = Title;
        this.Body = Body;
        this.Tag = Tag;
        this.TimeStamp = Date.now();
        this.Id = "" + this.Author + "_" + this.TimeStamp;
        this.Upvoters = [];
        this.Downvoters = [];
        this.Edited = false;
        this.Endorsed = false;
        this.Replies = [];
    }
}

class Comment {
    constructor(Author, Body, ParentId) {
        this.Author = Author;
        this.Body = Body;
        this.ParentId = ParentId;
        this.TimeStamp = Date.now();
        this.Id = "" + this.Author + "_" + this.TimeStamp;
        this.Upvoters = [];
        this.Downvoters = [];
        this.Edited = false;
        this.Endorsed = false;
    }
}

// Create a new thread and add it to the json database.
function CreateThread(DiscussionBoard, Author, Title, Body, Tag) {
    DiscussionBoard.refresh();
    let newThread = new Thread(Author, Title, Body, Tag);
    // add new thread to post list
    DiscussionBoard.PostList[newThread.Id] = newThread;
    // push to json database
    DiscussionBoard.PushToJSON();
    // return the id of the new thread
    return newThread.Id;
}

// Create a new reply to a comment or thread
// and add it to the json database.
function CreateReply(DiscussionBoard, ParentId, Author, Body, ParentAuthor) {
    DiscussionBoard.refresh();
    let newReply = new Comment(Author, "@" + ParentAuthor + " " + Body, ParentId);
    // add new comment to discussion board
    DiscussionBoard.PostList[newReply.Id] = newReply;
    // add id to replies list of parent
    DiscussionBoard.PostList[ParentId].Replies.push(newReply.Id);
    // push to json
    DiscussionBoard.PushToJSON();

    return newReply;
}

// Toggle the endorsement status of a post
// and update the json database.
function ToggleEndorseStatus(DiscussionBoard, PostId) {
    DiscussionBoard.refresh()
    DiscussionBoard.PostList[PostId].Endorsed = !DiscussionBoard.PostList[PostId].Endorsed;
    DiscussionBoard.PushToJSON();
    return DiscussionBoard.PostList[PostId].Endorsed;
}

// Upvote or Downvote a Post
// User is the displayname of the upvoter.
// IsUpvote = true if upvoting, false if downvoting.
function Vote(DiscussionBoard, User, IsUpvote, PostId) {
    DiscussionBoard.refresh();
    if(IsUpvote == true)
    {
        if(DiscussionBoard.PostList[PostId].Upvoters.includes(User))
        {
            return;
        }
        // Add user to upvoter list.
        DiscussionBoard.PostList[PostId].Upvoters.push(User);
        // If they were on the downvoter list, remove them from it.
        if(DiscussionBoard.PostList[PostId].Downvoters.includes(User))
        {
            let index = DiscussionBoard.PostList[PostId].Downvoters.indexOf(User);
            DiscussionBoard.PostList[PostId].Downvoters.splice(index, 1);
        }
    }
    else if(IsUpvote == false)
    {
        if(DiscussionBoard.PostList[PostId].Downvoters.includes(User))
        {
            return;
        }
        // Add the user to the downvoter list.
        DiscussionBoard.PostList[PostId].Downvoters.push(User);
        // If they were on the upvoter list, remove them from it.
        if(DiscussionBoard.PostList[PostId].Upvoters.includes(User))
        {
            let index = DiscussionBoard.PostList[PostId].Upvoters.indexOf(User);
            DiscussionBoard.PostList[PostId].Upvoters.splice(index, 1);
        }
    }
    DiscussionBoard.PushToJSON();
}

// Edits a post if the user is the owner, or an instructor.
// if editing a comment, newTitle should be null
// if newTitle is non-null it is assumed a thread is being edited and
//      EditPost will attempt to change the title attribute of the post.
function EditPost(DiscussionBoard, PostId, newBody, newTitle = null) {
    // todo: add user privilege verification
    DiscussionBoard.refresh();
    let post = DiscussionBoard.PostList[PostId];
    post.Body = newBody;
    if(newTitle != null)
    {
        post.Title = newTitle;
    }
    post.Edited = true;
    DiscussionBoard.PushToJSON();
}

function DeletePost(DiscussionBoard, User, PostId) {
    // user privilege verification
    privileged = false;
    if(User === "admin" || User === DiscussionBoard.PostList[PostId].Author)
    {
        privileged = true;
    }
    else
    {
        return "Invalid Privileges";
    }

    DiscussionBoard.refresh();

    // if its a thread
    if('Title' in DiscussionBoard.PostList[PostId]) {
        for(let j = 0; j < DiscussionBoard.PostList[PostId].Replies.length; j++) {
            delete DiscussionBoard.PostList[DiscussionBoard.PostList[PostId].Replies[j]];
        }
        delete DiscussionBoard.PostList[PostId];
    }
    else {
        // if its a comment
        let arr = DiscussionBoard.PostList[DiscussionBoard.PostList[PostId].ParentId].Replies;
        arr = arr.filter(e => e !== PostId);
        DiscussionBoard.PostList[DiscussionBoard.PostList[PostId].ParentId].Replies = arr;
        delete DiscussionBoard.PostList[PostId];
    }
    
    DiscussionBoard.PushToJSON();
}

function GetNestedThread(DiscussionBoard, PostId) {
    DiscussionBoard.refresh();
    let parent = DiscussionBoard.PostList[PostId];
    for(let i = 0; i < parent.Replies.length; ++i)
    {
        parent.Replies[i] = DiscussionBoard.PostList[parent.Replies[i]];
    }
    return parent;
}

function GetSortedDiscussionBoard(DiscussionBoard, type) {
    DiscussionBoard.refresh();
    let tempArr = [];
    for (var post in DiscussionBoard.PostList) {
        tempArr.push([post, DiscussionBoard.PostList[post]]);
    }

    // Sorts discussion board posts based on type of sort
    tempArr.sort(function (a, b) {
        // Endorsed posts go first
        if (a.Endorsed && !b.Endorsed) return -1;
        else if (b.Endorsed && !a.Endorsed) return 1;

        // If neither or both posts are endorsed, sort based on type
        if (type === 'TimeStamp') {
            return a[1][type] - b[1][type];
        }
        else if (type === 'Rating') {
            return (b[1].Upvoters.length - b[1].Downvoters.length) - (a[1].Upvoters.length - a[1].Downvoters.length);
        }

    });

    let sorted = {}
    tempArr.forEach(function (elem) {
        sorted[elem[0]] = elem[1];
    });

    // Sorts Reply lists of threads based on type of sort
    for (var el in sorted) {
        if ('Title' in sorted[el]) {
            sorted[el].Replies.sort(function (a, b) {
                // Endorsed posts go first
                if (sorted[a].Endorsed && !sorted[b].Endorsed) return -1;
                else if (sorted[b].Endorsed && !sorted[a].Endorsed) return 1;

                // If neither or both posts are endorsed, sort based on type
                if (type === 'TimeStamp') {
                    return sorted[a][type] - sorted[b][type];
                }
                else if (type === 'Rating') {
                    // Rating of a - Rating of b
                    return (sorted[b].Upvoters.length - sorted[b].Downvoters.length) - (sorted[a].Upvoters.length - sorted[a].Downvoters.length);
                }

            });
        }
    };

    return sorted;
}; 


// returns a list of all threads
// If you want a particular thread and it's nested comments,
//      pass the id of that thrad to GetNestedThread
function GetAllThreads(DiscussionBoard) {
    DiscussionBoard.refresh();
    let Threads = [];
    let keys = Object.keys(DiscussionBoard.PostList);
    for(let i = 0; i < keys.length; ++i) {
        if(DiscussionBoard.PostList[keys[i]].Title != undefined) {
            Threads.push(DiscussionBoard.PostList[keys[i]]);
        }
    }
    return Threads;
}

// This function will return the entire discussion board,
// but will first transform it from a list of posts, with references in the reply section
// to a list of all threads with reply objects nested within.
function GetNestedDiscussionBoard(DiscussionBoard) {
    let threads = GetAllThreads(DiscussionBoard);
    for(let i = 0; i < threads.length; ++i) {
        threads[i] = GetNestedThread(DiscussionBoard, threads[i].Id);
    }
    return threads;
}

// This loads the current state of the json file into a discussion board object.
let db = new DiscussionBoard();


// Set up server and web socket
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {

    // expects nothing, returns a list of all threads (not nested)
    socket.on('GetAllThreads', () => {
        io.emit('GetAllThreads', GetAllThreads(db));
    });

    // expects no message, returns all threads WITH replies nested
    socket.on('GetNestedDiscussionBoard', () => {
        io.emit('GetNestedDiscussionBoard', GetNestedDiscussionBoard(db));
    });

    // expects {Id: string}
    socket.on('GetNestedThread', (msg) => {
        io.emit('GetNestedThread', GetNestedThread(db, msg.Id));
    })

    // expects {Type: string}
    socket.on('GetSortedDiscussionBoard', (msg) => {
        io.emit('GetSortedDiscussionBoard', GetSortedDiscussionBoard(db, msg.Type));
    });

    // expects {Author: string, Title: string, Body: string, Tag: string}
    socket.on('CreateThread', (msg) => {
        io.emit('CreateThread', CreateThread(db, msg.Author, msg.Title, msg.Body, msg.Tag));
    })

    // expects {ParentId: string, Author: string, Body: string, ParentAuthor: string}
    socket.on('CreateReply', (msg) => {
        io.emit('CreateReply', CreateReply(db, msg.ParentId, msg.Author, msg.Body, msg.ParentAuthor));
    })

    // expects {Id: string}
    socket.on('ToggleEndorseStatus', (msg) => {
        io.emit('ToggleEndorseStatus', ToggleEndorseStatus(db, msg.Id))
    })

    // expects {User: string, IsUpvote: boolean, PostId: string}
    socket.on('Vote', (msg) => {
        Vote(db, msg.User, msg.IsUpvote, msg.PostId);
        io.emit('Vote', true);
    })

    // expects {PostId: string, newBody: string, newTitle: string}
    //  **if it is a comment and not a thread set newTitle = null**
    socket.on('EditPost', (msg) => {
        EditPost(db, msg.PostId, msg.newBody, msg.NewTitle);
        io.emit('EditPost', true);
    })

    // expects {User: string, PostId: string}
    // sending user as "admin" will allow deletion of anything-
    socket.on('DeletePost', (msg) => {
        DeletePost(db, msg.User, msg.PostId);
        io.emit(('DeletePost'), true);
    })

  });

server.listen(3000, () => {
  console.log('listening on *:3000');
  console.log('http://localhost:3000');
});
