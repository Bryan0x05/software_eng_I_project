const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);
const fs = require('fs');
const { threadId } = require('worker_threads');


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
    if('Title' in DiscussionBoard.PostList[PostId]) {
        return PostId;
    }
    return DiscussionBoard.PostList[PostId].ParentId;
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
            if('Title' in DiscussionBoard.PostList[PostId]) {
                return PostId;
            }
            return DiscussionBoard.PostList[PostId].ParentId;
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
            if('Title' in DiscussionBoard.PostList[PostId]) {
                return PostId;
            }
            return DiscussionBoard.PostList[PostId].ParentId;
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
    if('Title' in DiscussionBoard.PostList[PostId]) {
        return PostId;
    }
    return DiscussionBoard.PostList[PostId].ParentId;
}

// Edits a post if the user is the owner, or an instructor.
// if editing a comment, newTitle should be null
// if newTitle is non-null it is assumed a thread is being edited and
//      EditPost will attempt to change the title attribute of the post.
function EditPost(DiscussionBoard, PostId, newBody, newTitle = null) {
    DiscussionBoard.refresh();
    let post = DiscussionBoard.PostList[PostId];
    post.Body = newBody;
    if('Title' in DiscussionBoard.PostList[PostId] && newTitle!=null)
    {
        post.Title = newTitle;
    }
    post.Edited = true;
    DiscussionBoard.PushToJSON();
    if('Title' in DiscussionBoard.PostList[PostId]) {
        return PostId;
    }
    return DiscussionBoard.PostList[PostId].ParentId;
}

function DeletePost(DiscussionBoard, User, PostId) {
    // user privilege verification
    privileged = false;
    if(User.Permission === "admin" || User.Name === DiscussionBoard.PostList[PostId].Author)
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
        DiscussionBoard.PushToJSON();
        return true;
    }
    else {
        // if its a comment
        let parentThreadId = DiscussionBoard.PostList[PostId].ParentId;
        let arr = DiscussionBoard.PostList[DiscussionBoard.PostList[PostId].ParentId].Replies;
        arr = arr.filter(e => e !== PostId);
        DiscussionBoard.PostList[DiscussionBoard.PostList[PostId].ParentId].Replies = arr;
        delete DiscussionBoard.PostList[PostId];
        DiscussionBoard.PushToJSON();
        return parentThreadId;
    }
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

function SortByTime(DiscussionBoard)  {
    DiscussionBoard.refresh();
    let tempArr = [];
    for(var post in DiscussionBoard.PostList) {
        tempArr.push([post, DiscussionBoard.PostList[post]]);
    }

    tempArr.sort(function(a, b){return a[1].TimeStamp - b[1].TimeStamp});

    let sorted = {}
    tempArr.forEach(function(elem){
        sorted[elem[0]] = elem[1];
    });
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
        let id = ToggleEndorseStatus(db, msg.Id);
        io.emit('ToggleEndorseStatus', GetNestedThread(db, id))
    })

    // expects {User: string, IsUpvote: boolean, PostId: string}
    socket.on('Vote', (msg) => {
        let id = Vote(db, msg.User, msg.IsUpvote, msg.PostId);
        io.emit('Vote', GetNestedThread(db, id));
    })

    // expects {PostId: string, newBody: string, newTitle: string}
    //  **if it is a comment and not a thread set newTitle = null**
    socket.on('EditPost', (msg) => {
        let id = EditPost(db, msg.PostId, msg.newBody, msg.NewTitle);
        io.emit('EditPost', GetNestedThread(db, id));
    })

    // expects {User: string, PostId: string}
    // sending user as "admin" will allow deletion of anything-
    socket.on('DeletePost', (msg) => {
        let id = DeletePost(db, msg.User, msg.PostId);
        if(id == true) {
            io.emit(('DeletePost'), true);
        }
        else if(id == "Invalid Privileges") {
            io.emit(('DeletePost'), "Invalid Privileges");
        }
        else {
            io.emit(('DeletePost'), GetNestedThread(db, id));
        }
    })

  });

server.listen(3000, () => {
  console.log('listening on *:3000');
  console.log('http://localhost:3000');
});
