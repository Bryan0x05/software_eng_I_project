const fs = require('fs');
const { arrayBuffer } = require('stream/consumers');

function LoadThreadsFromJSON()
{
    return JSON.parse(fs.readFileSync("./DiscussionBoard.json", 'utf8'));
}

class DiscussionBoard
{
    constructor()
    {
        this.PostList = LoadThreadsFromJSON();
    }

    refresh()
    {
        this.PostList = LoadThreadsFromJSON();
    }

    print()
    {
        console.log(this.PostList);
    }

    PushToJSON()
    {
        fs.writeFileSync("./DiscussionBoard.json", JSON.stringify(this.PostList));
    }
}

class Thread
{
    constructor(Author, Title, Body, Tag)
    {
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

class Comment
{
    constructor(Author, Body)
    {
        this.Author = Author;
        this.Body = Body;
        this.TimeStamp = Date.now();
        this.Id = "" + this.Author + "_" + this.TimeStamp;
        this.Upvoters = [];
        this.Downvoters = [];
        this.Edited = false;
        this.Endorsed = false;
        this.Replies = [];
    }
}

// Create a new thread and add it to the json database.
function CreateThread(DiscussionBoard, Author, Body, Tag)
{
    DiscussionBoard.refresh();
    let newThread = new Thread(Author, Title, Body, Tag);
    // add new thread to post list
    DiscussionBoard.PostList[newThread.Id] = newThread;
    // push to json database
    DiscussionBoard.PushToJSON();
}

// Create a new reply to a comment or thread
// and add it to the json database.
function CreateReply(DiscussionBoard, ParentId, Author, Body)
{
    DiscussionBoard.refresh();
    let newReply = new Comment(Author, Body);
    // add new comment to discussion board
    DiscussionBoard.PostList[newReply.Id] = newReply;
    // add id to replies list of parent
    DiscussionBoard.PostList[ParentId].Replies.push(newReply.Id)
    // push to json
    DiscussionBoard.PushToJSON();

    return newReply;
}

// Toggle the endorsement status of a post
// and update the json database.
function ToggleEndorseStatus(DiscussionBoard, PostId)
{
    DiscussionBoard.refresh()
    DiscussionBoard.PostList[PostId].Endorsed = !DiscussionBoard.PostList[PostId].Endorsed;
    DiscussionBoard.PushToJSON();
}

// Upvote or Downvote a Post
// User is the displayname of the upvoter.
// IsUpvote = true if upvoting, false if downvoting.
function Vote(DiscussionBoard, User, IsUpvote, PostId)
{
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
function EditPost(DiscussionBoard, PostId, newBody, newTitle = null)
{
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

function DeletePost(DiscussionBoard, User, PostId)
{
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

    // delete all children of this post
    for(let j = 0; j < DiscussionBoard.PostList[PostId].Replies.length; j++)
    {
        DeletePost(DiscussionBoard, "admin", DiscussionBoard.PostList[PostId].Replies[j]);
    }
    
    // remove all references of this post in other posts reply lists.
    let keys = Object.keys(DiscussionBoard.PostList);
    for(let i = 0; i < keys.length; i++)
    {
        if(DiscussionBoard.PostList[keys[i]].Replies.includes(PostId))
        {
            // remove from replies array
            DiscussionBoard.PostList[keys[i]].Replies.splice(DiscussionBoard.PostList[keys[i]].Replies.indexOf(PostId), 1);
        }
    }

    delete DiscussionBoard.PostList[PostId];
    DiscussionBoard.PushToJSON();
}

function GetNestedThread(DiscussionBoard, PostId)
{
    DiscussionBoard.refresh();
    let parent = DiscussionBoard.PostList[PostId];
    for(let i = 0; i < parent.Replies.length; ++i)
    {
        parent.Replies[i] = GetNestedThread(db, parent.Replies[i]);
    }
    return parent;
}

// todo - function to sort nested threads/top level threads by timestamp
       // function returning the list of top level threads

// todo - implement tag creation and management (maybe another json file with a list)
// todo - implement user management, keeping track of users and their level of privilege

// This loads the current state of the json file into a discussion board object.
let db = new DiscussionBoard();

// testing functions
//ToggleEndorseStatus(db, "alex_1669611033378");
//Vote(db, "test_user", true, "alex_1669611033378");
//let t1 = CreateReply(db, "alex_1669611033378", "aidan", "sick post dude.");
//let t2 = CreateReply(db, t1.Id, "Bryan", "I agree aidan");
//DeletePost(db, "aidan", "aidan_1669674720598");
//DeletePost(db, "aidan", t1.Id);

//db.print();

console.log(GetNestedThread(db, "alex_1669611033378"));
